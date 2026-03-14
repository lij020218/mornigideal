// Heartbeat Cron API
//
// 30분 간격으로 실행 (KST 06:00~22:00)
//
// 1. Google Calendar 동기화
// 2. 시스템 건강 점검 (KST 6시, 12시, 18시에만)
//    - 트렌드 브리핑 배포 상태
//    - 데일리 브리핑 배포 상태
//    - 푸시 토큰 활성 상태
//    - CRON 실행 기록 (jarvis_notifications 기반)
// 3. 이상 감지 시 관리자에게 푸시 알림

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendPushNotification } from '@/lib/pushService';
import { logger } from '@/lib/logger';
import { logCronExecution } from '@/lib/cron-logger';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

interface HealthIssue {
    severity: 'warning' | 'critical';
    area: string;
    message: string;
}

/**
 * 시스템 건강 점검 — 트렌드 브리핑, 데일리 브리핑, 푸시 토큰 등
 */
async function checkSystemHealth(today: string): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = [];
    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const kstHour = kst.getHours();

    // ── 1. 트렌드 브리핑 배포 점검 (6시 이후) ──
    if (kstHour >= 6) {
        const { count: totalUsers } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact', head: true })
            .not('profile', 'is', null);

        const { count: briefedUsers } = await supabaseAdmin
            .from('trends_cache')
            .select('*', { count: 'exact', head: true })
            .eq('date', today);

        const total = totalUsers || 0;
        const briefed = briefedUsers || 0;

        if (total > 0) {
            const coverage = Math.round((briefed / total) * 100);
            if (coverage < 50) {
                issues.push({
                    severity: 'critical',
                    area: '트렌드 브리핑',
                    message: `배포율 ${coverage}% (${briefed}/${total}명). 50% 미만 — CRON 실패 의심`,
                });
            } else if (coverage < 80) {
                issues.push({
                    severity: 'warning',
                    area: '트렌드 브리핑',
                    message: `배포율 ${coverage}% (${briefed}/${total}명). 일부 유저 누락`,
                });
            }
        }
    }

    // ── 2. 데일리 브리핑 배포 점검 (6시 이후) ──
    if (kstHour >= 6) {
        const { count: briefingCount } = await supabaseAdmin
            .from('daily_briefings')
            .select('*', { count: 'exact', head: true })
            .eq('date', today);

        if ((briefingCount || 0) === 0 && kstHour >= 7) {
            issues.push({
                severity: 'warning',
                area: '데일리 브리핑',
                message: `오늘(${today}) 생성된 데일리 브리핑이 0건`,
            });
        }
    }

    // ── 3. 푸시 토큰 상태 점검 ──
    const { count: activeTokens } = await supabaseAdmin
        .from('push_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);

    if ((activeTokens || 0) === 0) {
        issues.push({
            severity: 'critical',
            area: '푸시 토큰',
            message: '활성 푸시 토큰이 0개. 모든 푸시 알림 전송 불가',
        });
    }

    // ── 4. 하루 마무리 CRON 점검 (22시) ──
    if (kstHour >= 22) {
        const todayStart = `${today}T00:00:00+09:00`;
        const { count: wrapCount } = await supabaseAdmin
            .from('jarvis_notifications')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'daily_wrap')
            .gte('created_at', todayStart);

        if ((wrapCount || 0) === 0) {
            issues.push({
                severity: 'warning',
                area: '하루 마무리',
                message: '오늘 daily_wrap 알림이 0건 — proactive-push CRON 점검 필요',
            });
        }
    }

    // ── 5. DB 연결 점검 ──
    try {
        const { error } = await supabaseAdmin
            .from('users')
            .select('email')
            .limit(1)
            .maybeSingle();

        if (error) {
            issues.push({
                severity: 'critical',
                area: 'DB 연결',
                message: `Supabase 쿼리 실패: ${error.message}`,
            });
        }
    } catch (dbErr: any) {
        issues.push({
            severity: 'critical',
            area: 'DB 연결',
            message: `Supabase 접속 불가: ${dbErr?.message}`,
        });
    }

    return issues;
}

/**
 * 관리자에게 이상 감지 알림 전송
 */
