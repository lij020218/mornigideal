"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Sun, CheckCircle2, TrendingUp, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect } from "react";

interface DailyBriefingData {
    greeting: string;
    yesterdayReview: string;
    yesterdayStats: {
        wakeUp: boolean;
        learning: number;
        trendBriefing: number;
    };
    trendSummary: string[];
    todayFocus: string;
    importantSchedule?: {
        time: string;
        title: string;
        type: 'work' | 'meeting' | 'personal';
    };
    closing: string;
}

interface DailyBriefingModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: DailyBriefingData | null;
    isLoading: boolean;
}

export function DailyBriefingModal({ isOpen, onClose, data, isLoading }: DailyBriefingModalProps) {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Scroll to top when modal opens
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto scrollbar-hide"
                >
                    <style jsx global>{`
                        .scrollbar-hide::-webkit-scrollbar {
                            display: none;
                        }
                        .scrollbar-hide {
                            -ms-overflow-style: none;
                            scrollbar-width: none;
                        }
                    `}</style>
                    {/* Background Gradient */}
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-yellow-500/10 to-transparent pointer-events-none" />

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>

                    <div className="p-6 md:p-8 relative z-0">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                <div className="w-12 h-12 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
                                <p className="text-muted-foreground animate-pulse">오늘의 브리핑을 준비하고 있습니다...</p>
                            </div>
                        ) : data ? (
                            <div className="space-y-8">
                                {/* Header / Greeting */}
                                <div className="text-center space-y-2">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/20 text-yellow-500 mb-2 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                                        <Sun className="w-8 h-8 fill-yellow-500" />
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                                        {data.greeting}
                                    </h2>
                                </div>

                                <div className="grid gap-6">
                                    {/* Yesterday's Review & Stats */}
                                    <Card className="bg-white/5 border-white/10 overflow-hidden">
                                        <CardContent className="p-5">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </div>
                                                <h3 className="font-semibold text-white text-lg">어제의 나</h3>
                                            </div>

                                            <p className="text-sm text-gray-300 leading-relaxed mb-6">
                                                {data.yesterdayReview}
                                            </p>

                                            {/* Visual Stats */}
                                            <div className="grid grid-cols-3 gap-3">
                                                {/* Wake Up */}
                                                <div className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center ${data.yesterdayStats.wakeUp ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${data.yesterdayStats.wakeUp ? 'bg-green-500 text-black' : 'bg-white/10 text-muted-foreground'}`}>
                                                        <Sun className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-400">기상</span>
                                                </div>

                                                {/* Learning */}
                                                <div className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center ${data.yesterdayStats.learning >= 2 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/10'}`}>
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${data.yesterdayStats.learning >= 2 ? 'bg-purple-500 text-white' : 'bg-purple-500/20 text-purple-400'}`}>
                                                        <span className="text-xs font-bold">{data.yesterdayStats.learning}/2</span>
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-400">학습</span>
                                                </div>

                                                {/* Trends */}
                                                <div className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center ${data.yesterdayStats.trendBriefing >= 6 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10'}`}>
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${data.yesterdayStats.trendBriefing >= 6 ? 'bg-blue-500 text-white' : 'bg-blue-500/20 text-blue-400'}`}>
                                                        <span className="text-xs font-bold">{data.yesterdayStats.trendBriefing}/6</span>
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-400">브리핑</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Yesterday's Trends (6 items) */}
                                    <Card className="bg-white/5 border-white/10">
                                        <CardContent className="p-5">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                                    <TrendingUp className="w-5 h-5" />
                                                </div>
                                                <h3 className="font-semibold text-white text-lg">어제의 트렌드 요약</h3>
                                            </div>
                                            <div className="space-y-3">
                                                {data.trendSummary.map((item, i) => (
                                                    <div key={i} className="flex gap-3 items-start p-2 rounded-lg hover:bg-white/5 transition-colors">
                                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
                                                            {i + 1}
                                                        </span>
                                                        <p className="text-sm text-gray-300 leading-snug">{item}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Today's Focus & Schedule */}
                                    <Card className="bg-white/5 border-white/10">
                                        <CardContent className="p-5">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                                                    <Calendar className="w-5 h-5" />
                                                </div>
                                                <h3 className="font-semibold text-white text-lg">오늘의 포커스</h3>
                                            </div>

                                            <p className="text-sm text-gray-300 leading-relaxed mb-4">
                                                {data.todayFocus}
                                            </p>

                                            {/* Important Schedule Card */}
                                            {data.importantSchedule && (
                                                <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl p-4 flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                                                        <Calendar className="w-6 h-6 text-purple-400" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 border border-purple-500/20">
                                                                {data.importantSchedule.time}
                                                            </span>
                                                            <span className="text-xs text-purple-300/70 uppercase tracking-wider">중요 일정</span>
                                                        </div>
                                                        <p className="font-bold text-white">{data.importantSchedule.title}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Closing & Action */}
                                <div className="text-center pt-2">
                                    <p className="text-muted-foreground mb-6 text-sm italic">
                                        "{data.closing}"
                                    </p>
                                    <Button
                                        onClick={onClose}
                                        className="w-full md:w-auto px-10 py-6 text-lg rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold shadow-lg shadow-yellow-500/20 group transition-all hover:scale-105"
                                    >
                                        힘차게 하루 시작하기
                                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-muted-foreground">
                                브리핑 데이터를 불러올 수 없습니다.
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
