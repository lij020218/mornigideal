/**
 * CRON 실행 로깅 유틸리티
 *
 * - logCronExecution: 수동 로깅
 * - withCronLogging: 기존 CRON 핸들러를 감싸는 HOF (자동 로깅)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

type CronStatus = 'success' | 'failure' | 'partial' | 'skipped';

interface CronLogDetails {
    error?: string;
    affected_count?: number;
    metrics?: Record<string, unknown>;
    self_heal?: boolean;
    [key: string]: unknown;
}

/**
 * CRON 실행 결과를 system_health_log에 기록
 */
export async function logCronExecution(
    cronName: string,
    status: CronStatus,
    details?: CronLogDetails,
    durationMs?: number,
): Promise<void> {
    try {
        await supabaseAdmin.from('system_health_log').insert({
            cron_name: cronName,
            status,
            duration_ms: durationMs ?? null,
            details: details ?? {},
        });
    } catch (err) {
        logger.error(`[CronLogger] Failed to log ${cronName}:`, err);
    }
}

type CronHandler = (request: any) => Promise<NextResponse>;

/**
 * CRON 핸들러를 감싸서 실행 시간/결과를 자동 로깅.
 * withCron 안쪽에서 사용:
 *
 * export const GET = withCron(withCronLogging('name', async (req) => { ... }));
 */
export function withCronLogging(cronName: string, handler: CronHandler): CronHandler {
    return async (request: any) => {
        const start = Date.now();
        try {
            const response = await handler(request);
            const durationMs = Date.now() - start;

            // 응답 body에서 세부 정보 추출 시도
            let details: CronLogDetails = {};
            try {
                const cloned = response.clone();
                const body = await cloned.json();
                if (body.affected_count !== undefined) details.affected_count = body.affected_count;
                if (body.count !== undefined) details.affected_count = body.count;
                if (body.metrics) details.metrics = body.metrics;
            } catch {
                // body 파싱 실패해도 무시
            }

            const status: CronStatus = response.ok ? 'success' : 'failure';
            if (!response.ok) {
                details.error = `HTTP ${response.status}`;
            }

            await logCronExecution(cronName, status, details, durationMs);
            return response;
        } catch (error: any) {
            const durationMs = Date.now() - start;
            await logCronExecution(cronName, 'failure', {
                error: error?.message || String(error),
            }, durationMs);
            throw error;
        }
    };
}
