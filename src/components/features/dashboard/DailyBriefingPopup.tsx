"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sunrise, Calendar, CheckCircle, TrendingUp, Sparkles, ChevronRight, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface DailyBriefingContent {
    greeting: string;
    yesterday_summary: string;
    yesterday_score: number;
    today_schedule_summary: string;
    trend_summary: string;
    cheering_message: string;
}

interface DailyBriefingPopupProps {
    isOpen: boolean;
    onClose: () => void;
    briefing: DailyBriefingContent | null;
}

export function DailyBriefingPopup({ isOpen, onClose, data, username }: { isOpen: boolean; onClose: () => void; data: DailyBriefingContent | null; username: string }) {
    const [step, setStep] = useState(0);
    const [mounted, setMounted] = useState(false);

    // Reset step when opened
    useEffect(() => {
        setMounted(true);
        if (isOpen) setStep(0);
        return () => setMounted(false);
    }, [isOpen]);

    // Reset step when opened
    useEffect(() => {
        setMounted(true);
        if (isOpen) setStep(0);
        return () => setMounted(false);
    }, [isOpen]);

    if (!mounted) return null;

    // Show loading or placeholder if open but no data
    if (isOpen && !data) {
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
                <div className="text-white flex flex-col items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4"></div>
                    <p>브리핑 내용을 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const steps = [
        // Step 0: Cover / Greetings
        {
            title: "Good Morning!",
            content: (
                <div className="text-center space-y-8">
                    <div className="relative w-32 h-32 mx-auto">
                        <div className="absolute inset-0 bg-orange-500/30 blur-[40px] rounded-full animate-pulse" />
                        <div className="relative w-full h-full bg-gradient-to-br from-orange-400 to-amber-200 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(251,146,60,0.5)] border-4 border-white/20">
                            <Sunrise className="w-16 h-16 text-white drop-shadow-lg" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl md:text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white via-orange-100 to-white/70">
                            Good Morning,<br />{username}님!
                        </h3>
                        <p className="text-lg text-muted-foreground leading-relaxed px-4 font-light">
                            오늘 하루를 시작하기 위한<br />
                            <span className="text-orange-300 font-medium">나만의 인사이트</span>가 도착했습니다.
                        </p>
                    </div>
                </div>
            )
        },
        // Step 1: Yesterday's Review
        {
            title: "Yesterday's Summary",
            content: (
                <div className="space-y-8">
                    <div className="flex items-center justify-center py-4">
                        <div className="relative w-40 h-40 flex items-center justify-center">
                            {/* Background Glow */}
                            {/* Background Glow removed for cleaner look, relying on stroke drop-shadow */}

                            <svg className="w-full h-full transform -rotate-90 overflow-visible">
                                <circle cx="80" cy="80" r="70" className="stroke-white/5 fill-none" strokeWidth="12" />
                                <motion.circle
                                    cx="80" cy="80" r="70"
                                    className="stroke-green-500 fill-none drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                    strokeWidth="12"
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: data.yesterday_score / 100 }}
                                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-tr from-green-400 to-emerald-200">
                                    {data.yesterday_score}%
                                </span>
                                <span className="text-xs text-green-400/80 font-medium uppercase tracking-wider mt-1">Completion</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-transparent p-4 rounded-2xl text-center">
                        <h4 className="flex items-center justify-center gap-2 font-bold mb-3 text-sm text-green-400 uppercase tracking-wider">
                            <CheckCircle className="w-4 h-4" /> 어제 활동 요약
                        </h4>
                        <p className="text-sm text-gray-200 leading-relaxed font-light">
                            {data.yesterday_summary}
                        </p>
                    </div>
                </div>
            )
        },
        // Step 2: Today's Schedule & Trends
        {
            title: "Today's Focus",
            content: (
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/5 backdrop-blur-md p-5 rounded-2xl border border-blue-500/20 relative overflow-hidden group hover:border-blue-500/40 transition-colors">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
                        <h4 className="flex items-center gap-2 font-bold mb-3 text-sm text-blue-400 uppercase tracking-wider relative z-10">
                            <Calendar className="w-4 h-4" /> 오늘 주요 일정
                        </h4>
                        <p className="text-sm text-gray-200 leading-relaxed font-light relative z-10">
                            {data.today_schedule_summary}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/5 backdrop-blur-md p-5 rounded-2xl border border-purple-500/20 max-h-[220px] overflow-y-auto custom-scrollbar relative group hover:border-purple-500/40 transition-colors">
                        <h4 className="flex items-center gap-2 font-bold mb-3 text-sm text-purple-400 sticky top-0 bg-transparent uppercase tracking-wider z-10">
                            <TrendingUp className="w-4 h-4" /> 트렌드 브리핑
                        </h4>
                        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line font-light">
                            {data.trend_summary}
                        </p>
                    </div>
                </div>
            )
        },
        // Step 3: Closing / Cheering
        {
            title: "Cheering For You",
            content: (
                <div className="text-center space-y-10 py-6">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400/20 to-amber-500/20 rounded-full flex items-center justify-center animate-pulse border border-yellow-500/30 relative">
                        <div className="absolute inset-0 bg-yellow-500/20 blur-2xl rounded-full" />
                        <Sparkles className="w-12 h-12 text-yellow-400 relative z-10" />
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-xl font-medium text-white/90">오늘의 응원 메시지</h3>
                        <p className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-white to-yellow-200 italic px-4 leading-normal">
                            "{data.cheering_message}"
                        </p>
                    </div>
                    <Button
                        size="lg"
                        className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 transition-all rounded-xl h-14 text-lg font-bold shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_40px_rgba(168,85,247,0.6)] hover:scale-[1.02]"
                        onClick={onClose}
                    >
                        멋진 하루 시작하기 ✨
                    </Button>
                </div>
            )
        }
    ];

    const currentStep = steps[step];

    const popupContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[99999] flex items-center justify-center p-4"
                        onClick={onClose}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="w-full max-w-lg bg-[#121212]/90 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Decorative Gradients */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

                            {/* Progress Bar */}
                            <div className="h-1 bg-white/5 w-full">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-primary to-purple-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>

                            {/* Content */}
                            <div className="p-8 md:p-10 min-h-[500px] flex flex-col relative z-10">
                                {/* Header */}
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-xs font-bold text-muted-foreground tracking-[0.2em] uppercase flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                        DAILY BRIEFING
                                    </h2>
                                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10 w-8 h-8">
                                        <X className="w-4 h-4 text-muted-foreground" />
                                    </Button>
                                </div>

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={step}
                                        initial={{ opacity: 0, x: 20, filter: "blur(10px)" }}
                                        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                                        exit={{ opacity: 0, x: -20, filter: "blur(10px)" }}
                                        transition={{ duration: 0.4, ease: "easeOut" }}
                                        className="flex-1 flex flex-col justify-center"
                                    >
                                        {currentStep.content}
                                    </motion.div>
                                </AnimatePresence>

                                {/* Navigation */}
                                <div className="mt-10 flex justify-between items-center">
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "rounded-full px-6 text-muted-foreground hover:text-white hover:bg-white/5 transition-all",
                                            step === 0 && "invisible"
                                        )}
                                        onClick={() => setStep(step - 1)}
                                    >
                                        이전
                                    </Button>

                                    {step < steps.length - 1 && (
                                        <Button
                                            className="rounded-full px-8 bg-white text-black hover:bg-gray-200 transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-105"
                                            onClick={() => setStep(step + 1)}
                                        >
                                            다음 <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    if (typeof document !== "undefined") {
        return createPortal(popupContent, document.body);
    }
    return null;
}
