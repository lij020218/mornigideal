/**
 * 시스템 모니터링 엔진
 *
 * - 증거 기반 CRON 검증 (DB 출력물 확인)
 * - 자가 복구 (missing CRON 재실행)
 * - 헬스 점수 산정 (0-100)
 * - 관리자 알림 발송
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendPushNotification } from '@/lib/pushService';
import { llmCircuit, embeddingCircuit, reactCircuit } from '@/lib/circuit-breaker';
import { kvGet, kvSet } from '@/lib/kv-store';
import { logCronExecution } from '@/lib/cron-logger';
import { logger } from '@/lib/logger';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
const SYSTEM_EMAIL = ADMIN_EMAILS[0] || 'system@fieri.app';

// ── CRON 정의 ──

interface CronDefinition {
    name: string;
    /** 증거 검증 함수 (null = 로그 기반으로만 검증) */
    verify: ((today: string, kstHour: number) => Promise<CronVerifyResult>) | null;
    /** 검증 활성 시간 (KST) — 이 시간 이전이면 skip */
    activeAfterKST: number;
    /** 핵심 CRON 여부 (가중치 높음) */
    critical: boolean;
    /** Vercel CRON 경로 (자가 복구용) */
    path: string;
}

interface CronVerifyResult {
    status: 'ok' | 'missing' | 'degraded';
    message: string;
    evidence?: Record<string, unknown>;
}

const CRON_DEFINITIONS: CronDefinition[] = [
    {
        name: 'generate-trend-briefings',
        critical: true,
        activeAfterKST: 6, // UTC 20 → KST 05
        path: '/api/cron/generate-trend-briefings',
        verify: async (today, _kstHour) => {
            const { count } = await supabaseAdmin
                .from('trends_cache')
                .select('*', { count: 'exact', head: true })
                .eq('date', today);
            if ((count || 0) > 0) return { status: 'ok', message: `${count}건 배포`, evidence: { count } };
            return { status: 'missing', message: '오늘 트렌드 브리핑 0건' };
        },
    },
    {
        name: 'daily-briefing',
        critical: true,
        activeAfterKST: 6, // UTC 20 → KST 05
        path: '/api/cron/daily-briefing',
        verify: async (today, _kstHour) => {
            const { count } = await supabaseAdmin
                .from('daily_briefings')
                .select('*', { count: 'exact', head: true })
                .eq('date', today);
            if ((count || 0) > 0) return { status: 'ok', message: `${count}건 생성`, evidence: { count } };
            return { status: 'missing', message: '오늘 데일리 브리핑 0건' };
        },
    },
    {
        name: 'heartbeat',
        critical: true,
        activeAfterKST: 6,
        path: '/api/cron/heartbeat',
        verify: null, // 로그 기반
    },
    {
        name: 'proactive-push',
        critical: false,
        activeAfterKST: 7, // KST 07시부터
        path: '/api/cron/proactive-push',
        verify: async (today, kstHour) => {
            if (kstHour < 9) return { status: 'ok', message: '아직 이른 시간' };
            const todayStart = `${today}T00:00:00+09:00`;
            const { count } = await supabaseAdmin
                .from('jarvis_notifications')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', todayStart);
            if ((count || 0) > 0) return { status: 'ok', message: `${count}건 알림`, evidence: { count } };
            return { status: 'missing', message: '오늘 선제적 알림 0건' };
        },
    },
    {
        name: 'update-weather',
        critical: false,
        activeAfterKST: 0,
        path: '/api/cron/update-weather',
        verify: null,
    },
    {
        name: 'generate-greetings',
        critical: false,
        activeAfterKST: 7, // UTC 22 → KST 07
        path: '/api/cron/generate-greetings',
        verify: null,
    },
    {
        name: 'daily-cleanup',
        critical: false,
        activeAfterKST: 12, // UTC 03 → KST 12
        path: '/api/cron/daily-cleanup',
        verify: null,
    },
    {
        name: 'gmail-summary',
        critical: false,
        activeAfterKST: 0,
        path: '/api/cron/gmail-summary',
        verify: null,
    },
    {
        name: 'schedule-reminder',
        critical: false,
        activeAfterKST: 0,
        path: '/api/cron/schedule-reminder',
        verify: null,
    },
    {
        name: 'generate-recommendations',
        critical: false,
        activeAfterKST: 6, // UTC 21 → KST 06
        path: '/api/cron/generate-recommendations',
        verify: null,
    },
    {
        name: 'morning-motivation',
        critical: false,
        activeAfterKST: 9, // UTC 00 → KST 09
        path: '/api/cron/morning-motivation',
        verify: null,
    },
    {
        name: 'morning-widget-push',
        critical: false,
        activeAfterKST: 8,
        path: '/api/cron/morning-widget-push',
        verify: null,
    },
    {
        name: 'idle-schedule-nudge',
        critical: false,
        activeAfterKST: 10,
        path: '/api/cron/idle-schedule-nudge',
        verify: null,
    },
    {
        name: 'weekly-report',
        critical: false,
        activeAfterKST: 21,
        path: '/api/cron/weekly-report',
        verify: null,
    },
    {
        name: 'daily-insights',
        critical: false,
        activeAfterKST: 21, // UTC 12 → KST 21
        path: '/api/cron/daily-insights',
        verify: null,
    },
    {
        name: 'verify-briefings',
        critical: false,
        activeAfterKST: 6, // UTC 21 → KST 06
        path: '/api/cron/verify-briefings',
        verify: null,
    },
    {
        name: 'collect-curated-content',
        critical: false,
        activeAfterKST: 3, // UTC 18 → KST 03
        path: '/api/cron/collect-curated-content',
        verify: null,
    },
];

