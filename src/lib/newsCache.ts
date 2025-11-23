// Supabase-based cache for persistent storage
import { supabase } from './supabase';

export interface CachedTrend {
    category: string;
    title: string;
    time: string;
    imageColor: string;
    imageUrl?: string;
    originalUrl: string;
    summary: string;
    id: string;
}

export interface CachedDetail {
    title: string;
    content: string;
    keyTakeaways: string[];
    actionItems: string[];
    originalUrl: string;
}

export interface CachedData {
    trends: CachedTrend[];
    details: Record<string, CachedDetail>;
    lastUpdated: string;
}

export async function saveTrendsCache(trends: CachedTrend[], clearExisting: boolean = false): Promise<void> {
    try {
        // If clearExisting is true, delete all old trends first
        if (clearExisting) {
            const { error: deleteError } = await supabase
                .from('trends')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

            if (deleteError) {
                console.error('[Cache] Error clearing old trends:', deleteError);
            } else {
                console.log('[Cache] Cleared old trends from Supabase');
            }
        }

        const trendsToInsert = trends.map(t => ({
            id: t.id,
            title: t.title,
            category: t.category,
            time: t.time,
            image_color: t.imageColor,
            image_url: t.imageUrl,
            original_url: t.originalUrl,
            summary: t.summary,
            created_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('trends')
            .upsert(trendsToInsert);

        if (error) {
            console.error('[Cache] Error saving trends:', error);
        } else {
            console.log('[Cache] Trends saved to Supabase');
        }
    } catch (e) {
        console.error('[Cache] Exception saving trends:', e);
    }
}

export function isCacheValid(lastUpdated: string): boolean {
    const now = new Date();
    const cacheDate = new Date(lastUpdated);
    const sixHoursInMs = 6 * 60 * 60 * 1000;
    return (now.getTime() - cacheDate.getTime()) < sixHoursInMs;
}

export async function getTrendsCache(): Promise<CachedData | null> {
    try {
        // Get latest trends (limit 10 for example)
        const { data, error } = await supabase
            .from('trends')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error || !data || data.length === 0) {
            return null;
        }

        // Check validity of the most recent item
        const latestTrend = data[0];
        if (!isCacheValid(latestTrend.created_at)) {
            console.log('[Cache] Cache expired (db), needs refresh');
            return null;
        }

        const trends: CachedTrend[] = data.map(t => ({
            id: t.id,
            title: t.title,
            category: t.category,
            time: t.time,
            imageColor: t.image_color,
            imageUrl: t.image_url,
            originalUrl: t.original_url,
            summary: t.summary
        }));

        return {
            trends,
            details: {}, // Details are fetched on demand
            lastUpdated: latestTrend.created_at
        };
    } catch (e) {
        console.error('[Cache] Error fetching trends:', e);
        return null;
    }
}

export async function saveDetailCache(trendId: string, detail: CachedDetail): Promise<void> {
    try {
        const { error } = await supabase
            .from('trend_details')
            .upsert({
                trend_id: trendId,
                title: detail.title,
                content: detail.content,
                key_takeaways: detail.keyTakeaways,
                action_items: detail.actionItems,
                original_url: detail.originalUrl
            });

        if (error) {
            console.error(`[Cache] Error saving detail for ${trendId}:`, error);
        } else {
            console.log(`[Cache] Detail saved for ${trendId}`);
        }
    } catch (e) {
        console.error(`[Cache] Exception saving detail:`, e);
    }
}

export async function getDetailCache(trendId: string): Promise<CachedDetail | null> {
    try {
        const { data, error } = await supabase
            .from('trend_details')
            .select('*')
            .eq('trend_id', trendId)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            title: data.title,
            content: data.content,
            keyTakeaways: data.key_takeaways,
            actionItems: data.action_items,
            originalUrl: data.original_url
        };
    } catch (e) {
        return null;
    }
}

export async function getAllDetailsCache(): Promise<Record<string, CachedDetail>> {
    // Not strictly needed for Supabase implementation as we fetch on demand
    return {};
}

export function generateTrendId(title: string): string {
    return Buffer.from(title).toString('base64url');
}
