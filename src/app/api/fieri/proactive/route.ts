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
import { createClient } from '@supabase/supabase-js';
import { getUserEmailWithAuth } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. 사용자 컨텍스트 수집
        const context = await getUserContext(userEmail);
        if (!context) {
            return NextResponse.json({ notifications: [] });
        }

        // 2. 선제적 알림 생성
        const generatedNotifications = await generateProactiveNotifications(context);

        // 3. 이미 해제된 알림 필터링
        const dismissedKey = `proactive_dismissed_${userEmail}`;
        const { data: dismissedData } = await supabase
            .from('user_kv_store')
            .select('value')
            .eq('user_email', userEmail)
            .eq('key', 'dismissed_proactive_notifications')
            .single();

        const dismissedIds = dismissedData?.value || [];

        // 4. 만료된 알림 및 해제된 알림 제외
        const now = new Date();
        const activeNotifications = generatedNotifications.filter(n => {
            if (dismissedIds.includes(n.id)) return false;
            if (n.expiresAt && new Date(n.expiresAt) < now) return false;
            return true;
        });

        // 5. 오늘 이미 표시한 타입별 알림 체크 (하루에 한 번만 표시)
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const { data: shownToday } = await supabase
            .from('user_kv_store')
            .select('value')
            .eq('user_email', userEmail)
            .eq('key', `proactive_shown_${todayStr}`)
            .single();

        const shownTypes = shownToday?.value || [];

        // morning_briefing, goal_nudge 등은 하루에 한 번만
        const filteredNotifications = activeNotifications.filter(n => {
            if (['morning_briefing', 'goal_nudge', 'urgent_alert', 'lifestyle_recommend'].includes(n.type)) {
                if (shownTypes.includes(n.type)) return false;
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
                    scheduleText: notif.actionPayload?.scheduleText,
                    deadlineHours: notif.actionPayload?.deadlineHours,
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

        return NextResponse.json({
            notifications: finalNotifications.slice(0, 5), // 최대 5개
            context: {
                todaySchedulesCount: context.todaySchedules.length,
                uncompletedCount: context.uncompletedGoals.length
            }
        });
    } catch (error) {
        console.error('[Proactive API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate notifications' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = await request.json();
        const { action, notificationId, notificationType, actionType, actionPayload } = body;

        if (action === 'dismiss') {
            // 알림 해제 - dismissed 목록에 추가
            const { data: existing } = await supabase
                .from('user_kv_store')
                .select('value')
                .eq('user_email', userEmail)
                .eq('key', 'dismissed_proactive_notifications')
                .single();

            const dismissedIds = existing?.value || [];
            if (!dismissedIds.includes(notificationId)) {
                dismissedIds.push(notificationId);

                await supabase
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
                const { data: streakData } = await supabase
                    .from('user_kv_store')
                    .select('value')
                    .eq('user_email', userEmail)
                    .eq('key', streakKey)
                    .single();

                const streak = streakData?.value || { count: 0, lastDate: null };
                streak.count += 1;
                streak.lastDate = new Date().toISOString().split('T')[0];

                await supabase.from('user_kv_store').upsert({
                    user_email: userEmail,
                    key: streakKey,
                    value: streak,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_email,key' });
            }

            return NextResponse.json({ success: true });
        }

        if (action === 'mark_shown') {
            // 오늘 표시한 알림 타입 기록
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
            const key = `proactive_shown_${todayStr}`;

            const { data: existing } = await supabase
                .from('user_kv_store')
                .select('value')
                .eq('user_email', userEmail)
                .eq('key', key)
                .single();

            const shownTypes = existing?.value || [];
            if (!shownTypes.includes(notificationType)) {
                shownTypes.push(notificationType);

                await supabase
                    .from('user_kv_store')
                    .upsert({
                        user_email: userEmail,
                        key: key,
                        value: shownTypes,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_email,key' });
            }

            return NextResponse.json({ success: true });
        }

        if (action === 'accept') {
            // 반복 일정 전환 처리
            if (actionType === 'convert_to_recurring' && actionPayload) {
                const { text, dayOfWeek, startTime, scheduleIds, color } = actionPayload;

                // 사용자 프로필에서 customGoals 로드
                const { data: userData, error: userFetchError } = await supabase
                    .from('users')
                    .select('profile')
                    .eq('email', userEmail)
                    .single();

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
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ profile: { ...profile, customGoals: filteredGoals } })
                    .eq('email', userEmail);

                if (updateError) {
                    console.error('[Proactive API] Failed to convert to recurring:', updateError);
                    return NextResponse.json({ error: 'Failed to convert schedule' }, { status: 500 });
                }

                console.log(`[Proactive API] Converted "${text}" to recurring (day ${dayOfWeek}), removed ${scheduleIds.length} one-time schedules`);
            }

            // Dismiss streak 리셋 (사용자가 수락했으므로)
            if (notificationType) {
                const streakKey = `dismiss_streak_${notificationType}`;
                await supabase.from('user_kv_store').upsert({
                    user_email: userEmail,
                    key: streakKey,
                    value: { count: 0, lastDate: null },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_email,key' });
            }

            // 알림 해제 처리
            const { data: existing } = await supabase
                .from('user_kv_store')
                .select('value')
                .eq('user_email', userEmail)
                .eq('key', 'dismissed_proactive_notifications')
                .single();

            const dismissedIds = existing?.value || [];
            if (!dismissedIds.includes(notificationId)) {
                dismissedIds.push(notificationId);

                await supabase
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
    } catch (error) {
        console.error('[Proactive API] POST Error:', error);
        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 }
        );
    }
}
