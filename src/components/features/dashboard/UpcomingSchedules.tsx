"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, ChevronRight } from "lucide-react";
import { getTodayCompletions } from "@/lib/scheduleNotifications";

interface Schedule {
    id: string;
    text: string;
    startTime: string;
    endTime: string;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface UpcomingSchedulesProps {
    schedules: Schedule[];
    currentTime: Date | null;
    onToggleComplete: (id: string) => void;
    onViewAll?: () => void;
}

export function UpcomingSchedules({ schedules, currentTime, onToggleComplete, onViewAll }: UpcomingSchedulesProps) {
    if (schedules.length === 0) {
        return null;
    }

    const completions = getTodayCompletions();

    const colorMap: Record<string, { bg: string; text: string }> = {
        yellow: { bg: "bg-yellow-500", text: "text-yellow-600" },
        purple: { bg: "bg-purple-500", text: "text-purple-600" },
        green: { bg: "bg-green-500", text: "text-green-600" },
        blue: { bg: "bg-blue-500", text: "text-blue-600" },
        red: { bg: "bg-red-500", text: "text-red-600" },
        orange: { bg: "bg-orange-500", text: "text-orange-600" },
        pink: { bg: "bg-pink-500", text: "text-pink-600" },
        amber: { bg: "bg-amber-500", text: "text-amber-600" },
        primary: { bg: "bg-amber-500", text: "text-amber-600" },
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    예정된 일정
                </h4>
                {onViewAll && schedules.length > 3 && (
                    <button
                        onClick={onViewAll}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                        전체 보기 <ChevronRight className="w-3 h-3" />
                    </button>
                )}
            </div>

            <div className="space-y-1.5">
                {schedules.slice(0, 3).map((schedule, index) => {
                    const isCompleted = completions[schedule.id]?.completed === true;
                    const colors = colorMap[schedule.color] || colorMap.primary;
                    const Icon = schedule.icon;

                    return (
                        <motion.button
                            key={schedule.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => onToggleComplete(schedule.id)}
                            className={cn(
                                "w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-xl transition-all",
                                isCompleted
                                    ? "bg-green-50 border border-green-200"
                                    : "glass-card hover:bg-white/80"
                            )}
                        >
                            {/* Time indicator */}
                            <div className={cn(
                                "w-1 h-8 rounded-full",
                                isCompleted ? "bg-green-500" : colors.bg
                            )} />

                            {/* Icon */}
                            <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                isCompleted ? "bg-green-500 text-white" : "bg-gray-100"
                            )}>
                                {isCompleted ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <Icon className={cn("w-4 h-4", colors.text)} />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 text-left">
                                <p className={cn(
                                    "text-sm font-medium truncate",
                                    isCompleted && "line-through text-muted-foreground"
                                )}>
                                    {schedule.text}
                                </p>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {schedule.startTime}
                                </p>
                            </div>

                            {/* Complete indicator */}
                            {!isCompleted && (
                                <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {schedules.length > 3 && (
                <p className="text-center text-xs text-muted-foreground pt-1">
                    +{schedules.length - 3}개 더
                </p>
            )}
        </div>
    );
}
