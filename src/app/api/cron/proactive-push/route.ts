/**
 * 통합 선제적 알림 푸시 CRON
 *
 * 2시간 간격 (KST 7, 9, 11, 13, 15, 17, 19, 21시)
 * 앱을 열지 않아도 선제적 알림을 푸시로 발송
 *
 * 흐름:
 * 1. 전체 사용자 조회
 * 2. 5명씩 배치 병렬 처리
 * 3. getUserContext → generateProactiveNotifications
 * 4. 이미 표시/해제된 알림 필터링
 * 5. 에스컬레이션 전략 적용 (pushAllowed 확인)
 * 6. 푸시 알림 전송 + jarvis_notifications 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    generateProactiveNotifications,
    getUserContext,
    saveProactiveNotification,
    type ProactiveNotification,
} from '@/lib/proactiveNotificationService';
import { getEscalationDecision, applyEscalation } from '@/lib/escalationService';
import { sendPushNotification } from '@/lib/pushService';
import { appendChatMessage } from '@/lib/chatHistoryService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withCron } from '@/lib/api-handler';
import { withCronLogging } from '@/lib/cron-logger';
import { logger } from '@/lib/logger';
import { getUserPlan } from '@/lib/user-plan';

export const maxDuration = 120;

const BATCH_SIZE = 5;
const typeSingletons = ['morning_briefing', 'trend_briefing', 'goal_nudge', 'urgent_alert', 'lifestyle_recommend'];

/** 유저 1명 처리 — 알림 생성 → 필터 → 푸시 → 저장 */
async function processUser(
    email: string,
    todayStr: string,
    now: Date,
): Promise<'pushed' | 'skipped' | 'error'> {
    const [context, userPlan] = await Promise.all([
        getUserContext(email),
        getUserPlan(email),
    ]);

    if (!context) return 'skipped';
    context.planType = userPlan.plan;

    // 알림 생성
    const notifications = await generateProactiveNotifications(context);
    if (notifications.length === 0) return 'skipped';

    // dismissed + shown 상태 병렬 조회
    const [{ data: dismissedData }, { data: shownToday }, { data: shownIdsToday }] = await Promise.all([
        supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', email)
            .eq('key', 'dismissed_proactive_notifications')
            .maybeSingle(),
        supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', email)
            .eq('key', `proactive_shown_${todayStr}`)
            .maybeSingle(),
        supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', email)
            .eq('key', `proactive_shown_ids_${todayStr}`)
            .maybeSingle(),
    ]);

    const dismissedIds: string[] = dismissedData?.value || [];
    const shownTypes: string[] = shownToday?.value || [];
    const shownIds: string[] = shownIdsToday?.value || [];

    // 만료/해제/이미표시 필터링
    const filtered = notifications.filter(n => {
        if (dismissedIds.includes(n.id)) return false;
        if (n.expiresAt && new Date(n.expiresAt) < now) return false;
        if (typeSingletons.includes(n.type)) {
            if (shownTypes.includes(n.type)) return false;
        } else {
            if (shownIds.includes(n.id)) return false;
        }
        return true;
    });

    if (filtered.length === 0) return 'skipped';

    // 에스컬레이션 필터 — pushAllowed인 것만 발송
    // 트렌드 브리핑, 기분 체크인은 에스컬레이션 bypass (억제되면 안 됨)
    const pushable: ProactiveNotification[] = [];
    for (const notif of filtered) {
        if (notif.type === 'daily_wrap' || notif.id.startsWith('trend-reminder-') || notif.id.startsWith('youtube-recommend-') || notif.id.startsWith('mood-reminder-')) {
            pushable.push(notif);
            continue;
        }
        const decision = await getEscalationDecision(
            email,
            notif.type,
            notif.priority,
            {
                scheduleText: notif.actionPayload?.scheduleText as string | undefined,
                deadlineHours: notif.actionPayload?.deadlineHours as number | undefined,
            }
        );
        if (!decision.shouldDeliver || !decision.pushAllowed) continue;

        const result = applyEscalation(notif, decision);
        if (result) pushable.push(result);
    }

    if (pushable.length === 0) return 'skipped';

    // daily_wrap은 반드시 포함 (displayOrder가 높아서 밀리는 문제 방지)
    const mustSendTypes = ['daily_wrap', 'morning_briefing'];
    const mustSend = pushable.filter(n => mustSendTypes.includes(n.type));
    const rest = pushable.filter(n => !mustSendTypes.includes(n.type));

    // 나머지는 displayOrder(시간순) 정렬
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    rest.sort((a, b) => {
        const orderDiff = (a.displayOrder ?? 150) - (b.displayOrder ?? 150);
        if (orderDiff !== 0) return orderDiff;
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    });

    // 필수 알림 + 나머지에서 최대 5개
    const toSend = [...mustSend, ...rest].slice(0, 5);

    // 푸시 + 저장 + 채팅 히스토리를 알림별 병렬 처리
    let userPushed = 0;
    await Promise.all(toSend.map(async (notif) => {
        const sent = await sendPushNotification(email, {
            title: notif.title,
            body: notif.message.length > 100
                ? notif.message.slice(0, 97) + '...'
                : notif.message,
            data: {
                type: notif.type,
                deepLink: 'fieri://dashboard',
                notificationId: notif.id,
                actionType: notif.actionType,
            },
        });

        if (sent) userPushed++;

        // jarvis_notifications + 채팅 히스토리 병렬 저장
        await Promise.all([
            saveProactiveNotification(email, notif).catch(e =>
                logger.error(`[ProactivePush] saveNotification failed for ${email}:`, e)
            ),
            appendChatMessage(email, {
                id: `proactive-${notif.id}`,
                role: 'assistant',
                content: notif.type === 'daily_wrap'
                    ? notif.message
                    : `${notif.title}\n\n${notif.message}`,
                timestamp: new Date().toISOString(),
                type: 'proactive',
                ...(notif.actionType && {
                    proactiveData: {
                        notificationId: notif.id,
                        notificationType: notif.type,
                        actionType: notif.actionType,
                        actionPayload: notif.actionPayload,
                    },
                }),
            }, todayStr).catch(e =>
                logger.error(`[ProactivePush] appendChatMessage failed for ${email}:`, e)
            ),
        ]);
    }));

    if (userPushed > 0) {
        // shown 기록 업데이트 (중복 발송 방지)
        const newShownTypes = [...shownTypes];
        const newShownIds = [...shownIds];

        for (const notif of toSend) {
            if (typeSingletons.includes(notif.type) && !newShownTypes.includes(notif.type)) {
                newShownTypes.push(notif.type);
            }
            if (!newShownIds.includes(notif.id)) {
                newShownIds.push(notif.id);
            }
        }

        await Promise.all([
            supabaseAdmin.from('user_kv_store').upsert({
                user_email: email,
                key: `proactive_shown_${todayStr}`,
                value: newShownTypes,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_email,key' }),
            supabaseAdmin.from('user_kv_store').upsert({
                user_email: email,
                key: `proactive_shown_ids_${todayStr}`,
                value: newShownIds,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_email,key' }),
        ]);
    }

    return userPushed > 0 ? 'pushed' : 'skipped';
}

export const GET = withCron(withCronLogging('proactive-push', async (_request: NextRequest) => {
    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const currentHour = kst.getHours();

    // 활동 시간대만 (7시 ~ 22시 KST)
    if (currentHour < 7 || currentHour >= 22) {
        return NextResponse.json({ message: 'Outside active hours', skipped: true });
    }

    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;

    // 전체 사용자 조회
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('email');

    if (!users || users.length === 0) {
        return NextResponse.json({ message: 'No users', processed: 0 });
    }

    let pushed = 0;
    let skipped = 0;
    let errors = 0;

    // 5명씩 배치 병렬 처리 (타임아웃 방지)
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(user => processUser(user.email, todayStr, now))
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                if (result.value === 'pushed') pushed++;
                else if (result.value === 'skipped') skipped++;
                else errors++;
            } else {
                logger.error(`[ProactivePush] Batch error:`, result.reason?.message || result.reason);
                errors++;
            }
        }
    }

    return NextResponse.json({
        success: true,
        date: todayStr,
        hour: currentHour,
        pushed,
        skipped,
        errors,
        total: users.length,
    });
}));
