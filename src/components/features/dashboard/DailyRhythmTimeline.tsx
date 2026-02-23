"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sun,
    Moon,
    Briefcase,
    Coffee,
    Dumbbell,
    BookOpen,
    Target,
    Heart,
    Gamepad2,
    Film,
    Tv,
    Music,
    Headphones,
    Code,
    Laptop,
    Pen,
    Palette,
    Camera,
    CheckCircle2,
    XCircle,
    Clock,
    CalendarDays,
    MapPin,
    FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTodayCompletions } from "@/lib/scheduleNotifications";
import type { CustomGoal } from "./SchedulePopup";

interface DailyGoals {
    wakeUp: boolean;
    learning: number;
    exercise: boolean;
    trendBriefing: number;
    customGoals: Record<string, boolean>;
}

export function DailyRhythmTimeline({ schedule, customGoals, dailyGoals, toggleCustomGoal, isMobile = false, currentTime }: {
    schedule?: {
        wakeUp: string;
        workStart: string;
        workEnd: string;
        sleep: string;
    };
    customGoals?: CustomGoal[];
    dailyGoals: DailyGoals;
    toggleCustomGoal: (id: string) => void;
    isMobile?: boolean;
    currentTime: Date | null;
}) {
    const [todayCompletions, setTodayCompletions] = useState<Record<string, any>>({});

    // Auto-scroll to active/upcoming item on mobile (must be before early return)
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateCompletions = () => {
            setTodayCompletions(getTodayCompletions());
        };

        updateCompletions();
        const interval = setInterval(updateCompletions, 60000);
        return () => clearInterval(interval);
    }, [customGoals]);

    // Note: This useEffect needs schedule-dependent variables, but must be here for hooks order
    // It will safely handle the case when schedule is undefined
    useEffect(() => {
        // Allow scrolling even without schedule - customGoals alone is enough
        if (!isMobile || !scrollContainerRef.current || !currentTime) return;
        if (!schedule && (!customGoals || customGoals.length === 0)) return;

        // Use a timeout to ensure the DOM is fully rendered before scrolling
        const scrollToActive = () => {
            if (!scrollContainerRef.current) return;

            const now = currentTime;
            const currentDayOfWeek = now.getDay();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTimeValue = currentHour * 60 + currentMinute;

            // Build timeline to find active index - 중복 제거 포함
            const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

            // 특정 날짜 일정 (우선순위 높음)
            const specificDateGoals = customGoals?.filter((g: any) => g.specificDate === todayStr && g.startTime) || [];

            // 반복 일정 (중복 제거)
            const recurringGoals = customGoals?.filter((g: any) => {
                if (g.specificDate) return false;
                if (!g.daysOfWeek?.includes(currentDayOfWeek)) return false;
                if (!g.startTime) return false;
                // Check date range constraints
                if (g.startDate && todayStr < g.startDate) return false;
                if (g.endDate && todayStr > g.endDate) return false;
                // 같은 이름 + 같은 시간의 특정 날짜 일정이 있으면 제외
                const hasDuplicate = specificDateGoals.some((sg: any) =>
                    sg.text === g.text && sg.startTime === g.startTime
                );
                return !hasDuplicate;
            }) || [];

            const allGoals = [...specificDateGoals, ...recurringGoals];

            // Only use customGoals for timeline - no longer using base schedule items
            const timelineItemsForScroll: Array<{ time: string; endTime?: string | undefined }> = allGoals
                .map((g: any) => ({ time: g.startTime!, endTime: g.endTime || undefined }))
                .sort((a, b) => {
                    const [aH, aM] = a.time.split(':').map(Number);
                    const [bH, bM] = b.time.split(':').map(Number);
                    return (aH * 60 + aM) - (bH * 60 + bM);
                });

            let activeIndex = -1;
            let nextIndex = -1;

            timelineItemsForScroll.forEach((item, i) => {
                const [h, m] = item.time.split(':').map(Number);
                const startTime = h * 60 + m;

                const nextItem = timelineItemsForScroll[i + 1];
                let nextStartTime = 24 * 60;

                if (nextItem) {
                    const [nh, nm] = nextItem.time.split(':').map(Number);
                    nextStartTime = nh * 60 + nm;
                }

                let endTime = nextStartTime;

                if (item.endTime) {
                    const [eh, em] = item.endTime.split(':').map(Number);
                    endTime = eh * 60 + em;
                    if (endTime < startTime) endTime += 24 * 60;
                }

                if (currentTimeValue >= startTime && currentTimeValue < endTime) {
                    activeIndex = i;
                }

                if (currentTimeValue < startTime && nextIndex === -1) {
                    nextIndex = i;
                }
            });

            const targetIndex = activeIndex !== -1 ? activeIndex : nextIndex;

            if (targetIndex !== -1 && scrollContainerRef.current) {
                // Get all timeline items
                const items = scrollContainerRef.current.querySelectorAll('[data-timeline-item]');

                if (items.length > targetIndex) {
                    const targetItem = items[targetIndex] as HTMLElement;
                    const container = scrollContainerRef.current;

                    // Calculate scroll position to center the item
                    const itemLeft = targetItem.offsetLeft;
                    const itemWidth = targetItem.offsetWidth;
                    const containerWidth = container.clientWidth;
                    const scrollLeft = Math.max(0, itemLeft - (containerWidth / 2) + (itemWidth / 2));


                    container.scrollTo({
                        left: scrollLeft,
                        behavior: 'smooth'
                    });
                }
            }
        };

        // Scroll with multiple attempts to ensure DOM is ready
        const timer0 = setTimeout(scrollToActive, 50);
        const timer1 = setTimeout(scrollToActive, 200);
        const timer2 = setTimeout(scrollToActive, 600);

        return () => {
            clearTimeout(timer0);
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [isMobile, schedule, customGoals, currentTime]);

    if (!schedule) return (
        <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-4">
            <p>일정을 설정하고 나만의 리듬을 찾아보세요.</p>
            <Button size="sm" onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="일정 추가/변경"]')?.click()}>일정 설정하기</Button>
        </div>
    );

    const now = currentTime || new Date(0); // Fallback to epoch if null (server-side safe)
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    // If currentTime is null, set a value that won't match any schedule (e.g. -1)
    const currentTimeValue = currentTime ? currentHour * 60 + currentMinute : -1;

    // Map activity labels to icons
    const activityIcons: Record<string, any> = {
        '기상': Sun,
        '업무 시작': Briefcase,
        '업무/수업 시작': Briefcase,
        '업무 종료': Briefcase,
        '업무/수업 종료': Briefcase,
        '취침': Moon,
        '아침 식사': Coffee,
        '점심 식사': Coffee,
        '저녁 식사': Coffee,
        '운동': Dumbbell,
        '독서': BookOpen,
        '자기계발': Target,
        '병원': Heart,
        '휴식/여가': Gamepad2,
        '영화': Film,
        '영화 감상': Film,
        '영화 보기': Film,
        '게임': Gamepad2,
        '게임하기': Gamepad2,
        'TV': Tv,
        'TV 시청': Tv,
        '드라마': Tv,
        '음악': Music,
        '음악 감상': Music,
        '팟캐스트': Headphones,
        '팟캐스트 청취': Headphones,
        '팟캐스트 듣기': Headphones,
        '코딩': Code,
        '프로그래밍': Code,
        '개발': Laptop,
        '공부': BookOpen,
        '학습': BookOpen,
        '글쓰기': Pen,
        '작문': Pen,
        '그림': Palette,
        '그리기': Palette,
        '미술': Palette,
        '사진': Camera,
        '촬영': Camera,
    };

    // Filter custom goals for today (both recurring and specific date)
    const currentDate = currentTime || new Date();
    const todayStr = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + String(currentDate.getDate()).padStart(2, '0');

    const todaysGoals = customGoals?.filter(goal => {
        // IMPORTANT: If specificDate exists, ONLY show on that exact date (not as recurring)
        if (goal.specificDate) {
            // Specific date events only show on that exact date
            return goal.specificDate === todayStr;
        }
        // Recurring events (no specificDate) show on matching days of week
        return goal.daysOfWeek?.includes(currentDayOfWeek);
    }) || [];

    // State for schedule detail popup
    const [selectedSchedule, setSelectedSchedule] = useState<{
        time: string;
        label: string;
        endTime?: string;
        location?: string;
        memo?: string;
        color: string;
    } | null>(null);

    // Fetch long-term goals for displaying linked goal badges
    const [longTermGoals, setLongTermGoals] = useState<{
        weekly: Array<{ id: string; title: string; category?: string }>;
        monthly: Array<{ id: string; title: string; category?: string }>;
        yearly: Array<{ id: string; title: string; category?: string }>;
    } | null>(null);

    useEffect(() => {
        const fetchGoals = async () => {
            try {
                const res = await fetch('/api/user/long-term-goals');
                if (res.ok) {
                    const data = await res.json();
                    setLongTermGoals(data.goals);
                }
            } catch (error) {
                console.error('[DailyRhythmTimeline] Failed to fetch long-term goals:', error);
            }
        };
        fetchGoals();
    }, []);

    // Helper to get linked goal info
    const getLinkedGoalInfo = (linkedGoalId?: string, linkedGoalType?: 'weekly' | 'monthly' | 'yearly') => {
        if (!linkedGoalId || !linkedGoalType || !longTermGoals) return null;
        const goalList = longTermGoals[linkedGoalType] || [];
        return goalList.find(g => g.id === linkedGoalId) || null;
    };

    // Build timeline items
    const baseTimelineItems: Array<{
        time: string;
        label: string;
        icon: any;
        color: string;
        goalId: string;
        endTime?: string;
        location?: string;
        memo?: string;
        linkedGoalId?: string;
        linkedGoalType?: 'weekly' | 'monthly' | 'yearly';
    }> = [];

    // Note: Base schedule items (schedule.wakeUp, etc.) are no longer added here.
    // We rely entirely on customGoals to ensure only user-configured schedules for the specific date are shown.

    // Add today's custom goals to timeline
    todaysGoals.forEach(goal => {
        if (goal.startTime) {
            // Try exact match first, then search for keywords in text
            let icon = activityIcons[goal.text];
            if (!icon) {
                // Search for keywords in the goal text
                const text = goal.text.toLowerCase();
                for (const [keyword, iconComponent] of Object.entries(activityIcons)) {
                    if (text.includes(keyword.toLowerCase())) {
                        icon = iconComponent;
                        break;
                    }
                }
                // Default to Target if no match found
                if (!icon) icon = Target;
            }

            baseTimelineItems.push({
                time: goal.startTime,
                label: goal.text,
                icon: icon,
                color: goal.color || 'purple',
                goalId: goal.id,
                endTime: goal.endTime,
                location: goal.location,
                memo: goal.memo,
                linkedGoalId: goal.linkedGoalId,
                linkedGoalType: goal.linkedGoalType,
            });
        }
    });

    // Remove duplicates: same time + same label = keep only first occurrence
    const uniqueItems = baseTimelineItems.filter((item, index, self) => {
        return index === self.findIndex(t =>
            t.time === item.time && t.label === item.label
        );
    });

    // Sort by time
    const timelineItems = uniqueItems.sort((a, b) => {
        const [aHour, aMin] = a.time.split(':').map(Number);
        const [bHour, bMin] = b.time.split(':').map(Number);
        return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });

    // Find active and next indices
    let activeIndex = -1;
    let nextIndex = -1;

    for (let i = 0; i < timelineItems.length; i++) {
        const item = timelineItems[i];
        const [h, m] = item.time.split(':').map(Number);
        const startTime = h * 60 + m;

        // Determine end time: strictly use item.endTime if available
        let endTime = startTime + 60; // Default duration fallback

        const nextItem = timelineItems[i + 1];
        let nextStartTime = 24 * 60;
        if (nextItem) {
            const [nh, nm] = nextItem.time.split(':').map(Number);
            nextStartTime = nh * 60 + nm;
        }

        if (item.endTime) {
            const [eh, em] = item.endTime.split(':').map(Number);
            endTime = eh * 60 + em;
            if (endTime < startTime) endTime += 24 * 60;
        } else {
            // If no explicit endTime, use next start time
            endTime = nextStartTime;
        }

        if (currentTimeValue >= startTime && currentTimeValue < endTime) {
            activeIndex = i;
        }

        if (currentTimeValue < startTime && nextIndex === -1) {
            nextIndex = i;
        }
    }

    const getColorClasses = (color: string, isActive: boolean = false) => {
        // NOTE: 'primary' is black in our theme, so we use 'purple' as default
        const normalizedColor = color === 'primary' || !color ? 'purple' : color;

        const bgColors: Record<string, string> = {
            yellow: isActive ? 'bg-yellow-500' : 'bg-yellow-500/30',
            blue: isActive ? 'bg-blue-500' : 'bg-blue-500/30',
            purple: isActive ? 'bg-purple-500' : 'bg-purple-500/30',
            green: isActive ? 'bg-green-500' : 'bg-green-500/30',
            red: isActive ? 'bg-red-500' : 'bg-red-500/30',
            orange: isActive ? 'bg-orange-500' : 'bg-orange-500/30',
            pink: isActive ? 'bg-pink-500' : 'bg-pink-500/30',
            amber: isActive ? 'bg-amber-500' : 'bg-amber-500/30',
            cyan: isActive ? 'bg-cyan-500' : 'bg-cyan-500/30',
            indigo: isActive ? 'bg-indigo-500' : 'bg-indigo-500/30',
        };

        const activeGradients: Record<string, string> = {
            yellow: 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
            blue: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]',
            purple: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]',
            green: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)]',
            red: 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]',
            orange: 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
            pink: 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.15)]',
            amber: 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
            cyan: 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
            indigo: 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]',
        };

        const textColors: Record<string, string> = {
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

        const borderColors: Record<string, string> = {
            yellow: 'border-yellow-500/30',
            blue: 'border-blue-500/30',
            purple: 'border-purple-500/30',
            green: 'border-green-500/30',
            red: 'border-red-500/30',
            orange: 'border-orange-500/30',
            pink: 'border-pink-500/30',
            amber: 'border-amber-500/30',
            cyan: 'border-cyan-500/30',
            indigo: 'border-indigo-500/30',
        };

        const badgeBgColors: Record<string, string> = {
            yellow: 'bg-yellow-500/20',
            blue: 'bg-blue-500/20',
            purple: 'bg-purple-500/20',
            green: 'bg-green-500/20',
            red: 'bg-red-500/20',
            orange: 'bg-orange-500/20',
            pink: 'bg-pink-500/20',
            amber: 'bg-amber-500/20',
            cyan: 'bg-cyan-500/20',
            indigo: 'bg-indigo-500/20',
        };

        return {
            bg: bgColors[normalizedColor] || bgColors.purple,
            activeGradient: activeGradients[normalizedColor] || activeGradients.purple,
            text: textColors[normalizedColor] || textColors.purple,
            border: borderColors[normalizedColor] || borderColors.purple,
            badgeBg: badgeBgColors[normalizedColor] || badgeBgColors.purple,
        };
    };

    return (
        <div className={cn(
            "relative",
            isMobile ? "w-full" : "pl-8 space-y-3"
        )}>
            {/* Empty State when no schedules for today */}
            {timelineItems.length === 0 && (
                <div className="text-center py-8 flex flex-col items-center gap-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-muted-foreground mb-2">오늘은 등록된 일정이 없네요!</p>
                        <p className="text-sm text-muted-foreground/70">나만의 루틴을 추가하고 하루를 계획해보세요.</p>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 border-primary/30 hover:bg-primary/10"
                        onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="일정 추가/변경"]')?.click()}
                    >
                        <CalendarDays className="w-4 h-4" />
                        일정 추가하기
                    </Button>
                </div>
            )}

            {/* Enhanced Vertical line with gradient (Desktop only) */}
            {!isMobile && timelineItems.length > 0 && <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 via-primary/50 to-primary/30 rounded-full" />}

            {/* Mobile Horizontal Scroll Container */}
            {isMobile && (
                <div
                    ref={scrollContainerRef}
                    className="flex gap-3 overflow-x-auto py-6 scrollbar-hide snap-x snap-mandatory px-4"
                >
                    {timelineItems.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = index === activeIndex;
                        const isUpcoming = activeIndex === -1 && index === nextIndex;
                        const isPast = index < activeIndex || (activeIndex === -1 && index < nextIndex && nextIndex !== -1);
                        const colors = getColorClasses(item.color, isActive || isUpcoming);
                        const completion = todayCompletions[item.goalId];


                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="snap-center shrink-0 cursor-pointer"
                                data-timeline-item
                                onClick={() => setSelectedSchedule({
                                    time: item.time,
                                    label: item.label,
                                    endTime: item.endTime,
                                    location: item.location,
                                    memo: item.memo,
                                    color: item.color,
                                })}
                            >
                                <div className={cn(
                                    "relative w-[140px] p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3",
                                    // Active state - 현재 진행중인 일정만 색상으로 강조
                                    isActive && item.color === 'yellow' && "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)] scale-105 z-10 ring-1 ring-yellow-500/50",
                                    isActive && item.color === 'blue' && "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-105 z-10 ring-1 ring-blue-500/50",
                                    isActive && item.color === 'purple' && "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)] scale-105 z-10 ring-1 ring-purple-500/50",
                                    isActive && item.color === 'green' && "bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)] scale-105 z-10 ring-1 ring-green-500/50",
                                    isActive && item.color === 'red' && "bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] scale-105 z-10 ring-1 ring-red-500/50",
                                    isActive && item.color === 'orange' && "bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)] scale-105 z-10 ring-1 ring-orange-500/50",
                                    isActive && item.color === 'pink' && "bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.15)] scale-105 z-10 ring-1 ring-pink-500/50",
                                    isActive && item.color === 'amber' && "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] scale-105 z-10 ring-1 ring-amber-500/50",
                                    isActive && item.color === 'indigo' && "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)] scale-105 z-10 ring-1 ring-indigo-500/50",
                                    isActive && item.color === 'cyan' && "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] scale-105 z-10 ring-1 ring-cyan-500/50",
                                    isActive && item.color === 'teal' && "bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)] scale-105 z-10 ring-1 ring-teal-500/50",
                                    isActive && item.color === 'emerald' && "bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] scale-105 z-10 ring-1 ring-emerald-500/50",
                                    isActive && item.color === 'violet' && "bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.15)] scale-105 z-10 ring-1 ring-violet-500/50",
                                    isActive && item.color === 'rose' && "bg-gradient-to-br from-rose-500/20 to-pink-500/20 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)] scale-105 z-10 ring-1 ring-rose-500/50",
                                    isActive && item.color === 'sky' && "bg-gradient-to-br from-sky-500/20 to-blue-500/20 border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.15)] scale-105 z-10 ring-1 ring-sky-500/50",
                                    isActive && (!item.color || item.color === 'primary') && "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)] scale-105 z-10 ring-1 ring-purple-500/50",
                                    // Upcoming state - 해당 일정 색상으로 은은하게 표시
                                    isUpcoming && item.color === 'yellow' && "bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30 ring-1 ring-yellow-500/20",
                                    isUpcoming && item.color === 'blue' && "bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 ring-1 ring-blue-500/20",
                                    isUpcoming && item.color === 'purple' && "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 ring-1 ring-purple-500/20",
                                    isUpcoming && item.color === 'green' && "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 ring-1 ring-green-500/20",
                                    isUpcoming && item.color === 'red' && "bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/30 ring-1 ring-red-500/20",
                                    isUpcoming && item.color === 'orange' && "bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/30 ring-1 ring-orange-500/20",
                                    isUpcoming && item.color === 'pink' && "bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-pink-500/30 ring-1 ring-pink-500/20",
                                    isUpcoming && item.color === 'amber' && "bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 ring-1 ring-amber-500/20",
                                    isUpcoming && item.color === 'indigo' && "bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20",
                                    isUpcoming && item.color === 'cyan' && "bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30 ring-1 ring-cyan-500/20",
                                    isUpcoming && item.color === 'teal' && "bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border-teal-500/30 ring-1 ring-teal-500/20",
                                    isUpcoming && item.color === 'emerald' && "bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20",
                                    isUpcoming && item.color === 'violet' && "bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/30 ring-1 ring-violet-500/20",
                                    isUpcoming && item.color === 'rose' && "bg-gradient-to-br from-rose-500/10 to-pink-500/10 border-rose-500/30 ring-1 ring-rose-500/20",
                                    isUpcoming && item.color === 'sky' && "bg-gradient-to-br from-sky-500/10 to-blue-500/10 border-sky-500/30 ring-1 ring-sky-500/20",
                                    isUpcoming && (!item.color || item.color === 'primary') && "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 ring-1 ring-purple-500/20",
                                    // Past and default states
                                    isPast && "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5 opacity-50 grayscale scale-95",
                                    !isActive && !isUpcoming && !isPast && "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                                )}>
                                    {/* Connection Line (Visual only) */}
                                    {index < timelineItems.length - 1 && (
                                        <div className="absolute top-1/2 -right-4 w-4 h-0.5 bg-white/10 z-0" />
                                    )}

                                    {/* Time Badge */}
                                    <div className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border",
                                        isActive || isUpcoming
                                            ? "bg-white/10 border-white/20 text-white"
                                            : "bg-black/20 border-white/5 text-muted-foreground"
                                    )}>
                                        {item.time}
                                    </div>

                                    {/* Icon Circle */}
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative",
                                        colors.bg,
                                        (isActive || isUpcoming) && "shadow-lg ring-2 ring-white/20"
                                    )}>
                                        <Icon className={cn("w-5 h-5", (isActive || isUpcoming) ? "text-white" : colors.text)} />
                                        {isActive && (
                                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="text-center w-full px-1">
                                        <h4
                                            className={cn(
                                                "font-semibold text-sm mb-0.5 line-clamp-2 break-words",
                                                (isActive || isUpcoming) ? "text-gray-800 dark:text-white" : "text-gray-600 dark:text-gray-300"
                                            )}
                                            title={item.label}
                                        >
                                            {item.label.length > 30 ? item.label.substring(0, 30) + '...' : item.label}
                                        </h4>
                                        {isActive && (
                                            <p className={cn("text-[10px] font-bold animate-pulse", colors.text)}>
                                                현재 진행 중
                                            </p>
                                        )}
                                        {isUpcoming && (
                                            <p className={cn("text-[10px] font-bold", colors.text)}>
                                                예정됨
                                            </p>
                                        )}
                                    </div>

                                    {/* Linked Goal Badge */}
                                    {item.linkedGoalId && item.linkedGoalType && (() => {
                                        const linkedGoal = getLinkedGoalInfo(item.linkedGoalId, item.linkedGoalType);
                                        if (!linkedGoal) return null;
                                        const typeLabels = { weekly: '주간', monthly: '월간', yearly: '연간' };
                                        return (
                                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
                                                <Target className="w-3 h-3 text-primary" />
                                                <span className="text-[9px] font-medium text-primary truncate max-w-[80px]" title={linkedGoal.title}>
                                                    {typeLabels[item.linkedGoalType]} 목표
                                                </span>
                                            </div>
                                        );
                                    })()}

                                    {/* Completion status */}
                                    {completion && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className={cn(
                                                "text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5",
                                                completion.completed
                                                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                                            )}
                                        >
                                            {completion.completed ? (
                                                <>
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    완료
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    미완료
                                                </>
                                            )}
                                        </motion.span>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Desktop Vertical Layout */}
            {!isMobile && (
                <div
                    className="overflow-y-auto space-y-3 scrollbar-hide"
                    style={{
                        maxHeight: 'calc(5 * 100px)', // Approx 5 items height
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}
                >
                    {timelineItems.map((item, index) => {
                        const Icon = item.icon;
                        const completion = todayCompletions[item.goalId];
                        const isActive = index === activeIndex;
                        const isUpcoming = activeIndex === -1 && index === nextIndex;
                        const isPast = index < activeIndex || (activeIndex === -1 && index < nextIndex && nextIndex !== -1);
                        const colors = getColorClasses(item.color, isActive || isUpcoming);

                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="relative flex items-center gap-4 group cursor-pointer"
                                onClick={() => setSelectedSchedule({
                                    time: item.time,
                                    label: item.label,
                                    endTime: item.endTime,
                                    location: item.location,
                                    memo: item.memo,
                                    color: item.color,
                                })}
                            >
                                {/* Enhanced Timeline dot with glow effect */}
                                <div className={cn(
                                    "absolute -left-8 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center z-10 transition-all",
                                    colors.bg,
                                    (isActive || isUpcoming) && "ring-4 ring-white/20 scale-110 shadow-lg shadow-primary/50"
                                )}>
                                    <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        (isActive || isUpcoming) ? "bg-white" : "bg-background/50"
                                    )} />
                                </div>

                                {/* Enhanced Content card */}
                                <div className={cn(
                                    "flex-1 rounded-xl p-4 border transition-all w-full",
                                    isActive
                                        ? `${colors.activeGradient} shadow-md`
                                        : isUpcoming
                                            ? `${colors.activeGradient} shadow-md opacity-80`
                                            : isPast
                                                ? "bg-white/5 border-white/5 opacity-60"
                                                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {/* Icon with colored background */}
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                                                colors.bg,
                                                (isActive || isUpcoming) && "shadow-lg"
                                            )}>
                                                <Icon className={cn("w-5 h-5", (isActive || isUpcoming) ? "text-white" : colors.text)} />
                                            </div>

                                            <div className="flex-1 min-w-0 max-w-[400px]">
                                                <h4
                                                    className={cn(
                                                        "font-semibold text-base truncate",
                                                        (isActive || isUpcoming) ? "text-gray-900" : "text-foreground"
                                                    )}
                                                    title={item.label}
                                                >
                                                    {item.label.length > 50 ? item.label.substring(0, 50) + '...' : item.label}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <p className={cn(
                                                        "text-sm font-mono",
                                                        (isActive || isUpcoming) ? "text-gray-700" : "text-muted-foreground"
                                                    )}>
                                                        {item.time}
                                                        {item.endTime && ` - ${item.endTime}`}
                                                    </p>
                                                    {isActive && (
                                                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", colors.badgeBg, colors.text)}>
                                                            진행 중
                                                        </span>
                                                    )}
                                                    {isUpcoming && (
                                                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", colors.badgeBg, colors.text)}>
                                                            예정됨
                                                        </span>
                                                    )}
                                                    {/* Linked Goal Badge */}
                                                    {item.linkedGoalId && item.linkedGoalType && (() => {
                                                        const linkedGoal = getLinkedGoalInfo(item.linkedGoalId, item.linkedGoalType);
                                                        if (!linkedGoal) return null;
                                                        const typeLabels = { weekly: '주간', monthly: '월간', yearly: '연간' };
                                                        return (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs">
                                                                <Target className="w-3 h-3 text-primary" />
                                                                <span className="font-medium text-primary">
                                                                    {typeLabels[item.linkedGoalType]}: {linkedGoal.title.length > 15 ? linkedGoal.title.substring(0, 15) + '...' : linkedGoal.title}
                                                                </span>
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Completion status */}
                                        {completion && (
                                            <motion.span
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className={cn(
                                                    "text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5",
                                                    completion.completed
                                                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                                                )}
                                            >
                                                {completion.completed ? (
                                                    <>
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        완료
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        미완료
                                                    </>
                                                )}
                                            </motion.span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Schedule Detail Popup */}
            <AnimatePresence>
                {selectedSchedule && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedSchedule(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header with color indicator */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={cn(
                                    "w-3 h-3 rounded-full",
                                    selectedSchedule.color === 'yellow' && "bg-yellow-500",
                                    selectedSchedule.color === 'blue' && "bg-blue-500",
                                    selectedSchedule.color === 'purple' && "bg-purple-500",
                                    selectedSchedule.color === 'green' && "bg-green-500",
                                    selectedSchedule.color === 'red' && "bg-red-500",
                                    selectedSchedule.color === 'orange' && "bg-orange-500",
                                    selectedSchedule.color === 'pink' && "bg-pink-500",
                                    selectedSchedule.color === 'amber' && "bg-amber-500",
                                    selectedSchedule.color === 'indigo' && "bg-indigo-500",
                                    selectedSchedule.color === 'cyan' && "bg-cyan-500",
                                    (!selectedSchedule.color || selectedSchedule.color === 'primary') && "bg-purple-500"
                                )} />
                                <h3 className="text-lg font-bold text-gray-900 flex-1">{selectedSchedule.label}</h3>
                                <button
                                    onClick={() => setSelectedSchedule(null)}
                                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <XCircle className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Time */}
                            <div className="flex items-center gap-2 text-gray-600 mb-3">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm font-mono">
                                    {selectedSchedule.time}
                                    {selectedSchedule.endTime && ` - ${selectedSchedule.endTime}`}
                                </span>
                            </div>

                            {/* Location */}
                            {selectedSchedule.location && (
                                <div className="flex items-center gap-2 text-gray-600 mb-3">
                                    <MapPin className="w-4 h-4" />
                                    <span className="text-sm">{selectedSchedule.location}</span>
                                </div>
                            )}

                            {/* Memo/Description */}
                            {selectedSchedule.memo && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <FileText className="w-3 h-3" />
                                        <span>세부사항</span>
                                    </div>
                                    <p className="text-sm text-gray-700">{selectedSchedule.memo}</p>
                                </div>
                            )}

                            {/* Close button */}
                            <Button
                                className="w-full mt-4"
                                variant="outline"
                                onClick={() => setSelectedSchedule(null)}
                            >
                                닫기
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
