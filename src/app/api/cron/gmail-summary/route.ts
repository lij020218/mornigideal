/**
 * Gmail 요약 사전 캐싱 CRON
 *
 * 6시간 간격 실행 (UTC 0, 6, 12, 18 = KST 9, 15, 21, 3)
 * Gmail 연동된 모든 사용자의 이메일을 미리 분석하여 캐시에 저장.
 * → 앱에서 인사이트 페이지 진입 시 항상 캐시된 결과만 반환 (즉시 표시)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withCron } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import { getUserByEmail } from '@/lib/users';
import { saveProactiveNotification } from '@/lib/proactiveNotificationService';
import { sendPushNotification } from '@/lib/pushService';
import {
    fetchGmailMessages,
    classifyAndSummarizeEmails,
    refreshAccessToken,
} from '@/app/api/gmail/summary/route';

export const maxDuration = 120;

export const GET = withCron(async (_request: NextRequest) => {
    // Gmail 연동된 모든 사용자 조회
    const { data: gmailUsers, error } = await supabaseAdmin
        .from('gmail_tokens')
        .select('user_email, access_token, refresh_token, expires_at');

    if (error || !gmailUsers || gmailUsers.length === 0) {
        return NextResponse.json({ message: 'No Gmail users', processed: 0 });
    }

    let refreshed = 0;
    let skipped = 0;
    let errors = 0;

    for (const gmailUser of gmailUsers) {
        try {
            const email = gmailUser.user_email;

            // 캐시가 아직 유효하면 스킵 (3시간 미만이면 아직 안 해도 됨)
            const { data: cached } = await supabaseAdmin
                .from('user_kv_store')
                .select('updated_at')
                .eq('user_email', email)
                .eq('key', 'gmail_summary_cache')
                .maybeSingle();

            if (cached?.updated_at) {
                const age = Date.now() - new Date(cached.updated_at).getTime();
                if (age < 3 * 60 * 60 * 1000) { // 3시간 미만이면 스킵
                    skipped++;
                    continue;
                }
            }

            // Access token 준비
            let accessToken = gmailUser.access_token;
            if (gmailUser.expires_at < Date.now()) {
                if (!gmailUser.refresh_token) {
                    skipped++;
                    continue;
                }
                const newToken = await refreshAccessToken(gmailUser.refresh_token, email);
                if (!newToken) {
                    skipped++;
                    continue;
                }
                accessToken = newToken;
            }

            // 이메일 가져오기
            const messages = await fetchGmailMessages(accessToken);

            if (messages.length === 0) {
                // 이메일 없으면 빈 캐시 저장
                await supabaseAdmin
                    .from('user_kv_store')
                    .upsert({
                        user_email: email,
                        key: 'gmail_summary_cache',
                        value: { importantEmails: [], totalUnread: 0, skippedCount: 0 },
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_email,key' });
                refreshed++;
                continue;
            }

            // 사용자 직업 정보
            let userJob = '사용자';
            let userName = '사용자';
            try {
                const user = await getUserByEmail(email);
                userJob = user?.profile?.job || '사용자';
                userName = (user?.profile?.name as string) || user?.name || '사용자';
            } catch { /* ignore */ }

            // 기존 캐시 (새 이메일 비교용)
            let previousCache: any = null;
            try {
                const { data: prevCached } = await supabaseAdmin
                    .from('user_kv_store')
                    .select('value')
                    .eq('user_email', email)
                    .eq('key', 'gmail_summary_cache')
                    .maybeSingle();
                if (prevCached && prevCached.value?.importantEmails?.length > 0) {
                    previousCache = prevCached.value;
                }
            } catch { /* ignore */ }

            // AI 분류 + 요약
            const summary = await classifyAndSummarizeEmails(messages, userJob);

            // 캐시 저장
            await supabaseAdmin
                .from('user_kv_store')
                .upsert({
                    user_email: email,
                    key: 'gmail_summary_cache',
                    value: summary,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_email,key' });

            // 새 이메일 감지 → 푸시 알림
            if (previousCache) {
                const previousIds = new Set(
                    (previousCache.importantEmails || []).map((e: any) => e.messageId)
                );
                const newEmails = summary.importantEmails.filter(
                    (e: any) => !previousIds.has(e.messageId)
                );

                if (newEmails.length > 0) {
                    const highPriority = newEmails.filter((e: any) => e.priority === 'high');
                    const topEmail = highPriority[0] || newEmails[0];
                    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

                    const notification = {
                        id: `gmail-new-${today}-${Date.now()}`,
                        type: 'context_suggestion' as const,
                        priority: (highPriority.length > 0 ? 'high' : 'medium') as 'high' | 'medium',
                        title: `📧 새 이메일 ${newEmails.length}통`,
                        message: highPriority.length > 0
                            ? `${userName}님, 중요 메일이 도착했어요: ${topEmail.subject || topEmail.summary?.slice(0, 30)}`
                            : `${userName}님, 새 메일 ${newEmails.length}통이 도착했어요. 확인해보세요!`,
                        actionType: 'open_insights',
                    };

                    await saveProactiveNotification(email, notification);
                    await sendPushNotification(email, {
                        title: notification.title,
                        body: notification.message,
                        data: {
                            notificationId: notification.id,
                            type: 'gmail_new',
                            actionType: 'open_insights',
                        },
                    }).catch(() => {});
                }
            }

            refreshed++;
        } catch (err) {
            logger.error(`[GmailCron] Error for ${gmailUser.user_email}:`, err instanceof Error ? err.message : err);
            errors++;
        }
    }

    return NextResponse.json({
        success: true,
        refreshed,
        skipped,
        errors,
        total: gmailUsers.length,
    });
});