async function notifyAdmins(issues: HealthIssue[], today: string): Promise<number> {
    if (ADMIN_EMAILS.length === 0 || issues.length === 0) return 0;

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    const title = criticalCount > 0
        ? `🚨 시스템 이상 감지 (심각 ${criticalCount}건)`
        : `⚠️ 시스템 경고 (${warningCount}건)`;

    const body = issues
        .map(i => `${i.severity === 'critical' ? '🔴' : '🟡'} [${i.area}] ${i.message}`)
        .join('\n');

    // 중복 알림 방지 — 같은 날 같은 이슈를 이미 보냈으면 스킵
    const alertKey = `system_alert_${today}`;
    const { data: existingAlert } = await supabaseAdmin
        .from('user_kv_store')
        .select('value')
        .eq('user_email', ADMIN_EMAILS[0])
        .eq('key', alertKey)
        .maybeSingle();

    const sentAreas: string[] = existingAlert?.value?.areas || [];
    const newIssues = issues.filter(i => !sentAreas.includes(i.area));

    if (newIssues.length === 0) return 0;

    let notified = 0;
    for (const adminEmail of ADMIN_EMAILS) {
        try {
            await sendPushNotification(adminEmail, {
                title,
                body: body.length > 200 ? body.slice(0, 197) + '...' : body,
                data: {
                    type: 'system_alert',
                    notificationId: `system-alert-${today}`,
                },
            });
            notified++;
        } catch {
            logger.error(`[Heartbeat] Failed to notify admin ${adminEmail}`);
        }
    }

    // 보낸 알림 기록 (중복 방지)
    const areaSet = new Set([...sentAreas, ...newIssues.map(i => i.area)]);
    const allSentAreas = Array.from(areaSet);
    await supabaseAdmin.from('user_kv_store').upsert({
        user_email: ADMIN_EMAILS[0],
        key: alertKey,
        value: { areas: allSentAreas, lastAlert: new Date().toISOString() },
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_email,key' }).then(() => {}, () => {});

    return notified;
}

// ============================================
// Main Heartbeat Handler
// ============================================

export async function GET(request: NextRequest) {
    const start = Date.now();
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const kstHour = kst.getHours();

    if (kstHour < 6 || kstHour >= 22) {
        return NextResponse.json({
            success: true,
            message: 'Outside active hours (KST 06-22)',
            skipped: true,
        });
    }

    const today = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;

    try {
        // ── 1. GCal 동기화 (기존) ──
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const PAGE_SIZE = 50;
        let pageOffset = 0;
        let activeUsers: { email: string }[] = [];

        while (true) {
            const { data: batch, error: usersError } = await supabaseAdmin
                .from('users')
                .select('email')
                .gte('updated_at', sevenDaysAgo.toISOString())
                .range(pageOffset, pageOffset + PAGE_SIZE - 1);

            if (usersError) {
                logger.error('[Heartbeat] Failed to get users:', usersError);
                break;
            }
            if (!batch || batch.length === 0) break;
            activeUsers = activeUsers.concat(batch);
            if (batch.length < PAGE_SIZE) break;
            pageOffset += PAGE_SIZE;
        }

        let synced = 0;
        for (const user of activeUsers) {
            try {
                const { data: gcalToken } = await supabaseAdmin
                    .from('google_calendar_tokens')
                    .select('user_email')
                    .eq('user_email', user.email)
                    .maybeSingle();

                if (gcalToken) {
                    const { GoogleCalendarService } = await import('@/lib/googleCalendarService');
                    const gcalService = new GoogleCalendarService(user.email);
                    await gcalService.sync();
                    synced++;
                }
            } catch (syncError) {
                logger.error('[Heartbeat] GCal sync error:', syncError);
            }
        }

        // ── 2. 시스템 건강 점검 (6시, 12시, 18시에만 — 30분 간격 중 정시) ──
        const healthCheckHours = [6, 12, 18];
        let healthIssues: HealthIssue[] = [];
        let notifiedAdmins = 0;

        if (healthCheckHours.includes(kstHour)) {
            healthIssues = await checkSystemHealth(today);

            if (healthIssues.length > 0) {
                logger.warn(`[Heartbeat] ${healthIssues.length} health issues detected:`,
                    healthIssues.map(i => `[${i.severity}] ${i.area}: ${i.message}`).join(' | ')
                );

                notifiedAdmins = await notifyAdmins(healthIssues, today);
            } else {
                logger.info(`[Heartbeat] System healthy at KST ${kstHour}:00`);
            }
        }

        await logCronExecution('heartbeat', 'success', {
            affected_count: synced,
            metrics: { activeUsers: activeUsers.length, healthIssues: healthIssues.length },
        }, Date.now() - start);
        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            kstHour,
            activeUsers: activeUsers.length,
            gcalSynced: synced,
            healthCheck: healthCheckHours.includes(kstHour) ? {
                ran: true,
                issues: healthIssues.length,
                critical: healthIssues.filter(i => i.severity === 'critical').length,
                warnings: healthIssues.filter(i => i.severity === 'warning').length,
                notifiedAdmins,
                details: healthIssues,
            } : { ran: false },
        });
    } catch (error: any) {
        await logCronExecution('heartbeat', 'failure', { error: error?.message }, Date.now() - start);
        logger.error('[Heartbeat] Fatal error:', error);
        return NextResponse.json(
            { error: 'Heartbeat failed' },
            { status: 500 }
        );
    }
}
