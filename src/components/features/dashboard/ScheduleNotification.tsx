"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, XCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CustomGoal } from "./SchedulePopup";
import {
    markScheduleCompletion,
    isScheduleCompleted,
    isScheduleNotDone,
} from "@/lib/scheduleNotifications";

interface ScheduleNotificationProps {
    goal: CustomGoal;
    onDismiss: () => void;
    onComplete: (completed: boolean) => void;
}

export function ScheduleNotification({ goal, onDismiss, onComplete }: ScheduleNotificationProps) {
    const [isVisible, setIsVisible] = useState(true);

    const handleComplete = (completed: boolean) => {
        markScheduleCompletion(goal.id, completed);
        onComplete(completed);
        setIsVisible(false);
        setTimeout(onDismiss, 300);
    };

    const getColorClasses = (color?: string) => {
        const colors: Record<string, string> = {
            yellow: 'bg-yellow-500/90 border-yellow-500',
            blue: 'bg-blue-500/90 border-blue-500',
            purple: 'bg-purple-500/90 border-purple-500',
            green: 'bg-green-500/90 border-green-500',
            red: 'bg-red-500/90 border-red-500',
            orange: 'bg-orange-500/90 border-orange-500',
            pink: 'bg-pink-500/90 border-pink-500',
            amber: 'bg-amber-500/90 border-amber-500',
            cyan: 'bg-cyan-500/90 border-cyan-500',
            indigo: 'bg-indigo-500/90 border-indigo-500',
        };
        return colors[color || 'primary'] || 'bg-primary/90 border-primary';
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -50, scale: 0.9 }}
                    className={cn(
                        "fixed top-4 right-4 z-[100] w-96 rounded-xl border-2 shadow-2xl backdrop-blur-lg p-5",
                        getColorClasses(goal.color)
                    )}
                >
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                <Bell className="w-5 h-5 text-white animate-bounce" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">일정 알림</h3>
                                <p className="text-xs text-white/80">지금 시작하세요!</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setIsVisible(false);
                                setTimeout(onDismiss, 300);
                            }}
                            className="text-white/80 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="bg-white/10 rounded-lg p-4 mb-4 backdrop-blur-sm">
                        <h4 className="text-xl font-bold text-white mb-2">{goal.text}</h4>
                        <p className="text-white/90 text-sm">
                            {goal.startTime} - {goal.endTime}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            onClick={() => handleComplete(true)}
                            className="flex-1 bg-white hover:bg-white/90 text-green-600 font-semibold shadow-lg"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            완료
                        </Button>
                        <Button
                            onClick={() => handleComplete(false)}
                            variant="outline"
                            className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30 font-semibold"
                        >
                            <XCircle className="w-4 h-4 mr-2" />
                            못함
                        </Button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

interface ScheduleNotificationManagerProps {
    goals: CustomGoal[];
}

export function ScheduleNotificationManager({ goals }: ScheduleNotificationManagerProps) {
    const [activeNotifications, setActiveNotifications] = useState<CustomGoal[]>([]);
    const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Check every minute for schedules that need notifications
        const checkSchedules = () => {
            const now = new Date();
            const currentDay = now.getDay();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            const newNotifications = goals.filter(goal => {
                // Check if notification is enabled
                if (!goal.notificationEnabled) return false;

                // Check if today is in the selected days
                if (!goal.daysOfWeek?.includes(currentDay)) return false;

                // startDate~endDate 범위 내에서만 알림
                const todayStr = now.toISOString().split('T')[0];
                if (goal.startDate && todayStr < goal.startDate) return false;
                if (goal.endDate && todayStr > goal.endDate) return false;

                // Check if it's time for this schedule (exact match required)
                if (goal.startTime !== currentTime) return false;

                // Check if already notified this minute
                const notificationKey = `${goal.id}_${currentTime}`;
                if (notifiedIds.has(notificationKey)) return false;

                // Check if already completed or marked as not done today
                const completed = isScheduleCompleted(goal.id);
                const notDone = isScheduleNotDone(goal.id);
                if (completed || notDone) return false;

                return true;
            });

            if (newNotifications.length > 0) {
                setActiveNotifications(prev => [...prev, ...newNotifications]);

                // Mark as notified to prevent duplicate notifications in the same minute
                setNotifiedIds(prev => {
                    const updated = new Set(prev);
                    newNotifications.forEach(goal => {
                        updated.add(`${goal.id}_${currentTime}`);
                    });
                    return updated;
                });

                // Request notification permission and show browser notification
                if ("Notification" in window && Notification.permission === "granted") {
                    newNotifications.forEach(goal => {
                        new Notification(`일정 알림: ${goal.text}`, {
                            body: `${goal.startTime} - ${goal.endTime}\n시작 시간입니다!`,
                            tag: goal.id,
                            requireInteraction: false,
                        });
                    });
                }
            }
        };

        // Calculate time until next minute boundary
        const now = new Date();
        const seconds = now.getSeconds();
        const millisecondsUntilNextMinute = (60 - seconds) * 1000 - now.getMilliseconds();

        let interval: NodeJS.Timeout;

        // Wait until the next minute boundary, then check every minute
        const initialTimeout = setTimeout(() => {
            checkSchedules();
            interval = setInterval(checkSchedules, 60000);
        }, millisecondsUntilNextMinute);

        return () => {
            clearTimeout(initialTimeout);
            if (interval) clearInterval(interval);
        };
    }, [goals]);

    const handleDismiss = (goalId: string) => {
        setActiveNotifications(prev => prev.filter(n => n.id !== goalId));
    };

    const handleComplete = (goalId: string, completed: boolean) => {
        // The completion is already marked in the notification component
        // Just update the UI
        setActiveNotifications(prev => prev.filter(n => n.id !== goalId));
    };

    return (
        <>
            {activeNotifications.map((goal, index) => (
                <motion.div
                    key={goal.id}
                    style={{
                        position: 'fixed',
                        top: `${16 + index * 160}px`,
                        right: '16px',
                        zIndex: 100,
                    }}
                >
                    <ScheduleNotification
                        goal={goal}
                        onDismiss={() => handleDismiss(goal.id)}
                        onComplete={(completed) => handleComplete(goal.id, completed)}
                    />
                </motion.div>
            ))}
        </>
    );
}
