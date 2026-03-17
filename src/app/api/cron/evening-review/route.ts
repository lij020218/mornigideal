/**
 * 하루 마무리 푸시 알림 CRON
 *
 * 매일 KST 21:00 (UTC 12:00) 정확히 1회 실행.
 * 오늘 활동 요약 + 내일 일정 미리보기를 푸시 알림으로 발송.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    generateProactiveNotifications,
    getUserContext,
    saveProactiveNotification,
    type ProactiveNotification,
} from '@/lib/proactiveNotificationService';
import { sendPushNotification } from '@/lib/pushService';
import { appendChatMessage } from '@/lib/chatHistoryService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withCron } from '@/lib/api-handler';
import { withCronLogging } from '@/lib/cron-logger';
import { logger } from '@/lib/logger';

export const maxDuration = 120;

export const GET = withCron(withCronLogging('evening-review', async (_request: NextRequest) => {
    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;

    // 전체 사용자 조회
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('email');

    if (!users || users.length === 0) {
        return NextResponse.json({ message: 'No users', sent: 0 });
    }

    let sent = 0;
    let failed = 0;

    for (const user of users) {
        try {
            // 이미 오늘 daily_wrap 발송했는지 확인
            const { data: existing } = await supabaseAdmin
                .from('jarvis_notifications')
                .select('id')
                .eq('user_email', user.email)
                .eq('type', 'daily_wrap')
                .gte('created_at', `${todayStr}T00:00:00+09:00`)
                .limit(1);

            if (existing && existing.length > 0) {
                continue; // 이미 발송됨 (proactive-push에서 먼저 보냈을 수 있음)
            }

            const context = await getUserContext(user.email);
            if (!context) continue;
            const allNotifications = await generateProactiveNotifications(context);

            // daily_wrap 타입만 필터
            const dailyWrap = allNotifications.find(n => n.type === 'daily_wrap');
            if (!dailyWrap) continue;

            // 푸시 발송
            const pushResult = await sendPushNotification(user.email, {
                title: dailyWrap.title,
                body: dailyWrap.message.length > 200
                    ? dailyWrap.message.substring(0, 197) + '...'
                    : dailyWrap.message,
                data: {
                    type: 'daily_wrap',
                    notificationId: dailyWrap.id,
                    deepLink: 'fieri://chat',
                },
                priority: 'high',
            });

            if (pushResult) {
                sent++;
            } else {
                failed++;
            }

            // jarvis_notifications 저장
            await saveProactiveNotification(user.email, dailyWrap)
                .catch(e => logger.error(`[EveningReview] saveNotification failed for ${user.email}:`, e));

            // 채팅 히스토리에 저장
            await appendChatMessage(user.email, {
                id: `proactive-${dailyWrap.id}`,
                role: 'assistant',
                content: `${dailyWrap.title}\n\n${dailyWrap.message}`,
                timestamp: new Date().toISOString(),
                type: 'proactive',
                ...(dailyWrap.actionType && {
                    proactiveData: {
                        notificationId: dailyWrap.id,
                        notificationType: dailyWrap.type,
                        actionType: dailyWrap.actionType,
                        actionPayload: dailyWrap.actionPayload,
                    },
                }),
            }, todayStr).catch(e => logger.error(`[EveningReview] appendChat failed for ${user.email}:`, e));

        } catch (err) {
            logger.error(`[EveningReview] Error for ${user.email}:`, err);
            failed++;
        }
    }

    logger.info(`[EveningReview] ${todayStr} | sent: ${sent}, failed: ${failed}`);

    return NextResponse.json({
        success: true,
        date: todayStr,
        sent,
        failed,
        total: users.length,
    });
}));
