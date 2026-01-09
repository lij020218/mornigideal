import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateWeeklyReport, generateWeeklyReportNarrative } from "@/lib/weeklyReportGenerator";
import db from "@/lib/db";

/**
 * Weekly Report API
 *
 * GET /api/weekly-report - 주간 리포트 조회
 */

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userEmail = session.user.email;

        console.log(`[Weekly Report API] Generating report for ${userEmail}`);

        // Generate report data
        const reportData = await generateWeeklyReport(userEmail);

        // Get user profile for AI narrative
        const supabase = db.client;
        const { data: userData } = await supabase
            .from('users')
            .select('profile')
            .eq('email', userEmail)
            .maybeSingle();

        const profile = userData?.profile || {};

        // Generate AI narrative
        const narrative = await generateWeeklyReportNarrative(reportData, profile);

        // Save to database (optional - for history)
        try {
            await supabase.from('user_events').insert({
                id: `weekly-report-${Date.now()}`,
                user_email: userEmail,
                event_type: 'weekly_report_generated',
                start_at: new Date().toISOString(),
                metadata: {
                    week_number: reportData.period.weekNumber,
                    completion_rate: reportData.scheduleAnalysis.completionRate,
                    total_read: reportData.trendBriefingAnalysis.totalRead,
                },
            });
        } catch (e) {
            console.error('[Weekly Report API] Failed to log event:', e);
        }

        return NextResponse.json({
            success: true,
            report: {
                ...reportData,
                narrative,
            },
        });
    } catch (error: any) {
        console.error("[Weekly Report API] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate weekly report", details: error.message },
            { status: 500 }
        );
    }
}
