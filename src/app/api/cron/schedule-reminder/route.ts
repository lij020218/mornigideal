/**
 * 일정 시작 전 서버 Push 알림 CRON
 *
 * 5분 간격으로 실행. 앞으로 10분 이내 시작하는 일정을 찾아 push 발송.
 * 앱이 꺼져 있어도 알림이 감.
 *
 * - users.profile.customGoals에서 오늘 일정 중 startTime이 현재~10분 후인 것 조회
 * - 이미 발송한 일정은 user_kv_store에 기록하여 중복 방지
 * - completed/skipped 일정은 제외
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendBulkPushNotifications } from '@/lib/pushService';
import { appendChatMessage } from '@/lib/chatHistoryService';
import { saveProactiveNotification } from '@/lib/proactiveNotificationService';
import { withCron } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import { FOCUS_KEYWORDS } from '@/lib/constants';

/** 집중 모드 대상 일정인지 판별 */
function isFocusEligible(title: string): boolean {
    const lower = title.toLowerCase();
    if (isSleepSchedule(lower)) return false;
    return FOCUS_KEYWORDS.some(kw => lower.includes(kw))
        || /운동|헬스|요가|필라테스|러닝|조깅|수영|등산|논문|리서치|연구/.test(lower);
}

/** 취침 일정인지 판별 */
function isSleepSchedule(title: string): boolean {
    return /취침|잠|수면|숙면|잠자리|야간|sleep|bedtime/.test(title.toLowerCase());
}

export const maxDuration = 30;

