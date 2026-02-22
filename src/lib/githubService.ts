/**
 * GitHub 연동 서비스
 * OAuth 토큰으로 GitHub API 호출
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

interface GitHubCommit {
    sha: string;
    message: string;
    date: string;
    repo: string;
}

interface GitHubContribution {
    totalCommits: number;
    currentStreak: number;
    longestStreak: number;
    recentRepos: string[];
}

/**
 * 사용자의 GitHub 토큰 조회
 */
async function getGitHubToken(email: string): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from('github_tokens')
        .select('access_token')
        .eq('user_email', email)
        .maybeSingle();

    return data?.access_token || null;
}

/**
 * GitHub 연동 여부 확인
 */
export async function isGitHubLinked(email: string): Promise<boolean> {
    const token = await getGitHubToken(email);
    return !!token;
}

/**
 * GitHub API 요청 헬퍼
 */
async function githubFetch(token: string, path: string): Promise<any> {
    const res = await fetch(`https://api.github.com${path}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });

    if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
}

/**
 * 최근 커밋 조회
 */
export async function getRecentCommits(email: string, limit: number = 10): Promise<GitHubCommit[]> {
    const token = await getGitHubToken(email);
    if (!token) return [];

    try {
        // Get recent events (commits)
        const events = await githubFetch(token, '/user/events?per_page=50');

        const commits: GitHubCommit[] = [];
        for (const event of events) {
            if (event.type === 'PushEvent' && event.payload?.commits) {
                for (const commit of event.payload.commits) {
                    commits.push({
                        sha: commit.sha?.substring(0, 7) || '',
                        message: commit.message?.split('\n')[0] || '',
                        date: event.created_at || '',
                        repo: event.repo?.name || '',
                    });
                    if (commits.length >= limit) break;
                }
            }
            if (commits.length >= limit) break;
        }

        return commits;
    } catch (error) {
        console.error('[GitHubService] getRecentCommits error:', error);
        return [];
    }
}

/**
 * 기여 통계 조회
 */
export async function getContributionStats(email: string): Promise<GitHubContribution | null> {
    const token = await getGitHubToken(email);
    if (!token) return null;

    try {
        // Get user info
        const user = await githubFetch(token, '/user');

        // Get recent events for streak calculation
        const events = await githubFetch(token, `/users/${user.login}/events?per_page=100`);

        // Calculate stats from events
        const commitDates = new Set<string>();
        const repos = new Set<string>();
        let totalCommits = 0;

        for (const event of events) {
            if (event.type === 'PushEvent') {
                const date = event.created_at?.split('T')[0];
                if (date) commitDates.add(date);
                totalCommits += event.payload?.commits?.length || 0;
                if (event.repo?.name) repos.add(event.repo.name);
            }
        }

        // Calculate streak
        const sortedDates = Array.from(commitDates).sort().reverse();
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Check if today or yesterday has commits (streak is active)
        if (sortedDates[0] === today || sortedDates[0] === yesterday) {
            let checkDate = new Date(sortedDates[0]);
            for (const dateStr of sortedDates) {
                const expected = checkDate.toISOString().split('T')[0];
                if (dateStr === expected) {
                    currentStreak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }
        }

        // Calculate longest streak
        for (let i = 0; i < sortedDates.length; i++) {
            if (i === 0) {
                tempStreak = 1;
            } else {
                const prev = new Date(sortedDates[i - 1]);
                const curr = new Date(sortedDates[i]);
                const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
                if (diffDays === 1) {
                    tempStreak++;
                } else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            }
        }
        longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

        return {
            totalCommits,
            currentStreak,
            longestStreak,
            recentRepos: Array.from(repos).slice(0, 5),
        };
    } catch (error) {
        console.error('[GitHubService] getContributionStats error:', error);
        return null;
    }
}
