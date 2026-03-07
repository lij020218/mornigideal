/**
 * GitHub 활동 요약 API (Pro 이상)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-handler';
import { isProOrAbove } from '@/lib/user-plan';
import { getRecentCommits, getContributionStats, isGitHubLinked } from '@/lib/githubService';

export const GET = withAuth(async (request: NextRequest, email: string) => {
    // Plan gate: Pro 이상
    if (!(await isProOrAbove(email))) {
        return NextResponse.json(
            { error: 'GitHub 연동은 Pro 플랜에서 사용 가능합니다.' },
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
});
