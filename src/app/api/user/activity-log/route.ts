import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Log user activity for personalization
 *
 * Activity types:
 * - briefing_read: User read a trend briefing
 *   metadata: { briefingId, title, category, keywords }
 *
 * - schedule_complete: User completed a schedule
 *   metadata: { scheduleId, scheduleType, scheduleText, startTime, endTime, duration }
 *
 * - schedule_skip: User skipped a schedule
 *   metadata: { scheduleId, scheduleType, scheduleText, startTime, reason }
 *
 * - chat_interaction: User interacted with AI chat
 *   metadata: { messageCount, topic }
 */

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { activityType, metadata } = await request.json();


        // Store activity in database
        const { data, error } = await supabaseAdmin
            .from('user_activity_logs')
            .insert({
                user_email: email,
                activity_type: activityType,
                metadata: metadata,
                timestamp: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[Activity Log] Database error:', error);
            return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
        }

        return NextResponse.json({ success: true, activity: data });
    } catch (error: any) {
        console.error('[Activity Log] Error:', error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * Get user activity analytics
 */
export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Fetch recent activities (capped at 500 for performance)
        const { data: activities, error } = await supabaseAdmin
            .from('user_activity_logs')
            .select('*')
            .eq('user_email', email)
            .gte('timestamp', startDate.toISOString())
            .order('timestamp', { ascending: false })
            .limit(500);

        if (error) {
            console.error('[Activity Log] Query error:', error);
            return NextResponse.json({ error: "Failed to fetch activity log" }, { status: 500 });
        }

        // Analyze activities
        const analytics = analyzeActivities(activities || []);

        return NextResponse.json({ activities, analytics });
    } catch (error: any) {
        console.error('[Activity Log] Error:', error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

function analyzeActivities(activities: any[]) {
    const analytics = {
        briefingReadCount: 0,
        briefingCategories: {} as Record<string, number>,
        scheduleCompletionRate: 0,
        scheduleCompleted: 0,
        scheduleSkipped: 0,
        scheduleTotal: 0,
        preferredScheduleCategories: {} as Record<string, number>,
        mostActiveTimeSlots: {} as Record<string, number>,
        chatInteractions: 0,
    };

    activities.forEach(activity => {
        const metadata = activity.metadata || {};

        switch (activity.activity_type) {
            case 'briefing_read':
                analytics.briefingReadCount++;
                const category = metadata.category || 'uncategorized';
                analytics.briefingCategories[category] = (analytics.briefingCategories[category] || 0) + 1;
                break;

            case 'schedule_complete':
                analytics.scheduleCompleted++;
                analytics.scheduleTotal++;
                const scheduleType = metadata.scheduleType || 'other';
                analytics.preferredScheduleCategories[scheduleType] = (analytics.preferredScheduleCategories[scheduleType] || 0) + 1;

                // Track time slots
                const hour = new Date(activity.timestamp).getHours();
                const timeSlot = `${hour}:00`;
                analytics.mostActiveTimeSlots[timeSlot] = (analytics.mostActiveTimeSlots[timeSlot] || 0) + 1;
                break;

            case 'schedule_skip':
                analytics.scheduleSkipped++;
                analytics.scheduleTotal++;
                break;

            case 'chat_interaction':
                analytics.chatInteractions++;
                break;
        }
    });

    if (analytics.scheduleTotal > 0) {
        analytics.scheduleCompletionRate = (analytics.scheduleCompleted / analytics.scheduleTotal) * 100;
    }

    // Sort categories by frequency
    analytics.briefingCategories = Object.fromEntries(
        Object.entries(analytics.briefingCategories).sort(([, a], [, b]) => b - a)
    );

    analytics.preferredScheduleCategories = Object.fromEntries(
        Object.entries(analytics.preferredScheduleCategories).sort(([, a], [, b]) => b - a)
    );

    return analytics;
}
