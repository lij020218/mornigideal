"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BookOpen, Calendar, Check, ChevronRight, Clock, Crown,
    GraduationCap, Loader2, Play, Sparkles, Target, Trophy, X,
    ChevronDown, ChevronUp, FileText, Lock, Plus, CalendarPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// Date & Time Picker Modal Component
interface DateTimePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string, startTime: string) => void;
    dayTitle: string;
    estimatedMinutes: number;
}

function DateTimePickerModal({ isOpen, onClose, onConfirm, dayTitle, estimatedMinutes }: DateTimePickerModalProps) {
    const [step, setStep] = useState<'date' | 'time'>('date');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedHour, setSelectedHour] = useState(9);
    const [selectedMinute, setSelectedMinute] = useState(0);

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = [0, 15, 30, 45];

    // Generate next 14 days for date selection
    const getNext14Days = () => {
        const days: Date[] = [];
        const today = new Date();
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            days.push(date);
        }
        return days;
    };

    const next14Days = getNext14Days();

    const formatDateDisplay = (date: Date) => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return '오늘';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return '내일';
        } else {
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
            return `${month}/${day} (${weekday})`;
        }
    };

    const formatTime = (h: number, m: number) => {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const getEndTime = () => {
        const totalMinutes = selectedHour * 60 + selectedMinute + estimatedMinutes;
        const endHour = Math.floor(totalMinutes / 60) % 24;
        const endMinute = totalMinutes % 60;
        return formatTime(endHour, endMinute);
    };

    const formatDateString = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const handleConfirm = () => {
        onConfirm(formatDateString(selectedDate), formatTime(selectedHour, selectedMinute));
    };

    // Reset step when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('date');
            setSelectedDate(new Date());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-card rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl border"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">
                            {step === 'date' ? '학습 날짜 선택' : '학습 시간 선택'}
                        </h3>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4">
                        "{dayTitle}" 학습 일정을 {step === 'date' ? '언제' : '몇 시에'} 시작할까요?
                    </p>

                    {/* Step indicator */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                            step === 'date' ? "bg-purple-500 text-white" : "bg-purple-500/20 text-purple-400"
                        )}>
                            1
                        </div>
                        <div className="w-8 h-0.5 bg-muted" />
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                            step === 'time' ? "bg-purple-500 text-white" : "bg-muted text-muted-foreground"
                        )}>
                            2
                        </div>
                    </div>

                    {step === 'date' ? (
                        /* Date Selector */
                        <div className="mb-6">
                            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
                                {next14Days.map((date, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedDate(date)}
                                        className={cn(
                                            "p-3 rounded-xl text-center transition-all",
                                            selectedDate.toDateString() === date.toDateString()
                                                ? "bg-purple-500 text-white font-bold"
                                                : "bg-muted/30 hover:bg-muted"
                                        )}
                                    >
                                        <div className="text-xs opacity-70">
                                            {['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}
                                        </div>
                                        <div className="text-lg font-bold">{date.getDate()}</div>
                                        <div className="text-xs opacity-70">
                                            {date.getMonth() + 1}월
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Time Selector */
                        <div className="flex items-center justify-center gap-4 mb-6">
                            {/* Hour */}
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-muted-foreground mb-2">시</span>
                                <div className="h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-muted rounded-lg bg-muted/30 p-2">
                                    {hours.map((h) => (
                                        <button
                                            key={h}
                                            onClick={() => setSelectedHour(h)}
                                            className={cn(
                                                "w-12 py-2 rounded-lg text-center transition-colors",
                                                selectedHour === h
                                                    ? "bg-purple-500 text-white font-bold"
                                                    : "hover:bg-muted"
                                            )}
                                        >
                                            {h.toString().padStart(2, '0')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <span className="text-2xl font-bold">:</span>

                            {/* Minute */}
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-muted-foreground mb-2">분</span>
                                <div className="flex flex-col gap-1">
                                    {minutes.map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => setSelectedMinute(m)}
                                            className={cn(
                                                "w-12 py-2 rounded-lg text-center transition-colors",
                                                selectedMinute === m
                                                    ? "bg-purple-500 text-white font-bold"
                                                    : "hover:bg-muted bg-muted/30"
                                            )}
                                        >
                                            {m.toString().padStart(2, '0')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    <div className="bg-purple-500/10 rounded-xl p-4 mb-6 border border-purple-500/20">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">날짜</span>
                            <span className={cn("font-bold", step === 'date' ? "text-purple-400" : "")}>
                                {formatDateDisplay(selectedDate)}
                            </span>
                        </div>
                        {step === 'time' && (
                            <>
                                <div className="flex items-center justify-between text-sm mt-2">
                                    <span className="text-muted-foreground">시작</span>
                                    <span className="font-bold text-purple-400">{formatTime(selectedHour, selectedMinute)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm mt-2">
                                    <span className="text-muted-foreground">종료 (예상)</span>
                                    <span className="font-medium">{getEndTime()}</span>
                                </div>
                            </>
                        )}
                        <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-purple-500/20">
                            <span className="text-muted-foreground">예상 소요시간</span>
                            <span>{estimatedMinutes}분</span>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        {step === 'date' ? (
                            <>
                                <Button variant="outline" onClick={onClose} className="flex-1">
                                    취소
                                </Button>
                                <Button
                                    onClick={() => setStep('time')}
                                    className="flex-1 bg-purple-500 hover:bg-purple-600"
                                >
                                    다음
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setStep('date')} className="flex-1">
                                    이전
                                </Button>
                                <Button
                                    onClick={handleConfirm}
                                    className="flex-1 bg-purple-500 hover:bg-purple-600"
                                >
                                    <CalendarPlus className="w-4 h-4 mr-2" />
                                    일정 추가
                                </Button>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

interface CurriculumDay {
    day: number;
    title: string;
    description: string;
    objectives: string[];
    estimatedMinutes: number;
}

interface Curriculum {
    id: string;
    topic: string;
    reason: string;
    targetLevel: string;
    currentLevel: string;
    duration: number;
    days: CurriculumDay[];
    createdAt: string;
    hasSlides: boolean;
}

interface LearningProgress {
    completedDays: number[];
    currentDay: number;
}

interface LearningCurriculumViewProps {
    curriculum: Curriculum;
    userPlan: "standard" | "pro" | "max";
    onClose: () => void;
    onStartDay: (day: CurriculumDay, hasSlides: boolean) => void;
}

const LEVEL_LABELS: Record<string, string> = {
    beginner: "입문",
    basic: "기초",
    intermediate: "중급",
    advanced: "고급",
    expert: "전문가",
};

export function LearningCurriculumView({
    curriculum,
    userPlan,
    onClose,
    onStartDay,
}: LearningCurriculumViewProps) {
    const router = useRouter();
    const [progress, setProgress] = useState<LearningProgress>({
        completedDays: [],
        currentDay: 1,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
    const [isAddingSchedule, setIsAddingSchedule] = useState(false);
    const [addedToSchedule, setAddedToSchedule] = useState<Set<number>>(new Set());
    const [timePickerOpen, setTimePickerOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<CurriculumDay | null>(null);

    useEffect(() => {
        fetchProgress();
    }, [curriculum.id]);

    const fetchProgress = async () => {
        try {
            const res = await fetch(`/api/user/learning-progress?curriculumId=${curriculum.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.progress) {
                    setProgress(data.progress);
                }
            }
        } catch (error) {
            console.error("[LearningCurriculumView] Failed to fetch progress:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompleteDay = async (dayNumber: number) => {
        try {
            const newCompletedDays = [...progress.completedDays, dayNumber];
            const newCurrentDay = Math.max(...newCompletedDays) + 1;

            setProgress({
                completedDays: newCompletedDays,
                currentDay: newCurrentDay,
            });

            await fetch("/api/user/learning-progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    curriculumId: curriculum.id,
                    completedDays: newCompletedDays,
                    currentDay: newCurrentDay,
                }),
            });
        } catch (error) {
            console.error("[LearningCurriculumView] Failed to update progress:", error);
        }
    };

    const toggleWeek = (weekNumber: number) => {
        const newExpanded = new Set(expandedWeeks);
        if (newExpanded.has(weekNumber)) {
            newExpanded.delete(weekNumber);
        } else {
            newExpanded.add(weekNumber);
        }
        setExpandedWeeks(newExpanded);
    };

    // 시간 선택 모달 열기
    const openTimePicker = (day: CurriculumDay) => {
        if (userPlan === "max") {
            // Max 플랜은 슬라이드 보기
            onStartDay(day, true);
            return;
        }
        setSelectedDay(day);
        setTimePickerOpen(true);
    };

    // 스탠다드/프로 플랜: 일정에 학습 주제 추가 (날짜 & 시간 선택 후)
    const handleAddToSchedule = async (selectedDateStr: string, startTime: string) => {
        if (!selectedDay) return;
        const day = selectedDay;

        setTimePickerOpen(false);
        setIsAddingSchedule(true);

        try {
            // 종료 시간 계산
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const totalMinutes = startHour * 60 + startMinute + day.estimatedMinutes;
            const endHour = Math.floor(totalMinutes / 60) % 24;
            const endMinute = totalMinutes % 60;
            const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

            // 프로필에서 현재 customGoals 가져오기
            const profileRes = await fetch('/api/user/profile');
            if (!profileRes.ok) throw new Error('Failed to fetch profile');

            const { profile } = await profileRes.json();
            const currentGoals = profile?.customGoals || [];

            // 학습 데이터 생성
            const learningData = {
                curriculumId: curriculum.id,
                curriculumTopic: curriculum.topic,
                dayNumber: day.day,
                dayTitle: day.title,
                description: day.description,
                objectives: day.objectives,
            };

            // 선택한 날짜의 요일 계산
            const selectedDate = new Date(selectedDateStr);
            const selectedDayOfWeek = selectedDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

            // 새 학습 일정 추가
            const newSchedule = {
                id: `learning-${curriculum.id}-day${day.day}-${Date.now()}`,
                text: `📚 ${curriculum.topic}: ${day.title}`,
                time: startHour < 12 ? "morning" as const : startHour < 18 ? "afternoon" as const : "evening" as const,
                startTime,
                endTime,
                color: "purple",
                notificationEnabled: true,
                isLearning: true,
                learningData,
                specificDate: selectedDateStr, // 선택한 날짜
                daysOfWeek: [selectedDayOfWeek], // 선택한 날짜의 요일 (호환성)
            };

            const updatedGoals = [...currentGoals, newSchedule];

            // 프로필 업데이트 - API는 { profile: {...} } 형태를 기대
            const updatedProfile = {
                ...profile,
                customGoals: updatedGoals,
            };

            const updateRes = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile: updatedProfile }),
            });

            if (!updateRes.ok) {
                const errorData = await updateRes.json().catch(() => ({}));
                console.error('[Learning] Profile update failed:', errorData);
                throw new Error('Failed to update profile');
            }

            console.log('[Learning] Profile updated successfully with', updatedGoals.length, 'goals');

            // Notify other components about schedule update
            window.dispatchEvent(new CustomEvent('schedule-updated'));
            window.dispatchEvent(new Event('profile-updated'));

            // 추가된 상태 업데이트
            setAddedToSchedule(prev => new Set([...prev, day.day]));

            // 진행 상황 업데이트
            await handleCompleteDay(day.day);

            console.log('[Learning] Added schedule for day:', day.day);

            // 학습 팁 생성 요청 & 채팅 페이지로 이동
            try {
                const tipRes = await fetch('/api/ai-learning-tip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        learningData,
                        userLevel: curriculum.currentLevel,
                    }),
                });

                if (tipRes.ok) {
                    const tipData = await tipRes.json();
                    // localStorage에 학습 팁 저장 (채팅 페이지에서 읽어서 표시)
                    localStorage.setItem('pending_learning_tip', JSON.stringify({
                        ...tipData,
                        scheduleId: newSchedule.id,
                        dayTitle: day.title,
                        topic: curriculum.topic,
                    }));

                    // 채팅 페이지에 학습 팁이 추가되었음을 알림
                    window.dispatchEvent(new Event('learning-tip-added'));
                    console.log('[Learning] Dispatched learning-tip-added event');
                }
            } catch (tipError) {
                console.error('[Learning] Failed to generate tip:', tipError);
                // 팁 생성 실패해도 기본 메시지는 저장
                localStorage.setItem('pending_learning_tip', JSON.stringify({
                    greeting: `오늘의 학습: ${day.title}`,
                    tips: [],
                    encouragement: '오늘도 화이팅!',
                    scheduleId: newSchedule.id,
                    dayTitle: day.title,
                    topic: curriculum.topic,
                }));
                window.dispatchEvent(new Event('learning-tip-added'));
            }

            // 채팅 알림 이벤트 발생 (다른 페이지에 있을 때 알림용)
            window.dispatchEvent(new CustomEvent('new-chat-notification', {
                detail: {
                    title: '학습 일정 추가됨',
                    message: `"${day.title}" 학습이 ${startTime}에 예정되었어요!`,
                    type: 'learning',
                }
            }));

            // 채팅 페이지로 이동
            router.push('/chat');

        } catch (error) {
            console.error('[Learning] Failed to add schedule:', error);
        } finally {
            setIsAddingSchedule(false);
            setSelectedDay(null);
        }
    };

    // Group days by week
    const weeks: { weekNumber: number; days: CurriculumDay[] }[] = [];
    for (let i = 0; i < curriculum.days.length; i += 7) {
        weeks.push({
            weekNumber: Math.floor(i / 7) + 1,
            days: curriculum.days.slice(i, i + 7),
        });
    }

    const completedCount = progress.completedDays.length;
    const totalCount = curriculum.days.length;
    const progressPercent = Math.round((completedCount / totalCount) * 100);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{curriculum.topic}</h2>
                            <p className="text-sm text-muted-foreground">
                                {LEVEL_LABELS[curriculum.currentLevel]} → {LEVEL_LABELS[curriculum.targetLevel]}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <p className="text-sm text-muted-foreground mb-4">{curriculum.reason}</p>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">학습 진행률</span>
                        <span className="font-bold">{progressPercent}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{completedCount}일 완료</span>
                        <span>{totalCount - completedCount}일 남음</span>
                    </div>
                </div>

                {/* Plan Badge */}
                {curriculum.hasSlides && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-amber-300">Max 플랜 전용 슬라이드 포함</span>
                    </div>
                )}
            </div>

            {/* Weekly Schedule */}
            <div className="space-y-3">
                {weeks.map((week) => (
                    <div key={week.weekNumber} className="bg-white/[0.03] rounded-xl overflow-hidden">
                        {/* Week Header */}
                        <button
                            onClick={() => toggleWeek(week.weekNumber)}
                            className="w-full flex items-center justify-between p-4 hover:bg-white/[0.03] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-purple-400" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-medium">Week {week.weekNumber}</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Day {week.days[0].day} - Day {week.days[week.days.length - 1].day}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-xs">
                                    <Check className="w-3 h-3 text-green-400" />
                                    <span>
                                        {week.days.filter(d => progress.completedDays.includes(d.day)).length}/{week.days.length}
                                    </span>
                                </div>
                                {expandedWeeks.has(week.weekNumber) ? (
                                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                            </div>
                        </button>

                        {/* Week Content */}
                        <AnimatePresence>
                            {expandedWeeks.has(week.weekNumber) && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-4 pb-4 space-y-2">
                                        {week.days.map((day) => {
                                            const isCompleted = progress.completedDays.includes(day.day);
                                            const isCurrent = day.day === progress.currentDay;
                                            const isLocked = day.day > progress.currentDay && !isCompleted;

                                            return (
                                                <motion.div
                                                    key={day.day}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: (day.day % 7) * 0.05 }}
                                                    className={cn(
                                                        "p-4 rounded-xl transition-all",
                                                        isCompleted
                                                            ? "bg-green-500/10 border border-green-500/20"
                                                            : isCurrent
                                                            ? "bg-purple-500/10 border border-purple-500/30"
                                                            : isLocked
                                                            ? "bg-white/[0.02] opacity-50"
                                                            : "bg-white/[0.03] hover:bg-white/[0.06]"
                                                    )}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                                            isCompleted
                                                                ? "bg-green-500/20"
                                                                : isCurrent
                                                                ? "bg-purple-500/20"
                                                                : "bg-white/10"
                                                        )}>
                                                            {isCompleted ? (
                                                                <Check className="w-5 h-5 text-green-400" />
                                                            ) : isLocked ? (
                                                                <Lock className="w-5 h-5 text-muted-foreground" />
                                                            ) : (
                                                                <span className={cn(
                                                                    "font-bold",
                                                                    isCurrent ? "text-purple-400" : "text-muted-foreground"
                                                                )}>
                                                                    {day.day}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className={cn(
                                                                    "font-medium text-sm",
                                                                    isCompleted && "text-green-400"
                                                                )}>
                                                                    {day.title}
                                                                </h4>
                                                                {isCurrent && (
                                                                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">
                                                                        오늘
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                                {day.description}
                                                            </p>
                                                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    {day.estimatedMinutes}분
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <Target className="w-3 h-3" />
                                                                    {day.objectives.length}개 목표
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {/* Max 플랜: 슬라이드 버튼 */}
                                                            {userPlan === "max" && !isLocked && (
                                                                <Button
                                                                    onClick={() => onStartDay(day, true)}
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="gap-1 rounded-lg text-xs h-8"
                                                                >
                                                                    <FileText className="w-3 h-3" />
                                                                    슬라이드
                                                                </Button>
                                                            )}
                                                            {/* 스탠다드/프로 플랜: 일정에 추가 버튼 */}
                                                            {userPlan !== "max" && !isCompleted && !isLocked && !addedToSchedule.has(day.day) && (
                                                                <Button
                                                                    onClick={() => openTimePicker(day)}
                                                                    disabled={isAddingSchedule}
                                                                    size="sm"
                                                                    className={cn(
                                                                        "gap-1 rounded-lg text-xs h-8",
                                                                        isCurrent && "bg-purple-500 hover:bg-purple-600"
                                                                    )}
                                                                >
                                                                    {isAddingSchedule && selectedDay?.day === day.day ? (
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                        <CalendarPlus className="w-3 h-3" />
                                                                    )}
                                                                    일정 추가
                                                                </Button>
                                                            )}
                                                            {/* 일정에 추가됨 표시 */}
                                                            {addedToSchedule.has(day.day) && !isCompleted && (
                                                                <span className="text-xs text-purple-400 flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3" />
                                                                    일정 추가됨
                                                                </span>
                                                            )}
                                                            {isCompleted && (
                                                                <span className="text-xs text-green-400 flex items-center gap-1">
                                                                    <Trophy className="w-3 h-3" />
                                                                    완료
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {/* Completion Card */}
            {completedCount === totalCount && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl p-6 text-center border border-amber-500/30"
                >
                    <Trophy className="w-12 h-12 mx-auto text-amber-400 mb-3" />
                    <h3 className="text-xl font-bold mb-2">축하합니다! 🎉</h3>
                    <p className="text-sm text-muted-foreground">
                        "{curriculum.topic}" 커리큘럼을 모두 완료했습니다!
                    </p>
                </motion.div>
            )}

            {/* Date & Time Picker Modal */}
            <DateTimePickerModal
                isOpen={timePickerOpen}
                onClose={() => {
                    setTimePickerOpen(false);
                    setSelectedDay(null);
                }}
                onConfirm={handleAddToSchedule}
                dayTitle={selectedDay?.title || ''}
                estimatedMinutes={selectedDay?.estimatedMinutes || 30}
            />
        </div>
    );
}
