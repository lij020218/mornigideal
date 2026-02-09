import { NextRequest, NextResponse } from "next/server";
import { executeDataCleanup } from "@/lib/data-cleanup-service";

/**
 * 자동 데이터 정리 Cron Job
 *
 * Vercel Cron: 매일 새벽 3시 실행
 * 수동 실행: POST /api/cron/daily-cleanup?secret=<CRON_SECRET>
 */

export async function GET(request: NextRequest) {
    try {
        // 보안: Cron secret 확인
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log('[Cron Daily Cleanup] Starting scheduled data cleanup...');

        // 모든 사용자 데이터 정리 (userEmail 없이 실행)
        const report = await executeDataCleanup();

        console.log('[Cron Daily Cleanup] Completed:', {
            deleted: report.totalRecordsDeleted,
            aggregated: report.totalRecordsAggregated,
            errors: report.errors.length,
            executionTimeMs: report.executionTimeMs,
        });

        // 에러가 많으면 알림 (Slack, 이메일 등)
        if (report.errors.length > 5) {
            console.error('[Cron Daily Cleanup] Too many errors:', report.errors);
            // TODO: Send alert to admin
        }

        return NextResponse.json({
            success: true,
            report,
        });
    } catch (error: any) {
        console.error("[Cron Daily Cleanup] Fatal error:", error);
        return NextResponse.json(
            { error: "Cleanup failed", details: error.message },
            { status: 500 }
        );
    }
}

// POST도 지원 (Vercel Cron)
export async function POST(request: NextRequest) {
    return GET(request);
}
