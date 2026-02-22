/**
 * Simple in-memory TTL cache for serverless environments.
 *
 * On Vercel, each serverless function instance has its own memory,
 * and instances are recycled after ~5-15 minutes of inactivity.
 * This cache provides short-lived memoization within a single instance.
 *
 * Usage:
 *   import { getCached, setCache, invalidateCache } from '@/lib/cache';
 *
 *   const key = `enhanced-profile:${email}`;
 *   const cached = getCached<ProfileData>(key);
 *   if (cached) return cached;
 *
 *   const data = await fetchExpensiveData();
 *   setCache(key, data, 5 * 60 * 1000); // 5 minutes
 */

interface CacheEntry<T = unknown> {
    data: T;
    expiry: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Get a cached value, or null if expired/missing.
 */
export function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
        cache.delete(key);
        return null;
    }

    return entry.data as T;
}

/**
 * Set a cached value with a TTL in milliseconds.
 */
export function setCache<T>(key: string, data: T, ttlMs: number): void {
    cache.set(key, {
        data,
        expiry: Date.now() + ttlMs,
    });
}

/**
 * Invalidate cache entries whose keys start with the given prefix.
 */
export function invalidateCache(prefix: string): void {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}

/**
 * Get cache stats (for debugging).
 */
export function getCacheStats(): { size: number; keys: string[] } {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now > entry.expiry) {
            cache.delete(key);
        }
    }

    return {
        size: cache.size,
        keys: Array.from(cache.keys()),
    };
}
