import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { modeEventSchema, validateBody } from '@/lib/schemas';
import { logger } from '@/lib/logger';

/**
 * Mode Events API
 *
 * Tracks focus mode and sleep mode events for analytics and weekly reports.
 *
 * Event Types:
 * - focus_start: User started focus mode
 * - focus_end: User ended focus mode
 * - focus_interrupted: User switched tabs during focus mode
 * - sleep_start: User started sleep mode
 * - sleep_end: User woke up / ended sleep mode
 */

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const body = await request.json();
    const v = validateBody(modeEventSchema, body);
    if (!v.success) return v.response;
    const { eventType, metadata } = v.data;

    // Insert event into user_events table
    const { data, error } = await supabaseAdmin
        .from('user_events')
        .insert({
            email: email,
            event_type: eventType,
            metadata: metadata || {},
            created_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        logger.error('[Mode Events] Failed to insert event:', error);
        return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
    }


    return NextResponse.json({
        success: true,
        event: data,
    });
});

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabaseAdmin
        .from('user_events')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false });

    // Filter by event type (focus or sleep related)
    if (eventType) {
        if (eventType === 'focus') {
            query = query.in('event_type', ['focus_start', 'focus_end', 'focus_interrupted']);
        } else if (eventType === 'sleep') {
            query = query.in('event_type', ['sleep_start', 'sleep_end']);
        } else {
            query = query.eq('event_type', eventType);
        }
    } else {
        // Default: only mode events
        query = query.in('event_type', [
            'focus_start', 'focus_end', 'focus_interrupted',
            'sleep_start', 'sleep_end'
        ]);
    }

    // Filter by date range
    if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
    }
    if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    // Limit results
    query = query.limit(100);

    const { data, error } = await query;

    if (error) {
        logger.error('[Mode Events] Failed to fetch events:', error);
        return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    // Calculate statistics
    const focusEvents = data?.filter(e =>
        e.event_type === 'focus_start' || e.event_type === 'focus_end'
    ) || [];

    const sleepEvents = data?.filter(e =>
        e.event_type === 'sleep_start' || e.event_type === 'sleep_end'
    ) || [];

    // Calculate focus statistics
    let totalFocusMinutes = 0;
    let focusSessions = 0;
    let totalInterruptions = 0;

    const focusEndEvents = data?.filter(e => e.event_type === 'focus_end') || [];
    focusEndEvents.forEach(event => {
        if (event.metadata?.duration) {
            totalFocusMinutes += Math.floor(event.metadata.duration / 60);
            focusSessions++;
        }
        if (event.metadata?.interruptCount) {
            totalInterruptions += event.metadata.interruptCount;
        }
    });

    // Calculate sleep statistics
    let totalSleepMinutes = 0;
    let sleepSessions = 0;

    const sleepEndEvents = data?.filter(e => e.event_type === 'sleep_end') || [];
    sleepEndEvents.forEach(event => {
        if (event.metadata?.durationMinutes) {
            totalSleepMinutes += event.metadata.durationMinutes;
            sleepSessions++;
        }
    });

    return NextResponse.json({
        events: data,
        statistics: {
            focus: {
                totalMinutes: totalFocusMinutes,
                sessions: focusSessions,
                avgSessionMinutes: focusSessions > 0 ? Math.round(totalFocusMinutes / focusSessions) : 0,
                totalInterruptions,
            },
            sleep: {
                totalMinutes: totalSleepMinutes,
                sessions: sleepSessions,
                avgSleepHours: sleepSessions > 0 ? (totalSleepMinutes / sleepSessions / 60).toFixed(1) : 0,
            },
        },
    });
});
