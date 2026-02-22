/**
 * GitHub 활동 요약 API (Max 전용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';
import { isMaxPlan } from '@/lib/user-plan';
import { getRecentCommits, getContributionStats, isGitHubLinked } from '@/lib/githubService';

export async function GET(request: NextRequest) {
    const email = await getUserEmailWithAuth(request);
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Plan gate: Max only
    if (!(await isMaxPlan(email))) {
        return NextResponse.json(
            { error: 'GitHub 연동은 Max 플랜에서 사용 가능합니다.' },
            { status: 403 },
        );
    }

    // Check if linked
    if (!(await isGitHubLinked(email))) {
        return NextResponse.json(
            { error: 'GitHub 계정이 연동되지 않았습니다.', linked: false },
            { status: 400 },
        );
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

    const [commits, stats] = await Promise.all([
        getRecentCommits(email, limit),
        getContributionStats(email),
    ]);

    return NextResponse.json({
        linked: true,
        commits,
        stats,
    });
}
