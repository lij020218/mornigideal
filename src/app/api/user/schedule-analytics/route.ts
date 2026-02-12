import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Deep Schedule Pattern Analysis
 *
 * Analyzes user schedules to understand:
 * - What activities happen at what times
 * - Exercise preferences and frequency
 * - Sleep duration and quality
 * - Wellness insights and recommendations
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

        // Fetch user's schedules (custom goals)
        const { data: schedules, error: schedulesError } = await supabaseAdmin
            .from('custom_goals')
            .select('*')
            .eq('user_email', email)
            .gte('created_at', startDate.toISOString());

        if (schedulesError) {
            console.error('[Schedule Analytics] Error fetching schedules:', schedulesError);
            return NextResponse.json({ error: schedulesError.message }, { status: 500 });
        }

        // Fetch schedule completion activities
        const { data: activities, error: activitiesError } = await supabaseAdmin
            .from('user_activity_logs')
            .select('*')
            .eq('user_email', email)
            .in('activity_type', ['schedule_complete', 'schedule_skip'])
            .gte('timestamp', startDate.toISOString());

        if (activitiesError) {
            console.error('[Schedule Analytics] Error fetching activities:', activitiesError);
        }

        // Analyze patterns
        const analytics = analyzeSchedulePatterns(schedules || [], activities || []);

        return NextResponse.json({ analytics });
    } catch (error: any) {
        console.error('[Schedule Analytics] Error:', error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

interface SchedulePattern {
    activityType: string;
    timeSlots: string[];
    frequency: number;
    avgDuration?: number;
}

interface ExerciseAnalytics {
    totalWorkouts: number;
    workoutTypes: Record<string, number>;
    avgWorkoutsPerWeek: number;
    preferredExerciseTimes: string[];
    mostFrequentExercise?: string;
    weeklyGoalMet: boolean;
}

interface SleepAnalytics {
    avgSleepDuration: number; // in hours
    avgBedtime: string;
    avgWakeTime: string;
    sleepConsistency: number; // 0-100
    isHealthy: boolean;
    recommendation?: string;
}

interface WellnessInsights {
    exerciseStatus: 'insufficient' | 'adequate' | 'excellent';
    sleepStatus: 'insufficient' | 'adequate' | 'excellent';
    recommendations: string[];
    alerts: string[];
}

function analyzeSchedulePatterns(schedules: any[], activities: any[]) {
    const analytics = {
        timeSlotPatterns: {} as Record<string, SchedulePattern>,
        exerciseAnalytics: analyzeExercise(schedules, activities),
        sleepAnalytics: analyzeSleep(schedules),
        wellnessInsights: {} as WellnessInsights,
    };

    // Analyze time slot patterns
    schedules.forEach(schedule => {
        const activityType = schedule.text || 'other';
        const startTime = new Date(schedule.start_time);
        const endTime = new Date(schedule.end_time);
        const hour = startTime.getHours();
        const timeSlot = `${hour}:00`;
        const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // hours

        if (!analytics.timeSlotPatterns[activityType]) {
            analytics.timeSlotPatterns[activityType] = {
                activityType,
                timeSlots: [],
                frequency: 0,
                avgDuration: 0,
            };
        }

        const pattern = analytics.timeSlotPatterns[activityType];
        pattern.frequency++;
        pattern.timeSlots.push(timeSlot);
        pattern.avgDuration = ((pattern.avgDuration || 0) * (pattern.frequency - 1) + duration) / pattern.frequency;
    });

    // Calculate most common time slots for each activity
    Object.values(analytics.timeSlotPatterns).forEach(pattern => {
        const timeSlotCounts: Record<string, number> = {};
        pattern.timeSlots.forEach(slot => {
            timeSlotCounts[slot] = (timeSlotCounts[slot] || 0) + 1;
        });

        pattern.timeSlots = Object.entries(timeSlotCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([slot]) => slot);
    });

    // Generate wellness insights
    analytics.wellnessInsights = generateWellnessInsights(
        analytics.exerciseAnalytics,
        analytics.sleepAnalytics
    );

    return analytics;
}

function analyzeExercise(schedules: any[], activities: any[]): ExerciseAnalytics {
    const exerciseKeywords = ['운동', '헬스', '러닝', '조깅', '요가', '필라테스', '수영', '자전거', '걷기', 'workout', 'gym', 'running', 'exercise'];

    const workoutSchedules = schedules.filter(schedule => {
        const text = (schedule.text || '').toLowerCase();
        return exerciseKeywords.some(keyword => text.includes(keyword));
    });

    const workoutTypes: Record<string, number> = {};
    const workoutTimes: string[] = [];

    workoutSchedules.forEach(schedule => {
        const text = schedule.text || 'unknown';
        workoutTypes[text] = (workoutTypes[text] || 0) + 1;

        const hour = new Date(schedule.start_time).getHours();
        workoutTimes.push(`${hour}:00`);
    });

    // Calculate weekly average
    const daysSpan = schedules.length > 0
        ? (Date.now() - new Date(schedules[schedules.length - 1].created_at).getTime()) / (1000 * 60 * 60 * 24)
        : 30;
    const weeksSpan = Math.max(1, daysSpan / 7);
    const avgWorkoutsPerWeek = workoutSchedules.length / weeksSpan;

    // Most frequent exercise
    const mostFrequentExercise = Object.entries(workoutTypes)
        .sort(([, a], [, b]) => b - a)[0]?.[0];

    // Preferred times
    const timeCounts: Record<string, number> = {};
    workoutTimes.forEach(time => {
        timeCounts[time] = (timeCounts[time] || 0) + 1;
    });
    const preferredExerciseTimes = Object.entries(timeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([time]) => time);

    // WHO recommends at least 150 minutes (2.5 hours) of moderate activity per week
    // Or at least 3 workout sessions per week
    const weeklyGoalMet = avgWorkoutsPerWeek >= 3;

    return {
        totalWorkouts: workoutSchedules.length,
        workoutTypes,
        avgWorkoutsPerWeek,
        preferredExerciseTimes,
        mostFrequentExercise,
        weeklyGoalMet,
    };
}

function analyzeSleep(schedules: any[]): SleepAnalytics {
    const wakeSchedules = schedules.filter(s =>
        (s.text || '').includes('기상') || (s.text || '').toLowerCase().includes('wake')
    );
    const sleepSchedules = schedules.filter(s =>
        (s.text || '').includes('취침') || (s.text || '').toLowerCase().includes('sleep')
    );

    if (wakeSchedules.length === 0 && sleepSchedules.length === 0) {
        return {
            avgSleepDuration: 0,
            avgBedtime: 'N/A',
            avgWakeTime: 'N/A',
            sleepConsistency: 0,
            isHealthy: false,
            recommendation: '기상과 취침 일정을 등록하면 수면 패턴을 분석할 수 있어요',
        };
    }

    // Calculate average wake time
    const wakeTimes = wakeSchedules.map(s => {
        const date = new Date(s.start_time);
        return date.getHours() + date.getMinutes() / 60;
    });
    const avgWakeHour = wakeTimes.length > 0
        ? wakeTimes.reduce((a, b) => a + b, 0) / wakeTimes.length
        : 7;

    // Calculate average bedtime
    const bedTimes = sleepSchedules.map(s => {
        const date = new Date(s.start_time);
        return date.getHours() + date.getMinutes() / 60;
    });
    const avgBedHour = bedTimes.length > 0
        ? bedTimes.reduce((a, b) => a + b, 0) / bedTimes.length
        : 23;

    // Calculate sleep duration
    let avgSleepDuration = 0;
    if (avgBedHour < 12) {
        // Bedtime is in the morning (unusual but possible)
        avgSleepDuration = avgWakeHour - avgBedHour;
    } else {
        // Normal case: bedtime at night, wake in morning
        avgSleepDuration = (24 - avgBedHour) + avgWakeHour;
    }

    // Calculate consistency (standard deviation of wake times)
    const wakeStdDev = wakeTimes.length > 1
        ? Math.sqrt(wakeTimes.reduce((sum, time) => sum + Math.pow(time - avgWakeHour, 2), 0) / wakeTimes.length)
        : 0;
    const sleepConsistency = Math.max(0, 100 - (wakeStdDev * 20)); // Lower std dev = higher consistency

    // Health assessment (7-9 hours is ideal)
    const isHealthy = avgSleepDuration >= 7 && avgSleepDuration <= 9;

    const avgBedtimeStr = `${Math.floor(avgBedHour)}:${String(Math.round((avgBedHour % 1) * 60)).padStart(2, '0')}`;
    const avgWakeTimeStr = `${Math.floor(avgWakeHour)}:${String(Math.round((avgWakeHour % 1) * 60)).padStart(2, '0')}`;

    let recommendation;
    if (avgSleepDuration < 7) {
        recommendation = `수면 시간이 부족해요. 최소 7시간 수면을 목표로 해보세요`;
    } else if (avgSleepDuration > 9) {
        recommendation = `수면 시간이 너무 많아요. 과다 수면은 피로감을 증가시킬 수 있어요`;
    } else if (sleepConsistency < 70) {
        recommendation = `수면 패턴이 불규칙해요. 일정한 시간에 자고 일어나보세요`;
    }

    return {
        avgSleepDuration: Math.round(avgSleepDuration * 10) / 10,
        avgBedtime: avgBedtimeStr,
        avgWakeTime: avgWakeTimeStr,
        sleepConsistency: Math.round(sleepConsistency),
        isHealthy,
        recommendation,
    };
}

function generateWellnessInsights(
    exercise: ExerciseAnalytics,
    sleep: SleepAnalytics
): WellnessInsights {
    const recommendations: string[] = [];
    const alerts: string[] = [];

    // Exercise status
    let exerciseStatus: 'insufficient' | 'adequate' | 'excellent' = 'adequate';
    if (exercise.avgWorkoutsPerWeek < 2) {
        exerciseStatus = 'insufficient';
        alerts.push('운동량이 부족해요');
        recommendations.push('주 3회 이상 운동을 목표로 해보세요');
        recommendations.push(`${exercise.preferredExerciseTimes[0] || '아침'}에 운동하시는 것 같아요. 이 시간대를 활용해보세요`);
    } else if (exercise.avgWorkoutsPerWeek >= 4) {
        exerciseStatus = 'excellent';
        recommendations.push('훌륭한 운동 습관을 유지하고 계세요! 💪');
    } else {
        exerciseStatus = 'adequate';
        recommendations.push('좋은 운동 패턴이에요. 조금만 더 늘려보면 어떨까요?');
    }

    if (exercise.mostFrequentExercise) {
        recommendations.push(`${exercise.mostFrequentExercise}을(를) 선호하시네요. 다양한 운동을 섞어보는 것도 좋아요`);
    }

    // Sleep status
    let sleepStatus: 'insufficient' | 'adequate' | 'excellent' = 'adequate';
    if (sleep.avgSleepDuration === 0) {
        sleepStatus = 'insufficient';
        alerts.push('수면 일정 데이터가 없어요');
        recommendations.push('기상/취침 일정을 등록하면 수면 패턴을 분석해드려요');
    } else if (sleep.avgSleepDuration < 7) {
        sleepStatus = 'insufficient';
        alerts.push('수면 시간이 부족해요');
        recommendations.push(sleep.recommendation || '최소 7시간 수면을 목표로 해보세요');
    } else if (sleep.avgSleepDuration >= 7 && sleep.avgSleepDuration <= 9 && sleep.sleepConsistency > 80) {
        sleepStatus = 'excellent';
        recommendations.push('완벽한 수면 패턴이에요! 😴');
    } else if (sleep.sleepConsistency < 70) {
        sleepStatus = 'insufficient';
        alerts.push('수면 패턴이 불규칙해요');
        recommendations.push('매일 비슷한 시간에 자고 일어나보세요');
    }

    // Combined insights
    if (exerciseStatus === 'insufficient' && sleepStatus === 'insufficient') {
        alerts.push('운동과 수면 모두 개선이 필요해요');
        recommendations.push('먼저 수면 패턴을 고정하고, 그 다음 운동을 늘려보세요');
    }

    if (exercise.preferredExerciseTimes.length > 0 && sleep.avgWakeTime !== 'N/A') {
        const wakeHour = parseInt(sleep.avgWakeTime.split(':')[0]);
        const preferredHour = parseInt(exercise.preferredExerciseTimes[0].split(':')[0]);

        if (Math.abs(preferredHour - wakeHour) < 2) {
            recommendations.push('기상 직후 운동하시는군요! 아침 운동은 하루를 활기차게 시작하는 좋은 방법이에요');
        }
    }

    return {
        exerciseStatus,
        sleepStatus,
        recommendations: recommendations.slice(0, 5), // Top 5
        alerts,
    };
}
