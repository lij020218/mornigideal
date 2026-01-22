/**
 * Jarvis Run API
 * 주기적으로 호출되어 모든 Max 사용자에 대해 Jarvis 실행
 *
 * 사용법:
 * - Vercel Cron Job으로 5-10분마다 호출
 * - 또는 수동 트리거 (관리자)
 */

import { NextRequest, NextResponse } from 'next/server';
import { runJarvisForAllMaxUsers } from '@/lib/jarvis';

export const maxDuration = 300; // 5분 타임아웃
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    // 인증 체크 (Cron Secret)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    console.log('[Jarvis API] Starting Jarvis run...');

    try {
        await runJarvisForAllMaxUsers();

        return NextResponse.json({
            success: true,
            message: 'Jarvis run completed',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Jarvis API] Run failed:', error);

        return NextResponse.json(
            {
                success: false,
                error: String(error),
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

/**
 * POST: 특정 사용자에 대해서만 실행 (테스트용)
 */
export async function POST(request: NextRequest) {
    // 인증 체크
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const { userEmail } = await request.json();

        if (!userEmail) {
            return NextResponse.json(
                { error: 'userEmail is required' },
                { status: 400 }
            );
        }

        console.log(`[Jarvis API] Running for user: ${userEmail}`);

        const { JarvisOrchestrator } = await import('@/lib/jarvis');
        const orchestrator = new JarvisOrchestrator(userEmail);
        await orchestrator.run();

        return NextResponse.json({
            success: true,
            message: `Jarvis run completed for ${userEmail}`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Jarvis API] Run failed:', error);

        return NextResponse.json(
            {
                success: false,
                error: String(error),
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}
