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
        // Get KST date and time
        const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentDayOfWeek = kstDate.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
        const currentTime = `${String(kstDate.getHours()).padStart(2, '0')}:${String(kstDate.getMinutes()).padStart(2, '0')}`;
        const currentTimeValue = kstDate.getHours() * 60 + kstDate.getMinutes();
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
                return 'bg-green-50 border-green-200 text-green-600';
            case 'notDone':
                return 'bg-red-50 border-red-200 text-red-600';
            case 'missed':
                return 'bg-orange-50 border-orange-200 text-orange-600';
            default:
                return 'bg-blue-50 border-blue-200 text-blue-600';
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
            yellow: 'text-yellow-600',
            blue: 'text-blue-600',
            purple: 'text-purple-600',
            green: 'text-green-600',
            red: 'text-red-600',
            orange: 'text-orange-600',
            pink: 'text-pink-600',
            amber: 'text-amber-600',
            cyan: 'text-cyan-600',
            indigo: 'text-indigo-600',
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
                        className="absolute right-0 top-14 w-[min(calc(100vw-2rem),380px)] sm:w-96 bg-background/95 border border-border rounded-xl shadow-2xl z-50 backdrop-blur-xl overflow-hidden max-h-[70vh] sm:max-h-[600px] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-3 sm:p-4 border-b border-border bg-muted/30 shrink-0">
                            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                <h3 className="font-bold text-base sm:text-lg">오늘의 알림</h3>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">{getTodayDateString()}</span>
                                </div>
                                {pendingCount > 0 && (
                                    <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold text-[10px] sm:text-xs">
                                        {pendingCount}개 대기중
                                    </span>
                                )}
                                {missedCount > 0 && (
                                    <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold text-[10px] sm:text-xs">
                                        {missedCount}개 놓침
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Notification List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-6 sm:p-8 text-center">
                                    <Bell className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-muted-foreground opacity-50" />
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
                                                "p-3 sm:p-4 rounded-lg border transition-all group relative",
                                                getStatusColor(notification.status)
                                            )}
                                        >
                                            <button
                                                onClick={() => handleDismissNotification(notification.id)}
                                                className="absolute top-2 right-2 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            </button>

                                            <div className="flex items-start justify-between mb-2 sm:mb-3 pr-6">
                                                <div className="flex items-center gap-2 sm:gap-3 flex-1">
                                                    <div className="flex flex-col">
                                                        <span className={cn(
                                                            "font-semibold text-sm sm:text-base",
                                                            getGoalColor(notification.goal.color)
                                                        )}>
                                                            {notification.goal.text}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                                                            <Clock className="w-3 h-3 text-muted-foreground" />
                                                            <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                                                                {notification.goal.startTime} - {notification.goal.endTime}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-semibold shrink-0",
                                                    notification.status === 'completed' && "bg-green-100 text-green-600",
                                                    notification.status === 'notDone' && "bg-red-100 text-red-600",
                                                    notification.status === 'missed' && "bg-orange-100 text-orange-600",
                                                    notification.status === 'pending' && "bg-blue-100 text-blue-600"
                                                )}>
                                                    {getStatusLabel(notification.status)}
                                                </span>
                                            </div>

                                            {/* Action buttons for pending/missed items */}
                                            {(notification.status === 'pending' || notification.status === 'missed') && (
                                                <div className="flex gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleMarkComplete(notification.id, true)}
                                                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 h-8 sm:h-9 text-xs sm:text-sm"
                                                    >
                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                        완료
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleMarkComplete(notification.id, false)}
                                                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border-red-200 h-8 sm:h-9 text-xs sm:text-sm"
                                                    >
                                                        <XCircle className="w-3 h-3 mr-1" />
                                                        {notification.status === 'missed' ? '놓침' : '못함'}
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Show completion icon for completed/notDone items */}
                                            {notification.status === 'completed' && (
                                                <div className="flex items-center gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50">
                                                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
                                                    <span className="text-xs text-green-600">잘하셨습니다!</span>
                                                </div>
                                            )}
                                            {notification.status === 'notDone' && (
                                                <div className="flex items-center gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50">
                                                    <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
                                                    <span className="text-xs text-red-600">다음엔 꼭 해보세요</span>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Stats - Always visible */}
                        {allTodayGoals.length > 0 && (
                            <div className="p-3 sm:p-4 border-t border-border bg-muted/30 shrink-0">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <div className="text-lg sm:text-xl font-bold text-green-600">
                                            {allTodayGoals.filter(n => n.status === 'completed').length}
                                        </div>
                                        <div className="text-[10px] sm:text-xs text-muted-foreground">완료</div>
                                    </div>
                                    <div>
                                        <div className="text-lg sm:text-xl font-bold text-red-600">
                                            {allTodayGoals.filter(n => n.status === 'notDone').length}
                                        </div>
                                        <div className="text-[10px] sm:text-xs text-muted-foreground">미완료</div>
                                    </div>
                                    <div>
                                        <div className="text-lg sm:text-xl font-bold text-blue-600">
                                            {allTodayGoals.filter(n => n.status === 'pending').length}
                                        </div>
                                        <div className="text-[10px] sm:text-xs text-muted-foreground">남음</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <style jsx global>{`
                            .custom-scrollbar::-webkit-scrollbar {
                                width: 6px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-track {
                                background: rgba(0, 0, 0, 0.05);
                                border-radius: 3px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb {
                                background: rgba(0, 0, 0, 0.1);
                                border-radius: 3px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                background: rgba(0, 0, 0, 0.2);
                            }
                        `}</style>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
