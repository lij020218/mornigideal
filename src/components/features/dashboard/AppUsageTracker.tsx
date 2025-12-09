"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Smartphone,
    Clock,
    TrendingUp,
    AlertCircle,
    Settings,
    BarChart3,
    Plus,
    Trash2,
    Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    getDailyStats,
    getWeeklyStats,
    formatDuration,
    formatDurationShort,
    getAppGoals,
    saveAppGoals,
    isLimitExceeded,
    getRemainingTime,
    getUsagePercentage,
    getTodayDate,
    type AppUsageGoal,
    type DailyStats
} from "@/lib/appUsageTracking";

const POPULAR_APPS = [
    { name: "Instagram", icon: "📷", color: "from-pink-500 to-purple-500" },
    { name: "YouTube", icon: "▶️", color: "from-red-500 to-red-600" },
    { name: "TikTok", icon: "🎵", color: "from-cyan-500 to-pink-500" },
    { name: "Twitter/X", icon: "𝕏", color: "from-gray-700 to-black" },
    { name: "Facebook", icon: "👍", color: "from-blue-500 to-blue-600" },
    { name: "Netflix", icon: "🎬", color: "from-red-600 to-black" },
    { name: "KakaoTalk", icon: "💬", color: "from-yellow-400 to-yellow-500" },
];

