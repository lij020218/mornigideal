import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        // Fetching briefing for today

        // Fetch pre-generated trend briefing from Supabase
        const { data, error } = await supabaseAdmin
            .from('trends_cache')
            .select('trends, last_updated')
            .eq('email', userEmail)
            .eq('date', today)
            .maybeSingle();

        if (error) {
            if (error.code === 'PGRST116') {
                // No briefing found
                // No pre-generated briefing found
                return NextResponse.json({ trends: null });
            }
            console.error('[trend-briefing/get] Error fetching briefing:', error);
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

    } catch (error) {
        console.error('[trend-briefing/get] Unexpected error:', error);
        return NextResponse.json({
            error: 'Failed to fetch briefing'
        }, { status: 500 });
    }
}
