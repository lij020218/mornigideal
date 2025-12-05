import type { CustomGoal } from "@/components/features/dashboard/SchedulePopup";

export interface ScheduleCompletion {
    goalId: string;
    date: string; // YYYY-MM-DD
    completed: boolean;
    timestamp: number;
}

// Get today's date in YYYY-MM-DD format
export function getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Get all completions for today
export function getTodayCompletions(): Record<string, ScheduleCompletion> {
    const today = getTodayDateString();
    const key = `schedule_completions_${today}`;
    const stored = localStorage.getItem(key);

    if (!stored) return {};

    try {
        return JSON.parse(stored);
    } catch {
        return {};
    }
}

// Mark a schedule as completed or not completed
export function markScheduleCompletion(goalId: string, completed: boolean): void {
    const today = getTodayDateString();
    const key = `schedule_completions_${today}`;
    const completions = getTodayCompletions();

    completions[goalId] = {
        goalId,
        date: today,
        completed,
        timestamp: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(completions));
}

// Check if a schedule is completed today
export function isScheduleCompleted(goalId: string): boolean {
    const completions = getTodayCompletions();
    return completions[goalId]?.completed === true;
}

// Check if a schedule was marked as not done today
export function isScheduleNotDone(goalId: string): boolean {
    const completions = getTodayCompletions();
    return completions[goalId]?.completed === false;
}

// Get schedules that should trigger notifications now
export function getSchedulesForNotification(goals: CustomGoal[]): CustomGoal[] {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return goals.filter(goal => {
        // Check if notification is enabled
        if (!goal.notificationEnabled) return false;

        // Check if today matches this goal's schedule
        const todayStr = getTodayDateString();

        // If goal has a specific date, only trigger on that date
        if (goal.specificDate) {
            if (goal.specificDate !== todayStr) return false;
        } else {
            // Otherwise, check if today is in the selected days
            const isDayMatch = goal.daysOfWeek?.includes(currentDay);
            if (!isDayMatch) return false;
        }

        // Check if it's time for this schedule
        if (goal.startTime === currentTime) return true;

        return false;
    });
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
        console.log("This browser does not support notifications");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }

    return false;
}

// Show browser notification
export function showNotification(goal: CustomGoal): void {
    if (Notification.permission === "granted") {
        const notification = new Notification(`일정 알림: ${goal.text}`, {
            body: `${goal.startTime} - ${goal.endTime}\n시작 시간입니다!`,
            icon: "/icon.png", // Add your app icon path
            badge: "/badge.png",
            tag: goal.id,
            requireInteraction: true,
        });

        notification.onclick = function () {
            window.focus();
            notification.close();
        };
    }
}

// Clean up old completion data (keep only last 30 days)
export function cleanupOldCompletions(): void {
    const daysToKeep = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('schedule_completions_')) {
            const dateStr = key.replace('schedule_completions_', '');
            const date = new Date(dateStr);

            if (date < cutoffDate) {
                localStorage.removeItem(key);
            }
        }
    });
}

// Get completion statistics for a goal
export function getGoalStatistics(goalId: string, days: number = 30): {
    totalDays: number;
    completedDays: number;
    notDoneDays: number;
    completionRate: number;
} {
    let completedDays = 0;
    let notDoneDays = 0;
    let totalDays = 0;

    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const key = `schedule_completions_${dateStr}`;
        const stored = localStorage.getItem(key);

        if (stored) {
            try {
                const completions = JSON.parse(stored);
                if (completions[goalId]) {
                    totalDays++;
                    if (completions[goalId].completed) {
                        completedDays++;
                    } else {
                        notDoneDays++;
                    }
                }
            } catch {
                // Ignore parsing errors
            }
        }
    }

    const completionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

    return {
        totalDays,
        completedDays,
        notDoneDays,
        completionRate,
    };
}
