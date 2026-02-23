import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyReport, generateWeeklyReportNarrative } from "@/lib/weeklyReportGenerator";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { withAuth } from "@/lib/api-handler";
import { logger } from '@/lib/logger';

/**
 * Weekly Report API
 *
 * GET /api/weekly-report - 주간 리포트 조회
 *
 * 주간 리포트는 항상 가장 최근 완료된 주간(월~일)을 기준으로 합니다.
 * 같은 주차의 리포트가 이미 존재하면 기존 것을 반환하고,
 * 없으면 새로 생성합니다.
 */

// ISO 8601 주차 계산 함수
function getISOWeekNumber(date: Date): number {
    const target = new Date(date.valueOf());
    // 현재 날짜를 가장 가까운 목요일로 조정 (ISO 8601 규칙)
    const dayOfWeek = date.getDay();
    const diff = dayOfWeek === 0 ? -3 : 4 - dayOfWeek;
    target.setDate(date.getDate() + diff);

    // 해당 연도의 1월 1일
    const yearStart = new Date(target.getFullYear(), 0, 1);

    // 주차 계산
    return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// 분석 대상 주의 주차 번호 계산 (DB 쿼리 없이, KST 기준)
// 일요일이면 해당 주(월~일), 월~토이면 지난 주(월~일)
function getTargetWeekNumber(): number {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    now.setHours(0, 0, 0, 0);

    const dayOfWeek = now.getDay();

    let targetMonday: Date;
    if (dayOfWeek === 0) {
        // 일요일: 이번 주(월~일) 완료됨
        targetMonday = new Date(now);
        targetMonday.setDate(now.getDate() - 6);
    } else {
        // 월~토: 지난 주
        const daysToSubtract = dayOfWeek - 1;
        const thisMonday = new Date(now);
        thisMonday.setDate(now.getDate() - daysToSubtract);
        targetMonday = new Date(thisMonday);
        targetMonday.setDate(thisMonday.getDate() - 7);
    }

    return getISOWeekNumber(targetMonday);
}

export const GET = withAuth(async (request: NextRequest, email: string) => {
    // 빠른 주차 번호 계산 (DB 쿼리 없이)
    const targetWeekNumber = getTargetWeekNumber();


    // 캐시 먼저 확인 (DB 쿼리 1회)
    // narrative_version: v2 = plain text (v1 = markdown)
    const NARRATIVE_VERSION = 'v2';
    const { data: existingReport } = await supabaseAdmin
        .from('user_events')
        .select('*')
        .eq('user_email', email)
        .eq('event_type', 'weekly_report_generated')
        .eq('metadata->>week_number', targetWeekNumber.toString())
        .eq('metadata->>narrative_version', NARRATIVE_VERSION)
        .order('start_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    // 이미 존재하는 리포트가 있으면 그것을 반환 (매우 빠름)
    if (existingReport?.metadata?.report_data) {
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
    const reportData = await generateWeeklyReport(email);

    // Get user profile for AI narrative
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('profile')
        .eq('email', email)
        .maybeSingle();

    const profile = userData?.profile || {};

    // Generate AI narrative
    const narrative = await generateWeeklyReportNarrative(reportData, profile);

    // Save to database (for history and caching)
    try {
        await supabaseAdmin.from('user_events').insert({
            id: `weekly-report-${email}-week${targetWeekNumber}-${Date.now()}`,
            user_email: email,
            event_type: 'weekly_report_generated',
            start_at: new Date().toISOString(),
            metadata: {
                week_number: targetWeekNumber,
                narrative_version: NARRATIVE_VERSION,
                period_start: reportData.period.start,
                period_end: reportData.period.end,
                completion_rate: reportData.scheduleAnalysis.completionRate,
                total_read: reportData.trendBriefingAnalysis.totalRead,
                narrative,
                report_data: reportData,
            },
        });
    } catch (e) {
        logger.error('[Weekly Report API] Failed to save report:', e);
    }

    return NextResponse.json({
        success: true,
        cached: false,
        report: {
            ...reportData,
            narrative,
        },
    });
});
