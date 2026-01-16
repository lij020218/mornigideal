"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, ChevronRight, ChevronLeft, BookOpen, Target, Clock,
    Sparkles, Loader2, Check, Calendar, Star, Crown, Zap,
    GraduationCap, Lightbulb, Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LearningCurriculumWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (curriculum: GeneratedCurriculum) => void;
    userPlan: "standard" | "pro" | "max";
}

interface WizardData {
    topic: string;
    customTopic: string;
    reason: string;
    targetLevel: string;
    currentLevel: string;
    duration: number;
}

interface CurriculumDay {
    day: number;
    title: string;
    description: string;
    objectives: string[];
    estimatedMinutes: number;
}

interface GeneratedCurriculum {
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

const POPULAR_TOPICS = [
    { id: "programming", label: "프로그래밍", icon: "💻", description: "코딩 및 개발 스킬" },
    { id: "design", label: "디자인", icon: "🎨", description: "UI/UX, 그래픽 디자인" },
    { id: "marketing", label: "마케팅", icon: "📈", description: "디지털 마케팅, 브랜딩" },
    { id: "language", label: "외국어", icon: "🌍", description: "영어, 일본어 등" },
    { id: "data", label: "데이터 분석", icon: "📊", description: "엑셀, SQL, 파이썬" },
    { id: "business", label: "비즈니스", icon: "💼", description: "경영, 전략, 리더십" },
    { id: "finance", label: "재테크", icon: "💰", description: "투자, 자산관리" },
    { id: "custom", label: "직접 입력", icon: "✏️", description: "원하는 주제 입력" },
];

const DURATION_OPTIONS = [
    { days: 7, label: "1주", description: "빠른 입문" },
    { days: 14, label: "2주", description: "기초 완성" },
    { days: 21, label: "3주", description: "심화 학습" },
    { days: 30, label: "1개월", description: "체계적 마스터" },
];

const LEVEL_OPTIONS = [
    { id: "beginner", label: "입문", description: "처음 시작하는 단계", icon: "🌱" },
    { id: "basic", label: "기초", description: "기본 개념을 익히는 단계", icon: "📗" },
    { id: "intermediate", label: "중급", description: "응용력을 키우는 단계", icon: "📘" },
    { id: "advanced", label: "고급", description: "전문성을 갖추는 단계", icon: "📕" },
    { id: "expert", label: "전문가", description: "최고 수준의 전문성", icon: "👑" },
];

export function LearningCurriculumWizard({
    isOpen,
    onClose,
    onComplete,
    userPlan,
}: LearningCurriculumWizardProps) {
    const [step, setStep] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [data, setData] = useState<WizardData>({
        topic: "",
        customTopic: "",
        reason: "",
        targetLevel: "",
        currentLevel: "",
        duration: 14,
    });

    const totalSteps = 5;

    const handleNext = () => {
        if (step < totalSteps) {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const canProceed = () => {
        switch (step) {
            case 1:
                return data.topic !== "" && (data.topic !== "custom" || data.customTopic.trim() !== "");
            case 2:
                return data.reason.trim().length >= 10;
            case 3:
                return data.currentLevel !== "";
            case 4:
                return data.targetLevel !== "";
            case 5:
                return data.duration > 0;
            default:
                return false;
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const topicName = data.topic === "custom"
                ? data.customTopic
                : POPULAR_TOPICS.find(t => t.id === data.topic)?.label || data.topic;

            const res = await fetch("/api/ai-learning-curriculum", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: topicName,
                    reason: data.reason,
                    currentLevel: data.currentLevel,
                    targetLevel: data.targetLevel,
                    duration: data.duration,
                    userPlan,
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to generate curriculum");
            }

            const result = await res.json();
            onComplete(result.curriculum);
        } catch (error) {
            console.error("[LearningWizard] Error:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const resetAndClose = () => {
        setStep(1);
        setData({
            topic: "",
            customTopic: "",
            reason: "",
            targetLevel: "",
            currentLevel: "",
            duration: 14,
        });
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={(e) => e.target === e.currentTarget && resetAndClose()}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-border/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                    <GraduationCap className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">학습 커리큘럼 만들기</h2>
                                    <p className="text-xs text-muted-foreground">
                                        단계 {step} / {totalSteps}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={resetAndClose}
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${(step / totalSteps) * 100}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 overflow-y-auto max-h-[55vh]">
                        <AnimatePresence mode="wait">
                            {/* Step 1: Topic Selection */}
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <h3 className="text-base font-semibold mb-1">무엇을 배우고 싶으세요?</h3>
                                        <p className="text-sm text-muted-foreground">
                                            학습하고 싶은 분야를 선택해주세요
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        {POPULAR_TOPICS.map((topic) => (
                                            <button
                                                key={topic.id}
                                                onClick={() => setData({ ...data, topic: topic.id })}
                                                className={cn(
                                                    "p-3 rounded-xl text-left transition-all",
                                                    data.topic === topic.id
                                                        ? "bg-purple-500/20 ring-1 ring-purple-500/50"
                                                        : "bg-white/[0.03] hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <span className="text-2xl">{topic.icon}</span>
                                                <h4 className="font-medium text-sm mt-1">{topic.label}</h4>
                                                <p className="text-xs text-muted-foreground">{topic.description}</p>
                                            </button>
                                        ))}
                                    </div>

                                    {data.topic === "custom" && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            className="mt-3"
                                        >
                                            <input
                                                type="text"
                                                placeholder="배우고 싶은 주제를 입력하세요"
                                                value={data.customTopic}
                                                onChange={(e) => setData({ ...data, customTopic: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl bg-background border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                                autoFocus
                                            />
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}

                            {/* Step 2: Reason */}
                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <h3 className="text-base font-semibold mb-1">왜 배우고 싶으세요?</h3>
                                        <p className="text-sm text-muted-foreground">
                                            학습 동기를 알려주시면 맞춤형 커리큘럼을 만들어 드려요
                                        </p>
                                    </div>

                                    <textarea
                                        placeholder="예: 이직을 위해 새로운 기술을 배우고 싶어요 / 부업으로 수익을 내고 싶어요 / 자격증을 취득하고 싶어요"
                                        value={data.reason}
                                        onChange={(e) => setData({ ...data, reason: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-background border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none"
                                        rows={4}
                                        autoFocus
                                    />

                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                        <p className="text-xs text-amber-200">
                                            구체적으로 작성할수록 더 맞춤화된 커리큘럼을 받을 수 있어요
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 3: Current Level */}
                            {step === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <h3 className="text-base font-semibold mb-1">현재 수준이 어느 정도인가요?</h3>
                                        <p className="text-sm text-muted-foreground">
                                            현재 실력에 맞는 커리큘럼을 추천해 드려요
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        {LEVEL_OPTIONS.map((level) => (
                                            <button
                                                key={level.id}
                                                onClick={() => setData({ ...data, currentLevel: level.id })}
                                                className={cn(
                                                    "w-full p-3 rounded-xl text-left transition-all flex items-center gap-3",
                                                    data.currentLevel === level.id
                                                        ? "bg-purple-500/20 ring-1 ring-purple-500/50"
                                                        : "bg-white/[0.03] hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <span className="text-xl">{level.icon}</span>
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-sm">{level.label}</h4>
                                                    <p className="text-xs text-muted-foreground">{level.description}</p>
                                                </div>
                                                {data.currentLevel === level.id && (
                                                    <Check className="w-4 h-4 text-purple-400" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 4: Target Level */}
                            {step === 4 && (
                                <motion.div
                                    key="step4"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <h3 className="text-base font-semibold mb-1">어느 수준까지 도달하고 싶으세요?</h3>
                                        <p className="text-sm text-muted-foreground">
                                            목표 수준에 맞춰 커리큘럼을 구성해 드려요
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        {LEVEL_OPTIONS.filter(l => {
                                            const currentIdx = LEVEL_OPTIONS.findIndex(o => o.id === data.currentLevel);
                                            const thisIdx = LEVEL_OPTIONS.findIndex(o => o.id === l.id);
                                            return thisIdx > currentIdx;
                                        }).map((level) => (
                                            <button
                                                key={level.id}
                                                onClick={() => setData({ ...data, targetLevel: level.id })}
                                                className={cn(
                                                    "w-full p-3 rounded-xl text-left transition-all flex items-center gap-3",
                                                    data.targetLevel === level.id
                                                        ? "bg-purple-500/20 ring-1 ring-purple-500/50"
                                                        : "bg-white/[0.03] hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <span className="text-xl">{level.icon}</span>
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-sm">{level.label}</h4>
                                                    <p className="text-xs text-muted-foreground">{level.description}</p>
                                                </div>
                                                {data.targetLevel === level.id && (
                                                    <Check className="w-4 h-4 text-purple-400" />
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {LEVEL_OPTIONS.filter(l => {
                                        const currentIdx = LEVEL_OPTIONS.findIndex(o => o.id === data.currentLevel);
                                        const thisIdx = LEVEL_OPTIONS.findIndex(o => o.id === l.id);
                                        return thisIdx > currentIdx;
                                    }).length === 0 && (
                                        <div className="text-center py-6">
                                            <Trophy className="w-10 h-10 mx-auto text-amber-400 mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                                이미 최고 수준이시네요! 현재 수준을 조정해주세요.
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Step 5: Duration */}
                            {step === 5 && (
                                <motion.div
                                    key="step5"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <h3 className="text-base font-semibold mb-1">학습 기간을 선택하세요</h3>
                                        <p className="text-sm text-muted-foreground">
                                            선택한 기간에 맞춰 일별 커리큘럼을 만들어 드려요
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        {DURATION_OPTIONS.map((option) => (
                                            <button
                                                key={option.days}
                                                onClick={() => setData({ ...data, duration: option.days })}
                                                className={cn(
                                                    "p-4 rounded-xl text-left transition-all",
                                                    data.duration === option.days
                                                        ? "bg-purple-500/20 ring-1 ring-purple-500/50"
                                                        : "bg-white/[0.03] hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Calendar className="w-4 h-4 text-purple-400" />
                                                    <span className="font-bold text-lg">{option.label}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{option.description}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    ({option.days}일)
                                                </p>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Plan Benefits */}
                                    <div className="mt-4 space-y-2">
                                        <p className="text-xs text-muted-foreground font-medium">내 플랜 혜택</p>
                                        <div className={cn(
                                            "p-3 rounded-xl",
                                            userPlan === "max"
                                                ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30"
                                                : "bg-white/[0.03]"
                                        )}>
                                            <div className="flex items-center gap-2 mb-2">
                                                {userPlan === "max" ? (
                                                    <Crown className="w-4 h-4 text-amber-400" />
                                                ) : userPlan === "pro" ? (
                                                    <Star className="w-4 h-4 text-purple-400" />
                                                ) : (
                                                    <Zap className="w-4 h-4 text-blue-400" />
                                                )}
                                                <span className="font-medium text-sm">
                                                    {userPlan === "max" ? "Max 플랜" : userPlan === "pro" ? "Pro 플랜" : "Standard 플랜"}
                                                </span>
                                            </div>
                                            <ul className="space-y-1 text-xs text-muted-foreground">
                                                <li className="flex items-center gap-2">
                                                    <Check className="w-3 h-3 text-green-400" />
                                                    일별 학습 커리큘럼 제공
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check className="w-3 h-3 text-green-400" />
                                                    AI 맞춤 학습 주제 추천
                                                </li>
                                                {userPlan === "max" && (
                                                    <li className="flex items-center gap-2">
                                                        <Sparkles className="w-3 h-3 text-amber-400" />
                                                        <span className="text-amber-300">15쪽 분량 학습 슬라이드 제공</span>
                                                    </li>
                                                )}
                                                {userPlan !== "max" && (
                                                    <li className="flex items-center gap-2 opacity-50">
                                                        <X className="w-3 h-3" />
                                                        학습 슬라이드 (Max 플랜 전용)
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border/50 flex gap-2">
                        {step > 1 && (
                            <Button
                                onClick={handleBack}
                                variant="outline"
                                size="sm"
                                className="gap-2 rounded-lg"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                이전
                            </Button>
                        )}

                        <div className="flex-1" />

                        {step < totalSteps ? (
                            <Button
                                onClick={handleNext}
                                disabled={!canProceed()}
                                size="sm"
                                className="gap-2 rounded-lg"
                            >
                                다음
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleGenerate}
                                disabled={!canProceed() || isGenerating}
                                size="sm"
                                className="gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        AI가 커리큘럼 생성 중...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        커리큘럼 생성하기
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
