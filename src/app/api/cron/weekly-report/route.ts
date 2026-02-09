import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyReport, generateWeeklyReportNarrative } from "@/lib/weeklyReportGenerator";
import db from "@/lib/db";

/**
 * Weekly Report Cron Job
 *
 * Vercel Cron: 매주 일요일 저녁 9시 KST 실행 (UTC 12시)
 * 수동 실행: GET /api/cron/weekly-report?secret=<CRON_SECRET>
 */

export async function GET(request: NextRequest) {
    try {
        // 보안: Cron secret 확인
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log('[Cron Weekly Report] Starting weekly report generation for all users...');

        // Get all users (paginated to avoid memory issues)
        const supabase = db.client;
        const BATCH_SIZE = 50;
        let offset = 0;
        let allUsers: { email: string; profile: any }[] = [];

        while (true) {
            const { data: batch, error } = await supabase
                .from('users')
                .select('email, profile')
                .range(offset, offset + BATCH_SIZE - 1);

            if (error) {
                console.error('[Cron Weekly Report] Failed to fetch users:', error);
                return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
            }
            if (!batch || batch.length === 0) break;
            allUsers = allUsers.concat(batch);
            if (batch.length < BATCH_SIZE) break;
            offset += BATCH_SIZE;
        }

        console.log(`[Cron Weekly Report] Found ${allUsers.length} users`);

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
                    const { data: existingReport } = await supabase
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

                    await supabase.from('user_events').insert({
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

                    return { email: user.email, success: true, week: targetWeekNumber, skipped: false };
                })
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                    successCount++;
                } else {
                    const email = batch[batchResults.indexOf(result)]?.email || 'unknown';
                    console.error(`[Cron Weekly Report] Failed for ${email}:`, result.reason);
                    results.push({ email, success: false, error: result.reason?.message });
                    errorCount++;
                }
            }
        }

        console.log(`[Cron Weekly Report] Completed: ${successCount} success, ${errorCount} errors`);

        return NextResponse.json({
            success: true,
            summary: {
                total: allUsers.length,
                success: successCount,
                errors: errorCount,
            },
            results,
        });
    } catch (error: any) {
        console.error("[Cron Weekly Report] Fatal error:", error);
        return NextResponse.json(
            { error: "Weekly report generation failed", details: error.message },
            { status: 500 }
        );
    }
}

// POST도 지원 (Vercel Cron)
export async function POST(request: NextRequest) {
    return GET(request);
}
