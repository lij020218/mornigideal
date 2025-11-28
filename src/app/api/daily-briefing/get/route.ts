import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
    try {
        // Authenticate user
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userEmail = session.user.email;
        const today = new Date().toISOString().split('T')[0];

        console.log(`[daily-briefing/get] Fetching briefing for ${userEmail} on ${today}`);

        // Fetch pre-generated briefing from Supabase
        const { data, error } = await supabase
            .from('daily_briefings')
            .select('briefing_data, created_at')
            .eq('email', userEmail)
            .eq('date', today)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No briefing found
                console.log(`[daily-briefing/get] No pre-generated briefing found for ${userEmail}`);
                return NextResponse.json({ briefing: null });
            }
            console.error('[daily-briefing/get] Error fetching briefing:', error);
            return NextResponse.json({ error: 'Failed to fetch briefing' }, { status: 500 });
        }

        if (!data) {
            console.log(`[daily-briefing/get] No briefing data for ${userEmail}`);
            return NextResponse.json({ briefing: null });
        }

        console.log(`[daily-briefing/get] Found pre-generated briefing for ${userEmail}`);

        return NextResponse.json({
            briefing: data.briefing_data,
            generated_at: data.created_at
        });

    } catch (error) {
        console.error('[daily-briefing/get] Unexpected error:', error);
        return NextResponse.json({
            error: 'Failed to fetch briefing',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
