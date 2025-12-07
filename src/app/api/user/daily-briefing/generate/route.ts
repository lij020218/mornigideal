import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateDailyBriefings } from "@/lib/dailyBriefingGenerator";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Generate briefings for all users
        await generateDailyBriefings();

        // Fetch the generated briefing for current user using Admin client
        // CRITICAL: Always lookup by email to ensure we match the public.users ID used by the generator
        // (Session ID might be different depending on auth provider)
        const { data: u } = await supabaseAdmin.from('users').select('id').eq('email', session.user.email!).single();
        const userId = u?.id;

        console.log(`[GenerateRoute] Lookup for User: ${session.user.email} -> ID: ${userId}`);

        if (userId) {
            const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
            console.log(`[GenerateRoute] Querying briefing for Date: ${date}`);

            const { data: briefing, error } = await supabaseAdmin
                .from('daily_briefings')
                .select('*')
                .eq('user_id', userId)
                .eq('date', date)
                .single();

            if (error) {
                console.error("[GenerateRoute] Verification fetch failed:", error);
            } else {
                console.log(`[GenerateRoute] Found briefing: ${briefing ? 'YES' : 'NO'}`);
            }

            return NextResponse.json({ success: true, briefing });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error generating briefing:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
