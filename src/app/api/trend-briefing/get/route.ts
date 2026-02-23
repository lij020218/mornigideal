import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from '@/lib/supabase-admin';

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    // Fetching briefing for today

    // Fetch pre-generated trend briefing from Supabase
    const { data, error } = await supabaseAdmin
        .from('trends_cache')
        .select('trends, last_updated')
        .eq('email', email)
        .eq('date', today)
        .maybeSingle();

    if (error) {
        if (error.code === 'PGRST116') {
            // No briefing found
            // No pre-generated briefing found
            return NextResponse.json({ trends: null });
        }
        logger.error('[trend-briefing/get] Error fetching briefing:', error);
        return NextResponse.json({ error: 'Failed to fetch briefing' }, { status: 500 });
    }

    if (!data) {
        // No briefing data found
        return NextResponse.json({ trends: null });
    }

    // Found pre-generated briefing

    // Return in the format expected by the frontend
    return NextResponse.json({
        trends: data.trends || [],
        generated_at: data.last_updated
    });
});