// ── 1. 증거 기반 CRON 검증 ──

export interface CronCheckResult {
    name: string;
    critical: boolean;
    status: 'ok' | 'missing' | 'degraded' | 'skipped';
    message: string;
    evidence?: Record<string, unknown>;
}

export async function verifyCronOutputs(today: string, kstHour: number): Promise<CronCheckResult[]> {
    const results: CronCheckResult[] = [];

    for (const cron of CRON_DEFINITIONS) {
        // 아직 실행 시간 전이면 skip
        if (kstHour < cron.activeAfterKST) {
            results.push({
                name: cron.name,
                critical: cron.critical,
                status: 'skipped',
                message: `KST ${cron.activeAfterKST}시 이후 검증`,
            });
            continue;
        }

        // 증거 기반 검증
        if (cron.verify) {
            try {
                const result = await cron.verify(today, kstHour);
                results.push({
                    name: cron.name,
                    critical: cron.critical,
                    status: result.status,
                    message: result.message,
                    evidence: result.evidence,
                });
            } catch (err: any) {
                results.push({
                    name: cron.name,
                    critical: cron.critical,
                    status: 'degraded',
                    message: `검증 실패: ${err?.message}`,
                });
            }
            continue;
        }

        // 로그 기반 검증 (최근 24시간 성공 로그 존재 여부)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: logs } = await supabaseAdmin
            .from('system_health_log')
            .select('status')
            .eq('cron_name', cron.name)
            .gte('created_at', twentyFourHoursAgo)
            .order('created_at', { ascending: false })
            .limit(5);

        if (!logs || logs.length === 0) {
            results.push({
                name: cron.name,
                critical: cron.critical,
                status: 'missing',
                message: '최근 24시간 실행 기록 없음',
            });
            continue;
        }

        const recentFailures = logs.filter(l => l.status === 'failure').length;
        if (recentFailures >= 3) {
            results.push({
                name: cron.name,
                critical: cron.critical,
                status: 'degraded',
                message: `최근 ${recentFailures}/${logs.length}회 실패`,
            });
        } else {
            results.push({
                name: cron.name,
                critical: cron.critical,
                status: 'ok',
                message: logs[0].status === 'success' ? '최근 실행 성공' : `최근 상태: ${logs[0].status}`,
            });
        }
    }

    return results;
}

// ── 2. 자가 복구 ──

interface SelfHealResult {
    cronName: string;
    attempted: boolean;
    success: boolean;
    message: string;
}

