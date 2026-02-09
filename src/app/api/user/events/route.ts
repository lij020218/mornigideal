import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let query = supabase
            .from('user_events')
            .select('*')
            .eq('user_email', email);

        if (type) {
            query = query.eq('event_type', type);
        }

        if (startDate) {
            const startDateTime = new Date(startDate);
            startDateTime.setHours(0, 0, 0, 0);
            query = query.gte('start_at', startDateTime.toISOString());
        }

        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            query = query.lte('start_at', endDateTime.toISOString());
        }

        const { data, error } = await query.order('start_at', { ascending: false });

        if (error) {
            console.error('[user/events] Error fetching events:', error);
            return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
        }

        return NextResponse.json({ events: data || [] });

    } catch (error) {
        console.error('[user/events] Unexpected error:', error);
        return NextResponse.json({
            error: 'Failed to fetch events'
        }, { status: 500 });
    }
}
