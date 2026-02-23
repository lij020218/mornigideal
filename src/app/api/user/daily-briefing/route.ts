import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const GET = withAuth(async (request: NextRequest, email: string) => {
    // Lookup userId from email
    const { data: u } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
    const userId = u?.id;

    if (!userId) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // Today YYYY-MM-DD

    const { data, error } = await supabaseAdmin
        .from('daily_briefings')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        logger.error("Fetch briefing error", error);
        return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json({ briefing: data });
});

export const POST = withAuth(async (request: NextRequest, email: string) => {
    // Mark as read
    const { briefingId } = await request.json();

    await supabaseAdmin
        .from('daily_briefings')
        .update({ is_read: true })
        .eq('id', briefingId);

    return NextResponse.json({ success: true });
});
