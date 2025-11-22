import { promises as fs } from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache', 'news');
const TRENDS_CACHE_FILE = path.join(CACHE_DIR, 'trends.json');
const DETAILS_CACHE_FILE = path.join(CACHE_DIR, 'details.json');

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

async function ensureCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating cache directory:', error);
    }
}

export async function saveTrendsCache(trends: CachedTrend[]): Promise<void> {
    await ensureCacheDir();
    const data: CachedData = {
        trends,
        details: {},
        lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(TRENDS_CACHE_FILE, JSON.stringify(data, null, 2));
}

export function isCacheValid(lastUpdated: string): boolean {
    const now = new Date();
    const cacheDate = new Date(lastUpdated);

    // Get today's 4 AM
    const today4AM = new Date(now);
    today4AM.setHours(4, 0, 0, 0);

    // Get tomorrow's 4 AM
    const tomorrow4AM = new Date(today4AM);
    tomorrow4AM.setDate(tomorrow4AM.getDate() + 1);

    // Cache is valid if:
    // 1. Cache was created before today's 4 AM and current time is before today's 4 AM, OR
    // 2. Cache was created after today's 4 AM and current time is before tomorrow's 4 AM

    if (now < today4AM) {
        // Before today's 4 AM - cache is valid if it was created yesterday
        const yesterday4AM = new Date(today4AM);
        yesterday4AM.setDate(yesterday4AM.getDate() - 1);
        return cacheDate >= yesterday4AM && cacheDate < today4AM;
    } else {
        // After today's 4 AM - cache is valid if it was created after today's 4 AM
        return cacheDate >= today4AM && cacheDate < tomorrow4AM;
    }
}

export async function getTrendsCache(): Promise<CachedData | null> {
    try {
        const data = await fs.readFile(TRENDS_CACHE_FILE, 'utf-8');
        const parsedData = JSON.parse(data);

        // Check if cache is still valid (until next 4 AM)
        if (!isCacheValid(parsedData.lastUpdated)) {
            console.log('[Cache] Cache expired, needs refresh');
            return null;
        }

        return parsedData;
    } catch (error) {
        return null;
    }
}

export async function saveDetailCache(trendId: string, detail: CachedDetail): Promise<void> {
    await ensureCacheDir();

    let allDetails: Record<string, CachedDetail> = {};
    try {
        const data = await fs.readFile(DETAILS_CACHE_FILE, 'utf-8');
        allDetails = JSON.parse(data);
    } catch (error) {
        // File doesn't exist yet, start fresh
    }

    allDetails[trendId] = detail;
    await fs.writeFile(DETAILS_CACHE_FILE, JSON.stringify(allDetails, null, 2));
}

export async function getDetailCache(trendId: string): Promise<CachedDetail | null> {
    try {
        const data = await fs.readFile(DETAILS_CACHE_FILE, 'utf-8');
        const allDetails: Record<string, CachedDetail> = JSON.parse(data);
        return allDetails[trendId] || null;
    } catch (error) {
        return null;
    }
}

export async function getAllDetailsCache(): Promise<Record<string, CachedDetail>> {
    try {
        const data = await fs.readFile(DETAILS_CACHE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

export function generateTrendId(title: string): string {
    return Buffer.from(title).toString('base64url');
}
