"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, Plus, Flag, CheckCircle2, Trash2, Calendar, Loader2, Check,
    Briefcase, Heart, BookOpen, Coins, Users, Palette, Dumbbell, Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface ScheduleRecommendation {
    text: string;
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
    color: string;
    reason: string;
}

interface GoalSettingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoalsUpdated?: () => void;
    onScheduleAdd?: (schedules: any[]) => void;
}

const GOAL_CATEGORIES = [
    { id: "career", label: "커리어", icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/20" },
    { id: "health", label: "건강", icon: Heart, color: "text-green-400", bg: "bg-green-500/20" },
    { id: "exercise", label: "운동", icon: Dumbbell, color: "text-red-400", bg: "bg-red-500/20" },
    { id: "learning", label: "학습", icon: BookOpen, color: "text-purple-400", bg: "bg-purple-500/20" },
    { id: "finance", label: "재정", icon: Coins, color: "text-yellow-400", bg: "bg-yellow-500/20" },
    { id: "relationship", label: "관계", icon: Users, color: "text-pink-400", bg: "bg-pink-500/20" },
    { id: "hobby", label: "취미", icon: Palette, color: "text-orange-400", bg: "bg-orange-500/20" },
    { id: "general", label: "기타", icon: Circle, color: "text-slate-400", bg: "bg-slate-500/20" },
];

const DAYS_LABEL: Record<number, string> = {
    0: "일",
    1: "월",
    2: "화",
    3: "수",
    4: "목",
    5: "금",
    6: "토",
};

export function GoalSettingModal({ isOpen, onClose, onGoalsUpdated, onScheduleAdd }: GoalSettingModalProps) {
    const [activeTab, setActiveTab] = useState<"weekly" | "monthly" | "yearly">("weekly");
    const [goals, setGoals] = useState<{ weekly: LongTermGoal[]; monthly: LongTermGoal[]; yearly: LongTermGoal[] }>({
        weekly: [],
        monthly: [],
        yearly: [],
    });
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newGoal, setNewGoal] = useState({
        title: "",
        description: "",
        category: "general",
    });

    // Schedule recommendation states
    const [showScheduleRecommendation, setShowScheduleRecommendation] = useState(false);
    const [scheduleRecommendations, setScheduleRecommendations] = useState<ScheduleRecommendation[]>([]);
    const [scheduleTip, setScheduleTip] = useState("");
    const [selectedSchedules, setSelectedSchedules] = useState<Set<number>>(new Set());
    const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
    const [addedGoalInfo, setAddedGoalInfo] = useState<{ id: string; title: string; type: "weekly" | "monthly" | "yearly" } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchGoals();
        }
    }, [isOpen]);

    const fetchGoals = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/user/long-term-goals");
            if (res.ok) {
                const data = await res.json();
                setGoals(data.goals);
            }
        } catch (error) {
            console.error("Failed to fetch goals:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddGoal = async () => {
        if (!newGoal.title.trim()) return;

        try {
            const res = await fetch("/api/user/long-term-goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "add",
                    goal: {
                        type: activeTab,
                        title: newGoal.title,
                        description: newGoal.description,
                        category: newGoal.category,
                    },
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setGoals(data.goals);

                // Find the newly added goal (last one in the list)
                const newlyAddedGoal = data.goals[activeTab]?.[data.goals[activeTab].length - 1];

                // Fetch schedule recommendations with goal ID
                setAddedGoalInfo({
                    id: newlyAddedGoal?.id || `goal-${Date.now()}`,
                    title: newGoal.title,
                    type: activeTab
                });
                await fetchScheduleRecommendations();

                setNewGoal({ title: "", description: "", category: "general" });
                setShowAddForm(false);
                onGoalsUpdated?.();
            }
        } catch (error) {
            console.error("Failed to add goal:", error);
        }
    };

    const [scheduleError, setScheduleError] = useState<string | null>(null);

    const fetchScheduleRecommendations = async () => {
        setIsLoadingSchedules(true);
        setShowScheduleRecommendation(true);
        setScheduleError(null);

        try {
            const res = await fetch("/api/ai-goal-schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    goal: {
                        title: newGoal.title,
                        description: newGoal.description,
                        category: newGoal.category,
                        type: activeTab,
                    },
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setScheduleRecommendations(data.schedules || []);
                setScheduleTip(data.tip || "");
                // Select all by default
                setSelectedSchedules(new Set(data.schedules?.map((_: any, i: number) => i) || []));
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error("[GoalSettingModal] API error:", res.status, errorData);
                setScheduleError(errorData.error || `서버 오류 (${res.status})`);
            }
        } catch (error: any) {
            console.error("Failed to fetch schedule recommendations:", error);
            setScheduleError(error?.message || "네트워크 오류가 발생했습니다");
        } finally {
            setIsLoadingSchedules(false);
        }
    };

    const handleAddSchedules = async () => {
        if (selectedSchedules.size === 0 || !onScheduleAdd) {
            setShowScheduleRecommendation(false);
            return;
        }

        const schedulesToAdd = scheduleRecommendations
            .filter((_, index) => selectedSchedules.has(index))
            .map((schedule) => ({
                id: `goal-schedule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                text: schedule.text,
                time: "morning" as const,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                color: schedule.color,
                daysOfWeek: schedule.daysOfWeek,
                notificationEnabled: true,
                // Link schedule to the goal for progress tracking
                linkedGoalId: addedGoalInfo?.id,
                linkedGoalType: addedGoalInfo?.type,
            }));

        onScheduleAdd(schedulesToAdd);
        setShowScheduleRecommendation(false);
        setScheduleRecommendations([]);
        setSelectedSchedules(new Set());
        setAddedGoalInfo(null);
    };

    const handleDeleteGoal = async (goalId: string, type: "weekly" | "monthly" | "yearly") => {
        try {
            const res = await fetch("/api/user/long-term-goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "delete",
                    goal: { id: goalId, type },
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setGoals(data.goals);
                onGoalsUpdated?.();
            }
        } catch (error) {
            console.error("Failed to delete goal:", error);
        }
    };

    // Note: Manual complete and progress update removed
    // Progress is now automatically updated when linked schedules are completed

    const getCategoryInfo = (categoryId: string) => {
        return GOAL_CATEGORIES.find((c) => c.id === categoryId) || GOAL_CATEGORIES[GOAL_CATEGORIES.length - 1];
    };

    const getTabLabel = (tab: string) => {
        switch (tab) {
            case "weekly": return "주간";
            case "monthly": return "월간";
            case "yearly": return "연간";
            default: return tab;
        }
    };

    const getTabDescription = (tab: string) => {
        switch (tab) {
            case "weekly": return "이번 주에 달성하고 싶은 목표";
            case "monthly": return "이번 달에 이루고 싶은 목표";
            case "yearly": return "올해 꼭 달성하고 싶은 목표";
            default: return "";
        }
    };

    const toggleScheduleSelection = (index: number) => {
        const newSelected = new Set(selectedSchedules);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedSchedules(newSelected);
    };

    if (!isOpen) return null;

    // Schedule Recommendation View
    if (showScheduleRecommendation) {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">일정 추천</h2>
                                    <p className="text-xs text-muted-foreground">
                                        "{addedGoalInfo?.title}" 달성을 위한 일정
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                            {isLoadingSchedules ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">AI가 일정을 추천하는 중...</p>
                                </div>
                            ) : scheduleRecommendations.length > 0 ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        목표 달성을 위해 아래 일정을 추천해요. 추가할 일정을 선택하세요.
                                    </p>

                                    <div className="space-y-2">
                                        {scheduleRecommendations.map((schedule, index) => (
                                            <motion.button
                                                key={index}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                onClick={() => toggleScheduleSelection(index)}
                                                className={cn(
                                                    "w-full p-4 rounded-xl text-left transition-all",
                                                    selectedSchedules.has(index)
                                                        ? "bg-primary/10 ring-1 ring-primary/50"
                                                        : "bg-white/[0.03] hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all",
                                                        selectedSchedules.has(index)
                                                            ? "bg-primary text-white"
                                                            : "bg-white/10"
                                                    )}>
                                                        {selectedSchedules.has(index) && <Check className="w-4 h-4" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-medium text-sm">{schedule.text}</h4>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                            <span>{schedule.startTime} - {schedule.endTime}</span>
                                                            <span className="flex gap-1">
                                                                {schedule.daysOfWeek.map((d) => (
                                                                    <span key={d} className="px-1.5 py-0.5 rounded bg-white/10">
                                                                        {DAYS_LABEL[d]}
                                                                    </span>
                                                                ))}
                                                            </span>
                                                        </div>
                                                        {schedule.reason && (
                                                            <p className="text-xs text-muted-foreground/70 mt-1.5">
                                                                {schedule.reason}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.button>
                                        ))}
                                    </div>

                                    {scheduleTip && (
                                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                            <p className="text-xs text-amber-200">{scheduleTip}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-muted-foreground">
                                        일정 추천을 불러오지 못했어요
                                    </p>
                                    {scheduleError && (
                                        <p className="text-xs text-red-400 mt-2">
                                            오류: {scheduleError}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-border/50 flex gap-2">
                            <Button
                                onClick={() => {
                                    setShowScheduleRecommendation(false);
                                    setScheduleRecommendations([]);
                                }}
                                variant="outline"
                                size="sm"
                                className="flex-1 rounded-lg"
                            >
                                건너뛰기
                            </Button>
                            <Button
                                onClick={handleAddSchedules}
                                disabled={selectedSchedules.size === 0 || isLoadingSchedules}
                                size="sm"
                                className="flex-1 rounded-lg gap-2"
                            >
                                <Calendar className="w-4 h-4" />
                                {selectedSchedules.size}개 일정 추가
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                                <Flag className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">목표 설정</h2>
                                <p className="text-xs text-muted-foreground">나만의 목표를 세워보세요</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 p-3 bg-white/[0.02]">
                        {(["weekly", "monthly", "yearly"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                                    activeTab === tab
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                )}
                            >
                                {getTabLabel(tab)}
                                {goals[tab].length > 0 && (
                                    <span className={cn(
                                        "ml-1.5 px-1.5 py-0.5 rounded text-xs",
                                        activeTab === tab ? "bg-primary/20" : "bg-white/10"
                                    )}>
                                        {goals[tab].length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-4 overflow-y-auto max-h-[50vh]">
                        <p className="text-xs text-muted-foreground mb-3">{getTabDescription(activeTab)}</p>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {goals[activeTab].map((goal) => {
                                    const category = getCategoryInfo(goal.category || "general");
                                    const CategoryIcon = category.icon;
                                    return (
                                        <motion.div
                                            key={goal.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "p-3 rounded-xl transition-all",
                                                goal.completed
                                                    ? "bg-green-500/10"
                                                    : "bg-white/[0.03] hover:bg-white/[0.06]"
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                                    goal.completed ? "bg-green-500/20" : category.bg
                                                )}>
                                                    {goal.completed ? (
                                                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                                                    ) : (
                                                        <CategoryIcon className={cn("w-4 h-4", category.color)} />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className={cn(
                                                        "text-sm font-medium",
                                                        goal.completed ? "text-green-400 line-through" : "text-foreground"
                                                    )}>
                                                        {goal.title}
                                                    </h3>
                                                    {goal.description && (
                                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{goal.description}</p>
                                                    )}

                                                    {/* Progress Bar - Read only, updated via schedule completion */}
                                                    {!goal.completed && (
                                                        <div className="mt-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all"
                                                                        style={{ width: `${goal.progress}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs text-muted-foreground w-8">{goal.progress}%</span>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                                                                연결된 일정을 완료하면 진행률이 올라갑니다
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-0.5">
                                                    {/* Removed manual complete button - progress is now tied to schedule completion */}
                                                    <button
                                                        onClick={() => handleDeleteGoal(goal.id, activeTab)}
                                                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                                        title="삭제"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}

                                {goals[activeTab].length === 0 && !showAddForm && (
                                    <div className="text-center py-10">
                                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
                                            <Flag className="w-7 h-7 text-primary/60" />
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            아직 {getTabLabel(activeTab)} 목표가 없어요
                                        </p>
                                        <Button
                                            onClick={() => setShowAddForm(true)}
                                            size="sm"
                                            className="gap-2 rounded-xl"
                                        >
                                            <Plus className="w-4 h-4" />
                                            목표 추가
                                        </Button>
                                    </div>
                                )}

                                {/* Add Form */}
                                {showAddForm && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 rounded-xl bg-primary/5 border border-primary/20"
                                    >
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                placeholder="목표를 입력하세요"
                                                value={newGoal.title}
                                                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                                                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                                                autoFocus
                                            />
                                            <textarea
                                                placeholder="상세 설명 (선택)"
                                                value={newGoal.description}
                                                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                                                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                                                rows={2}
                                            />
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-2">카테고리</p>
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    {GOAL_CATEGORIES.map((cat) => {
                                                        const Icon = cat.icon;
                                                        return (
                                                            <button
                                                                key={cat.id}
                                                                onClick={() => setNewGoal({ ...newGoal, category: cat.id })}
                                                                className={cn(
                                                                    "flex flex-col items-center gap-1 py-2 rounded-lg text-xs transition-all",
                                                                    newGoal.category === cat.id
                                                                        ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                                                                        : "bg-white/5 text-muted-foreground hover:bg-white/10"
                                                                )}
                                                            >
                                                                <Icon className="w-4 h-4" />
                                                                <span>{cat.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-1">
                                                <Button
                                                    onClick={handleAddGoal}
                                                    disabled={!newGoal.title.trim()}
                                                    size="sm"
                                                    className="flex-1 rounded-lg"
                                                >
                                                    추가
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        setShowAddForm(false);
                                                        setNewGoal({ title: "", description: "", category: "general" });
                                                    }}
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-lg"
                                                >
                                                    취소
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {!showAddForm && goals[activeTab].length > 0 && (
                        <div className="p-3 border-t border-border/50">
                            <Button
                                onClick={() => setShowAddForm(true)}
                                variant="outline"
                                size="sm"
                                className="w-full gap-2 rounded-lg bg-transparent hover:bg-white/5"
                            >
                                <Plus className="w-4 h-4" />
                                {getTabLabel(activeTab)} 목표 추가
                            </Button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
