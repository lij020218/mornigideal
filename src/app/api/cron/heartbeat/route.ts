// Heartbeat Cron API
//
// 서버사이드 선제적 알림 체크 — 30분 간격으로 실행
// 앱을 열지 않아도 중요 알림을 Slack/Push로 전달
//
// 동작:
// 1. 모든 활성 사용자 조회
// 2. 각 사용자별 proactiveNotificationService로 알림 생성
// 3. high priority 알림 → Slack DM 발송 (연결된 사용자만)
// 4. 알림 이력 저장 (중복 방지)
//
// 스케줄: 매 30분 (KST 06:00~22:00)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    generateProactiveNotifications,
    getUserContext,
    saveProactiveNotification,
    ProactiveNotification,
} from '@/lib/proactiveNotificationService';
import { getEscalationDecision, applyEscalation } from '@/lib/escalationService';
import { sendPushNotification } from '@/lib/pushService';

export const maxDuration = 300; // 5분 타임아웃
export const dynamic = 'force-dynamic';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Slack Push 전송
// ============================================

async function sendSlackDM(userEmail: string, notification: ProactiveNotification): Promise<boolean> {
    try {
        const { data: tokenData } = await supabase
            .from('slack_tokens')
            .select('access_token, slack_user_id')
            .eq('user_email', userEmail)
            .single();

        if (!tokenData?.access_token || !tokenData?.slack_user_id) return false;

        // Slack chat.postMessage로 DM 전송
        const response = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                channel: tokenData.slack_user_id,
                text: `${notification.title}\n${notification.message}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*${notification.title}*\n${notification.message}`,
                        },
                    },
                    ...(notification.actionType ? [{
                        type: 'actions',
                        elements: [{
                            type: 'button',
                            text: { type: 'plain_text', text: 'Fi.eri에서 확인' },
                            url: process.env.NEXT_PUBLIC_APP_URL || 'https://fieri.app',
                            action_id: `fieri_open_${notification.id}`,
                        }],
                    }] : []),
                ],
            }),
        });

        const result = await response.json();
        if (!result.ok) {
            console.error('[Heartbeat] Slack DM failed:', result.error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('[Heartbeat] Slack DM exception:', error);
        return false;
    }
}

// ============================================
// 중복 방지: 오늘 이미 전송한 알림 체크
// ============================================

async function getAlreadySentIds(userEmail: string, todayStr: string): Promise<Set<string>> {
    const { data } = await supabase
        .from('user_kv_store')
        .select('value')
        .eq('user_email', userEmail)
        .eq('key', `heartbeat_sent_${todayStr}`)
        .single();

    return new Set(data?.value || []);
}

