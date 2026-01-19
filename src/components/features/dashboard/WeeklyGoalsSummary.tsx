"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Flag,
    ChevronRight,
    Loader2,
    Trophy,
    Briefcase,
    Heart,
    BookOpen,
    Coins,
    Users,
    Palette,
    MoreHorizontal,
    Dumbbell,
    Check,
    Flame,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LongTermGoal {
    id: string;
    type: "weekly" | "monthly" | "yearly";
    title: string;
    description?: string;
    category?: string;
    targetDate?: string;
    progress: number;
    milestones?: { id: string; title: string; completed: boolean }[];
    completed: boolean;
    createdAt: string;
    updatedAt: string;
}

interface LongTermGoals {
    weekly: LongTermGoal[];
    monthly: LongTermGoal[];
    yearly: LongTermGoal[];
}

const categoryConfig: Record<string, { icon: typeof Briefcase; color: string; bg: string }> = {
    career: { icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/20" },
    health: { icon: Heart, color: "text-green-400", bg: "bg-green-500/20" },
    exercise: { icon: Dumbbell, color: "text-red-400", bg: "bg-red-500/20" },
    learning: { icon: BookOpen, color: "text-purple-400", bg: "bg-purple-500/20" },
    finance: { icon: Coins, color: "text-yellow-400", bg: "bg-yellow-500/20" },
    relationship: { icon: Users, color: "text-pink-400", bg: "bg-pink-500/20" },
    hobby: { icon: Palette, color: "text-orange-400", bg: "bg-orange-500/20" },
    general: { icon: MoreHorizontal, color: "text-slate-400", bg: "bg-slate-500/20" },
};

export function WeeklyGoalsSummary() {
    const [goals, setGoals] = useState<LongTermGoals | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGoals = async () => {
            try {
                // 먼저 주간 리셋 체크
                await checkAndResetWeeklyGoals();

                const res = await fetch("/api/user/long-term-goals");
                if (res.ok) {
                    const data = await res.json();
                    setGoals(data.goals);
                }
            } catch (error) {
                console.error("[WeeklyGoalsSummary] Failed to fetch goals:", error);
            } finally {
                setLoading(false);
            }
        };

        // ISO 주차 계산 (월요일 시작)
        const getWeekNumber = (date: Date): string => {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
            return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
        };

        // 주간 리셋 체크 및 실행
        const checkAndResetWeeklyGoals = async () => {
            const now = new Date();
            const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const currentWeek = getWeekNumber(kstNow);
            const lastResetWeek = localStorage.getItem('weekly_goals_last_reset_week');

            if (currentWeek !== lastResetWeek) {
                console.log('[WeeklyGoalsSummary] New week detected! Resetting weekly goals:', { currentWeek, lastResetWeek });
                localStorage.setItem('weekly_goals_last_reset_week', currentWeek);

                try {
                    await fetch('/api/user/long-term-goals', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            goal: { type: 'weekly' },
                            action: 'resetWeekly',
                        }),
                    });
                    console.log('[WeeklyGoalsSummary] Weekly goals reset completed');
                } catch (error) {
                    console.error('[WeeklyGoalsSummary] Failed to reset weekly goals:', error);
                    localStorage.removeItem('weekly_goals_last_reset_week');
                }
            }
        };

        fetchGoals();
    }, []);

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-center py-6 sm:py-8">
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    const weeklyGoals = goals?.weekly || [];
    const completedCount = weeklyGoals.filter((g) => g.completed).length;
    const totalCount = weeklyGoals.length;
    const overallProgress = totalCount > 0
        ? Math.round(weeklyGoals.reduce((acc, g) => acc + g.progress, 0) / totalCount)
        : 0;

    // Show max 3 goals
    const displayGoals = weeklyGoals.slice(0, 3);

    return (
        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl sm:rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                        <Flag className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm sm:text-base">이번 주 목표</h3>
                        {totalCount > 0 && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                                {completedCount}개 완료 · {totalCount - completedCount}개 진행중
                            </p>
                        )}
                    </div>
                </div>
                <Link href="/growth">
                    <Button variant="ghost" size="sm" className="h-7 sm:h-8 text-[10px] sm:text-xs gap-0.5 sm:gap-1 text-muted-foreground hover:text-foreground hover:bg-white/5 px-2 sm:px-3">
                        전체 보기
                        <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </Button>
                </Link>
            </div>

            {/* Content */}
            <div className="px-3 sm:px-5 pb-3 sm:pb-5">
                {totalCount === 0 ? (
                    <div className="text-center py-6 sm:py-8 bg-white/[0.02] rounded-lg sm:rounded-xl">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
                            <Flag className="w-6 h-6 sm:w-7 sm:h-7 text-primary/60" />
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                            이번 주 목표를 설정해보세요
                        </p>
                        <Link href="/growth">
                            <Button size="sm" className="rounded-lg sm:rounded-xl gap-1.5 sm:gap-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs sm:text-sm h-8 sm:h-9">
                                <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                목표 설정하기
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3 sm:space-y-4">
                        {/* Progress Bar */}
                        <div className="relative">
                            <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5 sm:mb-2">
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400" />
                                    <span className="text-muted-foreground">전체 진행률</span>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <span className="font-bold text-base sm:text-lg">{overallProgress}%</span>
                                    <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10">
                                        <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                                        <span className="text-[10px] sm:text-xs font-medium text-primary">
                                            {completedCount}/{totalCount}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-2 sm:h-2.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${overallProgress}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                />
                            </div>
                        </div>

                        {/* Goals List */}
                        <div className="space-y-1.5 sm:space-y-2">
                            {displayGoals.map((goal, index) => {
                                const category = categoryConfig[goal.category || "general"] || categoryConfig.general;
                                const CategoryIcon = category.icon;

                                return (
                                    <motion.div
                                        key={goal.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className={cn(
                                            "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all",
                                            goal.completed
                                                ? "bg-green-500/10"
                                                : "bg-white/[0.03] hover:bg-white/[0.06]"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0",
                                            goal.completed ? "bg-green-500/20" : category.bg
                                        )}>
                                            {goal.completed ? (
                                                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
                                            ) : (
                                                <CategoryIcon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", category.color)} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                "text-xs sm:text-sm font-medium truncate",
                                                goal.completed && "line-through text-muted-foreground"
                                            )}>
                                                {goal.title}
                                            </p>
                                        </div>
                                        {/* Mini Progress */}
                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                            <div className="w-12 sm:w-16 h-1 sm:h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all",
                                                        goal.progress >= 100 ? "bg-green-400" :
                                                        goal.progress >= 50 ? "bg-primary" :
                                                        "bg-white/30"
                                                    )}
                                                    style={{ width: `${goal.progress}%` }}
                                                />
                                            </div>
                                            <span className={cn(
                                                "text-[10px] sm:text-xs font-medium w-7 sm:w-8 text-right",
                                                goal.progress >= 100 ? "text-green-400" :
                                                goal.progress >= 50 ? "text-primary" :
                                                "text-muted-foreground"
                                            )}>
                                                {goal.progress}%
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* More indicator */}
                        {weeklyGoals.length > 3 && (
                            <Link href="/growth" className="block">
                                <div className="text-center py-1.5 sm:py-2 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    +{weeklyGoals.length - 3}개 더 보기
                                </div>
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
