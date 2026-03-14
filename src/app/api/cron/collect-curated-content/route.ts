import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import { logCronExecution } from '@/lib/cron-logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ContentItem {
    title: string;
    url: string;
    description: string;
    score?: number;
}

// KST 기준 오늘 날짜
function getKSTDate(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
}

// GitHub Trending: 최근 생성된 인기 레포지토리
async function fetchGitHubTrending(): Promise<ContentItem[]> {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().split('T')[0];

    const res = await fetch(
        `https://api.github.com/search/repositories?q=created:>${sinceStr}&sort=stars&order=desc&per_page=10`,
        { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);

    const data = await res.json();
    return (data.items || []).slice(0, 10).map((repo: any) => ({
        title: repo.full_name,
        url: repo.html_url,
        description: (repo.description || '').slice(0, 200),
        score: repo.stargazers_count,
    }));
}

// Google Books: 분야별 최신 도서
async function fetchBestsellerBooks(): Promise<ContentItem[]> {
    const subjects = ['technology', 'business', 'self-help', 'science'];
    const allBooks: ContentItem[] = [];

    for (const subject of subjects) {
        try {
            const res = await fetch(
                `https://www.googleapis.com/books/v1/volumes?q=subject:${subject}&orderBy=newest&maxResults=3&langRestrict=ko`
            );
            if (!res.ok) continue;
            const data = await res.json();
            for (const item of (data.items || []).slice(0, 3)) {
                const info = item.volumeInfo || {};
                allBooks.push({
                    title: info.title || '',
                    url: info.infoLink || '',
                    description: (info.description || '').slice(0, 200),
                });
            }
        } catch {
            // 개별 카테고리 실패해도 계속
        }
    }
    return allBooks.slice(0, 10);
}

// arXiv: AI/CS 최신 논문
async function fetchArxivPapers(): Promise<ContentItem[]> {
    const res = await fetch(
        'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=10'
    );
    if (!res.ok) throw new Error(`arXiv API ${res.status}`);

    const xml = await res.text();
    const entries: ContentItem[] = [];

    // 간단한 XML 파싱 (의존성 없이)
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null && entries.length < 10) {
        const entry = match[1];
        const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, ' ') || '';
        const url = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || '';
        const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, ' ') || '';
        entries.push({
            title,
            url,
            description: summary.slice(0, 200),
        });
    }
    return entries;
}

// Hacker News: Top Stories
async function fetchHackerNews(): Promise<ContentItem[]> {
    const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!idsRes.ok) throw new Error(`HN API ${idsRes.status}`);

    const ids: number[] = await idsRes.json();
    const top10 = ids.slice(0, 10);

    const items = await Promise.allSettled(
        top10.map(async (id) => {
            const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
            if (!res.ok) return null;
            const item = await res.json();
            return {
                title: item.title || '',
                url: item.url || `https://news.ycombinator.com/item?id=${id}`,
                description: '',
                score: item.score || 0,
            } as ContentItem;
        })
    );

    return items
        .filter((r): r is PromiseFulfilledResult<ContentItem | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((v): v is ContentItem => v !== null);
}

export async function GET(request: Request) {
    const start = Date.now();
    try {
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const today = getKSTDate();
        logger.info(`[Curated Content] Collecting for ${today}`);

        const sources = [
            { category: 'github', fetcher: fetchGitHubTrending },
            { category: 'books', fetcher: fetchBestsellerBooks },
            { category: 'arxiv', fetcher: fetchArxivPapers },
            { category: 'hackernews', fetcher: fetchHackerNews },
        ];

        const results = await Promise.allSettled(
            sources.map(async ({ category, fetcher }) => {
                const items = await fetcher();
                const { error } = await supabaseAdmin
                    .from('curated_content_cache')
                    .upsert({
                        date: today,
                        category,
                        items,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'date,category' });

                if (error) throw error;
                return { category, count: items.length };
            })
        );

        const summary = results.map((r, i) => {
            const cat = sources[i].category;
            if (r.status === 'fulfilled') return `${cat}: ${r.value.count} items`;
            logger.error(`[Curated Content] ${cat} failed:`, r.reason);
            return `${cat}: FAILED`;
        });

        logger.info(`[Curated Content] Done: ${summary.join(', ')}`);

        await logCronExecution('collect-curated-content', 'success', {}, Date.now() - start);
        return NextResponse.json({
            success: true,
            date: today,
            results: summary,
        });
    } catch (error: any) {
        await logCronExecution('collect-curated-content', 'failure', { error: error?.message }, Date.now() - start);
        logger.error('[Curated Content] Error:', error);
        return NextResponse.json(
            { error: 'Failed to collect curated content' },
            { status: 500 }
        );
    }
}
