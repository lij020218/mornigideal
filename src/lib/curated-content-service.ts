/**
 * 큐레이션 콘텐츠 서비스
 * Pro 유저의 일정 추천 시 실제 콘텐츠(GitHub, 도서, 논문, HN)를 프롬프트에 주입
 */

import { supabaseAdmin } from './supabase-admin';
import { getPlanName } from './user-plan';
import { logger } from './logger';

interface ContentItem {
    title: string;
    url: string;
    description: string;
    score?: number;
}

/**
 * Pro 유저에게 오늘의 큐레이션 콘텐츠를 프롬프트용 텍스트로 반환
 * Free 유저는 null 반환
 */
export async function getCuratedContentForPrompt(email: string): Promise<string | null> {
    try {
        const plan = await getPlanName(email);
        if (plan === 'Free') return null;

        // KST 기준 오늘
        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const today = kst.toISOString().split('T')[0];

        const { data, error } = await supabaseAdmin
            .from('curated_content_cache')
            .select('category, items')
            .eq('date', today);

        if (error || !data || data.length === 0) {
            // 오늘 데이터 없으면 어제 데이터 시도
            const yesterday = new Date(kst.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const { data: fallback } = await supabaseAdmin
                .from('curated_content_cache')
                .select('category, items')
                .eq('date', yesterday);

            if (!fallback || fallback.length === 0) return null;
            return formatContentForPrompt(fallback);
        }

        return formatContentForPrompt(data);
    } catch (err) {
        logger.error('[CuratedContent] Error:', err);
        return null;
    }
}

function formatContentForPrompt(
    rows: { category: string; items: ContentItem[] }[]
): string {
    const categoryLabels: Record<string, string> = {
        github: '🔥 GitHub 트렌딩 프로젝트',
        books: '📚 추천 도서',
        arxiv: '📄 최신 AI/CS 논문',
        hackernews: '💡 Hacker News 인기 글',
    };

    const sections: string[] = [];

    for (const row of rows) {
        const label = categoryLabels[row.category] || row.category;
        const items = (row.items || []).slice(0, 5);
        if (items.length === 0) continue;

        const lines = items.map((item, i) =>
            `${i + 1}. ${item.title}${item.description ? ` - ${item.description.slice(0, 80)}` : ''}`
        );
        sections.push(`${label}:\n${lines.join('\n')}`);
    }

    if (sections.length === 0) return null as any;

    return `\n[큐레이션 콘텐츠 - 학습/자기계발 추천에만 활용]
아래는 오늘의 트렌딩 콘텐츠입니다. 학습, 자기계발, 독서, 기술 학습 관련 일정을 추천할 때만 이 콘텐츠를 참고하여 구체적인 제목을 포함하세요.
운동, 휴식, 식사, 여가, 취미 등의 추천에는 이 콘텐츠를 사용하지 마세요.

${sections.join('\n\n')}`;
}
