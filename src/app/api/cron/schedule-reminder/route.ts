/**
 * 일정 시작 전 서버 Push 알림 CRON
 *
 * 5분 간격으로 실행. 앞으로 10분 이내 시작하는 일정을 찾아 push 발송.
 * 앱이 꺼져 있어도 알림이 감.
 *
 * - schedules 테이블에서 오늘 일정 중 start_time이 현재~10분 후인 것 조회
 * - 이미 발송한 일정은 user_kv_store에 기록하여 중복 방지
 * - completed/skipped 일정은 제외
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendBulkPushNotifications } from '@/lib/pushService';
import { appendChatMessage } from '@/lib/chatHistoryService';
import { withCron } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import { FOCUS_KEYWORDS } from '@/lib/constants';

/** 집중 모드 대상 일정인지 판별 */
function isFocusEligible(title: string): boolean {
    const lower = title.toLowerCase();
    if (isSleepSchedule(lower)) return false; // 취침은 집중 모드 대상 아님
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

    // 현재 KST 시간 (HH:mm)
    const nowMinutes = kst.getHours() * 60 + kst.getMinutes();
    // 10분 후까지의 일정
    const targetMinutes = nowMinutes + 10;

    const nowTime = `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`;
    const targetTime = `${String(Math.floor(targetMinutes / 60)).padStart(2, '0')}:${String(targetMinutes % 60).padStart(2, '0')}`;

    // 오늘 일정 중 start_time이 현재~10분 후이고, 완료/스킵되지 않은 것 조회
    const { data: schedules, error } = await supabaseAdmin
        .from('schedules')
        .select('id, user_id, title, start_time, date')
        .eq('date', todayStr)
        .eq('completed', false)
        .eq('skipped', false)
        .gt('start_time', nowTime)
        .lte('start_time', targetTime);

    if (error) {
        logger.error('[ScheduleReminder] Query error:', error);
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    if (!schedules || schedules.length === 0) {
        return NextResponse.json({ message: 'No upcoming schedules', sent: 0 });
    }

    // user_id → email 매핑
    const userIds = [...new Set(schedules.map(s => s.user_id))];
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .in('id', userIds);

    if (!users || users.length === 0) {
        return NextResponse.json({ message: 'No users found', sent: 0 });
    }

    const userMap = new Map(users.map(u => [u.id, u.email]));

    // 이미 발송한 일정 ID 조회 (중복 방지)
    const sentKey = `schedule_reminder_sent_${todayStr}`;
    const sentPromises = userIds.map(uid => {
        const email = userMap.get(uid);
        if (!email) return null;
        return supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', email)
            .eq('key', sentKey)
            .maybeSingle()
            .then(({ data }) => ({ email, sentIds: (data?.value as string[]) || [] }));
    });

    const sentResults = (await Promise.all(sentPromises)).filter(Boolean) as Array<{ email: string; sentIds: string[] }>;
    const sentMap = new Map(sentResults.map(r => [r.email, new Set(r.sentIds)]));

    // 발송 대상 필터링
    const notifications: Array<{ userEmail: string; title: string; body: string; data?: Record<string, any>; channelId?: string }> = [];
    const newSentMap = new Map<string, string[]>();

    for (const schedule of schedules) {
        const email = userMap.get(schedule.user_id);
        if (!email) continue;

        const alreadySent = sentMap.get(email);
        if (alreadySent?.has(schedule.id)) continue;

        // 시작까지 남은 분 계산
        const [sh, sm] = schedule.start_time.split(':').map(Number);
        const diffMin = (sh * 60 + sm) - nowMinutes;

        const focusEligible = isFocusEligible(schedule.title);
        const sleepEligible = isSleepSchedule(schedule.title);

        notifications.push({
            userEmail: email,
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
        const existing = newSentMap.get(email) || [...(sentMap.get(email) || [])];
        existing.push(schedule.id);
        newSentMap.set(email, existing);
    }

    if (notifications.length === 0) {
        return NextResponse.json({ message: 'All already sent', sent: 0 });
    }

    // 푸시 발송
    const result = await sendBulkPushNotifications(notifications);

    // 채팅 히스토리에도 저장 (앱이 꺼져있어도 채팅에 표시)
    for (const notif of notifications) {
        const isFocus = notif.data?.focusEligible;
        const isSleep = notif.data?.sleepEligible;

        let content: string;
        let proactiveData: Record<string, any> | undefined;

        if (isSleep) {
            content = `🌙 취침 시간이에요\n"${notif.data?.scheduleTitle}" 일정이 곧 시작돼요.\n취침 모드를 켜서 수면 시간을 기록해보세요.`;
            proactiveData = {
                notificationId: `sleep-${notif.data?.scheduleId}`,
                notificationType: 'sleep_prompt',
                actionType: 'start_wind_down',
                actionPayload: {
                    scheduleText: notif.data?.scheduleTitle,
                },
            };
        } else if (isFocus) {
            content = `${notif.title}\n"${notif.data?.scheduleTitle}" 일정이 곧 시작돼요! 🎯\n집중 모드를 켜면 더 효율적으로 할 수 있어요.`;
            proactiveData = {
                notificationId: `focus-${notif.data?.scheduleId}`,
                notificationType: 'focus_prompt',
                actionType: 'start_focus_mode',
                actionPayload: {
                    scheduleText: notif.data?.scheduleTitle,
                    focusDuration: 45,
                },
            };
        } else {
            content = `${notif.title}\n${notif.body}`;
        }

        appendChatMessage(notif.userEmail, {
            id: `schedule_reminder-${notif.data?.scheduleId}-${Date.now()}`,
            role: 'assistant',
            content,
            timestamp: new Date().toISOString(),
            type: 'proactive',
            ...(proactiveData && { proactiveData }),
        }, todayStr).catch(() => {});
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
