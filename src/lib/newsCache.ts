// In-memory cache for Vercel deployment compatibility
// Note: This cache will be reset when the serverless function cold starts.
// For persistent caching in production, consider using Vercel KV or Redis.

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

// Global in-memory storage
let globalCache: CachedData = {
    trends: [],
    details: {},
    lastUpdated: new Date(0).toISOString()
};

export async function saveTrendsCache(trends: CachedTrend[]): Promise<void> {
    globalCache.trends = trends;
    globalCache.lastUpdated = new Date().toISOString();
    console.log('[Cache] Trends saved to in-memory cache');
}

export function isCacheValid(lastUpdated: string): boolean {
    const now = new Date();
    const cacheDate = new Date(lastUpdated);

    // Simple 6-hour cache validity check
    const sixHoursInMs = 6 * 60 * 60 * 1000;
    return (now.getTime() - cacheDate.getTime()) < sixHoursInMs;
}

export async function getTrendsCache(): Promise<CachedData | null> {
    if (globalCache.trends.length === 0) {
        return null;
    }

    // Check if cache is still valid
    if (!isCacheValid(globalCache.lastUpdated)) {
        console.log('[Cache] Cache expired, needs refresh');
        return null;
    }

    return globalCache;
}

export async function saveDetailCache(trendId: string, detail: CachedDetail): Promise<void> {
    globalCache.details[trendId] = detail;
    console.log(`[Cache] Detail saved for ${trendId}`);
}

export async function getDetailCache(trendId: string): Promise<CachedDetail | null> {
    return globalCache.details[trendId] || null;
}

export async function getAllDetailsCache(): Promise<Record<string, CachedDetail>> {
    return globalCache.details;
}

export function generateTrendId(title: string): string {
    return Buffer.from(title).toString('base64url');
}
