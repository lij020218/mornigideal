import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabaseAdmin
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
        logger.error('[user/events] Error fetching events:', error);
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({ events: data || [] });
});
