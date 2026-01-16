"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sunrise, Calendar, CheckCircle, TrendingUp, Sparkles, ChevronRight, Moon, Smartphone, AlertTriangle, ThumbsUp, Target, BookOpen, Music, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { analyzeYesterdayUsage, formatDuration, type YesterdayUsageAnalysis } from "@/lib/appUsageTracking";

interface DailyBriefingContent {
    greeting: string;
    yesterday_summary: string;
    yesterday_score: number;
    today_schedule_summary: string;
    trend_summary: string;
    cheering_message: string;
    // New morning briefing fields
    todayGoal?: {
        text: string;
        motivation: string;
    };
    suggestions?: Array<{
        title: string;
        description: string;
        action: string;
        category: string;
        estimatedTime: string;
        priority: string;
        icon: string;
    }>;
    bookRecommendation?: {
        title: string;
        author: string;
        reason: string;
        quote: string;
    };
    songRecommendation?: {
        title: string;
        artist: string;
        reason: string;
        mood: string;
    };
}

interface DailyBriefingPopupProps {
    isOpen: boolean;
    onClose: () => void;
    briefing: DailyBriefingContent | null;
}

export function DailyBriefingPopup({ isOpen, onClose, data, username }: { isOpen: boolean; onClose: () => void; data: DailyBriefingContent | null; username: string }) {
    const [step, setStep] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [usageAnalysis, setUsageAnalysis] = useState<YesterdayUsageAnalysis | null>(null);

    // Reset step when opened and analyze yesterday's usage
    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            setStep(0);
            // Analyze yesterday's app usage
            const analysis = analyzeYesterdayUsage();
            setUsageAnalysis(analysis);
        }
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
                        <h3 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900">
                            Good Morning,<br />{username}님!
                        </h3>
                        <p className="text-lg text-gray-600 leading-relaxed px-4 font-light">
                            오늘 하루를 시작하기 위한<br />
                            <span className="text-orange-600 font-medium">나만의 인사이트</span>가 도착했습니다.
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
                                <circle cx="80" cy="80" r="70" className="stroke-gray-200 fill-none" strokeWidth="12" />
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
                                <span className="text-4xl font-bold text-green-600">
                                    {data.yesterday_score}%
                                </span>
                                <span className="text-xs text-green-600/70 font-medium uppercase tracking-wider mt-1">Completion</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl text-center border border-white/40">
                        <h4 className="flex items-center justify-center gap-2 font-bold mb-3 text-sm text-green-700 uppercase tracking-wider">
                            <CheckCircle className="w-4 h-4" /> 어제 활동 요약
                        </h4>
                        <p className="text-sm text-gray-700 leading-relaxed font-light">
                            {data.yesterday_summary}
                        </p>
                    </div>
                </div>
            )
        },
        // Step 2: Yesterday's App Usage Analysis (only if data available)
        ...(usageAnalysis?.hasData ? [{
            title: "Digital Habits",
            content: (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 mb-3">
                            <Smartphone className="w-8 h-8 text-blue-400" />
                        </div>
                        <h4 className="text-lg font-bold text-white mb-1">어제의 디지털 사용 패턴</h4>
                        <p className="text-xs text-muted-foreground">총 사용 시간: {formatDuration(usageAnalysis.totalTime)}</p>
                    </div>

                    {/* Top Apps */}
                    {usageAnalysis.topApps.length > 0 && (
                        <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                            <h5 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                                가장 많이 사용한 앱
                            </h5>
                            <div className="space-y-2">
                                {usageAnalysis.topApps.map((app, index) => (
                                    <div key={app.name} className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                            index === 0 ? "bg-yellow-500/20 text-yellow-400" :
                                            index === 1 ? "bg-gray-400/20 text-gray-300" :
                                            "bg-orange-500/20 text-orange-400"
                                        )}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-white">{app.name}</span>
                                                <span className="text-xs text-muted-foreground">{formatDuration(app.time)}</span>
                                            </div>
                                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                                                    style={{ width: `${app.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SNS Warning (if applicable) */}
                    {usageAnalysis.warning && (
                        <div className={cn(
                            "p-4 rounded-xl border",
                            usageAnalysis.totalSnsTime > 7200000 // 2시간 이상
                                ? "bg-red-500/10 border-red-500/30"
                                : "bg-yellow-500/10 border-yellow-500/30"
                        )}>
                            <div className="flex items-start gap-3">
                                <AlertTriangle className={cn(
                                    "w-5 h-5 shrink-0 mt-0.5",
                                    usageAnalysis.totalSnsTime > 7200000
                                        ? "text-red-400"
                                        : "text-yellow-400"
                                )} />
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-white">
                                        {usageAnalysis.warning}
                                    </p>
                                    {usageAnalysis.recommendation && (
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            💡 {usageAnalysis.recommendation}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Positive Message (if no warning) */}
                    {!usageAnalysis.warning && usageAnalysis.totalSnsTime > 0 && (
                        <div className="p-4 rounded-xl border bg-green-500/10 border-green-500/30">
                            <div className="flex items-start gap-3">
                                <ThumbsUp className="w-5 h-5 shrink-0 mt-0.5 text-green-400" />
                                <div>
                                    <p className="text-sm font-medium text-white mb-1">
                                        훌륭합니다! 균형 잡힌 디지털 습관을 유지하고 계시네요.
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        SNS 사용 시간: {formatDuration(usageAnalysis.totalSnsTime)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )
        }] : []),
        // Step: Today's Goal (if available)
        ...(data.todayGoal ? [{
            title: "Today's Goal",
            content: (
                <div className="space-y-6">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/80 backdrop-blur-sm border border-white/40 mb-4">
                            <Target className="w-10 h-10 text-orange-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">오늘의 목표</h3>
                        <p className="text-sm text-gray-600">Set Your Intention</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 backdrop-blur-sm p-6 rounded-2xl border border-orange-200/60 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                        <div className="relative z-10 text-center">
                            <p className="text-xl font-bold text-orange-800 leading-relaxed mb-3">
                                {data.todayGoal.text}
                            </p>
                            <p className="text-sm text-orange-600/80 italic">
                                "{data.todayGoal.motivation}"
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                        <Target className="w-3 h-3" />
                        <span>목표가 있는 하루는 다릅니다</span>
                    </div>
                </div>
            )
        }] : []),
        // Step: Suggested Activities (if available)
        ...(data.suggestions && data.suggestions.length > 0 ? [{
            title: "Suggested Activities",
            content: (
                <div className="space-y-5">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/80 backdrop-blur-sm border border-white/40 mb-3">
                            <Plus className="w-8 h-8 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">오늘 추천 활동</h3>
                        <p className="text-sm text-gray-600">5개 모두 달성하면 성취도 100%!</p>
                    </div>

                    <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
                        {data.suggestions.map((suggestion, index) => (
                            <div
                                key={index}
                                className="bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-white/40 flex items-center gap-3 hover:bg-white/90 transition-all"
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-100/80 flex items-center justify-center text-lg shrink-0">
                                    {suggestion.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-800 text-sm truncate">{suggestion.title}</p>
                                    <p className="text-xs text-gray-500">{suggestion.description} • {suggestion.estimatedTime}</p>
                                </div>
                                <span className={cn(
                                    "px-2 py-1 rounded-full text-[10px] font-medium shrink-0",
                                    suggestion.priority === 'high' ? "bg-red-100 text-red-700" :
                                    suggestion.priority === 'medium' ? "bg-yellow-100 text-yellow-700" :
                                    "bg-green-100 text-green-700"
                                )}>
                                    {suggestion.priority === 'high' ? '높음' : suggestion.priority === 'medium' ? '보통' : '낮음'}
                                </span>
                            </div>
                        ))}
                    </div>

                    <p className="text-center text-xs text-gray-500">
                        일정에 추가해서 하나씩 달성해보세요!
                    </p>
                </div>
            )
        }] : []),
        // Step: Book Recommendation (if available)
        ...(data.bookRecommendation ? [{
            title: "Book of the Day",
            content: (
                <div className="space-y-6">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/80 backdrop-blur-sm border border-white/40 mb-4">
                            <BookOpen className="w-10 h-10 text-emerald-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">오늘의 책 추천</h3>
                        <p className="text-sm text-gray-600">Book Recommendation</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 backdrop-blur-sm p-6 rounded-2xl border border-emerald-200/60 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                        <div className="relative z-10 space-y-4">
                            <div className="text-center">
                                <p className="text-xl font-bold text-emerald-800">"{data.bookRecommendation.title}"</p>
                                <p className="text-sm text-emerald-600">{data.bookRecommendation.author}</p>
                            </div>
                            <p className="text-sm text-gray-700 text-center">{data.bookRecommendation.reason}</p>
                            <div className="bg-white/60 p-3 rounded-xl">
                                <p className="text-sm text-emerald-700 italic text-center leading-relaxed">
                                    "{data.bookRecommendation.quote}"
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                        <BookOpen className="w-3 h-3" />
                        <span>책 한 권이 인생을 바꿀 수 있습니다</span>
                    </div>
                </div>
            )
        }] : []),
        // Step: Song Recommendation (if available)
        ...(data.songRecommendation ? [{
            title: "Song of the Day",
            content: (
                <div className="space-y-6">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/80 backdrop-blur-sm border border-white/40 mb-4">
                            <Music className="w-10 h-10 text-violet-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">오늘의 노래 추천</h3>
                        <p className="text-sm text-gray-600">Song Recommendation</p>
                    </div>

                    <div className="bg-gradient-to-br from-violet-50 to-purple-50 backdrop-blur-sm p-6 rounded-2xl border border-violet-200/60 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                        <div className="relative z-10 space-y-4 text-center">
                            <div className="w-16 h-16 mx-auto rounded-full bg-violet-100 flex items-center justify-center">
                                <span className="text-3xl">🎵</span>
                            </div>
                            <div>
                                <p className="text-xl font-bold text-violet-800">"{data.songRecommendation.title}"</p>
                                <p className="text-sm text-violet-600">{data.songRecommendation.artist}</p>
                            </div>
                            <p className="text-sm text-gray-700">{data.songRecommendation.reason}</p>
                            <div className={cn(
                                "inline-flex px-3 py-1 rounded-full text-xs font-medium",
                                data.songRecommendation.mood === 'energetic' ? "bg-red-100 text-red-700" :
                                data.songRecommendation.mood === 'calm' ? "bg-blue-100 text-blue-700" :
                                data.songRecommendation.mood === 'motivating' ? "bg-orange-100 text-orange-700" :
                                "bg-green-100 text-green-700"
                            )}>
                                {data.songRecommendation.mood === 'energetic' ? '🔥 에너제틱' :
                                 data.songRecommendation.mood === 'calm' ? '🌊 차분함' :
                                 data.songRecommendation.mood === 'motivating' ? '💪 동기부여' :
                                 '🌿 평화로움'}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                        <Music className="w-3 h-3" />
                        <span>좋은 음악으로 하루를 시작하세요</span>
                    </div>
                </div>
            )
        }] : []),
        // Step: Today's Schedule
        {
            title: "Today's Schedule",
            content: (
                <div className="space-y-6">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/80 backdrop-blur-sm border border-white/40 mb-4">
                            <Calendar className="w-10 h-10 text-blue-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">오늘의 일정</h3>
                        <p className="text-sm text-gray-600">Today's Schedule</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-white/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -ml-16 -mb-16" />
                        <div className="relative z-10">
                            <p className="text-base text-gray-700 leading-relaxed font-light whitespace-pre-line">
                                {data.today_schedule_summary}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                        <Calendar className="w-3 h-3" />
                        <span>효율적인 하루를 위한 계획</span>
                    </div>
                </div>
            )
        },
        // Step 4: Trend Briefing
        {
            title: "Trend Briefing",
            content: (
                <div className="space-y-6">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/80 backdrop-blur-sm border border-white/40 mb-4">
                            <TrendingUp className="w-10 h-10 text-purple-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">트렌드 브리핑</h3>
                        <p className="text-sm text-gray-600">Personalized Trend Analysis</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-white/40 max-h-[300px] overflow-y-auto custom-scrollbar relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -ml-16 -mb-16" />
                        <div className="relative z-10">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line font-light">
                                {data.trend_summary}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                        <TrendingUp className="w-3 h-3" />
                        <span>당신을 위한 맞춤 인사이트</span>
                    </div>
                </div>
            )
        },
        // Step 5: Closing / Cheering
        {
            title: "Cheering For You",
            content: (
                <div className="text-center space-y-10 py-6">
                    <div className="w-24 h-24 mx-auto bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center animate-pulse border border-white/40 relative">
                        <div className="absolute inset-0 bg-yellow-500/20 blur-2xl rounded-full" />
                        <Sparkles className="w-12 h-12 text-yellow-600 relative z-10" />
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-xl font-medium text-gray-700">오늘의 응원 메시지</h3>
                        <p className="text-xl md:text-2xl font-bold text-gray-900 italic px-4 leading-normal">
                            "{data.cheering_message}"
                        </p>
                    </div>
                    <Button
                        size="lg"
                        className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white transition-all rounded-xl h-14 text-lg font-bold shadow-lg hover:shadow-xl hover:scale-[1.02]"
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
                        className="fixed inset-0 bg-black/50 backdrop-blur-md z-[99999] flex items-center justify-center p-4"
                        onClick={onClose}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Decorative Gradients */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

                            {/* Progress Bar */}
                            <div className="h-1 bg-gray-200/30 w-full">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-orange-400 to-amber-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>

                            {/* Content */}
                            <div className="p-8 md:p-10 min-h-[500px] flex flex-col relative z-10">
                                {/* Header */}
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-xs font-bold text-gray-600 tracking-[0.2em] uppercase flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                        DAILY BRIEFING
                                    </h2>
                                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-900/5 w-8 h-8">
                                        <X className="w-4 h-4 text-gray-600" />
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
                                            "rounded-full px-6 text-gray-600 hover:text-gray-900 hover:bg-gray-900/5 transition-all",
                                            step === 0 && "invisible"
                                        )}
                                        onClick={() => setStep(step - 1)}
                                    >
                                        이전
                                    </Button>

                                    {step < steps.length - 1 && (
                                        <Button
                                            className="rounded-full px-8 bg-gray-900 text-white hover:bg-black transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-105"
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
