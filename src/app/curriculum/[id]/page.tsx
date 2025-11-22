"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, Clock, Calendar, TrendingUp, Pause, CheckCircle2, Trash2, ChevronLeft, ChevronRight, Bell, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { markLearningComplete } from "@/lib/dailyGoals";
import { motion, AnimatePresence } from "framer-motion";

interface CurriculumItem {
    title: string;
    subtitle: string;
    icon: string;
    description?: string;
    totalDays?: number;
}

interface CurriculumProgress {
    completedDays: number[];
    totalDays: number;
    startDate: string;
    status: "in_progress" | "paused" | "completed";
}

export default function CurriculumDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [curriculum, setCurriculum] = useState<CurriculumItem | null>(null);
    const [progress, setProgress] = useState<CurriculumProgress>({
        completedDays: [],
        totalDays: 3,
        startDate: new Date().toISOString().split('T')[0],
        status: "in_progress"
    });
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        // Load curriculum item from localStorage
        const savedCurriculum = localStorage.getItem("user_curriculum");
        let curriculumItem: CurriculumItem | null = null;
        if (savedCurriculum) {
            const items: CurriculumItem[] = JSON.parse(savedCurriculum);
            const index = parseInt(id);
            if (items[index]) {
                curriculumItem = items[index];
                setCurriculum(curriculumItem);
            }
        }

        // Load progress from localStorage
        const progressKey = `curriculum_progress_${id}`;
        const savedProgress = localStorage.getItem(progressKey);
        if (savedProgress) {
            setProgress(JSON.parse(savedProgress));
        } else if (curriculumItem) {
            // Initialize progress with curriculum's totalDays
            const initialProgress: CurriculumProgress = {
                completedDays: [],
                totalDays: curriculumItem.totalDays || 14,
                startDate: new Date().toISOString().split('T')[0],
                status: "in_progress"
            };
            setProgress(initialProgress);
            localStorage.setItem(progressKey, JSON.stringify(initialProgress));
        }
    }, [id]);

    const saveProgress = (newProgress: CurriculumProgress) => {
        setProgress(newProgress);
        localStorage.setItem(`curriculum_progress_${id}`, JSON.stringify(newProgress));
    };

    const handlePause = () => {
        saveProgress({
            ...progress,
            status: progress.status === "paused" ? "in_progress" : "paused"
        });
    };

    const handleComplete = () => {
        if (curriculum) {
            const learningId = `curriculum_${id}_${curriculum.title}`;
            markLearningComplete(learningId);
            saveProgress({
                ...progress,
                status: "completed"
            });
        }
    };

    const handleDelete = () => {
        if (confirm("이 학습을 삭제하시겠습니까?")) {
            localStorage.removeItem(`curriculum_progress_${id}`);
            router.push("/dashboard");
        }
    };

    const completionPercentage = Math.round((progress.completedDays.length / progress.totalDays) * 100);

    // Calendar helpers
    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const formatMonth = (date: Date) => {
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const goToLearning = (dayNum: number) => {
        router.push(`/curriculum/${id}/learn/${dayNum}`);
    };

    // Check if a calendar date is within curriculum period
    const isInCurriculumPeriod = (calendarDate: Date): number | null => {
        const startDate = new Date(progress.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + progress.totalDays - 1);

        if (calendarDate >= startDate && calendarDate <= endDate) {
            const diffTime = calendarDate.getTime() - startDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return diffDays + 1; // Return day number (1-based)
        }
        return null;
    };

    if (!curriculum) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground animate-pulse">학습 정보를 불러오는 중...</p>
                </motion.div>
            </div>
        );
    }

    const statusLabel = {
        in_progress: "진행 중",
        paused: "일시정지",
        completed: "완료"
    };

    const statusColor = {
        in_progress: "text-purple-400 bg-purple-500/10 border-purple-500/20",
        paused: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
        completed: "text-green-400 bg-green-500/10 border-green-500/20"
    };

    return (
        <div className="min-h-screen bg-background selection:bg-primary/30">
            {/* Background Gradient */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />

            {/* Header */}
            <motion.header
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="sticky top-0 z-50 glass border-b border-white/5 backdrop-blur-xl"
            >
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push("/dashboard")}
                            className="hover:bg-white/5 rounded-full"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <span className="text-lg font-semibold tracking-tight">{curriculum?.title || "학습 과정"}</span>
                            <span className={cn("text-xs px-2.5 py-0.5 rounded-full border font-medium", statusColor[progress.status])}>
                                {statusLabel[progress.status]}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="hover:bg-white/5 rounded-full">
                            <Bell className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => router.push("/mypage")} className="hover:bg-white/5 rounded-full">
                            <User className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </motion.header>

            <main className="max-w-4xl mx-auto px-6 py-10 space-y-10 relative z-10">
                {/* Title Section */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                    <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-5 flex-1"
                    >
                        <div>
                            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 mb-2">
                                {curriculum.title}
                            </h1>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                {curriculum.subtitle || "체계적인 학습 계획을 수립하고 목표에 합격하는 것"}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                                <Target className="w-4 h-4 text-primary" />
                                <span>중급</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                                <Clock className="w-4 h-4 text-blue-400" />
                                <span>{progress.totalDays}일 과정</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                                <Calendar className="w-4 h-4 text-purple-400" />
                                <span>{progress.startDate.replace(/-/g, '.')} 시작</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Progress Circle */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="flex flex-col items-center bg-white/5 p-6 rounded-2xl border border-white/5 backdrop-blur-sm"
                    >
                        <div className="relative w-36 h-36">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="72"
                                    cy="72"
                                    r="60"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="none"
                                    className="text-white/5"
                                />
                                <motion.circle
                                    cx="72"
                                    cy="72"
                                    r="60"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="none"
                                    strokeLinecap="round"
                                    initial={{ strokeDasharray: "0 377" }}
                                    animate={{ strokeDasharray: `${completionPercentage * 3.77} 377` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className="text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-bold tracking-tighter">{completionPercentage}%</span>
                                <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Complete</span>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground mt-4 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            {progress.completedDays.length} / {progress.totalDays}일 완료
                        </p>
                    </motion.div>
                </div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-wrap gap-3"
                >
                    <Button
                        variant="outline"
                        className="gap-2 h-11 px-6 rounded-xl border-white/10 hover:bg-white/5 hover:border-primary/50 transition-all"
                        onClick={handlePause}
                    >
                        <Pause className="w-4 h-4" />
                        {progress.status === "paused" ? "학습 재개하기" : "일시정지"}
                    </Button>
                    <Button
                        className="gap-2 h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all"
                        onClick={handleComplete}
                        disabled={progress.status === "completed"}
                    >
                        <Sparkles className="w-4 h-4" />
                        전체 완료 처리
                    </Button>
                    <div className="flex-1" />
                    <Button
                        variant="ghost"
                        className="gap-2 h-11 px-6 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                        onClick={handleDelete}
                    >
                        <Trash2 className="w-4 h-4" />
                        과정 삭제
                    </Button>
                </motion.div>

                {/* Learning Calendar */}
                <motion.div
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card className="glass-card border-none bg-black/20 backdrop-blur-xl overflow-hidden">
                        <CardContent className="p-8">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Calendar className="w-6 h-6 text-primary" />
                                    학습 캘린더
                                </h2>
                                <div className="flex items-center gap-4 bg-white/5 rounded-full p-1 pr-4">
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-full w-8 h-8 hover:bg-white/10">
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-full w-8 h-8 hover:bg-white/10">
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <span className="text-lg font-medium tabular-nums">{formatMonth(currentMonth)}</span>
                                </div>
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-3">
                                {/* Day Headers */}
                                {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                                    <div
                                        key={day}
                                        className={cn(
                                            "text-center py-3 text-sm font-medium text-muted-foreground",
                                            i === 0 && "text-red-400/70",
                                            i === 6 && "text-blue-400/70"
                                        )}
                                    >
                                        {day}
                                    </div>
                                ))}

                                {/* Empty cells */}
                                {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}

                                {/* Day cells */}
                                {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, i) => {
                                    const calendarDay = i + 1;
                                    const calendarDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), calendarDay);
                                    const dayNum = isInCurriculumPeriod(calendarDate);
                                    const isInPeriod = dayNum !== null;
                                    const isCompleted = dayNum !== null && progress.completedDays.includes(dayNum);
                                    const isToday = new Date().toDateString() === calendarDate.toDateString();
                                    const dayOfWeek = (getFirstDayOfMonth(currentMonth) + i) % 7;

                                    return (
                                        <motion.button
                                            key={calendarDay}
                                            whileHover={isInPeriod ? { scale: 1.05, y: -2 } : {}}
                                            whileTap={isInPeriod ? { scale: 0.95 } : {}}
                                            onClick={() => {
                                                if (isInPeriod && dayNum) {
                                                    goToLearning(dayNum);
                                                }
                                            }}
                                            disabled={!isInPeriod}
                                            className={cn(
                                                "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all duration-300",
                                                isInPeriod ? "cursor-pointer bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10" : "opacity-30 cursor-not-allowed",
                                                isCompleted && "bg-green-500/10 border-green-500/30 text-green-400",
                                                isInPeriod && !isCompleted && "bg-primary/5 border-primary/20 text-primary-foreground",
                                                isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                                                !isInPeriod && dayOfWeek === 0 && "text-red-400",
                                                !isInPeriod && dayOfWeek === 6 && "text-blue-400"
                                            )}
                                        >
                                            <span className={cn("text-sm font-medium", isToday && "font-bold")}>{calendarDay}</span>

                                            {/* Status Indicators */}
                                            <div className="mt-1 h-1.5 flex gap-0.5">
                                                {isCompleted && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"
                                                    />
                                                )}
                                                {isToday && !isCompleted && isInPeriod && (
                                                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                                )}
                                            </div>

                                            {isInPeriod && dayNum && (
                                                <div className="absolute top-1.5 right-1.5 text-[10px] font-bold opacity-50">
                                                    Day {dayNum}
                                                </div>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="mt-8 flex flex-wrap gap-6 text-sm justify-center bg-white/5 rounded-xl p-4 border border-white/5">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary/30"></div>
                                    <span className="text-muted-foreground">학습 기간</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/30 shadow-[0_0_5px_rgba(34,197,94,0.3)]"></div>
                                    <span className="text-muted-foreground">완료함</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-transparent border-2 border-primary"></div>
                                    <span className="text-muted-foreground">오늘</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </main>
        </div>
    );
}