export async function attemptSelfHeal(missingCrons: CronCheckResult[]): Promise<SelfHealResult[]> {
    const results: SelfHealResult[] = [];
    const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
    const cronSecret = process.env.CRON_SECRET;

    if (!vercelUrl || !cronSecret) {
        return missingCrons.map(c => ({
            cronName: c.name,
            attempted: false,
            success: false,
            message: 'VERCEL_URL 또는 CRON_SECRET 미설정',
        }));
    }

    const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2시간

    for (const cron of missingCrons) {
        const def = CRON_DEFINITIONS.find(d => d.name === cron.name);
        if (!def) continue;

        // 쿨다운 체크
        const cooldownKey = `self_heal_${cron.name}`;
        const lastHeal = await kvGet<{ timestamp: string }>(SYSTEM_EMAIL, cooldownKey);
        if (lastHeal && Date.now() - new Date(lastHeal.timestamp).getTime() < COOLDOWN_MS) {
            results.push({
                cronName: cron.name,
                attempted: false,
                success: false,
                message: '쿨다운 중 (2시간 이내 재시도 불가)',
            });
            continue;
        }

        // 자가 복구 시도
        try {
            const protocol = vercelUrl.startsWith('localhost') ? 'http' : 'https';
            const url = `${protocol}://${vercelUrl}${def.path}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${cronSecret}` },
                signal: AbortSignal.timeout(60_000),
            });

            const success = response.ok;
            await logCronExecution(cron.name, success ? 'success' : 'failure', {
                self_heal: true,
                error: success ? undefined : `HTTP ${response.status}`,
            });

            // 쿨다운 기록
            await kvSet(SYSTEM_EMAIL, cooldownKey, { timestamp: new Date().toISOString() });

            results.push({
                cronName: cron.name,
                attempted: true,
                success,
                message: success ? '자가 복구 성공' : `자가 복구 실패 (HTTP ${response.status})`,
            });
        } catch (err: any) {
            await kvSet(SYSTEM_EMAIL, cooldownKey, { timestamp: new Date().toISOString() });
            results.push({
                cronName: cron.name,
                attempted: true,
                success: false,
                message: `자가 복구 에러: ${err?.message}`,
            });
        }
    }

    return results;
}

// ── 3. 헬스 점수 산정 ──

export type HealthLevel = 'healthy' | 'degraded' | 'warning' | 'critical';

export interface HealthScore {
    score: number;
    level: HealthLevel;
    breakdown: {
        criticalCrons: number;   // /40
        auxiliaryCrons: number;  // /20
        failureRate: number;    // /20
        externalAPIs: number;   // /20
    };
}

export async function computeHealthScore(cronResults: CronCheckResult[]): Promise<HealthScore> {
    // 1. 핵심 CRON 점수 (40점)
    const criticalCrons = cronResults.filter(c => c.critical && c.status !== 'skipped');
    const criticalOk = criticalCrons.filter(c => c.status === 'ok').length;
    const criticalTotal = criticalCrons.length;
    const criticalScore = criticalTotal > 0
        ? Math.round((criticalOk / criticalTotal) * 40)
        : 40;

    // 2. 보조 CRON 점수 (20점)
    const auxCrons = cronResults.filter(c => !c.critical && c.status !== 'skipped');
    const auxOk = auxCrons.filter(c => c.status === 'ok').length;
    const auxTotal = auxCrons.length;
    const auxScore = auxTotal > 0
        ? Math.round((auxOk / auxTotal) * 20)
        : 20;

    // 3. 최근 1시간 실패율 (20점)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabaseAdmin
        .from('system_health_log')
        .select('status')
        .gte('created_at', oneHourAgo)
        .neq('cron_name', 'system-monitor');

    let failureRateScore = 20;
    if (recentLogs && recentLogs.length > 0) {
        const failures = recentLogs.filter(l => l.status === 'failure').length;
        const rate = failures / recentLogs.length;
        failureRateScore = Math.round((1 - rate) * 20);
    }

    // 4. 외부 API 상태 (20점, circuit breaker 기반)
    let apiScore = 20;
    const circuits = [
        { name: 'openai-llm', circuit: llmCircuit },
        { name: 'react-agent', circuit: reactCircuit },
        { name: 'openai-embedding', circuit: embeddingCircuit },
    ];
    for (const { circuit } of circuits) {
        if (circuit.getState() === 'OPEN') apiScore -= 7;
        else if (circuit.getState() === 'HALF_OPEN') apiScore -= 3;
    }
    apiScore = Math.max(0, apiScore);

    const score = criticalScore + auxScore + failureRateScore + apiScore;

    let level: HealthLevel;
    if (score >= 90) level = 'healthy';
    else if (score >= 70) level = 'degraded';
    else if (score >= 50) level = 'warning';
    else level = 'critical';

    return {
        score,
        level,
        breakdown: {
            criticalCrons: criticalScore,
            auxiliaryCrons: auxScore,
            failureRate: failureRateScore,
            externalAPIs: apiScore,
        },
    };
}

