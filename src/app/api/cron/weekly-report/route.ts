import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyReport, generateWeeklyReportNarrative } from "@/lib/weeklyReportGenerator";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { withCron } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { saveProactiveNotification } from "@/lib/proactiveNotificationService";
import { sendPushNotification } from "@/lib/pushService";

/**
 * Weekly Report Cron Job
 *
 * Vercel Cron: 매주 일요일 저녁 9시 KST 실행 (UTC 12시)
 */

export const GET = withCron(async (_request: NextRequest) => {
    // Get all users (paginated to avoid memory issues)
    const BATCH_SIZE = 50;
    let offset = 0;
    let allUsers: { email: string; profile: any }[] = [];

    while (true) {
        const { data: batch, error } = await supabaseAdmin
            .from('users')
            .select('email, profile')
            .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
            logger.error('[Cron Weekly Report] Failed to fetch users:', error);
            return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
        }
        if (!batch || batch.length === 0) break;
        allUsers = allUsers.concat(batch);
        if (batch.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
    }

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Process users in parallel batches of 5
    const CONCURRENCY = 5;
    for (let i = 0; i < allUsers.length; i += CONCURRENCY) {
        const batch = allUsers.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
            batch.map(async (user) => {
                const reportData = await generateWeeklyReport(user.email);
                const targetWeekNumber = reportData.period.weekNumber;

                // 해당 주차의 리포트가 이미 존재하는지 확인
                const { data: existingReport } = await supabaseAdmin
                    .from('user_events')
                    .select('id')
                    .eq('user_email', user.email)
                    .eq('event_type', 'weekly_report_generated')
                    .eq('metadata->>week_number', targetWeekNumber.toString())
                    .limit(1)
                    .maybeSingle();

                if (existingReport) {
                    return { email: user.email, success: true, week: targetWeekNumber, skipped: true };
                }

                const narrative = await generateWeeklyReportNarrative(reportData, user.profile || {});

                await supabaseAdmin.from('user_events').insert({
                    id: `weekly-report-${user.email}-week${targetWeekNumber}-${Date.now()}`,
                    user_email: user.email,
                    event_type: 'weekly_report_generated',
                    start_at: new Date().toISOString(),
                    metadata: {
                        week_number: targetWeekNumber,
                        period_start: reportData.period.start,
                        period_end: reportData.period.end,
                        completion_rate: reportData.scheduleAnalysis.completionRate,
                        total_read: reportData.trendBriefingAnalysis.totalRead,
                        narrative,
                        report_data: reportData,
                    },
                });

                // 채팅으로 주간 카드 뉴스 알림 전송
                const rate = reportData.scheduleAnalysis.completionRate;
                const notification = {
                    id: `weekly-card-news-${targetWeekNumber}`,
                    type: 'weekly_review' as const,
                    priority: 'medium' as const,
                    title: '📊 주간 리포트가 도착했어요',
                    message: `${targetWeekNumber}주차 카드 뉴스가 준비됐어요! 이번 주 완료율 ${rate}%${narrative ? ` — "${narrative.slice(0, 40)}..."` : ''}`,
                    actionType: 'view_weekly_report',
                    actionPayload: { weekNumber: targetWeekNumber },
                };

                await saveProactiveNotification(user.email, notification);
                await sendPushNotification(user.email, {
                    title: notification.title,
                    body: notification.message,
                    data: {
                        notificationId: notification.id,
                        type: notification.type,
                        actionType: notification.actionType,
                    },
                }).catch(() => {}); // 푸시 실패는 무시

                return { email: user.email, success: true, week: targetWeekNumber, skipped: false };
            })
        );

        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                results.push(result.value);
                successCount++;
            } else {
                const email = batch[batchResults.indexOf(result)]?.email || 'unknown';
                logger.error(`[Cron Weekly Report] Failed for ${email}:`, result.reason);
                results.push({ email, success: false, error: result.reason?.message });
                errorCount++;
            }
        }
    }

    return NextResponse.json({
        success: true,
        summary: {
            total: allUsers.length,
            success: successCount,
            errors: errorCount,
        },
        results,
    });
});

// POST도 지원 (Vercel Cron)
export const POST = withCron(async (request: NextRequest) => {
    return GET(request);
});
