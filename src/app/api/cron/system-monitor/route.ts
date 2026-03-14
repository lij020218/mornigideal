/**
 * 시스템 모니터링 CRON
 *
 * 매 10분 실행. 모든 CRON의 실행 상태를 검증하고,
 * 실패한 CRON은 자가 복구를 시도하며, 관리자에게 알림 발송.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCron } from '@/lib/api-handler';
import {
    verifyCronOutputs,
    attemptSelfHeal,
    computeHealthScore,
    sendHealthAlert,
    cleanupOldLogs,
} from '@/lib/system-monitor';
import { logCronExecution } from '@/lib/cron-logger';
import { logger } from '@/lib/logger';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export const GET = withCron(async (_request: NextRequest) => {
    const start = Date.now();

    try {
        // KST 현재 시간
        const now = new Date();
        const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const kstHour = kst.getHours();
        const today = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;

        // 1. 증거 기반 CRON 검증
        const cronResults = await verifyCronOutputs(today, kstHour);

        // 2. missing CRON 자가 복구 시도
        const missingCrons = cronResults.filter(c => c.status === 'missing');
        const selfHealResults = missingCrons.length > 0
            ? await attemptSelfHeal(missingCrons)
            : [];

        // 3. 헬스 점수 산정
        const healthScore = await computeHealthScore(cronResults);

        // 4. 알림 발송
        const alertSent = await sendHealthAlert(healthScore, cronResults, selfHealResults);

        // 5. 로그 정리 (정시에만)
        let cleaned = 0;
        if (kst.getMinutes() < 10) {
            cleaned = await cleanupOldLogs();
        }

        // 6. 자체 실행 결과 로깅
        const durationMs = Date.now() - start;
        await logCronExecution('system-monitor', 'success', {
            metrics: {
                score: healthScore.score,
                level: healthScore.level,
                breakdown: healthScore.breakdown,
                missing: missingCrons.length,
                healed: selfHealResults.filter(r => r.success).length,
                alertSent,
                cleaned,
            },
        }, durationMs);

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            kstHour,
            health: {
                score: healthScore.score,
                level: healthScore.level,
                breakdown: healthScore.breakdown,
            },
            cronResults: cronResults.map(c => ({
                name: c.name,
                critical: c.critical,
                status: c.status,
                message: c.message,
            })),
            selfHeal: selfHealResults,
            alertSent,
            logsCleaned: cleaned,
            durationMs: Date.now() - start,
        });
    } catch (error: any) {
        const durationMs = Date.now() - start;
        await logCronExecution('system-monitor', 'failure', {
            error: error?.message,
        }, durationMs);
        logger.error('[SystemMonitor] Fatal error:', error);
        return NextResponse.json(
            { error: 'System monitor failed', message: error?.message },
            { status: 500 }
        );
    }
});
