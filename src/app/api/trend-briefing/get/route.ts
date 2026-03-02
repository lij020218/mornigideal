import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPlanName } from '@/lib/user-plan';
import { kvGet } from "@/lib/kv-store";
import { LIMITS } from "@/lib/constants";

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    // 유저 플랜 + 트렌드 데이터 + 읽음 정보 병렬 조회
    const [normalizedPlan, { data, error }, readIds] = await Promise.all([
        getPlanName(email),
        supabaseAdmin
            .from('trends_cache')
            .select('trends, last_updated')
            .eq('email', email)
            .eq('date', today)
            .maybeSingle(),
        kvGet<string[]>(email, `read_trend_ids_${today}`),
    ]);

    const articleCount = LIMITS.TREND_BRIEFING_COUNT[normalizedPlan] || 3;
    const refreshLimit = LIMITS.TREND_REFRESH_DAILY[normalizedPlan] ?? 0;

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ trends: null });
        }
        logger.error('[trend-briefing/get] Error fetching briefing:', error);
        return NextResponse.json({ error: 'Failed to fetch briefing' }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ trends: null });
    }

    const refreshKey = `trend_refresh_count_${today}`;
    const currentRefreshCount = await kvGet<number>(email, refreshKey) || 0;

    return NextResponse.json({
        trends: (data.trends || []).slice(0, articleCount),
        generated_at: data.last_updated,
        readIds: readIds || [],
        refreshRemaining: Math.max(0, refreshLimit - currentRefreshCount),
    });
});
