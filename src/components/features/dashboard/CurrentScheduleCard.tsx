"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Play, X, ChevronRight, CalendarDays } from "lucide-react";
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
    allSchedules?: Schedule[];
    currentTime: Date | null;
    onToggleComplete: (id: string) => void;
    onScheduleClick?: () => void;
}

export function CurrentScheduleCard({ schedule, allSchedules = [], currentTime, onToggleComplete, onScheduleClick }: CurrentScheduleCardProps) {
    const [showAllSchedules, setShowAllSchedules] = useState(false);

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

    const colors = colorMap[schedule.color] || colorMap.primary;
    const Icon = schedule.icon;

    // Check schedule status helper
    const getScheduleStatus = (s: Schedule) => {
        const [sH, sM] = s.startTime.split(':').map(Number);
        const [eH, eM] = s.endTime.split(':').map(Number);
        let start = sH * 60 + sM;
        let end = eH * 60 + eM;
        if (end < start) end += 24 * 60;

        const completed = completions[s.id]?.completed === true;
        const active = currentMins >= start && currentMins < end;
        const upcoming = currentMins < start;
        const past = currentMins >= end;

        return { completed, active, upcoming, past };
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setShowAllSchedules(true)}
                className={cn(
                    "glass-card rounded-2xl overflow-hidden transition-all cursor-pointer active:scale-[0.98]",
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
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleComplete(schedule.id);
                            }}
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

                        {/* Arrow indicator */}
                        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-4" />
                    </div>

                    {/* Action hint */}
                    {!isCompleted && (
                        <p className="mt-4 text-xs text-muted-foreground text-center">
                            탭하여 전체 일정 보기 · 아이콘 탭하여 완료
                        </p>
                    )}
                </div>
            </motion.div>

            {/* All Schedules Popup */}
            <AnimatePresence>
                {showAllSchedules && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowAllSchedules(false)}
                    >
                        <motion.div
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: "100%", opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-hidden shadow-2xl"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                                        <CalendarDays className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-base">오늘의 일정</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {allSchedules.filter(s => completions[s.id]?.completed).length}/{allSchedules.length} 완료
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAllSchedules(false)}
                                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Schedule List */}
                            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
                                {allSchedules.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                        <p className="text-sm">오늘 일정이 없습니다</p>
                                    </div>
                                ) : (
                                    allSchedules.map((s) => {
                                        const status = getScheduleStatus(s);
                                        const sColors = colorMap[s.color] || colorMap.primary;
                                        const SIcon = s.icon;

                                        return (
                                            <motion.button
                                                key={s.id}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => {
                                                    onToggleComplete(s.id);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                                                    status.completed
                                                        ? "bg-green-50 border border-green-200"
                                                        : status.active
                                                            ? cn(sColors.bg, sColors.border, "border")
                                                            : "bg-gray-50 hover:bg-gray-100"
                                                )}
                                            >
                                                {/* Time indicator */}
                                                <div className={cn(
                                                    "w-1.5 h-12 rounded-full shrink-0",
                                                    status.completed ? "bg-green-500" :
                                                        status.active ? "bg-gradient-to-b " + sColors.gradient.replace("from-", "from-").replace("to-", "to-") :
                                                            status.past ? "bg-gray-300" : "bg-gray-200"
                                                )} />

                                                {/* Icon */}
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                                    status.completed
                                                        ? "bg-green-500 text-white"
                                                        : status.active
                                                            ? cn("bg-gradient-to-br", sColors.gradient, "text-white")
                                                            : "bg-gray-100"
                                                )}>
                                                    {status.completed ? (
                                                        <CheckCircle2 className="w-5 h-5" />
                                                    ) : (
                                                        <SIcon className={cn(
                                                            "w-5 h-5",
                                                            status.active ? "" : sColors.text
                                                        )} />
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className={cn(
                                                            "font-medium truncate",
                                                            status.completed && "line-through text-muted-foreground"
                                                        )}>
                                                            {s.text}
                                                        </p>
                                                        {status.active && !status.completed && (
                                                            <span className="flex items-center gap-0.5 text-[9px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full shrink-0">
                                                                <Play className="w-2 h-2 fill-current" /> NOW
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <Clock className="w-3 h-3" />
                                                        {s.startTime} - {s.endTime}
                                                    </p>
                                                </div>

                                                {/* Checkbox indicator */}
                                                {!status.completed && (
                                                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                                                )}
                                            </motion.button>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-gray-100 bg-gray-50">
                                <button
                                    onClick={() => {
                                        setShowAllSchedules(false);
                                        onScheduleClick?.();
                                    }}
                                    className="w-full py-3 text-sm font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors"
                                >
                                    일정 관리하기
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