// ── 4. 알림 발송 ──

const ALERT_INTERVALS: Record<HealthLevel, number> = {
    healthy: Infinity,
    degraded: 60 * 60 * 1000,     // 1시간
    warning: 30 * 60 * 1000,      // 30분
    critical: 10 * 60 * 1000,     // 10분
};

export async function sendHealthAlert(
    healthScore: HealthScore,
    cronResults: CronCheckResult[],
    selfHealResults: SelfHealResult[],
): Promise<boolean> {
    if (healthScore.level === 'healthy') return false;
    if (ADMIN_EMAILS.length === 0) return false;

    // 중복 방지 — 같은 심각도 알림 최근 발송 시간 확인
    const alertKey = `health_alert_last_${healthScore.level}`;
    const lastAlert = await kvGet<{ timestamp: string }>(SYSTEM_EMAIL, alertKey);
    const interval = ALERT_INTERVALS[healthScore.level];

    if (lastAlert && Date.now() - new Date(lastAlert.timestamp).getTime() < interval) {
        return false;
    }

    // 알림 내용 구성
    const levelEmoji: Record<HealthLevel, string> = {
        healthy: '',
        degraded: '⚠️',
        warning: '🟠',
        critical: '🚨',
    };

    const levelLabel: Record<HealthLevel, string> = {
        healthy: '정상',
        degraded: '주의',
        warning: '경고',
        critical: '심각',
    };

    const failedCrons = cronResults
        .filter(c => c.status === 'missing' || c.status === 'degraded')
        .map(c => `${c.critical ? '(핵심)' : ''} ${c.name}: ${c.message}`)
        .join('\n');

    const healSummary = selfHealResults
        .filter(r => r.attempted)
        .map(r => `${r.success ? '✅' : '❌'} ${r.cronName}`)
        .join(', ');

    const title = `${levelEmoji[healthScore.level]} 시스템 ${levelLabel[healthScore.level]} [${healthScore.score}점]`;
    let body = failedCrons || '상세 정보 없음';
    if (healSummary) body += `\n복구: ${healSummary}`;
    if (body.length > 200) body = body.slice(0, 197) + '...';

    for (const adminEmail of ADMIN_EMAILS) {
        try {
            await sendPushNotification(adminEmail, {
                title,
                body,
                data: {
                    type: 'system_health',
                    notificationId: `health-${healthScore.level}-${Date.now()}`,
                },
            });
        } catch {
            logger.error(`[SystemMonitor] Failed to notify ${adminEmail}`);
        }
    }

    // 알림 발송 시간 기록
    await kvSet(SYSTEM_EMAIL, alertKey, { timestamp: new Date().toISOString() });
    return true;
}

// ── 5. 채팅 & AI 품질 검증 ──

export interface ServiceCheckResult {
    name: string;
    status: 'ok' | 'warning' | 'critical';
    message: string;
    metrics?: Record<string, unknown>;
}

/**
 * 채팅 시스템 정합성 검증
 * - proactive-push CRON이 chat_history에 메시지를 정상 저장했는지
 * - 활성 유저 대비 오늘 chat_history 비율
 */
async function verifyChatIntegrity(today: string, kstHour: number): Promise<ServiceCheckResult> {
    if (kstHour < 9) return { name: 'chat-integrity', status: 'ok', message: '아직 이른 시간' };

    try {
        // 오늘 jarvis_notifications에 저장된 알림 수
        const { count: notifCount } = await supabaseAdmin
            .from('jarvis_notifications')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', `${today}T00:00:00+09:00`);

        // 오늘 chat_history에 저장된 대화 수
        const { count: chatCount } = await supabaseAdmin
            .from('chat_history')
            .select('*', { count: 'exact', head: true })
            .eq('date', today);

        const notifs = notifCount || 0;
        const chats = chatCount || 0;

        // 알림은 보냈는데 chat_history가 0이면 동기화 문제
        if (notifs > 0 && chats === 0) {
            return {
                name: 'chat-integrity',
                status: 'warning',
                message: `알림 ${notifs}건 발송했으나 chat_history 0건 — 동기화 문제 의심`,
                metrics: { notifications: notifs, chatHistories: chats },
            };
        }

        return {
            name: 'chat-integrity',
            status: 'ok',
            message: `알림 ${notifs}건, 채팅 ${chats}건`,
            metrics: { notifications: notifs, chatHistories: chats },
        };
    } catch (err: any) {
        return { name: 'chat-integrity', status: 'warning', message: `검증 실패: ${err?.message}` };
    }
}

