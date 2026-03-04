import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCached, setCache } from '@/lib/cache';
import { logger } from '@/lib/logger';

/**
 * Get enhanced user profile with behavioral analytics
 *
 * This combines:
 * - Basic profile (job, goal, interests)
 * - Activity analytics (briefing preferences, schedule patterns)
 * - AI-friendly insights for personalization
 */

export const GET = withAuth(async (request: NextRequest, email: string) => {
    // Check cache first (5 min TTL)
    const cacheKey = `enhanced-profile:${email}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
        return NextResponse.json({ profile: cached });
    }

    // Fetch basic profile
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (profileError) {
        logger.error('[Enhanced Profile] Profile error:', profileError);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Fetch activity analytics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activities } = await supabaseAdmin
        .from('user_events')
        .select('*')
        .eq('email', email)
        .gte('created_at', thirtyDaysAgo.toISOString());

    const analytics = analyzeUserBehavior(activities || []);

    // Fetch schedule history (daily_goals uses user_id)
    const userId = profile?.id;
    const { data: schedules } = await supabaseAdmin
        .from('daily_goals')
        .select('*')
        .eq('user_id', userId);

    const scheduleInsights = analyzeSchedulePatterns(schedules || []);

    // Wellness analytics: 직접 계산 (self-fetch 제거)
    let wellnessAnalytics = null;
    try {
        const customGoals = profile?.profile?.customGoals || [];
        const exerciseKeywords = ['운동', '헬스', '러닝', '조깅', '요가', '필라테스', '수영', '등산', '산책', '스트레칭', '웨이트'];
        const sleepKeywords = ['취침', '수면', '잠자기'];

        const exerciseGoals = customGoals.filter((g: any) =>
            exerciseKeywords.some(k => (g.text || '').includes(k))
        );
        const sleepGoals = customGoals.filter((g: any) =>
            sleepKeywords.some(k => (g.text || '').includes(k))
        );

        wellnessAnalytics = {
            exerciseAnalytics: {
                preferredExerciseTimes: exerciseGoals
                    .filter((g: any) => g.startTime)
                    .map((g: any) => g.startTime)
                    .slice(0, 3),
            },
            sleepAnalytics: {
                recommendation: sleepGoals.length === 0 ? '규칙적인 취침 시간을 설정해보세요' : null,
            },
            wellnessInsights: {
                exerciseStatus: exerciseGoals.length >= 3 ? 'good' : exerciseGoals.length >= 1 ? 'moderate' : 'insufficient',
                sleepStatus: sleepGoals.length > 0 ? 'good' : 'unknown',
                recommendations: [],
                alerts: [],
            },
            timeSlotPatterns: {},
        };
    } catch (error) {
        logger.error('[Enhanced Profile] Failed to compute wellness analytics:', error);
    }

    // Build enhanced profile
    const enhancedProfile = {
        ...profile,
        behavioral_insights: {
            // Trend briefing preferences
            preferred_briefing_categories: analytics.topBriefingCategories,
            briefing_engagement_rate: analytics.briefingEngagementRate,

            // Schedule patterns
            most_completed_schedule_types: scheduleInsights.mostCompletedTypes,
            most_skipped_schedule_types: scheduleInsights.mostSkippedTypes,
            preferred_time_slots: analytics.mostActiveTimeSlots,
            overall_completion_rate: analytics.scheduleCompletionRate,

            // Activity summary
            total_briefings_read: analytics.briefingReadCount,
            total_schedules_completed: analytics.scheduleCompleted,
            chat_interactions: analytics.chatInteractions,

            // Wellness insights (from schedule analytics)
            exercise_analytics: wellnessAnalytics?.exerciseAnalytics,
            sleep_analytics: wellnessAnalytics?.sleepAnalytics,
            wellness_insights: wellnessAnalytics?.wellnessInsights,
            time_slot_patterns: wellnessAnalytics?.timeSlotPatterns,

            // Recommendations for AI
            ai_recommendations: generateAIRecommendations(analytics, scheduleInsights, profile, wellnessAnalytics),
        },
        last_updated: new Date().toISOString(),
    };

    setCache(cacheKey, enhancedProfile, 5 * 60 * 1000); // 5 minutes
    return NextResponse.json({ profile: enhancedProfile });
});

function analyzeUserBehavior(activities: any[]) {
    const analytics = {
        briefingReadCount: 0,
        briefingCategories: {} as Record<string, number>,
        topBriefingCategories: [] as string[],
        briefingEngagementRate: 0,
        scheduleCompleted: 0,
        scheduleSkipped: 0,
        scheduleTotal: 0,
        scheduleCompletionRate: 0,
        mostActiveTimeSlots: [] as string[],
        timeSlotCounts: {} as Record<string, number>,
        chatInteractions: 0,
    };

    activities.forEach(activity => {
        const metadata = activity.metadata || {};

        switch (activity.event_type) {
            case 'briefing_read':
                analytics.briefingReadCount++;
                const category = metadata.category || 'uncategorized';
                analytics.briefingCategories[category] = (analytics.briefingCategories[category] || 0) + 1;
                break;

            case 'schedule_complete':
                analytics.scheduleCompleted++;
                analytics.scheduleTotal++;

                const hour = new Date(activity.created_at).getHours();
                const timeSlot = `${hour}:00`;
                analytics.timeSlotCounts[timeSlot] = (analytics.timeSlotCounts[timeSlot] || 0) + 1;
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

    // Calculate completion rate
    if (analytics.scheduleTotal > 0) {
        analytics.scheduleCompletionRate = Math.round((analytics.scheduleCompleted / analytics.scheduleTotal) * 100);
    }

    // Get top 3 briefing categories
    analytics.topBriefingCategories = Object.entries(analytics.briefingCategories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([category]) => category);

    // Get top 3 most active time slots
    analytics.mostActiveTimeSlots = Object.entries(analytics.timeSlotCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([slot]) => slot);

    // Calculate engagement rate (% of days with at least 1 activity)
    const uniqueDays = new Set(activities.map(a => new Date(a.created_at).toDateString())).size;
    analytics.briefingEngagementRate = uniqueDays > 0 ? Math.round((analytics.briefingReadCount / uniqueDays) * 100) : 0;

    return analytics;
}

function analyzeSchedulePatterns(schedules: any[]) {
    const completed: Record<string, number> = {};
    const skipped: Record<string, number> = {};

    schedules.forEach(schedule => {
        const type = schedule.text || 'other';

        // This would need completion tracking in the actual schedule data
        // For now, we'll return empty arrays
    });

    return {
        mostCompletedTypes: Object.entries(completed)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([type]) => type),
        mostSkippedTypes: Object.entries(skipped)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([type]) => type),
    };
}

function generateAIRecommendations(analytics: any, scheduleInsights: any, profile: any, wellnessAnalytics: any = null) {
    const recommendations = {
        briefing_focus: [] as string[],
        schedule_suggestions: [] as string[],
        engagement_tips: [] as string[],
        wellness_recommendations: [] as string[],
    };

    // Briefing recommendations
    if (analytics.topBriefingCategories.length > 0) {
        recommendations.briefing_focus = [
            `User prefers ${analytics.topBriefingCategories.join(', ')} content`,
            `Prioritize these categories in recommendations`,
        ];
    }

    // Schedule recommendations
    if (analytics.scheduleCompletionRate < 50) {
        recommendations.schedule_suggestions = [
            'User struggles with schedule completion',
            'Suggest shorter, more manageable tasks',
            'Provide motivation and accountability',
        ];
    } else if (analytics.scheduleCompletionRate > 80) {
        recommendations.schedule_suggestions = [
            'User is highly disciplined',
            'Can handle more ambitious goals',
            'Encourage expansion of activities',
        ];
    }

    // Time-based recommendations
    if (analytics.mostActiveTimeSlots.length > 0) {
        recommendations.engagement_tips = [
            `Most active during: ${analytics.mostActiveTimeSlots.join(', ')}`,
            'Schedule important tasks during these times',
        ];
    }

    // Wellness recommendations
    if (wellnessAnalytics?.wellnessInsights) {
        const insights = wellnessAnalytics.wellnessInsights;

        // Exercise recommendations
        if (insights.exerciseStatus === 'insufficient') {
            recommendations.wellness_recommendations.push(
                'User needs more exercise - suggest workout activities',
                `Recommend exercising at ${wellnessAnalytics.exerciseAnalytics?.preferredExerciseTimes?.[0] || 'morning'}`
            );
        } else if (insights.exerciseStatus === 'excellent') {
            recommendations.wellness_recommendations.push(
                'User has excellent exercise habits - encourage maintaining routine'
            );
        }

        // Sleep recommendations
        if (insights.sleepStatus === 'insufficient') {
            recommendations.wellness_recommendations.push(
                'User needs better sleep - encourage consistent sleep schedule',
                wellnessAnalytics.sleepAnalytics?.recommendation || 'Aim for 7-9 hours of sleep'
            );
        } else if (insights.sleepStatus === 'excellent') {
            recommendations.wellness_recommendations.push(
                'User has excellent sleep habits - acknowledge this achievement'
            );
        }

        // Add specific alerts as recommendations
        if (insights.alerts?.length > 0) {
            recommendations.wellness_recommendations.push(...insights.alerts);
        }
    }

    return recommendations;
}
