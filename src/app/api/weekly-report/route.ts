import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateWeeklyReport, generateWeeklyReportNarrative } from "@/lib/weeklyReportGenerator";
import db from "@/lib/db";

/**
 * Weekly Report API
 *
 * GET /api/weekly-report - 주간 리포트 조회
 *
 * 주간 리포트는 항상 가장 최근 완료된 주간(월~일)을 기준으로 합니다.
 * 같은 주차의 리포트가 이미 존재하면 기존 것을 반환하고,
 * 없으면 새로 생성합니다.
 */

// 주차 번호를 빠르게 계산하는 함수 (DB 쿼리 없이)
function getTargetWeekNumber(): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const dayOfWeek = now.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - daysToSubtract);

    // 지난 주의 월요일
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    // 주차 계산 (ISO 8601 기준)
    const startOfYear = new Date(lastMonday.getFullYear(), 0, 1);
    const days = Math.floor((lastMonday.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userEmail = session.user.email;
        const supabase = db.client;

        console.log(`[Weekly Report API] Fetching report for ${userEmail}`);

        // 빠른 주차 번호 계산 (DB 쿼리 없이)
        const targetWeekNumber = getTargetWeekNumber();

        console.log(`[Weekly Report API] Target week: ${targetWeekNumber}`);

        // 캐시 먼저 확인 (DB 쿼리 1회)
        const { data: existingReport } = await supabase
            .from('user_events')
            .select('*')
            .eq('user_email', userEmail)
            .eq('event_type', 'weekly_report_generated')
            .eq('metadata->>week_number', targetWeekNumber.toString())
            .order('start_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // 이미 존재하는 리포트가 있으면 그것을 반환 (매우 빠름)
        if (existingReport?.metadata?.report_data) {
            console.log(`[Weekly Report API] Returning cached report for week ${targetWeekNumber}`);
            return NextResponse.json({
                success: true,
                cached: true,
                report: {
                    ...existingReport.metadata.report_data,
                    narrative: existingReport.metadata.narrative,
                },
            });
        }

        // 캐시 없음 - 리포트 데이터 생성 (느린 작업)
        console.log(`[Weekly Report API] Generating new report for week ${targetWeekNumber}`);
        const reportData = await generateWeeklyReport(userEmail);

        // Get user profile for AI narrative
        const { data: userData } = await supabase
            .from('users')
            .select('profile')
            .eq('email', userEmail)
            .maybeSingle();

        const profile = userData?.profile || {};

        // Generate AI narrative
        const narrative = await generateWeeklyReportNarrative(reportData, profile);

        // Save to database (for history and caching)
        try {
            await supabase.from('user_events').insert({
                id: `weekly-report-${userEmail}-week${targetWeekNumber}-${Date.now()}`,
                user_email: userEmail,
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
        } catch (e) {
            console.error('[Weekly Report API] Failed to save report:', e);
        }

        return NextResponse.json({
            success: true,
            cached: false,
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
