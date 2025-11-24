"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Sun, CheckCircle2, TrendingUp, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DailyBriefingData {
    greeting: string;
    yesterdayReview: string;
    trendSummary: string[];
    todayFocus: string;
    closing: string;
}

interface DailyBriefingModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: DailyBriefingData | null;
    isLoading: boolean;
}

export function DailyBriefingModal({ isOpen, onClose, data, isLoading }: DailyBriefingModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative"
                >
                    {/* Background Gradient */}
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />

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
                                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                                <p className="text-muted-foreground animate-pulse">오늘의 브리핑을 준비하고 있습니다...</p>
                            </div>
                        ) : data ? (
                            <div className="space-y-8">
                                {/* Header / Greeting */}
                                <div className="text-center space-y-2">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-2">
                                        <Sun className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                                        {data.greeting}
                                    </h2>
                                </div>

                                <div className="grid gap-6">
                                    {/* Yesterday's Review */}
                                    <Card className="bg-white/5 border-white/10">
                                        <CardContent className="p-4 flex gap-4">
                                            <div className="shrink-0 mt-1">
                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-white mb-1">어제의 성취</h3>
                                                <p className="text-sm text-gray-300 leading-relaxed">
                                                    {data.yesterdayReview}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Yesterday's Trends */}
                                    <Card className="bg-white/5 border-white/10">
                                        <CardContent className="p-4 flex gap-4">
                                            <div className="shrink-0 mt-1">
                                                <TrendingUp className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-white mb-2">놓치면 안 될 어제의 이슈</h3>
                                                <ul className="space-y-2">
                                                    {data.trendSummary.map((item, i) => (
                                                        <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Today's Focus */}
                                    <Card className="bg-white/5 border-white/10">
                                        <CardContent className="p-4 flex gap-4">
                                            <div className="shrink-0 mt-1">
                                                <Calendar className="w-5 h-5 text-purple-500" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-white mb-1">오늘의 포커스</h3>
                                                <p className="text-sm text-gray-300 leading-relaxed">
                                                    {data.todayFocus}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Closing & Action */}
                                <div className="text-center pt-4">
                                    <p className="text-muted-foreground mb-6 text-sm">
                                        "{data.closing}"
                                    </p>
                                    <Button
                                        onClick={onClose}
                                        className="w-full md:w-auto px-8 py-6 text-lg rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20 group"
                                    >
                                        하루 시작하기
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