async function markAsSent(userEmail: string, todayStr: string, notificationId: string): Promise<void> {
    const { data: existing } = await supabase
        .from('user_kv_store')
        .select('value')
        .eq('user_email', userEmail)
        .eq('key', `heartbeat_sent_${todayStr}`)
        .single();

    const sentIds: string[] = existing?.value || [];
    if (!sentIds.includes(notificationId)) {
        sentIds.push(notificationId);
        await supabase.from('user_preferences').upsert({
            user_email: userEmail,
            key: `heartbeat_sent_${todayStr}`,
            value: sentIds,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email,key' });
    }
}

// ============================================
// Dismiss streak 필터 (route.ts와 동일 로직)
// ============================================

async function getSuppressedTypes(userEmail: string): Promise<Set<string>> {
    const { data: streakRows } = await supabase
        .from('user_kv_store')
        .select('key, value')
        .eq('user_email', userEmail)
        .like('key', 'dismiss_streak_%');

    const suppressed = new Set<string>();
    for (const row of streakRows || []) {
        const type = row.key.replace('dismiss_streak_', '');
        const streak = row.value as { count: number; lastDate: string | null };
        if (streak.count >= 3 && streak.lastDate) {
            const daysSince = Math.floor(
                (Date.now() - new Date(streak.lastDate).getTime()) / 86400000
            );
            if (daysSince < 7) suppressed.add(type);
        }
    }
    return suppressed;
}

// ============================================
// Main Heartbeat Handler
// ============================================

export async function GET(request: NextRequest) {
    // 인증 체크 (Cron Secret)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // KST 시간 체크 — 6:00~22:00만 실행
    const now = new Date();
    const kstHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
    if (kstHour < 6 || kstHour >= 22) {
        return NextResponse.json({
            success: true,
            message: 'Outside active hours (KST 06-22)',
            skipped: true,
        });
    }

    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    console.log(`[Heartbeat] Starting at KST ${kstHour}:00, date: ${todayStr}`);

    try {
        // 1. 최근 7일 이내에 활동한 사용자 조회
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: activeUsers, error: usersError } = await supabase
            .from('users')
            .select('email, profile')
            .gte('updated_at', sevenDaysAgo.toISOString());

        if (usersError || !activeUsers) {
            console.error('[Heartbeat] Failed to get users:', usersError);
            return NextResponse.json({ error: 'Failed to get users' }, { status: 500 });
        }

        console.log(`[Heartbeat] Processing ${activeUsers.length} active users`);

        let totalSent = 0;
        let totalGenerated = 0;
        const userResults: Array<{ email: string; generated: number; sent: number }> = [];

        // 2. 각 사용자별 처리 (순차 — Vercel 타임아웃 내 처리)
        for (const user of activeUsers) {
            try {
                // Google Calendar 동기화 (알림 유무와 무관하게 항상 수행)
                try {
                    const { data: gcalToken } = await supabase
                        .from('google_calendar_tokens')
                        .select('user_email')
                        .eq('user_email', user.email)
                        .single();

                    if (gcalToken) {
                        const { GoogleCalendarService } = await import('@/lib/googleCalendarService');
                        const gcalService = new GoogleCalendarService(user.email);
                        await gcalService.sync();
                    }
                } catch (syncError) {
                    console.error('[Heartbeat] GCal sync error:', syncError);
                }

                const context = await getUserContext(user.email);
                if (!context) continue;

                // 알림 생성
                const notifications = await generateProactiveNotifications(context);
                if (notifications.length === 0) continue;

                // 이미 전송한 알림 필터
                const alreadySent = await getAlreadySentIds(user.email, todayStr);
                const newNotifications = notifications.filter(n => !alreadySent.has(n.id));

                if (newNotifications.length === 0) continue;

                // 적응형 에스컬레이션: 개별 알림마다 전략 판단
                const escalated: Array<ProactiveNotification & { pushAllowed: boolean }> = [];
                for (const notif of newNotifications) {
                    const decision = await getEscalationDecision(
                        user.email,
                        notif.type,
                        notif.priority,
                        {
                            scheduleText: notif.actionPayload?.scheduleText,
                            deadlineHours: notif.actionPayload?.deadlineHours,
                        }
                    );
                    const result = applyEscalation(notif, decision);
                    if (result) escalated.push(result);
                }

                if (escalated.length === 0) continue;
                totalGenerated += escalated.length;

                let sentCount = 0;

                for (const notif of escalated) {
                    // push 전송 여부: 에스컬레이션 허용 + high/medium
                    const shouldPush = notif.pushAllowed &&
                        (notif.priority === 'high' || notif.priority === 'medium');

                    if (shouldPush) {
                        // Slack DM 발송 시도
                        const slackSent = await sendSlackDM(user.email, notif);

                        // 모바일 푸시 알림 발송
                        const pushSent = await sendPushNotification(user.email, {
                            title: notif.title,
                            body: notif.message,
                            data: {
                                notificationId: notif.id,
                                type: notif.type,
                                actionType: notif.actionType,
                                actionPayload: notif.actionPayload,
                            },
                            channelId: notif.type === 'schedule_reminder' ? 'schedules' : 'default',
                            priority: notif.priority === 'high' ? 'high' : 'normal',
                        });

                        if (slackSent || pushSent) {
                            sentCount++;
                            totalSent++;
                        }
                    }

                    // DB에 알림 저장 (앱에서도 표시용)
                    await saveProactiveNotification(user.email, notif);

                    // 전송 기록
                    await markAsSent(user.email, todayStr, notif.id);
                }

                userResults.push({
                    email: user.email.substring(0, 3) + '***',
                    generated: escalated.length,
                    sent: sentCount,
                });
            } catch (userError) {
                console.error('[Heartbeat] Error processing user:', userError);
            }
        }

        console.log(`[Heartbeat] Done. Generated: ${totalGenerated}, Sent (Slack+Push): ${totalSent}`);

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            kstHour,
            activeUsers: activeUsers.length,
            totalGenerated,
            totalSent,
            details: userResults,
        });
    } catch (error) {
        console.error('[Heartbeat] Fatal error:', error);
        return NextResponse.json(
            { error: 'Heartbeat failed', details: String(error) },
            { status: 500 }
        );
    }
}
