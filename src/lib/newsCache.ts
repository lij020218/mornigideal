import { supabase } from './supabase';
import { auth } from '@/auth';

/**
 * Get current user email from session
 */
async function getUserEmail(): Promise<string | null> {
    try {
        const session = await auth();
        return session?.user?.email || null;
    } catch (error) {
        console.error('[NewsCache] Failed to get user email:', error);
        return null;
    }
}

/**
 * Generate unique trend ID from title
 */
export function generateTrendId(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 100);
}

/**
 * Get cached trends for today
 * @param emailOverride - Optional email for API routes where session is unavailable (e.g., mobile JWT auth)
 */
export async function getTrendsCache(emailOverride?: string): Promise<{ trends: any[]; lastUpdated: string } | null> {
    try {
        const userEmail = emailOverride || await getUserEmail();
        if (!userEmail) {
            console.warn('[NewsCache] No user email, skipping cache lookup');
            return null;
        }

        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        const { data, error } = await supabase
            .from('trends_cache')
            .select('trends, last_updated')
            .eq('email', userEmail)
            .eq('date', today)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found - normal case
                console.log('[NewsCache] No cached trends for today');
                return null;
            }
            throw error;
        }

        if (!data) return null;

        return {
            trends: data.trends as any[],
            lastUpdated: data.last_updated
        };
    } catch (error) {
        console.error('[NewsCache] Error fetching trends cache:', error);
        return null;
    }
}

/**
 * Get cached trends for a specific date (history)
 */
export async function getTrendsHistory(date: string): Promise<any[] | null> {
    try {
        const userEmail = await getUserEmail();
        if (!userEmail) return null;

        const { data, error } = await supabase
            .from('trends_cache')
            .select('trends')
            .eq('email', userEmail)
            .eq('date', date)
            .single();

        if (error || !data) return null;

        return data.trends as any[];
    } catch (error) {
        console.error('[NewsCache] Error fetching trends history:', error);
        return null;
    }
}

/**
 * Save trends to cache
 * @param trends - Trends to cache
 * @param clearExisting - Whether to clear existing cache first
 * @param emailOverride - Optional email for API routes where session is unavailable (e.g., mobile JWT auth)
 */
export async function saveTrendsCache(trends: any[], clearExisting: boolean = false, emailOverride?: string): Promise<void> {
    try {
        const userEmail = emailOverride || await getUserEmail();
        if (!userEmail) {
            console.warn('[NewsCache] No user email, skipping cache save');
            return;
        }

        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        // If clearExisting, delete old cache first
        if (clearExisting) {
            await supabase
                .from('trends_cache')
                .delete()
                .eq('email', userEmail)
                .eq('date', today);
        }

        const { error } = await supabase
            .from('trends_cache')
            .upsert({
                email: userEmail,
                date: today,
                trends: trends,
                last_updated: new Date().toISOString()
            }, {
                onConflict: 'email,date'
            });

        if (error) throw error;

        console.log(`[NewsCache] Saved ${trends.length} trends to cache`);
    } catch (error) {
        console.error('[NewsCache] Error saving trends cache:', error);
    }
}

/**
 * Get cached detail for a specific trend
 * @param trendId - Unique ID of the trend
 * @param emailOverride - Optional email for API routes where session is unavailable (e.g., mobile JWT auth)
 */
export async function getDetailCache(trendId: string, emailOverride?: string): Promise<any | null> {
    try {
        const userEmail = emailOverride || await getUserEmail();
        if (!userEmail) {
            console.warn('[NewsCache] No user email, skipping detail cache lookup');
            return null;
        }

        const { data, error } = await supabase
            .from('trend_details')
            .select('detail_data')
            .eq('email', userEmail)
            .eq('trend_id', trendId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found - normal case
                return null;
            }
            throw error;
        }

        return data?.detail_data || null;
    } catch (error) {
        console.error('[NewsCache] Error fetching detail cache:', error);
        return null;
    }
}

/**
 * Save detail analysis to cache
 * @param trendId - Unique ID of the trend
 * @param detail - Detail data to cache
 * @param emailOverride - Optional email for CRON jobs where session is unavailable
 */
export async function saveDetailCache(trendId: string, detail: any, emailOverride?: string): Promise<void> {
    try {
        const userEmail = emailOverride || await getUserEmail();
        if (!userEmail) {
            console.warn('[NewsCache] No user email, skipping detail cache save');
            return;
        }

        const { error } = await supabase
            .from('trend_details')
            .upsert({
                email: userEmail,
                trend_id: trendId,
                detail_data: detail,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'email,trend_id'
            });

        if (error) throw error;

        console.log(`[NewsCache] Saved detail for trend: ${trendId}`);
    } catch (error) {
        console.error('[NewsCache] Error saving detail cache:', error);
    }
}

/**
 * Get cached daily briefing for today
 */
export async function getDailyBriefingCache(): Promise<any | null> {
    try {
        const userEmail = await getUserEmail();
        if (!userEmail) {
            console.warn('[NewsCache] No user email, skipping briefing cache lookup');
            return null;
        }

        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        const { data, error } = await supabase
            .from('daily_briefings')
            .select('briefing_data, created_at')
            .eq('email', userEmail)
            .eq('date', today)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found - normal case
                console.log('[NewsCache] No cached daily briefing for today');
                return null;
            }
            throw error;
        }

        return data?.briefing_data || null;
    } catch (error) {
        console.error('[NewsCache] Error fetching daily briefing cache:', error);
        return null;
    }
}

/**
 * Save daily briefing to cache
 */
export async function saveDailyBriefingCache(briefingData: any): Promise<void> {
    try {
        const userEmail = await getUserEmail();
        if (!userEmail) {
            console.warn('[NewsCache] No user email, skipping briefing cache save');
            return;
        }

        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        const { error } = await supabase
            .from('daily_briefings')
            .upsert({
                email: userEmail,
                date: today,
                briefing_data: briefingData,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'email,date'
            });

        if (error) throw error;

        console.log(`[NewsCache] Saved daily briefing to cache for ${userEmail}`);
    } catch (error) {
        console.error('[NewsCache] Error saving daily briefing cache:', error);
    }
}
