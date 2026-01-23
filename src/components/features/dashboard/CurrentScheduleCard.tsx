"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Play, Sparkles } from "lucide-react";
import { getTodayCompletions } from "@/lib/scheduleNotifications";

interface Schedule {
    id: string;
    text: string;
    startTime: string;
    endTime: string;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface CurrentScheduleCardProps {
    schedule: Schedule | null;
    currentTime: Date | null;
    onToggleComplete: (id: string) => void;
    onScheduleClick?: () => void;
}

export function CurrentScheduleCard({ schedule, currentTime, onToggleComplete, onScheduleClick }: CurrentScheduleCardProps) {
    if (!schedule || !currentTime) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center min-h-[160px] border border-dashed border-border"
            >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Clock className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">현재 진행 중인 일정이 없습니다</p>
                <button
                    onClick={onScheduleClick}
                    className="mt-3 text-xs text-primary hover:underline"
                >
                    일정 추가하기
                </button>
            </motion.div>
        );
    }

    const completions = getTodayCompletions();
    const isCompleted = completions[schedule.id]?.completed === true;

    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    let endMins = endH * 60 + endM;
    if (endMins < startMins) endMins += 24 * 60;

    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    const isActive = currentMins >= startMins && currentMins < endMins;
    const progress = isActive ? Math.min(100, ((currentMins - startMins) / (endMins - startMins)) * 100) : 0;

    const colorMap: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
        yellow: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-600", gradient: "from-yellow-500 to-amber-500" },
        purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-600", gradient: "from-purple-500 to-violet-500" },
        green: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-600", gradient: "from-green-500 to-emerald-500" },
        blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-600", gradient: "from-blue-500 to-cyan-500" },
        red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-600", gradient: "from-red-500 to-rose-500" },
        orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-600", gradient: "from-orange-500 to-amber-500" },
        pink: { bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-600", gradient: "from-pink-500 to-rose-500" },
        amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-600", gradient: "from-amber-500 to-orange-500" },
        primary: { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", gradient: "from-amber-500 to-orange-500" },
    };

    const colors = colorMap[schedule.color] || colorMap.primary;
    const Icon = schedule.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "glass-card rounded-2xl overflow-hidden transition-all",
                isCompleted && "opacity-70"
            )}
        >
            {/* Progress Bar */}
            {isActive && !isCompleted && (
                <div className="h-1 bg-gray-100">
                    <motion.div
                        className={cn("h-full bg-gradient-to-r", colors.gradient)}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            )}

            <div className="p-4 sm:p-6">
                <div className="flex items-start gap-4">
                    {/* Icon */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onToggleComplete(schedule.id)}
                        className={cn(
                            "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 transition-all",
                            isCompleted
                                ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                                : cn("bg-gradient-to-br", colors.gradient, "text-white shadow-lg")
                        )}
                    >
                        {isCompleted ? (
                            <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
                        ) : (
                            <Icon className={cn("w-7 h-7 sm:w-8 sm:h-8", isActive && "animate-pulse")} />
                        )}
                    </motion.button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {isActive && !isCompleted && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                    <Play className="w-2.5 h-2.5 fill-current" /> 진행 중
                                </span>
                            )}
                            {isCompleted && (
                                <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                    완료
                                </span>
                            )}
                        </div>

                        <h3 className={cn(
                            "text-lg sm:text-xl font-bold mb-1 truncate",
                            isCompleted ? "line-through text-muted-foreground" : "text-foreground"
                        )}>
                            {schedule.text}
                        </h3>

                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            {schedule.startTime} - {schedule.endTime}
                        </p>
                    </div>
                </div>

                {/* Action hint */}
                {!isCompleted && (
                    <p className="mt-4 text-xs text-muted-foreground text-center">
                        아이콘을 탭하여 완료 표시
                    </p>
                )}
            </div>
        </motion.div>
    );
}
