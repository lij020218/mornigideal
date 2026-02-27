import { NextRequest, NextResponse } from "next/server";
import { executeDataCleanup } from "@/lib/data-cleanup-service";
import { computeWeightsForAllUsers } from "@/lib/jarvis/feedback-aggregator";
import { withCron } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

/**
 * 자동 데이터 정리 Cron Job
 *
 * Vercel Cron: 매일 새벽 3시 실행
 */

export const GET = withCron(async (_request: NextRequest) => {
    // 모든 사용자 데이터 정리 (userEmail 없이 실행)
    const report = await executeDataCleanup();

    // Jarvis 피드백 가중치 일괄 재계산
    let feedbackReport = { processed: 0, errors: 0 };
    try {
        feedbackReport = await computeWeightsForAllUsers();
        logger.info('[Cron Daily Cleanup] Feedback weights updated:', feedbackReport);
    } catch (e) {
        logger.error('[Cron Daily Cleanup] Feedback weight aggregation failed:', e);
    }

    // 에러가 많으면 알림 (Slack, 이메일 등)
    if (report.errors.length > 5) {
        logger.error('[Cron Daily Cleanup] Too many errors:', report.errors);
    }

    return NextResponse.json({
        success: true,
        report,
        feedbackReport,
    });
});

// POST도 지원 (Vercel Cron)
export const POST = withCron(async (request: NextRequest) => {
    return GET(request);
});
