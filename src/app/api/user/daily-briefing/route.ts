import { NextRequest, NextResponse } from "next/server";
import { getUserIdWithAuth, getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        let userId = await getUserIdWithAuth(request);

        if (!userId) {
            const email = await getUserEmailWithAuth(request);
            if (email) {
                const { data: u } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
                userId = u?.id;
            }
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // Today YYYY-MM-DD

        const { data, error } = await supabaseAdmin
            .from('daily_briefings')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            console.error("Fetch briefing error", error);
            return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
        }

        return NextResponse.json({ briefing: data });

    } catch (error) {
        console.error("Error fetching daily briefing:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    // Mark as read
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { briefingId } = await request.json();

        await supabaseAdmin
            .from('daily_briefings')
            .update({ is_read: true })
            .eq('id', briefingId);

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
