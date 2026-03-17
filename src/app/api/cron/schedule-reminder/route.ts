/**
 * 일정 시작/종료 서버 Push 알림 CRON
 *
 * 5분 간격으로 실행.
 * 1) 앞으로 10분 이내 시작하는 일정 → "곧 시작" push
 * 2) 지난 5분 이내 종료된 일정 → "종료" push
 * 앱이 꺼져 있어도 알림이 감.
 *
 * - users.profile.customGoals에서 오늘 일정 중 해당 시간대 조회
 * - 이미 발송한 일정은 user_kv_store에 기록하여 중복 방지
 * - completed/skipped 일정은 제외
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendBulkPushNotifications } from '@/lib/pushService';
import { appendChatMessage } from '@/lib/chatHistoryService';
import { saveProactiveNotification } from '@/lib/proactiveNotificationService';
import { withCron } from '@/lib/api-handler';
import { withCronLogging } from '@/lib/cron-logger';
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

export const GET = withCron(withCronLogging('schedule-reminder', async (_request: NextRequest) => {
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

    // 오늘 일정 추출 (customGoals + schedules 테이블)
    interface ScheduleItem {
        id: string;
        title: string;
        startTime: string;
        endTime?: string;
        userEmail: string;
    }

    const todaySchedules: ScheduleItem[] = [];      // 10분 이내 시작 예정 (곧 시작 알림)
    const startedSchedules: ScheduleItem[] = [];    // 지금 막 시작된 일정 (시작 알림)
    const endedSchedules: ScheduleItem[] = [];
    const seenIds = new Set<string>();
    /** 같은 유저+제목+시간 조합 중복 방지 (customGoals와 schedules 테이블 dual-write 대응) */
    const seenUpcomingKeys = new Set<string>();
    const seenStartedKeys = new Set<string>();
    const seenEndKeys = new Set<string>();

    /** 일정 하나를 시작/종료 알림 대상인지 판별하여 추가 */
    function checkSchedule(id: string, title: string, startTime: string, endTime: string | undefined, userEmail: string) {
        if (seenIds.has(`${userEmail}:${id}`)) return;
        seenIds.add(`${userEmail}:${id}`);

        const [sh, sm] = startTime.split(':').map(Number);
        if (isNaN(sh) || isNaN(sm)) return;
        const scheduleMinutes = sh * 60 + sm;

        // 곧 시작 알림: 1분 초과 ~ 10분 이내 (nowMinutes < scheduleMinutes <= targetMinutes)
        if (scheduleMinutes > nowMinutes && scheduleMinutes <= targetMinutes) {
            const upcomingKey = `${userEmail}:${title}:${startTime}`;
            if (!seenUpcomingKeys.has(upcomingKey)) {
                seenUpcomingKeys.add(upcomingKey);
                todaySchedules.push({ id, title, startTime, endTime, userEmail });
            }
        }

        // 시작 알림: 지난 5분 이내에 시작된 일정 (nowMinutes - 5 < scheduleMinutes <= nowMinutes)
        if (scheduleMinutes > (nowMinutes - 5) && scheduleMinutes <= nowMinutes) {
            const startedKey = `${userEmail}:${title}:${startTime}`;
            if (!seenStartedKeys.has(startedKey)) {
                seenStartedKeys.add(startedKey);
                startedSchedules.push({ id, title, startTime, endTime, userEmail });
            }
        }

        if (endTime) {
            const [eh, em] = endTime.split(':').map(Number);
            if (!isNaN(eh) && !isNaN(em)) {
                const endMinutes = eh * 60 + em;
                if (endMinutes > (nowMinutes - 5) && endMinutes <= nowMinutes) {
                    // 같은 유저+제목+종료시간 조합은 한 번만 (dual-write 중복 방지)
                    const endKey = `${userEmail}:${title}:${endTime}`;
                    if (!seenEndKeys.has(endKey)) {
                        seenEndKeys.add(endKey);
                        endedSchedules.push({ id, title, startTime, endTime, userEmail });
                    }
                }
            }
        }
    }

    // 1) customGoals 기반
    for (const user of users) {
        const profile = user.profile as any;
        const customGoals = profile?.customGoals;
        if (!Array.isArray(customGoals)) continue;

        for (const goal of customGoals) {
            if (goal.completed || goal.skipped) continue;
            if (!goal.startTime) continue;

            let isToday = false;
            if (goal.specificDate === todayStr) {
                isToday = true;
            } else if (goal.daysOfWeek && Array.isArray(goal.daysOfWeek) && goal.daysOfWeek.includes(dayOfWeek)) {
                if (goal.startDate && todayStr < goal.startDate) continue;
                if (goal.endDate && todayStr > goal.endDate) continue;
                isToday = true;
            }
            if (!isToday) continue;

            checkSchedule(goal.id, goal.text || '', goal.startTime, goal.endTime, user.email);
        }
    }

    // 2) schedules 테이블 기반 (dual-write로 저장된 일정)
    const { data: dbSchedules } = await supabaseAdmin
        .from('schedules')
        .select('id, user_email, text, start_time, end_time, completed, skipped, specific_date, days_of_week, start_date, end_date')
        .eq('completed', false)
        .not('start_time', 'is', null);

    if (dbSchedules) {
        for (const s of dbSchedules) {
            if (s.skipped) continue;
            const st = typeof s.start_time === 'string' ? s.start_time : '';
            if (!st) continue;

            // HH:MM 추출 (ISO datetime이면 시간 부분만)
            const startHHMM = st.includes('T') ? st.split('T')[1]?.substring(0, 5) : st.substring(0, 5);
            const endRaw = typeof s.end_time === 'string' ? s.end_time : undefined;
            const endHHMM = endRaw ? (endRaw.includes('T') ? endRaw.split('T')[1]?.substring(0, 5) : endRaw.substring(0, 5)) : undefined;

            let isToday = false;
            if (s.specific_date === todayStr) {
                isToday = true;
            } else if (s.days_of_week && Array.isArray(s.days_of_week) && s.days_of_week.includes(dayOfWeek)) {
                if (s.start_date && todayStr < s.start_date) continue;
                if (s.end_date && todayStr > s.end_date) continue;
                isToday = true;
            }
            if (!isToday) continue;

            checkSchedule(s.id, s.text || '', startHHMM, endHHMM, s.user_email);
        }
    }

    logger.info(`[ScheduleReminder] ${todayStr} ${nowTime} | users: ${users.length} | upcoming: ${todaySchedules.length} | started: ${startedSchedules.length} | ended: ${endedSchedules.length} | window: ${nowMinutes}-${targetMinutes}min`);

    if (todaySchedules.length === 0 && startedSchedules.length === 0 && endedSchedules.length === 0) {
        return NextResponse.json({ message: 'No upcoming, started, or ended schedules', sent: 0 });
    }

    // 이미 발송한 일정 ID 조회 (중복 방지)
    const sentKey = `schedule_reminder_sent_${todayStr}`;
    const uniqueEmails = [...new Set([...todaySchedules, ...startedSchedules].map(s => s.userEmail))];

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

    // ── 시작 알림 처리 ── (일정이 막 시작됨)
    const startSentKey = `schedule_start_sent_${todayStr}`;
    const startUniqueEmails = [...new Set(startedSchedules.map(s => s.userEmail))];

    const startSentPromises = startUniqueEmails.map(email =>
        supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', email)
            .eq('key', startSentKey)
            .maybeSingle()
            .then(({ data }) => ({ email, sentIds: (data?.value as string[]) || [] }))
    );

    const startSentResults = await Promise.all(startSentPromises);
    const startSentMap = new Map(startSentResults.map(r => [r.email, new Set(r.sentIds)]));
    const newStartSentMap = new Map<string, string[]>();

    for (const schedule of startedSchedules) {
        const alreadySent = startSentMap.get(schedule.userEmail);
        if (alreadySent?.has(schedule.id)) continue;

        const focusEligible = isFocusEligible(schedule.title);
        const sleepEligible = isSleepSchedule(schedule.title);

        notifications.push({
            userEmail: schedule.userEmail,
            title: sleepEligible ? '🌙 취침 시간이에요' : '🚀 일정이 시작됐어요!',
            body: sleepEligible
                ? `"${schedule.title}" 시간이에요. 취침 모드를 켜볼까요?`
                : focusEligible
                ? `"${schedule.title}" 지금 시작! 🎯 집중 모드를 켜볼까요?`
                : `"${schedule.title}" 지금 시작이에요!`,
            data: {
                type: 'schedule_start',
                scheduleId: schedule.id,
                deepLink: 'fieri://dashboard',
                focusEligible,
                sleepEligible,
                scheduleTitle: schedule.title,
            },
            channelId: 'schedules',
        });

        const existing = newStartSentMap.get(schedule.userEmail) || [...(startSentMap.get(schedule.userEmail) || [])];
        existing.push(schedule.id);
        newStartSentMap.set(schedule.userEmail, existing);
    }

    // ── 종료 알림 처리 ──
    const endSentKey = `schedule_end_sent_${todayStr}`;
    const endUniqueEmails = [...new Set(endedSchedules.map(s => s.userEmail))];

    const endSentPromises = endUniqueEmails.map(email =>
        supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', email)
            .eq('key', endSentKey)
            .maybeSingle()
            .then(({ data }) => ({ email, sentIds: (data?.value as string[]) || [] }))
    );

    const endSentResults = await Promise.all(endSentPromises);
    const endSentMap = new Map(endSentResults.map(r => [r.email, new Set(r.sentIds)]));
    const newEndSentMap = new Map<string, string[]>();

    for (const schedule of endedSchedules) {
        const alreadySent = endSentMap.get(schedule.userEmail);
        if (alreadySent?.has(schedule.id)) continue;

        notifications.push({
            userEmail: schedule.userEmail,
            title: '⏰ 일정 종료',
            body: `"${schedule.title}" 시간이 끝났어요. 완료하셨나요?`,
            data: {
                type: 'schedule_end',
                scheduleId: schedule.id,
                deepLink: 'fieri://dashboard',
                scheduleTitle: schedule.title,
            },
            channelId: 'schedules',
        });

        const existing = newEndSentMap.get(schedule.userEmail) || [...(endSentMap.get(schedule.userEmail) || [])];
        existing.push(schedule.id);
        newEndSentMap.set(schedule.userEmail, existing);
    }

    if (notifications.length === 0) {
        return NextResponse.json({ message: 'All already sent', sent: 0 });
    }

    // 푸시 발송
    const result = await sendBulkPushNotifications(notifications);

    // jarvis_notifications에 저장 → 모바일 폴링으로 확실히 수신 + 채팅 히스토리에도 저장
    for (const notif of notifications) {
        const isEnd = notif.data?.type === 'schedule_end';
        const isStart = notif.data?.type === 'schedule_start';
        const isFocus = notif.data?.focusEligible;
        const isSleep = notif.data?.sleepEligible;

        let content: string;
        let proactiveData: Record<string, any> | undefined;
        let actionType: string | undefined;
        let actionPayload: Record<string, unknown> | undefined;

        if (isEnd) {
            content = `⏰ 일정 종료\n"${notif.data?.scheduleTitle}" 시간이 끝났어요. 완료하셨나요?`;
            actionType = 'mark_schedule_done';
            actionPayload = { scheduleId: notif.data?.scheduleId, scheduleTitle: notif.data?.scheduleTitle };
            proactiveData = {
                notificationId: `schedule-end-${notif.data?.scheduleId}`,
                notificationType: 'schedule_end',
                actionType,
                actionPayload,
            };
        } else if (isStart) {
            if (isSleep) {
                content = `🌙 취침 시간이에요\n"${notif.data?.scheduleTitle}" 시간이에요.\n취침 모드를 켜서 수면 시간을 기록해보세요.`;
                actionType = 'start_wind_down';
                actionPayload = { scheduleText: notif.data?.scheduleTitle };
                proactiveData = { notificationId: `sleep-start-${notif.data?.scheduleId}`, notificationType: 'sleep_prompt', actionType, actionPayload };
            } else if (isFocus) {
                content = `🚀 일정이 시작됐어요!\n"${notif.data?.scheduleTitle}" 지금 시작! 🎯\n집중 모드를 켜면 더 효율적으로 할 수 있어요.`;
                actionType = 'start_focus_mode';
                actionPayload = { scheduleText: notif.data?.scheduleTitle, focusDuration: 45 };
                proactiveData = { notificationId: `focus-start-${notif.data?.scheduleId}`, notificationType: 'focus_prompt', actionType, actionPayload };
            } else {
                content = `🚀 일정이 시작됐어요!\n"${notif.data?.scheduleTitle}" 지금 시작이에요!`;
            }
        } else if (isSleep) {
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

        const notifId = isEnd
            ? `schedule-end-${notif.data?.scheduleId}`
            : isStart
            ? `schedule-start-${notif.data?.scheduleId}`
            : `schedule-reminder-${notif.data?.scheduleId}`;

        // jarvis_notifications에 저장
        saveProactiveNotification(notif.userEmail, {
            id: notifId,
            type: isEnd ? 'schedule_end' : isStart ? 'schedule_start' : 'schedule_reminder',
            priority: 'high',
            title: notif.title,
            message: notif.body,
            actionType,
            actionPayload,
        }).catch(e => logger.error(`[ScheduleReminder] saveNotification failed for ${notif.userEmail}:`, e));

        // 채팅 히스토리에도 직접 저장
        appendChatMessage(notif.userEmail, {
            id: `proactive-${notifId}`,
            role: 'assistant',
            content: `${notif.title}\n\n${notif.body}`,
            timestamp: new Date().toISOString(),
            type: 'proactive',
            ...(proactiveData && { proactiveData }),
        }, todayStr).catch(e => logger.error(`[ScheduleReminder] appendChatMessage failed for ${notif.userEmail}:`, e));
    }

    // 발송 기록 저장 (중복 방지) — 곧 시작 알림
    const savePromises = Array.from(newSentMap.entries()).map(([email, ids]) =>
        supabaseAdmin.from('user_kv_store').upsert({
            user_email: email,
            key: sentKey,
            value: ids,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email,key' })
    );
    // 발송 기록 저장 (중복 방지) — 시작 알림
    const startSavePromises = Array.from(newStartSentMap.entries()).map(([email, ids]) =>
        supabaseAdmin.from('user_kv_store').upsert({
            user_email: email,
            key: startSentKey,
            value: ids,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email,key' })
    );
    // 발송 기록 저장 (중복 방지) — 종료 알림
    const endSavePromises = Array.from(newEndSentMap.entries()).map(([email, ids]) =>
        supabaseAdmin.from('user_kv_store').upsert({
            user_email: email,
            key: endSentKey,
            value: ids,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email,key' })
    );
    await Promise.all([...savePromises, ...startSavePromises, ...endSavePromises]);

    const upcomingCount = notifications.filter(n => n.data?.type === 'schedule_reminder').length;
    const startCount = notifications.filter(n => n.data?.type === 'schedule_start').length;
    const endCount = notifications.filter(n => n.data?.type === 'schedule_end').length;
    logger.info(`[ScheduleReminder] Sent ${result.sent} (upcoming: ${upcomingCount}, start: ${startCount}, end: ${endCount}), failed ${result.failed}`);

    return NextResponse.json({
        success: true,
        date: todayStr,
        time: nowTime,
        sent: result.sent,
        failed: result.failed,
        total: notifications.length,
        upcomingReminders: upcomingCount,
        startReminders: startCount,
        endReminders: endCount,
    });
}));
