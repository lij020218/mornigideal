// Heartbeat Cron API
//
// 30분 간격으로 실행
// - Google Calendar 동기화
// (선제적 알림 생성/푸시는 proactive-push cron이 담당 — 중복 방지)
//
// 스케줄: 매 30분 (KST 06:00~22:00)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

export const maxDuration = 300; // 5분 타임아웃
export const dynamic = 'force-dynamic';

// ============================================
// Main Heartbeat Handler
// ============================================

export async function GET(request: NextRequest) {
    // 인증 체크 (Cron Secret)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // KST 시간 체크 — 6:00~22:00만 실행
    const now = new Date();
    const kstHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
    if (kstHour < 6 || kstHour >= 22) {
        return NextResponse.json({
            success: true,
            message: 'Outside active hours (KST 06-22)',
            skipped: true,
        });
    }

    try {
        // 1. 최근 7일 이내에 활동한 사용자 조회 (paginated, email only)
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
                return NextResponse.json({ error: 'Failed to get users' }, { status: 500 });
            }
            if (!batch || batch.length === 0) break;
            activeUsers = activeUsers.concat(batch);
            if (batch.length < PAGE_SIZE) break;
            pageOffset += PAGE_SIZE;
        }


        // 2. 각 사용자별 GCal 동기화
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

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            kstHour,
            activeUsers: activeUsers.length,
            gcalSynced: synced,
        });
    } catch (error) {
        logger.error('[Heartbeat] Fatal error:', error);
        return NextResponse.json(
            { error: 'Heartbeat failed' },
            { status: 500 }
        );
    }
}
