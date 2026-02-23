"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CustomGoal } from "./SchedulePopup";

export interface CalendarViewProps {
    currentMonth: Date;
    customGoals: CustomGoal[];
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onDateSelect: (day: number) => void;
    formatDate: (date: Date) => string;
    getDaysInMonth: (date: Date) => { daysInMonth: number; firstDayOfMonth: number };
    isSameDay: (d1: Date, d2: Date) => boolean;
}

export function CalendarView({
    currentMonth,
    customGoals,
    onPrevMonth,
    onNextMonth,
    onDateSelect,
    formatDate,
    getDaysInMonth,
    isSameDay,
}: CalendarViewProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 md:p-6 h-full flex flex-col"
        >
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-3 md:mb-6">
                <h3 className="text-lg md:text-2xl font-bold">
                    {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                </h3>
                <div className="flex gap-1 md:gap-2">
                    <Button variant="outline" size="sm" onClick={onPrevMonth} className="h-8 px-2 md:px-3 text-xs md:text-sm">
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden md:inline ml-1">이전 달</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={onNextMonth} className="h-8 px-2 md:px-3 text-xs md:text-sm">
                        <span className="hidden md:inline mr-1">다음 달</span>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 md:gap-4 mb-1 md:mb-2 text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                    <div key={d} className={cn("text-xs md:text-sm font-medium text-muted-foreground py-1 md:py-2", i === 0 && "text-red-500", i === 6 && "text-blue-500")}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-7 gap-1 md:gap-4">
                    {/* Empty cells for start of month */}
                    {Array.from({ length: getDaysInMonth(currentMonth).firstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-transparent" />
                    ))}

                    {/* Days */}
                    {Array.from({ length: getDaysInMonth(currentMonth).daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                        const isToday = isSameDay(date, new Date());

                        // Get all goals for this date with their colors
                        const goalsForDate = customGoals?.filter(g => {
                            const dateStr = formatDate(date);
                            if (g.specificDate) return g.specificDate === dateStr;
                            // 반복 일정: startDate~endDate 범위 내에서만 표시
                            if (g.daysOfWeek && g.daysOfWeek.includes(date.getDay()) && !g.specificDate) {
                                // startDate가 있으면 해당 날짜 이후에만 표시
                                if (g.startDate && dateStr < g.startDate) return false;
                                // endDate가 있으면 해당 날짜까지만 표시
                                if (g.endDate && dateStr > g.endDate) return false;
                                return true;
                            }
                            return false;
                        }) || [];

                        // Get unique colors (max 4 to display)
                        const uniqueColors = [...new Set(goalsForDate.map(g => g.color || 'primary'))].slice(0, 4);

                        // Color mapping for schedule indicators
                        const getIndicatorColor = (color: string) => {
                            const colorMap: Record<string, string> = {
                                yellow: 'bg-yellow-400',
                                blue: 'bg-blue-400',
                                purple: 'bg-purple-400',
                                violet: 'bg-violet-400',
                                green: 'bg-green-400',
                                emerald: 'bg-emerald-400',
                                red: 'bg-red-400',
                                rose: 'bg-rose-400',
                                orange: 'bg-orange-400',
                                pink: 'bg-pink-400',
                                amber: 'bg-amber-400',
                                cyan: 'bg-cyan-400',
                                sky: 'bg-sky-400',
                                teal: 'bg-teal-400',
                                indigo: 'bg-indigo-400',
                                primary: 'bg-primary',
                            };
                            return colorMap[color] || 'bg-primary';
                        };

                        return (
                            <motion.button
                                key={day}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onDateSelect(day)}
                                className={cn(
                                    "relative rounded-lg md:rounded-2xl border p-1.5 md:p-3 flex flex-col items-start justify-between transition-all group aspect-square min-h-[44px] md:min-h-0",
                                    isToday
                                        ? "bg-primary/10 border-primary text-foreground shadow-sm"
                                        : "bg-white border-border hover:border-primary/50 hover:shadow-sm text-foreground"
                                )}
                            >
                                <div className="flex justify-between items-start w-full">
                                    <span className={cn(
                                        "text-sm md:text-2xl font-light tracking-tight",
                                        isToday && "text-primary font-bold"
                                    )}>{day}</span>

                                    {isToday && (
                                        <span className="hidden md:inline text-[10px] font-medium bg-primary text-white px-2 py-0.5 rounded-full">
                                            TODAY
                                        </span>
                                    )}
                                </div>

                                {/* Schedule indicators - colored bars */}
                                {uniqueColors.length > 0 && (
                                    <div className="flex flex-col gap-0.5 mt-auto w-full">
                                        {uniqueColors.slice(0, 2).map((color, idx) => (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    "h-0.5 md:h-1 rounded-full",
                                                    getIndicatorColor(color)
                                                )}
                                                style={{ width: `${Math.min(100, 40 + idx * 15)}%` }}
                                            />
                                        ))}
                                    </div>
                                )}

                                <div className="absolute inset-0 rounded-lg md:rounded-2xl ring-1 ring-primary/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
}