export function AppUsageTracker() {
    const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
    const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
    const [goals, setGoals] = useState<AppUsageGoal[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedApp, setSelectedApp] = useState<string | null>(null);
    const [newGoalMinutes, setNewGoalMinutes] = useState<number>(60);

    // Load data
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    const loadData = () => {
        setTodayStats(getDailyStats(getTodayDate()));
        setWeeklyStats(getWeeklyStats());
        setGoals(getAppGoals());
    };

    const handleAddGoal = (appName: string) => {
        const existingGoal = goals.find(g => g.appName === appName);

        if (existingGoal) {
            // Update existing goal
            const updatedGoals = goals.map(g =>
                g.appName === appName
                    ? { ...g, dailyLimitMinutes: newGoalMinutes, enabled: true }
                    : g
            );
            setGoals(updatedGoals);
            saveAppGoals(updatedGoals);
        } else {
            // Add new goal
            const app = POPULAR_APPS.find(a => a.name === appName);
            const newGoal: AppUsageGoal = {
                appName,
                dailyLimitMinutes: newGoalMinutes,
                enabled: true,
                color: app?.color || "from-blue-500 to-blue-600"
            };
            const updatedGoals = [...goals, newGoal];
            setGoals(updatedGoals);
            saveAppGoals(updatedGoals);
        }

        setSelectedApp(null);
        setNewGoalMinutes(60);
    };

    const handleRemoveGoal = (appName: string) => {
        const updatedGoals = goals.filter(g => g.appName !== appName);
        setGoals(updatedGoals);
        saveAppGoals(updatedGoals);
    };

    const handleToggleGoal = (appName: string) => {
        const updatedGoals = goals.map(g =>
            g.appName === appName ? { ...g, enabled: !g.enabled } : g
        );
        setGoals(updatedGoals);
        saveAppGoals(updatedGoals);
    };

    // Get top 3 most used apps today
    const topApps = todayStats
        ? Object.entries(todayStats.appBreakdown)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
        : [];

    // Calculate total weekly usage
    const totalWeeklyTime = weeklyStats.reduce((sum, day) => sum + day.totalTime, 0);

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-blue-500" />
                    <h2 className="text-xl font-bold text-white">앱 사용 시간</h2>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                    className="h-8 w-8 p-0 rounded-full hover:bg-white/10"
                >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                </Button>
            </div>

            {/* Today's Summary */}
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-muted-foreground">오늘 총 사용 시간</span>
                    </div>
                    <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                    {todayStats ? formatDuration(todayStats.totalTime) : "0분"}
                </div>
                <div className="text-xs text-muted-foreground">
                    이번 주: {formatDuration(totalWeeklyTime)}
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-white">앱 사용 목표 설정</h3>
                    </div>

                    {/* Add New Goal */}
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">앱 선택</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {POPULAR_APPS.map(app => (
                                <button
                                    key={app.name}
                                    onClick={() => setSelectedApp(app.name)}
                                    className={cn(
                                        "p-2 rounded-lg border transition-all text-left",
                                        selectedApp === app.name
                                            ? "border-primary bg-primary/20"
                                            : "border-white/10 hover:border-white/20 bg-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{app.icon}</span>
                                        <span className="text-xs font-medium truncate">{app.name}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {selectedApp && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 space-y-3"
                            >
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-2">
                                        하루 목표 시간 (분)
                                    </label>
                                    <input
                                        type="number"
                                        value={newGoalMinutes}
                                        onChange={(e) => setNewGoalMinutes(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm"
                                        min="5"
                                        max="480"
                                        step="5"
                                    />
                                </div>
                                <Button
                                    onClick={() => handleAddGoal(selectedApp)}
                                    size="sm"
                                    className="w-full"
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    목표 추가
                                </Button>
                            </motion.div>
                        )}
                    </div>

                    {/* Existing Goals */}
                    {goals.length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-white/10">
                            <label className="text-xs text-muted-foreground">현재 목표</label>
                            {goals.map(goal => {
                                const app = POPULAR_APPS.find(a => a.name === goal.appName);
                                const usage = getUsagePercentage(goal.appName);
                                const exceeded = isLimitExceeded(goal.appName);
                                const remaining = getRemainingTime(goal.appName);

                                return (
                                    <div
                                        key={goal.appName}
                                        className="p-3 bg-white/5 border border-white/10 rounded-lg"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">{app?.icon || "📱"}</span>
                                                <span className="text-sm font-medium">{goal.appName}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleToggleGoal(goal.appName)}
                                                    className={cn(
                                                        "w-10 h-5 rounded-full transition-colors relative",
                                                        goal.enabled ? "bg-green-500" : "bg-gray-600"
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                                                            goal.enabled ? "left-5" : "left-0.5"
                                                        )}
                                                    />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveGoal(goal.appName)}
                                                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-3 h-3 text-red-400" />
                                                </button>
                                            </div>
                                        </div>

                                        {goal.enabled && (
                                            <>
                                                <div className="text-xs text-muted-foreground mb-1">
                                                    목표: {goal.dailyLimitMinutes}분 {remaining !== null && `(${Math.round(remaining)}분 남음)`}
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full transition-all",
                                                            exceeded
                                                                ? "bg-gradient-to-r from-red-500 to-orange-500"
                                                                : "bg-gradient-to-r from-green-500 to-blue-500"
                                                        )}
                                                        style={{ width: `${Math.min(usage, 100)}%` }}
                                                    />
                                                </div>

                                                {exceeded && (
                                                    <div className="flex items-center gap-1 mt-2 text-xs text-orange-400">
                                                        <AlertCircle className="w-3 h-3" />
                                                        <span>목표 시간을 초과했습니다</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            )}

            {/* Top Apps Today */}
            {topApps.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-white">오늘 가장 많이 사용한 앱</h3>
                    </div>

                    <div className="grid gap-2">
                        {topApps.map(([appName, duration], index) => {
                            const app = POPULAR_APPS.find(a => a.name === appName);
                            const percentage = todayStats
                                ? (duration / todayStats.totalTime) * 100
                                : 0;

                            return (
                                <motion.div
                                    key={appName}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="p-3 bg-white/5 border border-white/10 rounded-lg"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{app?.icon || "📱"}</span>
                                            <span className="text-sm font-medium">{appName}</span>
                                        </div>
                                        <span className="text-sm font-bold text-primary">
                                            {formatDuration(duration)}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full bg-gradient-to-r",
                                                app?.color || "from-blue-500 to-blue-600"
                                            )}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Weekly Chart */}
            {weeklyStats.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-white">주간 사용 추이</h3>
                    </div>

                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                        <div className="flex items-end justify-between gap-1 h-32">
                            {weeklyStats.map((day, index) => {
                                const maxTime = Math.max(...weeklyStats.map(d => d.totalTime), 1);
                                const height = (day.totalTime / maxTime) * 100;
                                const date = new Date(day.date);
                                const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

                                return (
                                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${height}%` }}
                                            transition={{ delay: index * 0.05 }}
                                            className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-sm min-h-[4px]"
                                            title={`${dayName}: ${formatDuration(day.totalTime)}`}
                                        />
                                        <span className="text-[10px] text-muted-foreground">{dayName}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!todayStats || todayStats.totalTime === 0 ? (
                <div className="text-center py-8 px-4 bg-white/5 border border-white/10 rounded-xl">
                    <Smartphone className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground mb-1">
                        아직 기록된 사용 시간이 없습니다
                    </p>
                    <p className="text-xs text-muted-foreground">
                        앱을 사용하면 자동으로 시간이 추적됩니다
                    </p>
                </div>
            ) : null}
        </section>
    );
}
