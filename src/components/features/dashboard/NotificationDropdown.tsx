"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle2, XCircle, Clock, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CustomGoal } from "./SchedulePopup";
import {
    getTodayCompletions,
    markScheduleCompletion,
    getTodayDateString,
} from "@/lib/scheduleNotifications";

interface NotificationItem {
    id: string;
    goal: CustomGoal;
    time: string;
    status: 'pending' | 'completed' | 'notDone' | 'missed';
}

interface NotificationDropdownProps {
    goals: CustomGoal[];
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationDropdown({ goals, isOpen, onClose }: NotificationDropdownProps) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [todayCompletions, setTodayCompletions] = useState<Record<string, any>>({});
    const [allTodayGoals, setAllTodayGoals] = useState<NotificationItem[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadNotifications();
        }
    }, [isOpen, goals]);

    const loadNotifications = () => {
        const now = new Date();
        const currentDayOfWeek = now.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentTimeValue = now.getHours() * 60 + now.getMinutes();
        const todayStr = getTodayDateString();

        console.log('[NotificationDropdown] Current day of week:', currentDayOfWeek, '(0=일,1=월,2=화,3=수,4=목,5=금,6=토)');
        console.log('[NotificationDropdown] Current time:', currentTime);
        console.log('[NotificationDropdown] Today string:', todayStr);

        const completions = getTodayCompletions();
        setTodayCompletions(completions);

        // Filter goals for today
        const todaysGoals = goals.filter(goal => {
            const hasNotif = goal.notificationEnabled;

            console.log(`[NotificationDropdown] Checking goal: "${goal.text}"`, {
                notificationEnabled: hasNotif,
                specificDate: goal.specificDate,
                daysOfWeek: goal.daysOfWeek,
                startTime: goal.startTime,
                endTime: goal.endTime
            });

            // If goal has a specific date, only show on that date
            if (goal.specificDate) {
                const isTodaySpecific = goal.specificDate === todayStr;
                console.log(`[NotificationDropdown] Specific date goal "${goal.text}": specificDate=${goal.specificDate}, today=${todayStr}, match=${isTodaySpecific}, hasNotif=${hasNotif}`);
                return isTodaySpecific && hasNotif;
            }

            // Otherwise, check if today is in daysOfWeek
            const hasDay = goal.daysOfWeek?.includes(currentDayOfWeek);
            console.log(`[NotificationDropdown] Recurring goal "${goal.text}": currentDay=${currentDayOfWeek}, daysOfWeek=${JSON.stringify(goal.daysOfWeek)}, match=${hasDay}, hasNotif=${hasNotif}`);

            return hasDay && hasNotif;
        });

        // Create notification items - only show schedules that have started
        const items: (NotificationItem & { isFuture: boolean })[] = todaysGoals.map(goal => {
            const [goalHour, goalMinute] = goal.startTime!.split(':').map(Number);
            const goalTimeValue = goalHour * 60 + goalMinute;
            const [endHour, endMinute] = goal.endTime!.split(':').map(Number);
            const endTimeValue = endHour * 60 + endMinute;

            let status: NotificationItem['status'] = 'pending';
            let isFuture = false;

            if (completions[goal.id]) {
                // User already marked this schedule
                status = completions[goal.id].completed ? 'completed' : 'notDone';
            } else if (currentTimeValue >= goalTimeValue && currentTimeValue < endTimeValue) {
                // Currently active schedule
                status = 'pending';
            } else if (currentTimeValue >= endTimeValue) {
                // Schedule ended without being marked
                status = 'missed';
            } else {
                // Future schedule - not yet started
                isFuture = true;
            }

            return {
                id: goal.id,
                goal,
                time: goal.startTime!,
                status,
                isFuture,
            };
        });

        // Deduplicate items based on unique key (text + startTime + endTime)
        const uniqueItemsMap = new Map<string, NotificationItem & { isFuture: boolean }>();

        items.forEach(item => {
            const key = `${item.goal.text}-${item.goal.startTime}-${item.goal.endTime}`;
            if (!uniqueItemsMap.has(key)) {
                uniqueItemsMap.set(key, item);
            } else {
                // If duplicate exists, keep the one that is NOT 'notDone' or 'missed' if possible (prioritize completed/pending)
                const existing = uniqueItemsMap.get(key)!;
                if ((existing.status === 'notDone' || existing.status === 'missed') &&
                    (item.status === 'completed' || item.status === 'pending')) {
                    uniqueItemsMap.set(key, item);
                }
            }
        });

        const uniqueItems = Array.from(uniqueItemsMap.values());
        console.log(`[NotificationDropdown] Deduplicated items: ${items.length} -> ${uniqueItems.length}`);

        // Sort by time
        uniqueItems.sort((a, b) => {
            const [aHour, aMin] = a.time.split(':').map(Number);
            const [bHour, bMin] = b.time.split(':').map(Number);
            return (aHour * 60 + aMin) - (bHour * 60 + bMin);
        });

        // Filter out dismissed and future notifications
        const today = getTodayDateString();
        const dismissedKey = `dismissed_notifications_${today}`;
        const dismissed = localStorage.getItem(dismissedKey);
        const dismissedIds = dismissed ? JSON.parse(dismissed) : [];

        // Only show notifications for schedules that have started or been responded to
        const visibleItems = uniqueItems.filter(item => {
            if (dismissedIds.includes(item.id)) return false;
            // Don't show future schedules - only show when time comes
            if (item.isFuture) return false;
            return true;
        });

        setAllTodayGoals(uniqueItems);
        setNotifications(visibleItems);
    };

    const handleMarkComplete = (goalId: string, completed: boolean) => {
        markScheduleCompletion(goalId, completed);
        loadNotifications();
    };

    const handleDismissNotification = (notificationId: string) => {
        // Save dismissed notification to localStorage
        const today = getTodayDateString();
        const dismissedKey = `dismissed_notifications_${today}`;
        const dismissed = localStorage.getItem(dismissedKey);
        const dismissedIds = dismissed ? JSON.parse(dismissed) : [];

        if (!dismissedIds.includes(notificationId)) {
            dismissedIds.push(notificationId);
            localStorage.setItem(dismissedKey, JSON.stringify(dismissedIds));
        }

        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    const getStatusColor = (status: NotificationItem['status']) => {
        switch (status) {
            case 'completed':
                return 'bg-green-500/10 border-green-500/30 text-green-400';
            case 'notDone':
                return 'bg-red-500/10 border-red-500/30 text-red-400';
            case 'missed':
                return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
            default:
                return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
        }
    };

    const getStatusLabel = (status: NotificationItem['status']) => {
        switch (status) {
            case 'completed':
                return '완료';
            case 'notDone':
                return '미완료';
            case 'missed':
                return '놓침';
            default:
                return '대기중';
        }
    };

    const getGoalColor = (color?: string) => {
        const colors: Record<string, string> = {
            yellow: 'text-yellow-400',
            blue: 'text-blue-400',
            purple: 'text-purple-400',
            green: 'text-green-400',
            red: 'text-red-400',
            orange: 'text-orange-400',
            pink: 'text-pink-400',
            amber: 'text-amber-400',
            cyan: 'text-cyan-400',
            indigo: 'text-indigo-400',
        };
        return colors[color || 'primary'] || 'text-primary';
    };

    const pendingCount = allTodayGoals.filter(n => n.status === 'pending').length;
    const missedCount = allTodayGoals.filter(n => n.status === 'missed').length;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute right-0 top-14 w-[calc(100vw-2rem)] sm:w-96 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 backdrop-blur-xl overflow-hidden fixed sm:absolute left-4 sm:left-auto right-4 sm:right-0"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-primary/5 to-transparent">
                            <div className="flex items-center gap-2 mb-2">
                                <Bell className="w-5 h-5 text-primary" />
                                <h3 className="font-bold text-lg">오늘의 알림</h3>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">{getTodayDateString()}</span>
                                </div>
                                {pendingCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">
                                        {pendingCount}개 대기중
                                    </span>
                                )}
                                {missedCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold">
                                        {missedCount}개 놓침
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Notification List */}
                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                                    <p className="text-muted-foreground text-sm">읽지 않은 알림이 없습니다</p>
                                    <p className="text-muted-foreground text-xs mt-1">일정을 추가하고 알림을 받아보세요</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-2">
                                    {notifications.map((notification, index) => (
                                        <motion.div
                                            key={notification.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={cn(
                                                "p-4 rounded-lg border transition-all group relative",
                                                getStatusColor(notification.status)
                                            )}
                                        >
                                            <button
                                                onClick={() => handleDismissNotification(notification.id)}
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-white"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                            <div className="flex items-start justify-between mb-3 pr-6">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="flex flex-col">
                                                        <span className={cn(
                                                            "font-semibold text-base",
                                                            getGoalColor(notification.goal.color)
                                                        )}>
                                                            {notification.goal.text}
                                                        </span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Clock className="w-3 h-3 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground font-mono">
                                                                {notification.goal.startTime} - {notification.goal.endTime}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className={cn(
                                                    "text-xs px-2 py-1 rounded-full font-semibold shrink-0",
                                                    notification.status === 'completed' && "bg-green-500/20 text-green-400",
                                                    notification.status === 'notDone' && "bg-red-500/20 text-red-400",
                                                    notification.status === 'missed' && "bg-orange-500/20 text-orange-400",
                                                    notification.status === 'pending' && "bg-blue-500/20 text-blue-400"
                                                )}>
                                                    {getStatusLabel(notification.status)}
                                                </span>
                                            </div>

                                            {/* Action buttons for pending/missed items */}
                                            {(notification.status === 'pending' || notification.status === 'missed') && (
                                                <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleMarkComplete(notification.id, true)}
                                                        className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                                                    >
                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                        완료
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleMarkComplete(notification.id, false)}
                                                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
                                                    >
                                                        <XCircle className="w-3 h-3 mr-1" />
                                                        {notification.status === 'missed' ? '놓침' : '못함'}
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Show completion icon for completed/notDone items */}
                                            {notification.status === 'completed' && (
                                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                    <span className="text-xs text-green-400">잘하셨습니다!</span>
                                                </div>
                                            )}
                                            {notification.status === 'notDone' && (
                                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                                                    <XCircle className="w-4 h-4 text-red-500" />
                                                    <span className="text-xs text-red-400">다음엔 꼭 해보세요</span>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Stats - Always visible */}
                        {allTodayGoals.length > 0 && (
                            <div className="p-4 border-t border-white/10 bg-white/5">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <div className="text-xl font-bold text-green-400">
                                            {allTodayGoals.filter(n => n.status === 'completed').length}
                                        </div>
                                        <div className="text-xs text-muted-foreground">완료</div>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-red-400">
                                            {allTodayGoals.filter(n => n.status === 'notDone').length}
                                        </div>
                                        <div className="text-xs text-muted-foreground">미완료</div>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-blue-400">
                                            {allTodayGoals.filter(n => n.status === 'pending').length}
                                        </div>
                                        <div className="text-xs text-muted-foreground">남음</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <style jsx global>{`
                            .custom-scrollbar::-webkit-scrollbar {
                                width: 6px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-track {
                                background: rgba(255, 255, 255, 0.05);
                                border-radius: 3px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb {
                                background: rgba(255, 255, 255, 0.2);
                                border-radius: 3px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                background: rgba(255, 255, 255, 0.3);
                            }
                        `}</style>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
