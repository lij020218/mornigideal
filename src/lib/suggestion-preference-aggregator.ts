/**
 * 추천 선호도 집계기
 *
 * user_events에서 ai_suggestion_shown/accepted/dismissed를 집계하여
 * 카테고리별·시간대별 선호도를 계산. user_kv_store에 캐시.
 *
 * feedback-aggregator.ts 패턴과 동일:
 * weight = acceptRate / (avgRate + 0.1), 클램프 [0.2, 3.0]
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { kvSet, kvGet } from '@/lib/kv-store';
import { logger } from '@/lib/logger';

export interface SuggestionPreferences {
    categoryWeights: Record<string, number>;
    timeCategoryScores: Record<string, Record<string, number>>;
    topCategories: string[];
    avoidCategories: string[];
    updatedAt: string;
}

const KV_KEY = 'suggestion_preferences';

/**
 * 4주간 추천 이벤트를 집계하여 선호도 계산 → user_kv_store 저장
 */
export async function computeSuggestionPreferences(userEmail: string): Promise<SuggestionPreferences> {
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const since = fourWeeksAgo.toISOString();

    // 병렬로 3종 이벤트 조회
    const [{ data: shownEvents }, { data: acceptedEvents }, { data: dismissedEvents }] = await Promise.all([
        supabaseAdmin
            .from('user_events')
            .select('metadata')
            .eq('user_email', userEmail)
            .eq('event_type', 'ai_suggestion_shown')
            .gte('created_at', since),
        supabaseAdmin
            .from('user_events')
            .select('metadata, start_at')
            .eq('user_email', userEmail)
            .eq('event_type', 'ai_suggestion_accepted')
            .gte('created_at', since),
        supabaseAdmin
            .from('user_events')
            .select('metadata')
            .eq('user_email', userEmail)
            .eq('event_type', 'ai_suggestion_dismissed')
            .gte('created_at', since),
    ]);

    // 카테고리별 집계
    const stats: Record<string, { shown: number; accepted: number; dismissed: number }> = {};
    const ensure = (cat: string) => {
        if (!stats[cat]) stats[cat] = { shown: 0, accepted: 0, dismissed: 0 };
    };

    for (const evt of shownEvents || []) {
        const suggestions = evt.metadata?.suggestions || [];
        for (const s of suggestions) {
            const cat = s.category || 'unknown';
            ensure(cat);
            stats[cat].shown++;
        }
    }

    for (const evt of acceptedEvents || []) {
        const cat = evt.metadata?.category || 'unknown';
        ensure(cat);
        stats[cat].accepted++;
    }

    for (const evt of dismissedEvents || []) {
        const cat = evt.metadata?.category || 'unknown';
        ensure(cat);
        stats[cat].dismissed++;
    }

    // weight 계산 (feedback-aggregator 패턴)
    const rates = Object.entries(stats).map(([cat, s]) => ({
        cat,
        rate: s.accepted / (s.shown || 1),
    }));
    const avgRate = rates.length > 0
        ? rates.reduce((sum, r) => sum + r.rate, 0) / rates.length
        : 0;

    const categoryWeights: Record<string, number> = {};
    for (const { cat, rate } of rates) {
        categoryWeights[cat] = Math.min(3.0, Math.max(0.2, rate / (avgRate + 0.1)));
    }

    // 시간대-카테고리 선호도
    const tcCounts: Record<string, Record<string, { accepted: number; total: number }>> = {
        morning: {}, afternoon: {}, evening: {},
    };

    for (const evt of acceptedEvents || []) {
        const hour = evt.metadata?.hour ?? new Date(evt.start_at).getHours();
        const cat = evt.metadata?.category || 'unknown';
        const block = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        if (!tcCounts[block][cat]) tcCounts[block][cat] = { accepted: 0, total: 0 };
        tcCounts[block][cat].accepted++;
        tcCounts[block][cat].total++;
    }

    for (const evt of shownEvents || []) {
        const hour = evt.metadata?.hour ?? 12;
        const block = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        for (const s of (evt.metadata?.suggestions || [])) {
            const cat = s.category || 'unknown';
            if (!tcCounts[block][cat]) tcCounts[block][cat] = { accepted: 0, total: 0 };
            tcCounts[block][cat].total++;
        }
    }

    const timeCategoryScores: Record<string, Record<string, number>> = {
        morning: {}, afternoon: {}, evening: {},
    };
    for (const [block, cats] of Object.entries(tcCounts)) {
        for (const [cat, c] of Object.entries(cats)) {
            timeCategoryScores[block][cat] = c.total > 0 ? c.accepted / c.total : 0;
        }
    }

    // 상위/하위 카테고리
    const sorted = Object.entries(categoryWeights).sort((a, b) => b[1] - a[1]);
    const topCategories = sorted.slice(0, 2).map(([cat]) => cat);
    const avoidCategories = sorted.filter(([, w]) => w < 0.3).map(([cat]) => cat);

    const prefs: SuggestionPreferences = {
        categoryWeights,
        timeCategoryScores,
        topCategories,
        avoidCategories,
        updatedAt: new Date().toISOString(),
    };

    await kvSet(userEmail, KV_KEY, prefs);
    logger.info(`[SuggestionPrefs] Updated for ${userEmail}: top=${topCategories.join(',')}, avoid=${avoidCategories.join(',')}`);

    return prefs;
}

/**
 * 캐시된 선호도 조회 (없으면 null)
 */
export async function getSuggestionPreferences(userEmail: string): Promise<SuggestionPreferences | null> {
    return kvGet<SuggestionPreferences>(userEmail, KV_KEY);
}
