/**
 * 관리자 대시보드 API
 *
 * GET: 시스템 상태 + 피드백 데이터 반환
 * - 관리자만 접근 가능 (ADMIN_EMAILS)
 * - 트렌드 브리핑 배포 상태
 * - 선제적 알림 전송 통계
 * - 시스템 이상 감지 내역
 * - 에스컬레이션 피드백 통계
 * - 최근 오류 내역
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

function isAdmin(email: string): boolean {
    return ADMIN_EMAILS.includes(email);
}

export const GET = withAuth(async (request: NextRequest, email: string) => {
    // 관리자 권한 확인
    if (!isAdmin(email)) {
        return NextResponse.json({ error: 'Forbidden', isAdmin: false }, { status: 403 });
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const now = new Date();

    // 모든 데이터를 병렬로 가져옴
    const [
        usersResult,
        trendCacheResult,
        pushTokensResult,
        notificationsResult,
        alertsResult,
        feedbackResult,
        dailyBriefingResult,
        userFeedbackNewResult,
        systemHealthResult,
        recentFailuresResult,
    ] = await Promise.all([
        // 1. 전체 유저 수
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).not('profile', 'is', null),

        // 2. 오늘 트렌드 브리핑 배포 수
        supabaseAdmin.from('trends_cache').select('*', { count: 'exact', head: true }).eq('date', today),

        // 3. 활성 푸시 토큰
        supabaseAdmin.from('push_tokens').select('*', { count: 'exact', head: true }).eq('active', true),

        // 4. 오늘 전송된 알림 (타입별)
        supabaseAdmin
            .from('jarvis_notifications')
            .select('type')
            .gte('created_at', `${today}T00:00:00+09:00`),

        // 5. 시스템 알림 내역 (최근 7일)
        supabaseAdmin
            .from('user_kv_store')
            .select('key, value, updated_at')
            .like('key', 'system_alert_%')
            .order('updated_at', { ascending: false })
            .limit(7),

        // 6. 에스컬레이션 피드백 (dismiss streak 통계)
        supabaseAdmin
            .from('user_kv_store')
            .select('key, value')
            .like('key', 'dismiss_streak_%'),

        // 7. 데일리 브리핑 생성 수
        supabaseAdmin.from('daily_briefings').select('*', { count: 'exact', head: true }).eq('date', today),

        // 8. 미처리 사용자 피드백 수
        supabaseAdmin.from('user_feedback').select('*', { count: 'exact', head: true }).eq('status', 'new'),

        // 9. 시스템 헬스 최근 결과
        supabaseAdmin
            .from('system_health_log')
            .select('details, created_at')
            .eq('cron_name', 'system-monitor')
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(1),

        // 10. 최근 24시간 CRON 실패 내역
        supabaseAdmin
            .from('system_health_log')
            .select('cron_name, status, details, created_at')
            .eq('status', 'failure')
            .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(20),
    ]);

    // ── 알림 타입별 통계 ──
    const notificationsByType: Record<string, number> = {};
    if (notificationsResult.data) {
        for (const n of notificationsResult.data) {
            notificationsByType[n.type] = (notificationsByType[n.type] || 0) + 1;
        }
    }

    // ── 에스컬레이션 피드백 분석 ──
    const escalationStats: Record<string, { suppressed: number; active: number }> = {};
    if (feedbackResult.data) {
        for (const row of feedbackResult.data) {
            const type = row.key.replace('dismiss_streak_', '');
            const streak = row.value as { count: number };
            if (!escalationStats[type]) escalationStats[type] = { suppressed: 0, active: 0 };
            if (streak.count >= 3) {
                escalationStats[type].suppressed++;
            } else {
                escalationStats[type].active++;
            }
        }
    }

    // ── 시스템 이상 감지 내역 ──
    const systemAlerts = (alertsResult.data || []).map((row: any) => ({
        date: row.key.replace('system_alert_', ''),
        areas: row.value?.areas || [],
        lastAlert: row.value?.lastAlert,
    }));

    // ── 브리핑 배포율 ──
    const totalUsers = usersResult.count || 0;
    const briefedUsers = trendCacheResult.count || 0;
    const briefingCoverage = totalUsers > 0 ? Math.round((briefedUsers / totalUsers) * 100) : 0;

    // ── 건강 상태 판단 ──
    const issues: string[] = [];
    const kstHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();

    if (kstHour >= 6 && briefingCoverage < 80) {
        issues.push(`트렌드 브리핑 배포율 ${briefingCoverage}% (${briefedUsers}/${totalUsers})`);
    }
    if ((pushTokensResult.count || 0) === 0) {
        issues.push('활성 푸시 토큰 0개');
    }
    if (kstHour >= 7 && (dailyBriefingResult.count || 0) === 0) {
        issues.push('데일리 브리핑 미생성');
    }

    const status = issues.length === 0 ? 'healthy' : issues.some(i => i.includes('0개')) ? 'critical' : 'warning';

    // ── 시스템 헬스 모니터 데이터 ──
    const latestHealth = systemHealthResult.data?.[0];
    const healthMetrics = latestHealth?.details?.metrics as any;
    const recentFailures = (recentFailuresResult.data || []).map((row: any) => ({
        cronName: row.cron_name,
        error: row.details?.error,
        selfHeal: row.details?.self_heal || false,
        at: row.created_at,
    }));

    return NextResponse.json({
        isAdmin: true,
        timestamp: now.toISOString(),
        date: today,
        status,
        issues,
        stats: {
            totalUsers,
            trendBriefing: {
                delivered: briefedUsers,
                coverage: briefingCoverage,
            },
            dailyBriefing: {
                count: dailyBriefingResult.count || 0,
            },
            pushTokens: {
                active: pushTokensResult.count || 0,
            },
            notifications: {
                today: notificationsResult.data?.length || 0,
                byType: notificationsByType,
            },
        },
        escalation: escalationStats,
        systemAlerts,
        feedback: {
            newCount: userFeedbackNewResult.count || 0,
        },
        systemHealth: {
            score: healthMetrics?.score ?? null,
            level: healthMetrics?.level ?? null,
            breakdown: healthMetrics?.breakdown ?? null,
            lastCheck: latestHealth?.created_at ?? null,
            recentFailures,
        },
    });
});
