import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth-utils';

export interface StreakData {
    schedule: {
        current: number;        // 현재 연속 일수
        longest: number;        // 최장 연속 일수
        todayCompleted: boolean;
    };
    learning: {
        current: number;
        longest: number;
    };
    goals: {
        weeklyCompletedCount: number;  // 이번 주 완료한 목표 수
        monthlyProgress: number;       // 이번 달 목표 평균 진행률
    };
    totalActiveDays: number;    // 최근 30일 중 활동한 일수
}

/**
 * 일정 완료 streak 계산
 * 각 날짜별로 일정이 있고, 50% 이상 완료한 날을 "활동일"로 간주
 */
function calculateScheduleStreak(dailyStats: Map<string, { total: number; completed: number }>) {
    const sortedDates = [...dailyStats.keys()].sort().reverse(); // 최신순

    let current = 0;
    let longest = 0;
    let tempStreak = 0;
    let todayCompleted = false;

    const today = new Date().toISOString().split('T')[0];

    // 오늘 완료 여부
    const todayStats = dailyStats.get(today);
    if (todayStats && todayStats.total > 0) {
        todayCompleted = todayStats.completed > 0 && (todayStats.completed / todayStats.total) >= 0.5;
    }

    // 연속 일수 계산 (오늘 또는 어제부터 시작)
    const startDate = new Date();
    if (!todayCompleted) {
        // 오늘 아직 미완료면 어제부터 카운트
        startDate.setDate(startDate.getDate() - 1);
    }

    for (let i = 0; i < 90; i++) {
        const checkDate = new Date(startDate);
        checkDate.setDate(startDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];

        const stats = dailyStats.get(dateStr);
        if (stats && stats.total > 0 && stats.completed > 0 && (stats.completed / stats.total) >= 0.5) {
            tempStreak++;
        } else if (stats && stats.total > 0) {
            // 일정이 있었지만 50% 미달 → streak 끊김
            break;
        }
        // 일정이 없는 날은 건너뜀 (주말 등)
    }
    current = tempStreak;

    // 최장 streak 계산
    tempStreak = 0;
    const allDates = [...dailyStats.keys()].sort();
    for (let i = 0; i < allDates.length; i++) {
        const stats = dailyStats.get(allDates[i])!;
        if (stats.total > 0 && stats.completed > 0 && (stats.completed / stats.total) >= 0.5) {
            tempStreak++;
            longest = Math.max(longest, tempStreak);
        } else if (stats.total > 0) {
            tempStreak = 0;
        }
    }

    return { current, longest, todayCompleted };
}

export async function GET(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 최근 90일 일정 조회
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        startDate.setHours(0, 0, 0, 0);

        const { data: schedules, error } = await supabaseAdmin
            .from('schedules')
            .select('date, completed, title')
            .eq('user_id', userId)
            .gte('date', startDate.toISOString())
            .order('date', { ascending: true });

        if (error) {
            console.error('[Streaks] Error fetching schedules:', error);
            return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
        }

        // 날짜별 통계 집계
        const dailyStats = new Map<string, { total: number; completed: number }>();

        for (const schedule of schedules || []) {
            const dateStr = schedule.date?.split('T')[0];
            if (!dateStr) continue;

            const existing = dailyStats.get(dateStr) || { total: 0, completed: 0 };
            existing.total++;
            if (schedule.completed) existing.completed++;
            dailyStats.set(dateStr, existing);
        }

        // 일정 streak 계산
        const scheduleStreak = calculateScheduleStreak(dailyStats);

        // 학습 streak: learning_progress에서 completedDays 조회
        let learningStreak = { current: 0, longest: 0 };
        try {
            const { data: learningData } = await supabaseAdmin
                .from('learning_progress')
                .select('completed_days, updated_at')
                .eq('user_id', userId);

            if (learningData && learningData.length > 0) {
                // 모든 커리큘럼의 완료일을 합산
                const allCompletedDates = new Set<string>();
                for (const lp of learningData) {
                    if (lp.completed_days && Array.isArray(lp.completed_days)) {
                        // completed_days는 day number 배열이고 updated_at으로 날짜 추정
                        // 대신 학습 활동이 있는 날짜로 streak 계산
                        const updatedDate = lp.updated_at?.split('T')[0];
                        if (updatedDate) allCompletedDates.add(updatedDate);
                    }
                }

                // 간단한 streak 계산
                const sortedDates = [...allCompletedDates].sort().reverse();
                let current = 0;
                const checkStart = new Date();
                for (let i = 0; i < 90; i++) {
                    const d = new Date(checkStart);
                    d.setDate(checkStart.getDate() - i);
                    const dateStr = d.toISOString().split('T')[0];
                    if (allCompletedDates.has(dateStr)) {
                        current++;
                    } else if (i > 0) {
                        break; // 어제부터 연속이 아니면 중단
                    }
                }
                learningStreak.current = current;
                learningStreak.longest = Math.max(current, sortedDates.length > 0 ? 1 : 0);
            }
        } catch {}

        // 목표 완료 통계
        let goalsStats = { weeklyCompletedCount: 0, monthlyProgress: 0 };
        try {
            const { data: userData } = await supabaseAdmin
                .from('users')
                .select('profile')
                .eq('id', userId)
                .single();

            if (userData?.profile?.longTermGoals) {
                const ltg = userData.profile.longTermGoals;
                // 주간 목표 완료 수
                const weeklyGoals = ltg.weekly || [];
                goalsStats.weeklyCompletedCount = weeklyGoals.filter((g: any) => g.completed).length;

                // 월간 목표 평균 진행률
                const monthlyGoals = ltg.monthly || [];
                if (monthlyGoals.length > 0) {
                    goalsStats.monthlyProgress = Math.round(
                        monthlyGoals.reduce((sum: number, g: any) => sum + (g.progress || 0), 0) / monthlyGoals.length
                    );
                }
            }
        } catch {}

        // 최근 30일 활동 일수
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDayStr = thirtyDaysAgo.toISOString().split('T')[0];
        const activeDays = [...dailyStats.entries()]
            .filter(([date, stats]) => date >= thirtyDayStr && stats.completed > 0)
            .length;

        const streakData: StreakData = {
            schedule: scheduleStreak,
            learning: learningStreak,
            goals: goalsStats,
            totalActiveDays: activeDays,
        };

        return NextResponse.json(streakData);

    } catch (error) {
        console.error('[Streaks] Error:', error);
        return NextResponse.json({ error: 'Failed to calculate streaks' }, { status: 500 });
    }
}
