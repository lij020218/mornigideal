import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        console.log(`[trend-briefing/get] Fetching briefing for ${userEmail} on ${today}`);

        // Fetch pre-generated trend briefing from Supabase
        const { data, error } = await supabase
            .from('trends_cache')
            .select('trends, last_updated')
            .eq('email', userEmail)
            .eq('date', today)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No briefing found
                console.log(`[trend-briefing/get] No pre-generated briefing found for ${userEmail}`);
                return NextResponse.json({ trends: null });
            }
            console.error('[trend-briefing/get] Error fetching briefing:', error);
            return NextResponse.json({ error: 'Failed to fetch briefing' }, { status: 500 });
        }

        if (!data) {
            console.log(`[trend-briefing/get] No briefing data for ${userEmail}`);
            return NextResponse.json({ trends: null });
        }

        console.log(`[trend-briefing/get] Found pre-generated briefing for ${userEmail}`);

        // Return in the format expected by the frontend
        return NextResponse.json({
            trends: data.trends || [],
            generated_at: data.last_updated
        });

    } catch (error) {
        console.error('[trend-briefing/get] Unexpected error:', error);
        return NextResponse.json({
            error: 'Failed to fetch briefing',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