export const GET = withCron(async (_request: NextRequest) => {
    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const currentHour = kst.getHours();

    // 활동 시간대만 (5시 ~ 24시 KST)
    if (currentHour < 5) {
        return NextResponse.json({ message: 'Outside active hours', skipped: true });
    }

    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    const dayOfWeek = kst.getDay();

    // 현재 KST 시간 (분 단위)
    const nowMinutes = kst.getHours() * 60 + kst.getMinutes();
    const targetMinutes = nowMinutes + 10;

    const nowTime = `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`;

    // 모든 유저의 customGoals에서 오늘 일정 추출
    const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, email, profile')
        .not('profile', 'is', null);

    if (usersError) {
        logger.error('[ScheduleReminder] Users query error:', usersError);
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    if (!users || users.length === 0) {
        return NextResponse.json({ message: 'No users', sent: 0 });
    }

    // 오늘 일정 추출 (customGoals 기반)
    interface ScheduleItem {
        id: string;
        title: string;
        startTime: string;
        userEmail: string;
    }

    const todaySchedules: ScheduleItem[] = [];

    for (const user of users) {
        const profile = user.profile as any;
        const customGoals = profile?.customGoals;
        if (!Array.isArray(customGoals)) continue;

        for (const goal of customGoals) {
            if (goal.completed || goal.skipped) continue;
            if (!goal.startTime) continue;

            // 오늘 해당 일정인지 확인
            let isToday = false;
            if (goal.specificDate === todayStr) {
                isToday = true;
            } else if (goal.daysOfWeek && Array.isArray(goal.daysOfWeek) && goal.daysOfWeek.includes(dayOfWeek)) {
                if (goal.startDate && todayStr < goal.startDate) continue;
                if (goal.endDate && todayStr > goal.endDate) continue;
                isToday = true;
            }

            if (!isToday) continue;

            // startTime이 현재~10분 후 범위인지 확인
            const [sh, sm] = goal.startTime.split(':').map(Number);
            if (isNaN(sh) || isNaN(sm)) continue;
            const scheduleMinutes = sh * 60 + sm;

            if (scheduleMinutes > nowMinutes && scheduleMinutes <= targetMinutes) {
                todaySchedules.push({
                    id: goal.id,
                    title: goal.text || '',
                    startTime: goal.startTime,
                    userEmail: user.email,
                });
            }
        }
    }

    if (todaySchedules.length === 0) {
        return NextResponse.json({ message: 'No upcoming schedules', sent: 0 });
    }

    // 이미 발송한 일정 ID 조회 (중복 방지)
    const sentKey = `schedule_reminder_sent_${todayStr}`;
    const uniqueEmails = [...new Set(todaySchedules.map(s => s.userEmail))];

    const sentPromises = uniqueEmails.map(email =>
        supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', email)
            .eq('key', sentKey)
            .maybeSingle()
            .then(({ data }) => ({ email, sentIds: (data?.value as string[]) || [] }))
    );

    const sentResults = await Promise.all(sentPromises);
    const sentMap = new Map(sentResults.map(r => [r.email, new Set(r.sentIds)]));

    // 발송 대상 필터링
    const notifications: Array<{ userEmail: string; title: string; body: string; data?: Record<string, any>; channelId?: string }> = [];
    const newSentMap = new Map<string, string[]>();

    for (const schedule of todaySchedules) {
        const alreadySent = sentMap.get(schedule.userEmail);
        if (alreadySent?.has(schedule.id)) continue;

        // 시작까지 남은 분 계산
        const [sh, sm] = schedule.startTime.split(':').map(Number);
        const diffMin = (sh * 60 + sm) - nowMinutes;

        const focusEligible = isFocusEligible(schedule.title);
        const sleepEligible = isSleepSchedule(schedule.title);

        notifications.push({
            userEmail: schedule.userEmail,
            title: sleepEligible ? '🌙 취침 시간이에요' : '⏰ 곧 일정이 시작돼요',
            body: sleepEligible
                ? `"${schedule.title}" - ${diffMin}분 후. 취침 모드를 켜볼까요?`
                : focusEligible
                ? `"${schedule.title}" - ${diffMin}분 후 시작 🎯 집중 모드를 켜볼까요?`
                : `"${schedule.title}" - ${diffMin}분 후 시작`,
            data: {
                type: 'schedule_reminder',
                scheduleId: schedule.id,
                deepLink: 'fieri://dashboard',
                focusEligible,
                sleepEligible,
                scheduleTitle: schedule.title,
            },
            channelId: 'schedules',
        });

        // 발송 기록 추가
        const existing = newSentMap.get(schedule.userEmail) || [...(sentMap.get(schedule.userEmail) || [])];
        existing.push(schedule.id);
        newSentMap.set(schedule.userEmail, existing);
    }

    if (notifications.length === 0) {
        return NextResponse.json({ message: 'All already sent', sent: 0 });
    }

    // 푸시 발송
    const result = await sendBulkPushNotifications(notifications);

    // jarvis_notifications에 저장 → 모바일 폴링으로 확실히 수신 + 채팅 히스토리에도 저장
    for (const notif of notifications) {
        const isFocus = notif.data?.focusEligible;
        const isSleep = notif.data?.sleepEligible;

        let content: string;
        let proactiveData: Record<string, any> | undefined;
        let actionType: string | undefined;
        let actionPayload: Record<string, unknown> | undefined;

        if (isSleep) {
            content = `🌙 취침 시간이에요\n"${notif.data?.scheduleTitle}" 일정이 곧 시작돼요.\n취침 모드를 켜서 수면 시간을 기록해보세요.`;
            actionType = 'start_wind_down';
            actionPayload = { scheduleText: notif.data?.scheduleTitle };
            proactiveData = {
                notificationId: `sleep-${notif.data?.scheduleId}`,
                notificationType: 'sleep_prompt',
                actionType,
                actionPayload,
            };
        } else if (isFocus) {
            content = `${notif.title}\n"${notif.data?.scheduleTitle}" 일정이 곧 시작돼요! 🎯\n집중 모드를 켜면 더 효율적으로 할 수 있어요.`;
            actionType = 'start_focus_mode';
            actionPayload = { scheduleText: notif.data?.scheduleTitle, focusDuration: 45 };
            proactiveData = {
                notificationId: `focus-${notif.data?.scheduleId}`,
                notificationType: 'focus_prompt',
                actionType,
                actionPayload,
            };
        } else {
            content = `${notif.title}\n${notif.body}`;
        }

        const notifId = `schedule-reminder-${notif.data?.scheduleId}`;

        // jarvis_notifications에 저장 → 앱이 백그라운드여도 폴링으로 채팅에 표시
        saveProactiveNotification(notif.userEmail, {
            id: notifId,
            type: 'schedule_reminder',
            priority: 'high',
            title: notif.title,
            message: notif.body,
            actionType,
            actionPayload,
        }).catch(e => logger.error(`[ScheduleReminder] saveNotification failed for ${notif.userEmail}:`, e));

        // 채팅 히스토리에도 직접 저장
        // ID를 모바일 폴링(checkAndShowProactiveNotifications)에서 만들 ID와 동일하게 맞춤
        appendChatMessage(notif.userEmail, {
            id: `proactive-${notifId}`,
            role: 'assistant',
            content: `**${notif.title}**\n\n${notif.body}`,
            timestamp: new Date().toISOString(),
            type: 'proactive',
            ...(proactiveData && { proactiveData }),
        }, todayStr).catch(e => logger.error(`[ScheduleReminder] appendChatMessage failed for ${notif.userEmail}:`, e));
    }

    // 발송 기록 저장 (중복 방지)
    const savePromises = Array.from(newSentMap.entries()).map(([email, ids]) =>
        supabaseAdmin.from('user_kv_store').upsert({
            user_email: email,
            key: sentKey,
            value: ids,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email,key' })
    );
    await Promise.all(savePromises);

    logger.info(`[ScheduleReminder] Sent ${result.sent}, failed ${result.failed}`);

    return NextResponse.json({
        success: true,
        date: todayStr,
        time: nowTime,
        sent: result.sent,
        failed: result.failed,
        total: notifications.length,
    });
});
