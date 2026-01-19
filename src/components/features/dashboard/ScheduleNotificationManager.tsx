"use client";

import { useEffect, useRef } from "react";
import type { CustomGoal } from "./SchedulePopup";
import { showNotification, requestNotificationPermission, getTodayDateString } from "@/lib/scheduleNotifications";
import { useFocusSleepMode } from "@/contexts/FocusSleepModeContext";

interface ScheduleNotificationManagerProps {
    goals: CustomGoal[];
}

// Check if a goal is work/study related
function isWorkOrStudyGoal(goalText: string): boolean {
    const lowerText = goalText.toLowerCase();
    return goalText.includes('업무') ||
        goalText.includes('공부') ||
        goalText.includes('작업') ||
        goalText.includes('집중') ||
        goalText.includes('미팅') ||
        goalText.includes('회의') ||
        goalText.includes('개발') ||
        goalText.includes('코딩') ||
        goalText.includes('학습') ||
        goalText.includes('수업') ||
        goalText.includes('강의') ||
        goalText.includes('프로젝트') ||
        lowerText.includes('work') ||
        lowerText.includes('study') ||
        lowerText.includes('focus') ||
        lowerText.includes('meeting') ||
        lowerText.includes('coding') ||
        lowerText.includes('develop');
}

export function ScheduleNotificationManager({ goals }: ScheduleNotificationManagerProps) {
    const lastCheckTime = useRef<string>("");
    const notifiedGoals = useRef<Set<string>>(new Set());
    const { setShowSleepPrompt, isSleepMode, setShowFocusPrompt, isFocusMode } = useFocusSleepMode();

    // Request permission on mount
    useEffect(() => {
        requestNotificationPermission();
    }, []);

    // Reset notified goals when the day changes
    useEffect(() => {
        const today = getTodayDateString();
        const lastDate = localStorage.getItem("notification_last_date");

        if (lastDate !== today) {
            notifiedGoals.current.clear();
            localStorage.setItem("notification_last_date", today);
        }
    }, []);

    useEffect(() => {
        const checkSchedules = () => {
            const now = new Date();
            const currentDay = now.getDay();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const currentTime = `${hours}:${minutes}`;

            // Prevent multiple checks in the same minute
            if (currentTime === lastCheckTime.current) return;
            lastCheckTime.current = currentTime;

            // Find goals that start at this exact time
            const goalsToNotify = goals.filter(goal => {
                // Check if notification is enabled
                if (!goal.notificationEnabled) return false;

                // Check if today is in the selected days OR if it's the specific date
                const todayStr = getTodayDateString();
                const isDateMatch = goal.specificDate === todayStr;

                // 반복 일정: startDate~endDate 범위 내에서만 알림
                let isDayMatch = goal.daysOfWeek?.includes(currentDay);
                if (isDayMatch && goal.startDate && todayStr < goal.startDate) {
                    isDayMatch = false;
                }
                if (isDayMatch && goal.endDate && todayStr > goal.endDate) {
                    isDayMatch = false;
                }

                if (!isDayMatch && !isDateMatch) return false;

                // Check if it's the exact start time
                if (goal.startTime === currentTime) return true;

                return false;
            });

            goalsToNotify.forEach(goal => {
                const notificationKey = `${goal.id}_${getTodayDateString()}_${currentTime}`;

                if (!notifiedGoals.current.has(notificationKey)) {
                    // Check if this is a sleep schedule (취침)
                    const isSleepSchedule = goal.text.includes('취침') ||
                        goal.text.toLowerCase().includes('sleep') ||
                        goal.text.includes('잠') ||
                        goal.text.includes('수면');

                    if (isSleepSchedule && !isSleepMode) {
                        // Check if user dismissed the prompt today
                        const todayStr = getTodayDateString();
                        const dismissed = localStorage.getItem(`sleep_prompt_dismissed_${todayStr}`);

                        if (!dismissed) {
                            setShowSleepPrompt(true);
                        }
                    }

                    // Check if this is a work END schedule (업무 종료, 퇴근 등) - should NOT trigger focus mode
                    const isWorkEndSchedule = goal.text.includes('종료') ||
                        goal.text.includes('퇴근') ||
                        goal.text.includes('마무리') ||
                        goal.text.includes('끝') ||
                        goal.text.toLowerCase().includes('end') ||
                        goal.text.toLowerCase().includes('finish') ||
                        goal.text.toLowerCase().includes('done');

                    // Check if this is a work/focus schedule (업무, 공부, 작업, 집중 등)
                    const isWorkSchedule = isWorkOrStudyGoal(goal.text);

                    // Only show focus prompt for work START schedules, not END schedules
                    if (isWorkSchedule && !isWorkEndSchedule && !isFocusMode && !isSleepMode) {
                        // Check if user dismissed the focus prompt today
                        const todayStr = getTodayDateString();
                        const dismissed = localStorage.getItem(`focus_prompt_dismissed_${todayStr}`);

                        if (!dismissed) {
                            setShowFocusPrompt(true);
                        }
                    }

                    showNotification(goal);
                    notifiedGoals.current.add(notificationKey);
                }
            });
        };

        // Check every 5 seconds to ensure we catch the minute change
        const intervalId = setInterval(checkSchedules, 5000);

        // Initial check
        checkSchedules();

        return () => clearInterval(intervalId);
    }, [goals, isSleepMode, isFocusMode, setShowSleepPrompt, setShowFocusPrompt]);

    return null; // This component doesn't render anything visible
}
