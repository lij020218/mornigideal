import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { kvGet } from "@/lib/kv-store";

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    // 트렌드 데이터 + 읽음 정보 병렬 조회
    const [{ data, error }, readIds] = await Promise.all([
        supabaseAdmin
            .from('trends_cache')
            .select('trends, last_updated')
            .eq('email', email)
            .eq('date', today)
            .maybeSingle(),
        kvGet<string[]>(email, `read_trend_ids_${today}`),
    ]);

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

    return NextResponse.json({
        trends: data.trends || [],
        generated_at: data.last_updated,
        readIds: readIds || [],
    });
});
