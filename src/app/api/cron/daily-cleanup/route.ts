import { NextRequest, NextResponse } from "next/server";
import { executeDataCleanup } from "@/lib/data-cleanup-service";
import { computeWeightsForAllUsers } from "@/lib/jarvis/feedback-aggregator";
import { withCron } from "@/lib/api-handler";
import { withCronLogging } from '@/lib/cron-logger';
import { logger } from "@/lib/logger";
import { sendPushNotification } from "@/lib/pushService";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

/**
 * 자동 데이터 정리 Cron Job
 *
 * Vercel Cron: 매일 새벽 3시 실행
 */

export const GET = withCron(withCronLogging('daily-cleanup', async (_request: NextRequest) => {
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

    // 에러가 많으면 관리자에게 푸시 알림
    if (report.errors.length > 3) {
        const errorSummary = report.errors.slice(0, 5).join(', ');
        logger.error(`[Cron Daily Cleanup] ${report.errors.length} errors:`, errorSummary);

        for (const adminEmail of ADMIN_EMAILS) {
            await sendPushNotification(adminEmail, {
                title: `⚠️ 데이터 정리 오류 ${report.errors.length}건`,
                body: `${errorSummary.slice(0, 100)}`,
                data: { type: 'system_alert', notificationId: 'cleanup-error' },
            }).catch(() => {});
        }
    }

    // 피드백 가중치 재계산 에러가 많으면 보고
    if (feedbackReport.errors > 0) {
        logger.warn(`[Cron Daily Cleanup] Feedback weight errors: ${feedbackReport.errors}/${feedbackReport.processed}`);
    }

    return NextResponse.json({
        success: true,
        report,
        feedbackReport,
    });
}));

// POST도 지원 (Vercel Cron)
export const POST = withCron(async (request: NextRequest) => {
    return GET(request);
});
