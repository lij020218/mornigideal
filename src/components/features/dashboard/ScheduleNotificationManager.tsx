"use client";

import { useEffect, useRef } from "react";
import type { CustomGoal } from "./SchedulePopup";
import { showNotification, requestNotificationPermission, getTodayDateString } from "@/lib/scheduleNotifications";

interface ScheduleNotificationManagerProps {
    goals: CustomGoal[];
}

export function ScheduleNotificationManager({ goals }: ScheduleNotificationManagerProps) {
    const lastCheckTime = useRef<string>("");
    const notifiedGoals = useRef<Set<string>>(new Set());

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

                // Check if today is in the selected days
                if (!goal.daysOfWeek?.includes(currentDay)) return false;

                // Check if it's the exact start time
                if (goal.startTime === currentTime) return true;

                return false;
            });

            goalsToNotify.forEach(goal => {
                const notificationKey = `${goal.id}_${getTodayDateString()}_${currentTime}`;

                if (!notifiedGoals.current.has(notificationKey)) {
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
    }, [goals]);

    return null; // This component doesn't render anything visible
}
