import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { activityLogSchema, validateBody } from '@/lib/schemas';
import { logger } from '@/lib/logger';

/**
 * Log user activity for personalization
 */
export const POST = withAuth(async (request: NextRequest, email: string) => {
    const body = await request.json();
    const v = validateBody(activityLogSchema, body);
    if (!v.success) return v.response;
    const { activityType, metadata } = v.data;

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
        logger.error('[Activity Log] Database error:', error);
        return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
    }

    return NextResponse.json({ success: true, activity: data });
});

/**
 * Get user activity analytics
 */
export const GET = withAuth(async (request: NextRequest, email: string) => {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: activities, error } = await supabaseAdmin
        .from('user_activity_logs')
        .select('*')
        .eq('user_email', email)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false })
        .limit(500);

    if (error) {
        logger.error('[Activity Log] Query error:', error);
        return NextResponse.json({ error: "Failed to fetch activity log" }, { status: 500 });
    }

    const analytics = analyzeActivities(activities || []);

    return NextResponse.json({ activities, analytics });
});

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

    analytics.briefingCategories = Object.fromEntries(
        Object.entries(analytics.briefingCategories).sort(([, a], [, b]) => b - a)
    );

    analytics.preferredScheduleCategories = Object.fromEntries(
        Object.entries(analytics.preferredScheduleCategories).sort(([, a], [, b]) => b - a)
    );

    return analytics;
}
