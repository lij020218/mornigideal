"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getChatDate } from "@/lib/scheduleUtils";
import type { Schedule } from "@/types/dashboard";

interface StreakData {
    schedule: { current: number; longest: number; todayCompleted: boolean };
    learning: { current: number };
    goals: { weeklyCompletedCount: number };
}

export interface DashboardData {
    todaySchedules: Schedule[];
    setTodaySchedules: React.Dispatch<React.SetStateAction<Schedule[]>>;
    userProfile: any;
    setUserProfile: React.Dispatch<React.SetStateAction<any>>;
    trendBriefings: any[];
    setTrendBriefings: React.Dispatch<React.SetStateAction<any[]>>;
    streakData: StreakData | null;
    refreshSchedules: () => Promise<void>;
}

export function useDashboardData(session: any): DashboardData {
    const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [trendBriefings, setTrendBriefings] = useState<any[]>([]);
    const [streakData, setStreakData] = useState<StreakData | null>(null);

    // 스케줄 + 프로필 fetch
    const fetchSchedules = useCallback(async () => {
        try {
            const response = await fetch('/api/user/profile');
            if (response.ok) {
                const data = await response.json();
                const today = getChatDate();
                const todayDateObj = new Date(today + 'T12:00:00');
                const currentDay = todayDateObj.getDay();

                setUserProfile(data.profile);

                const allGoals = data.profile?.customGoals || [];

                // 특정 날짜 일정 (우선순위 높음)
                const specificDateGoals = allGoals.filter((g: any) => g.specificDate === today);

                // 반복 일정 (중복 제거)
                const recurringGoals = allGoals.filter((g: any) => {
                    if (g.specificDate) return false;
                    if (!g.daysOfWeek?.includes(currentDay)) return false;
                    if (g.startDate && today < g.startDate) return false;
                    if (g.endDate && today > g.endDate) return false;
                    const hasDuplicate = specificDateGoals.some((sg: any) =>
                        sg.text === g.text && sg.startTime === g.startTime
                    );
                    return !hasDuplicate;
                });

                const todayGoals = [...specificDateGoals, ...recurringGoals];

                const schedulesWithStatus = todayGoals.map((g: any) => ({
                    ...g,
                    completed: g.completed || false,
                    skipped: g.skipped || false,
                }));

                setTodaySchedules(
                    schedulesWithStatus.sort((a: any, b: any) =>
                        (a.startTime || '').localeCompare(b.startTime || '')
                    )
                );
            }
        } catch (error) {
            console.error('[Home] Failed to fetch schedules:', error);
            toast.error('일정을 불러오지 못했어요');
        }
    }, []);

    // 스케줄 fetch + 이벤트 리스너 + 30초 폴링
    useEffect(() => {
        if (!session?.user?.email) return;

        fetchSchedules();

        const handleScheduleUpdate = () => fetchSchedules();

        window.addEventListener('schedule-added', handleScheduleUpdate);
        window.addEventListener('schedule-updated', handleScheduleUpdate);
        window.addEventListener('schedule-deleted', handleScheduleUpdate);

        const pollInterval = setInterval(fetchSchedules, 30000);

        return () => {
            window.removeEventListener('schedule-added', handleScheduleUpdate);
            window.removeEventListener('schedule-updated', handleScheduleUpdate);
            window.removeEventListener('schedule-deleted', handleScheduleUpdate);
            clearInterval(pollInterval);
        };
    }, [session, fetchSchedules]);

    // Streak 데이터
    useEffect(() => {
        if (!session?.user?.email) return;
        fetch('/api/user/streaks')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setStreakData(data); })
            .catch(() => {});
    }, [session]);

    // 트렌드 브리핑
    useEffect(() => {
        if (!session?.user?.email || !userProfile) return;

        const fetchTrendBriefings = async () => {
            try {
                const params = new URLSearchParams({
                    job: userProfile.job || 'Professional',
                    goal: userProfile.goal || '',
                    interests: (userProfile.interests || []).join(','),
                });

                const response = await fetch(`/api/trend-briefing?${params.toString()}`);

                if (response.ok) {
                    const data = await response.json();
                    setTrendBriefings(data.trends || []);
                }
            } catch (error) {
                console.error('[Home] Failed to fetch trend briefings:', error);
            }
        };

        fetchTrendBriefings();
    }, [session, userProfile]);

    return {
        todaySchedules,
        setTodaySchedules,
        userProfile,
        setUserProfile,
        trendBriefings,
        setTrendBriefings,
        streakData,
        refreshSchedules: fetchSchedules,
    };
}
