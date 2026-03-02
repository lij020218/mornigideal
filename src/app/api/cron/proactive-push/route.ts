/**
 * 통합 선제적 알림 푸시 CRON
 *
 * 2시간 간격 (KST 7, 9, 11, 13, 15, 17, 19, 21시)
 * 앱을 열지 않아도 선제적 알림을 푸시로 발송
 *
 * 흐름:
 * 1. 전체 사용자 순회
 * 2. getUserContext → generateProactiveNotifications
 * 3. 이미 표시/해제된 알림 필터링
 * 4. 에스컬레이션 전략 적용 (pushAllowed 확인)
 * 5. 푸시 알림 전송 + jarvis_notifications 저장
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
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withCron } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import { getUserPlan } from '@/lib/user-plan';
import { LIMITS } from '@/lib/constants';

export const maxDuration = 120;

export const GET = withCron(async (_request: NextRequest) => {
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

    for (const user of users) {
        try {
            const [context, userPlan] = await Promise.all([
                getUserContext(user.email),
                getUserPlan(user.email),
            ]);

            if (!context) {
                skipped++;
                continue;
            }
            context.planType = userPlan.plan;

            // 알림 생성
            const notifications = await generateProactiveNotifications(context);

            if (notifications.length === 0) {
                skipped++;
                continue;
            }

            // 이미 해제된 알림 필터링
            const { data: dismissedData } = await supabaseAdmin
                .from('user_kv_store')
                .select('value')
                .eq('user_email', user.email)
                .eq('key', 'dismissed_proactive_notifications')
                .maybeSingle();

            const dismissedIds: string[] = dismissedData?.value || [];

            // 오늘 이미 표시된 타입/ID 조회
            const [{ data: shownToday }, { data: shownIdsToday }] = await Promise.all([
                supabaseAdmin
                    .from('user_kv_store')
                    .select('value')
                    .eq('user_email', user.email)
                    .eq('key', `proactive_shown_${todayStr}`)
                    .maybeSingle(),
                supabaseAdmin
                    .from('user_kv_store')
                    .select('value')
                    .eq('user_email', user.email)
                    .eq('key', `proactive_shown_ids_${todayStr}`)
                    .maybeSingle(),
            ]);

            const shownTypes: string[] = shownToday?.value || [];
            const shownIds: string[] = shownIdsToday?.value || [];

            // 만료/해제/이미표시 필터링
            const typeSingletons = ['morning_briefing', 'goal_nudge', 'urgent_alert', 'lifestyle_recommend'];
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

            if (filtered.length === 0) {
                skipped++;
                continue;
            }

            // 에스컬레이션 필터 — pushAllowed인 것만 발송
            const pushable: ProactiveNotification[] = [];
            for (const notif of filtered) {
                const decision = await getEscalationDecision(
                    user.email,
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

            if (pushable.length === 0) {
                skipped++;
                continue;
            }

            // 플랜별 일일 한도
            const dailyLimit = LIMITS.PROACTIVE_DAILY[userPlan.plan] ?? LIMITS.PROACTIVE_DAILY.free;
            const countKey = `proactive_count_${todayStr}`;
            const { data: countData } = await supabaseAdmin
                .from('user_kv_store')
                .select('value')
                .eq('user_email', user.email)
                .eq('key', countKey)
                .maybeSingle();

            const shownCount: number = countData?.value ?? 0;
            const remaining = Math.max(0, dailyLimit - shownCount);
            if (remaining === 0) {
                skipped++;
                continue;
            }

            // 우선순위 정렬 후 한도 적용
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            pushable.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
            const toSend = pushable.slice(0, Math.min(remaining, 3)); // 한 번에 최대 3개

            let userPushed = 0;
            for (const notif of toSend) {
                // 푸시 알림 전송
                const sent = await sendPushNotification(user.email, {
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

                if (sent) {
                    userPushed++;

                    // jarvis_notifications에 저장 (앱 내에서도 확인 가능)
                    await saveProactiveNotification(user.email, notif);
                }
            }

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
                        user_email: user.email,
                        key: `proactive_shown_${todayStr}`,
                        value: newShownTypes,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_email,key' }),
                    supabaseAdmin.from('user_kv_store').upsert({
                        user_email: user.email,
                        key: `proactive_shown_ids_${todayStr}`,
                        value: newShownIds,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_email,key' }),
                    supabaseAdmin.from('user_kv_store').upsert({
                        user_email: user.email,
                        key: countKey,
                        value: shownCount + userPushed,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_email,key' }),
                ]);

                pushed += userPushed;
            }
        } catch (error) {
            logger.error(`[ProactivePush] Error for ${user.email}:`, error instanceof Error ? error.message : error);
            errors++;
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
});
