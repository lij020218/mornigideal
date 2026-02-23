import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Weekly Report History API
 *
 * GET /api/weekly-report/history - 주간 리포트 히스토리 조회 (플랜별 제한 적용)
 *
 * Plan limits:
 * - Standard: 3 months (12 weeks)
 * - Pro: 6 months (24 weeks)
 * - Max: 1 year (52 weeks)
 */

const PLAN_LIMITS = {
    standard: 12, // 3 months
    pro: 24,      // 6 months
    max: 52,      // 1 year
};

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const userEmail = email;
    const supabase = supabaseAdmin;

    // Get user's plan
    const { data: userData } = await supabase
        .from('users')
        .select('plan')
        .eq('email', userEmail)
        .maybeSingle();

    const userPlan = userData?.plan || 'standard';
    const weekLimit = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.standard;

    // Calculate the date limit
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - (weekLimit * 7));

    // Fetch weekly report events within the plan limit
    const { data: reports, error } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_email', userEmail)
        .eq('event_type', 'weekly_report_generated')
        .gte('start_at', limitDate.toISOString())
        .order('start_at', { ascending: false });

    if (error) {
        logger.error('[Weekly Report History] Error fetching reports:', error);
        return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    // Transform reports to a cleaner format and deduplicate by week number
    const seenWeeks = new Set<number>();
    const formattedReports = (reports || [])
        .filter(report => {
            const weekNumber = report.metadata?.week_number;
            if (weekNumber && seenWeeks.has(weekNumber)) {
                return false; // Skip duplicate week
            }
            if (weekNumber) {
                seenWeeks.add(weekNumber);
            }
            return true;
        })
        .map(report => ({
            id: report.id,
            date: report.start_at,
            weekNumber: report.metadata?.week_number,
            completionRate: report.metadata?.completion_rate,
            totalRead: report.metadata?.total_read,
            narrative: report.metadata?.narrative,
            reportData: report.metadata?.report_data,
        }));

    return NextResponse.json({
        success: true,
        plan: userPlan,
        limit: weekLimit,
        reports: formattedReports,
    });
});
