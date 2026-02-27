/**
 * Proactive Notifications API
 *
 * 선제적 알림을 생성하고 반환하는 API
 * GET: 현재 사용자에게 표시할 선제적 알림 조회
 * POST: 알림 확인/해제 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    generateProactiveNotifications,
    getUserContext,
    saveProactiveNotification,
    ProactiveNotification
} from '@/lib/proactiveNotificationService';
import { getEscalationDecision, applyEscalation } from '@/lib/escalationService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import { getUserPlan } from '@/lib/user-plan';
import { LIMITS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, userEmail: string) => {
        // 1. 사용자 컨텍스트 수집 + 플랜 조회 (1회만)
        const [context, userPlan] = await Promise.all([
            getUserContext(userEmail),
            getUserPlan(userEmail),
        ]);
        if (!context) {
            return NextResponse.json({ notifications: [] });
        }
        context.planType = userPlan.plan;

        // 2. 선제적 알림 생성
        const generatedNotifications = await generateProactiveNotifications(context);

        // 3. 이미 해제된 알림 필터링
        const dismissedKey = `proactive_dismissed_${userEmail}`;
        const { data: dismissedData } = await supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', userEmail)
            .eq('key', 'dismissed_proactive_notifications')
            .maybeSingle();

        const dismissedIds = dismissedData?.value || [];

        // 4. 만료된 알림 및 해제된 알림 제외
        const now = new Date();
        const activeNotifications = generatedNotifications.filter(n => {
            if (dismissedIds.includes(n.id)) return false;
            if (n.expiresAt && new Date(n.expiresAt) < now) return false;
            return true;
        });

        // 5. 오늘 이미 표시한 타입별/ID별 알림 체크
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const [{ data: shownToday }, { data: shownIdsToday }] = await Promise.all([
            supabaseAdmin
                .from('user_kv_store')
                .select('value')
                .eq('user_email', userEmail)
                .eq('key', `proactive_shown_${todayStr}`)
                .maybeSingle(),
            supabaseAdmin
                .from('user_kv_store')
                .select('value')
                .eq('user_email', userEmail)
                .eq('key', `proactive_shown_ids_${todayStr}`)
                .maybeSingle(),
        ]);

        const shownTypes = shownToday?.value || [];
        const shownIds: string[] = shownIdsToday?.value || [];

        // Type-singleton notifications: 하루에 한 번만 (morning_briefing, goal_nudge 등)
        // Instance notifications: 같은 ID가 이미 표시됐으면 제외
        const typeSingletons = ['morning_briefing', 'goal_nudge', 'urgent_alert', 'lifestyle_recommend'];
        const filteredNotifications = activeNotifications.filter(n => {
            if (typeSingletons.includes(n.type)) {
                if (shownTypes.includes(n.type)) return false;
            } else {
                if (shownIds.includes(n.id)) return false;
            }
            return true;
        });

        // 6. 적응형 에스컬레이션 필터 (단계별 전략 적용)
        const finalNotifications: ProactiveNotification[] = [];
        for (const notif of filteredNotifications) {
            const decision = await getEscalationDecision(
                userEmail,
                notif.type,
                notif.priority,
                {
                    scheduleText: notif.actionPayload?.scheduleText as string | undefined,
                    deadlineHours: notif.actionPayload?.deadlineHours as number | undefined,
                }
            );
            const result = applyEscalation(notif, decision);
            if (result) {
                finalNotifications.push(result);
            }
        }

        // 7. 우선순위로 정렬 (high > medium > low)
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        finalNotifications.sort((a, b) =>
            priorityOrder[a.priority] - priorityOrder[b.priority]
        );

        // 8. 플랜별 일일 한도 적용 (free: 5, pro: 10, max: 무제한)
        const dailyLimit = LIMITS.PROACTIVE_DAILY[userPlan.plan] ?? LIMITS.PROACTIVE_DAILY.free;

        const countKey = `proactive_count_${todayStr}`;
        const { data: countData } = await supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', userEmail)
            .eq('key', countKey)
            .maybeSingle();

        const shownCount: number = countData?.value ?? 0;
        const remaining = Math.max(0, dailyLimit - shownCount);
        const limitedNotifications = finalNotifications.slice(0, Math.min(remaining, 5));

        return NextResponse.json({
            notifications: limitedNotifications,
            context: {
                todaySchedulesCount: context.todaySchedules.length,
                uncompletedCount: context.uncompletedGoals.length
            }
        });
});

export const POST = withAuth(async (request: NextRequest, userEmail: string) => {
        const body = await request.json();
        const { action, notificationId, notificationType, actionType, actionPayload } = body;

        if (action === 'dismiss') {
            // 알림 해제 - dismissed 목록에 추가
            const { data: existing } = await supabaseAdmin
                .from('user_kv_store')
                .select('value')
                .eq('user_email', userEmail)
                .eq('key', 'dismissed_proactive_notifications')
                .maybeSingle();

            const dismissedIds = existing?.value || [];
            if (!dismissedIds.includes(notificationId)) {
                dismissedIds.push(notificationId);

                await supabaseAdmin
                    .from('user_kv_store')
                    .upsert({
                        user_email: userEmail,
                        key: 'dismissed_proactive_notifications',
                        value: dismissedIds,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_email,key' });
            }

            // Dismiss streak 카운트 증가 (3회 연속 무시 → 7일간 해당 타입 억제)
            if (notificationType) {
                const streakKey = `dismiss_streak_${notificationType}`;
                const { data: streakData } = await supabaseAdmin
                    .from('user_kv_store')
                    .select('value')
                    .eq('user_email', userEmail)
                    .eq('key', streakKey)
                    .maybeSingle();

                const streak = streakData?.value || { count: 0, lastDate: null };
                streak.count += 1;
                streak.lastDate = new Date().toISOString().split('T')[0];

                await supabaseAdmin.from('user_kv_store').upsert({
                    user_email: userEmail,
                    key: streakKey,
                    value: streak,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_email,key' });
            }

            return NextResponse.json({ success: true });
        }

        if (action === 'dismiss_today') {
            // 오늘만 해제 — type을 오늘의 shown 목록에 추가 (streak 증가 안 함)
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
            const typeKey = `proactive_shown_${todayStr}`;

            const { data: existingTypes } = await supabaseAdmin
                .from('user_kv_store')
                .select('value')
                .eq('user_email', userEmail)
                .eq('key', typeKey)
                .maybeSingle();

            const shownTypes: string[] = existingTypes?.value || [];
            if (notificationType && !shownTypes.includes(notificationType)) {
                shownTypes.push(notificationType);

                await supabaseAdmin
                    .from('user_kv_store')
                    .upsert({
                        user_email: userEmail,
                        key: typeKey,
                        value: shownTypes,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_email,key' });
            }

            return NextResponse.json({ success: true });
        }

        if (action === 'mark_shown') {
            // 오늘 표시한 알림 타입 + ID 기록
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
            const typeKey = `proactive_shown_${todayStr}`;
            const idKey = `proactive_shown_ids_${todayStr}`;

            const [{ data: existingTypes }, { data: existingIds }] = await Promise.all([
                supabaseAdmin
                    .from('user_kv_store')
                    .select('value')
                    .eq('user_email', userEmail)
                    .eq('key', typeKey)
                    .maybeSingle(),
                supabaseAdmin
                    .from('user_kv_store')
                    .select('value')
                    .eq('user_email', userEmail)
                    .eq('key', idKey)
                    .maybeSingle(),
            ]);

            // Save shown type
            const shownTypes = existingTypes?.value || [];
            if (notificationType && !shownTypes.includes(notificationType)) {
                shownTypes.push(notificationType);

                await supabaseAdmin
                    .from('user_kv_store')
                    .upsert({
                        user_email: userEmail,
                        key: typeKey,
                        value: shownTypes,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_email,key' });
            }

            // Save shown notification ID + increment daily count
            const shownIds: string[] = existingIds?.value || [];
            if (notificationId && !shownIds.includes(notificationId)) {
                shownIds.push(notificationId);

                const countKey = `proactive_count_${todayStr}`;
                const { data: countData } = await supabaseAdmin
                    .from('user_kv_store')
                    .select('value')
                    .eq('user_email', userEmail)
                    .eq('key', countKey)
                    .maybeSingle();

                await Promise.all([
                    supabaseAdmin
                        .from('user_kv_store')
                        .upsert({
                            user_email: userEmail,
                            key: idKey,
                            value: shownIds,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'user_email,key' }),
                    supabaseAdmin
                        .from('user_kv_store')
                        .upsert({
                            user_email: userEmail,
                            key: countKey,
                            value: (countData?.value ?? 0) + 1,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'user_email,key' }),
                ]);
            }

            return NextResponse.json({ success: true });
        }

        if (action === 'accept') {
            // 반복 일정 전환 처리
            if (actionType === 'convert_to_recurring' && actionPayload) {
                const { text, dayOfWeek, startTime, scheduleIds, color } = actionPayload;

                // 사용자 프로필에서 customGoals 로드
                const { data: userData, error: userFetchError } = await supabaseAdmin
                    .from('users')
                    .select('profile')
                    .eq('email', userEmail)
                    .maybeSingle();

                if (userFetchError || !userData) {
                    return NextResponse.json({ error: 'User not found' }, { status: 404 });
                }

                const profile = userData.profile || {};
                const customGoals = profile.customGoals || [];

                // 해당 일회성 일정들 제거
                const removeSet = new Set(scheduleIds);
                const filteredGoals = customGoals.filter((g: any) => !removeSet.has(g.id));

                // 새 반복 일정 생성
                const newRecurringGoal: Record<string, any> = {
                    id: `recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    text,
                    startTime,
                    daysOfWeek: [dayOfWeek],
                    completed: false,
                    time: 'morning' as const,
                    ...(color ? { color } : {}),
                };

                filteredGoals.push(newRecurringGoal);

                // 프로필 업데이트
                const { error: updateError } = await supabaseAdmin
                    .from('users')
                    .update({ profile: { ...profile, customGoals: filteredGoals } })
                    .eq('email', userEmail);

                if (updateError) {
                    logger.error('[Proactive API] Failed to convert to recurring:', updateError);
                    return NextResponse.json({ error: 'Failed to convert schedule' }, { status: 500 });
                }

            }

            // 연속 일자 → 매일 반복 전환 처리
            if (actionType === 'convert_to_recurring_daily' && actionPayload) {
                const { text, daysOfWeek, startTime, scheduleIds, color } = actionPayload;

                const { data: userData, error: userFetchError } = await supabaseAdmin
                    .from('users')
                    .select('profile')
                    .eq('email', userEmail)
                    .maybeSingle();

                if (userFetchError || !userData) {
                    return NextResponse.json({ error: 'User not found' }, { status: 404 });
                }

                const profile = userData.profile || {};
                const customGoals = profile.customGoals || [];

                const removeSet = new Set(scheduleIds as string[]);
                const filteredGoals = customGoals.filter((g: any) => !removeSet.has(g.id));

                const newRecurringGoal: Record<string, any> = {
                    id: `recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    text,
                    startTime,
                    daysOfWeek: (daysOfWeek as number[]) || [0, 1, 2, 3, 4, 5, 6],
                    completed: false,
                    ...(color ? { color } : {}),
                };

                filteredGoals.push(newRecurringGoal);

                const { error: updateError } = await supabaseAdmin
                    .from('users')
                    .update({ profile: { ...profile, customGoals: filteredGoals } })
                    .eq('email', userEmail);

                if (updateError) {
                    logger.error('[Proactive API] Failed to convert to recurring daily:', updateError);
                    return NextResponse.json({ error: 'Failed to convert schedule' }, { status: 500 });
                }
            }

            // Dismiss streak 리셋 (사용자가 수락했으므로)
            if (notificationType) {
                const streakKey = `dismiss_streak_${notificationType}`;
                await supabaseAdmin.from('user_kv_store').upsert({
                    user_email: userEmail,
                    key: streakKey,
                    value: { count: 0, lastDate: null },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_email,key' });
            }

            // 알림 해제 처리
            const { data: existing } = await supabaseAdmin
                .from('user_kv_store')
                .select('value')
                .eq('user_email', userEmail)
                .eq('key', 'dismissed_proactive_notifications')
                .maybeSingle();

            const dismissedIds = existing?.value || [];
            if (!dismissedIds.includes(notificationId)) {
                dismissedIds.push(notificationId);

                await supabaseAdmin
                    .from('user_kv_store')
                    .upsert({
                        user_email: userEmail,
                        key: 'dismissed_proactive_notifications',
                        value: dismissedIds,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_email,key' });
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
});