/**
 * AI API 품질 모니터링
 * - 최근 1시간 AI 호출 실패율
 * - 토큰 사용량 이상 감지 (일평균 대비 3배 초과)
 * - Circuit breaker 상태
 */
async function verifyAIQuality(today: string): Promise<ServiceCheckResult> {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        // 최근 1시간 AI 사용 로그 (openai_usage_logs 테이블)
        const { data: usageLogs } = await supabaseAdmin
            .from('openai_usage_logs')
            .select('endpoint, estimated_cost, output_tokens')
            .gte('created_at', oneHourAgo);

        // 오늘 전체 AI 사용량
        const { data: todayUsage } = await supabaseAdmin
            .from('openai_usage_logs')
            .select('estimated_cost')
            .gte('created_at', `${today}T00:00:00+09:00`);

        const recentCalls = usageLogs?.length || 0;
        const recentZeroOutput = usageLogs?.filter(l => (l.output_tokens || 0) === 0).length || 0;
        const todayCost = todayUsage?.reduce((sum, l) => sum + (l.estimated_cost || 0), 0) || 0;

        // Circuit breaker 상태
        const circuitStates = {
            llm: llmCircuit.getState(),
            react: reactCircuit.getState(),
            embedding: embeddingCircuit.getState(),
        };
        const openCircuits = Object.entries(circuitStates)
            .filter(([_, state]) => state === 'OPEN')
            .map(([name]) => name);

        // 판정
        const issues: string[] = [];

        // 빈 응답 비율 50% 초과 (최소 5건 이상일 때)
        if (recentCalls >= 5 && recentZeroOutput / recentCalls > 0.5) {
            issues.push(`빈 응답 ${recentZeroOutput}/${recentCalls}건 (${Math.round(recentZeroOutput / recentCalls * 100)}%)`);
        }

        // Circuit breaker OPEN
        if (openCircuits.length > 0) {
            issues.push(`서킷 브레이커 OPEN: ${openCircuits.join(', ')}`);
        }

        // 일일 비용 $5 초과 (이상 사용)
        if (todayCost > 5) {
            issues.push(`오늘 비용 $${todayCost.toFixed(2)} (임계값 $5 초과)`);
        }

        if (issues.length > 0) {
            return {
                name: 'ai-quality',
                status: openCircuits.length > 0 ? 'critical' : 'warning',
                message: issues.join(' | '),
                metrics: { recentCalls, recentZeroOutput, todayCost: +todayCost.toFixed(3), circuitStates },
            };
        }

        return {
            name: 'ai-quality',
            status: 'ok',
            message: `최근 1시간 ${recentCalls}건, 비용 $${todayCost.toFixed(3)}`,
            metrics: { recentCalls, todayCost: +todayCost.toFixed(3), circuitStates },
        };
    } catch (err: any) {
        return { name: 'ai-quality', status: 'warning', message: `검증 실패: ${err?.message}` };
    }
}

/**
 * 전체 서비스 레벨 검증 (채팅 + AI)
 */
export async function verifyServiceHealth(today: string, kstHour: number): Promise<ServiceCheckResult[]> {
    const [chatResult, aiResult] = await Promise.all([
        verifyChatIntegrity(today, kstHour),
        verifyAIQuality(today),
    ]);
    return [chatResult, aiResult];
}

// ── 6. 로그 정리 ──

export async function cleanupOldLogs(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
        .from('system_health_log')
        .delete()
        .lt('created_at', thirtyDaysAgo);

    if (error) {
        logger.error('[SystemMonitor] Log cleanup failed:', error);
        return 0;
    }
    return 1; // 성공 여부만 반환
}
