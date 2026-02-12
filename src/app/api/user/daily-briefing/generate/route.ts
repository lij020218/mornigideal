import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { generateDailyBriefings } from "@/lib/dailyBriefingGenerator";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Generate briefings for all users
        await generateDailyBriefings();

        // Fetch the generated briefing for current user using Admin client
        // CRITICAL: Always lookup by email to ensure we match the public.users ID used by the generator
        // (Session ID might be different depending on auth provider)
        const { data: u } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
        const userId = u?.id;


        if (userId) {
            const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

            const { data: briefing, error } = await supabaseAdmin
                .from('daily_briefings')
                .select('*')
                .eq('user_id', userId)
                .eq('date', date)
                .maybeSingle();

            if (error) {
                console.error("[GenerateRoute] Verification fetch failed:", error);
            } else {
            }

            return NextResponse.json({ success: true, briefing });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error generating briefing:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
