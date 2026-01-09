import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyReport, generateWeeklyReportNarrative } from "@/lib/weeklyReportGenerator";
import db from "@/lib/db";

/**
 * Weekly Report Cron Job
 *
 * Vercel Cron: 매주 일요일 저녁 8시 실행
 * 수동 실행: GET /api/cron/weekly-report?secret=<CRON_SECRET>
 */

export async function GET(request: NextRequest) {
    try {
        // 보안: Cron secret 확인
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        if (secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log('[Cron Weekly Report] Starting weekly report generation for all users...');

        // Get all users
        const supabase = db.client;
        const { data: users, error } = await supabase
            .from('users')
            .select('email, profile');

        if (error || !users) {
            console.error('[Cron Weekly Report] Failed to fetch users:', error);
            return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
        }

        console.log(`[Cron Weekly Report] Found ${users.length} users`);

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        // Generate report for each user
        for (const user of users) {
            try {
                console.log(`[Cron Weekly Report] Generating report for ${user.email}`);

                const reportData = await generateWeeklyReport(user.email);
                const narrative = await generateWeeklyReportNarrative(reportData, user.profile || {});

                // Save report to user_events
                await supabase.from('user_events').insert({
                    id: `weekly-report-${user.email}-${Date.now()}`,
                    user_email: user.email,
                    event_type: 'weekly_report_generated',
                    start_at: new Date().toISOString(),
                    metadata: {
                        week_number: reportData.period.weekNumber,
                        completion_rate: reportData.scheduleAnalysis.completionRate,
                        total_read: reportData.trendBriefingAnalysis.totalRead,
                        narrative,
                        report_data: reportData,
                    },
                });

                results.push({
                    email: user.email,
                    success: true,
                    week: reportData.period.weekNumber,
                });

                successCount++;
            } catch (userError: any) {
                console.error(`[Cron Weekly Report] Failed for ${user.email}:`, userError);
                results.push({
                    email: user.email,
                    success: false,
                    error: userError.message,
                });
                errorCount++;
            }
        }

        console.log(`[Cron Weekly Report] Completed: ${successCount} success, ${errorCount} errors`);

        return NextResponse.json({
            success: true,
            summary: {
                total: users.length,
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
