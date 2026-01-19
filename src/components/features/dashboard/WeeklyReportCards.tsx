"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Calendar, BookOpen, Award, Flame, Target, Sparkles, TrendingUp, Clock, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Fieri Logo
const FieriLogo = ({ className = "" }: { className?: string }) => (
    <svg viewBox="0 0 1024 1024" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="currentColor" d="M523.997498,653.945618 C528.388672,653.329346 532.779907,652.713013 537.750366,652.292419 C538.881531,652.271362 539.433472,652.054688 539.985413,651.838013 C540.406616,651.830505 540.827881,651.822998 541.912720,651.852661 C543.446411,651.342712 544.316467,650.795532 545.186462,650.248352 C555.374451,647.371582 565.861145,645.266846 575.690491,641.463196 C598.774475,632.530640 619.020569,618.929077 636.281677,601.162415 C648.263733,588.829346 658.432495,575.090271 666.007874,559.551270 C666.420288,558.705261 667.026672,557.953796 668.502197,557.285217 C668.502197,558.540161 668.714478,559.838135 668.470459,561.043701 C664.507629,580.623047 655.469055,597.935059 644.178284,614.125916 C618.600952,650.803650 584.596863,675.800232 541.063782,687.013367 C530.524475,689.728088 519.630188,691.064148 508.304321,692.805786 C507.138153,692.738220 506.566772,692.898987 505.995392,693.059753 C503.589661,693.317444 501.183929,693.575195 498.070679,693.587646 C491.912994,693.518860 486.462799,693.695251 481.012604,693.871704 C450.400208,692.652466 421.512512,684.577026 393.602448,672.289368 C359.801880,657.408508 331.161499,635.421631 306.879181,608.004089 C275.857605,572.977051 255.236130,532.357483 246.175018,486.287781 C243.917679,474.810760 243.133118,463.011169 242.221878,451.316925 C241.799973,445.902740 242.698868,440.385651 243.219055,434.309875 C243.292816,433.136383 243.146515,432.568176 243.000214,432.000000 C244.336960,426.729156 245.193604,421.269562 247.167740,416.249359 C248.652237,412.474243 251.968246,409.992279 256.573853,409.997620 C261.197296,410.002991 264.348541,412.579010 265.951782,416.322235 C268.358826,421.942230 270.401337,427.810394 271.782166,433.762543 C279.275421,466.062256 288.269745,497.875641 303.789429,527.361938 C317.585419,553.573425 334.553253,577.690186 356.950867,597.272278 C388.988617,625.282654 425.814819,643.978088 468.102478,651.100525 C474.099121,652.110535 480.107941,653.047974 486.791321,654.271362 C488.983215,654.385864 490.494934,654.248047 492.006622,654.110229 C501.718628,654.098572 511.430634,654.086914 521.731323,654.277344 C522.879150,654.301453 523.438354,654.123535 523.997498,653.945618z"/>
    </svg>
);

// Large Donut Chart for cards
function LargeDonutChart({
    percentage,
    size = 180,
    strokeWidth = 16,
    color = "rgb(59, 130, 246)",
    bgColor = "rgba(255,255,255,0.2)"
}: {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    bgColor?: string;
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={bgColor}
                    strokeWidth={strokeWidth}
                />
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                    className="text-5xl font-bold"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                >
                    {percentage.toFixed(0)}%
                </motion.span>
            </div>
        </div>
    );
}

// Horizontal Bar for category
function CategoryBar({
    label,
    icon,
    value,
    maxValue,
    color,
    delay = 0
}: {
    label: string;
    icon: string;
    value: number;
    maxValue: number;
    color: string;
    delay?: number;
}) {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-2xl w-10">{icon}</span>
            <div className="flex-1">
                <div className="h-8 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full rounded-full flex items-center justify-end pr-3"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(percentage, 15)}%` }}
                        transition={{ duration: 0.8, delay, ease: "easeOut" }}
                    >
                        <span className="text-white font-bold text-sm">{value}</span>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

// Stat Circle
function StatCircle({
    value,
    label,
    icon: Icon,
    color,
    delay = 0
}: {
    value: string | number;
    label: string;
    icon: React.ElementType;
    color: string;
    delay?: number;
}) {
    return (
        <motion.div
            className="flex flex-col items-center"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay, type: "spring", stiffness: 200 }}
        >
            <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mb-2", color)}>
                <Icon className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl font-bold">{value}</span>
            <span className="text-sm opacity-80">{label}</span>
        </motion.div>
    );
}

interface WeeklyReportData {
    period: {
        start: string;
        end: string;
        weekNumber: number;
    };
    scheduleAnalysis: {
        totalSchedules: number;
        completedSchedules: number;
        completionRate: number;
        categoryBreakdown: {
            work: number;
            learning: number;
            exercise: number;
            wellness: number;
            other: number;
        };
        mostProductiveDay: string;
        avgSchedulesPerDay: number;
    };
    trendBriefingAnalysis: {
        totalRead: number;
        avgReadPerDay: number;
        topCategories: Array<{ category: string; count: number }>;
        readingStreak: number;
    };
    growthMetrics: {
        newHabitsFormed: number;
        consistencyScore: number;
        focusAreas: string[];
        timeInvested: number;
    };
    insights: {
        achievements: string[];
        improvements: string[];
        recommendations: string[];
    };
    comparisonWithLastWeek: {
        scheduleChange: number;
        completionRateChange: number;
        readingChange: number;
    };
}

interface WeeklyReportCardsProps {
    isOpen: boolean;
    onClose: () => void;
    reportData: WeeklyReportData | null;
}

export function WeeklyReportCards({ isOpen, onClose, reportData }: WeeklyReportCardsProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    if (!reportData) return null;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    };

    const totalSlides = 6;

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 50;
        if (info.offset.x < -threshold && currentSlide < totalSlides - 1) {
            setCurrentSlide(prev => prev + 1);
        } else if (info.offset.x > threshold && currentSlide > 0) {
            setCurrentSlide(prev => prev - 1);
        }
    };

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    const slides = [
        // Slide 1: Title Card
        <div key="title" className="h-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
            >
                <FieriLogo className="w-24 h-24 mb-6" />
            </motion.div>
            <motion.h1
                className="text-4xl font-bold mb-2 text-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                주간 리포트
            </motion.h1>
            <motion.p
                className="text-xl opacity-90 mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                Week {reportData.period.weekNumber}
            </motion.p>
            <motion.div
                className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-3"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
                <p className="text-lg font-medium">
                    {formatDate(reportData.period.start)} ~ {formatDate(reportData.period.end)}
                </p>
            </motion.div>
        </div>,

        // Slide 2: Completion Rate
        <div key="completion" className="h-full bg-gradient-to-br from-blue-500 to-cyan-400 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                className="mb-4"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <Calendar className="w-12 h-12" />
            </motion.div>
            <motion.h2
                className="text-2xl font-bold mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                일정 완료율
            </motion.h2>
            <LargeDonutChart
                percentage={reportData.scheduleAnalysis.completionRate}
                color="white"
                bgColor="rgba(255,255,255,0.3)"
            />
            <motion.div
                className="mt-8 flex gap-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
            >
                <div className="text-center">
                    <p className="text-4xl font-bold">{reportData.scheduleAnalysis.completedSchedules}</p>
                    <p className="text-sm opacity-80">완료</p>
                </div>
                <div className="w-px bg-white/30" />
                <div className="text-center">
                    <p className="text-4xl font-bold">{reportData.scheduleAnalysis.totalSchedules}</p>
                    <p className="text-sm opacity-80">전체</p>
                </div>
            </motion.div>
        </div>,

        // Slide 3: Reading & Streak
        <div key="reading" className="h-full bg-gradient-to-br from-purple-500 to-pink-500 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                className="mb-4"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <BookOpen className="w-12 h-12" />
            </motion.div>
            <motion.h2
                className="text-2xl font-bold mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                브리핑 읽기
            </motion.h2>
            <motion.div
                className="text-center mb-8"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
            >
                <p className="text-8xl font-bold">{reportData.trendBriefingAnalysis.totalRead}</p>
                <p className="text-xl opacity-80">읽은 브리핑</p>
            </motion.div>
            <motion.div
                className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
                <Flame className="w-10 h-10 text-orange-300" />
                <div>
                    <p className="text-3xl font-bold">{reportData.trendBriefingAnalysis.readingStreak}일</p>
                    <p className="text-sm opacity-80">연속 학습</p>
                </div>
            </motion.div>
        </div>,

        // Slide 4: Category Breakdown
        <div key="category" className="h-full bg-gradient-to-br from-emerald-500 to-teal-400 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                className="mb-4"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <Target className="w-12 h-12" />
            </motion.div>
            <motion.h2
                className="text-2xl font-bold mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                활동 분석
            </motion.h2>
            <div className="w-full max-w-xs space-y-4">
                <CategoryBar label="업무" icon="💼" value={reportData.scheduleAnalysis.categoryBreakdown.work} maxValue={reportData.scheduleAnalysis.totalSchedules} color="rgba(59, 130, 246, 0.9)" delay={0.2} />
                <CategoryBar label="학습" icon="📚" value={reportData.scheduleAnalysis.categoryBreakdown.learning} maxValue={reportData.scheduleAnalysis.totalSchedules} color="rgba(168, 85, 247, 0.9)" delay={0.3} />
                <CategoryBar label="운동" icon="💪" value={reportData.scheduleAnalysis.categoryBreakdown.exercise} maxValue={reportData.scheduleAnalysis.totalSchedules} color="rgba(239, 68, 68, 0.9)" delay={0.4} />
                <CategoryBar label="웰빙" icon="🧘" value={reportData.scheduleAnalysis.categoryBreakdown.wellness} maxValue={reportData.scheduleAnalysis.totalSchedules} color="rgba(34, 197, 94, 0.9)" delay={0.5} />
                <CategoryBar label="기타" icon="🎯" value={reportData.scheduleAnalysis.categoryBreakdown.other} maxValue={reportData.scheduleAnalysis.totalSchedules} color="rgba(107, 114, 128, 0.9)" delay={0.6} />
            </div>
        </div>,

        // Slide 5: Stats Overview
        <div key="stats" className="h-full bg-gradient-to-br from-amber-500 to-orange-500 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                className="mb-4"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <TrendingUp className="w-12 h-12" />
            </motion.div>
            <motion.h2
                className="text-2xl font-bold mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                이번 주 요약
            </motion.h2>
            <div className="grid grid-cols-2 gap-8">
                <StatCircle value={reportData.scheduleAnalysis.completedSchedules} label="완료 일정" icon={Calendar} color="bg-blue-500" delay={0.2} />
                <StatCircle value={reportData.trendBriefingAnalysis.totalRead} label="읽은 브리핑" icon={BookOpen} color="bg-purple-500" delay={0.3} />
                <StatCircle value={reportData.growthMetrics.newHabitsFormed} label="새 습관" icon={Award} color="bg-green-500" delay={0.4} />
                <StatCircle value={`${Math.round(reportData.growthMetrics.timeInvested / 60)}h`} label="투자 시간" icon={Clock} color="bg-pink-500" delay={0.5} />
            </div>
        </div>,

        // Slide 6: Consistency & End
        <div key="end" className="h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                className="mb-4"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <Award className="w-12 h-12" />
            </motion.div>
            <motion.h2
                className="text-2xl font-bold mb-6"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                일관성 점수
            </motion.h2>
            <LargeDonutChart
                percentage={reportData.growthMetrics.consistencyScore}
                size={160}
                color={
                    reportData.growthMetrics.consistencyScore >= 70 ? "rgb(34, 197, 94)" :
                    reportData.growthMetrics.consistencyScore >= 40 ? "rgb(234, 179, 8)" :
                    "rgb(239, 68, 68)"
                }
                bgColor="rgba(255,255,255,0.2)"
            />
            <motion.p
                className="text-lg mt-6 text-center max-w-xs opacity-90"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
            >
                {reportData.growthMetrics.consistencyScore >= 70
                    ? "🎉 훌륭해요! 꾸준히 성장하고 있어요"
                    : reportData.growthMetrics.consistencyScore >= 40
                    ? "💪 조금만 더 힘내세요!"
                    : "🌱 규칙적인 습관을 만들어봐요"}
            </motion.p>
            <motion.div
                className="mt-8"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7, type: "spring" }}
            >
                <FieriLogo className="w-16 h-16 opacity-50" />
            </motion.div>
        </div>
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50"
                        onClick={onClose}
                    />

                    {/* Card Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[380px] sm:h-[680px] z-50 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="absolute -top-12 right-0 sm:-top-2 sm:-right-12 text-white hover:bg-white/20 z-10"
                        >
                            <X className="w-6 h-6" />
                        </Button>

                        {/* Slides Container */}
                        <div
                            ref={containerRef}
                            className="flex-1 relative overflow-hidden rounded-3xl shadow-2xl"
                        >
                            <motion.div
                                drag="x"
                                dragConstraints={{ left: 0, right: 0 }}
                                dragElastic={0.2}
                                onDragEnd={handleDragEnd}
                                className="absolute inset-0"
                            >
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentSlide}
                                        initial={{ opacity: 0, x: 100 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -100 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        className="absolute inset-0"
                                    >
                                        {slides[currentSlide]}
                                    </motion.div>
                                </AnimatePresence>
                            </motion.div>

                            {/* Navigation Arrows */}
                            {currentSlide > 0 && (
                                <button
                                    onClick={() => setCurrentSlide(prev => prev - 1)}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors"
                                >
                                    <ChevronLeft className="w-6 h-6 text-white" />
                                </button>
                            )}
                            {currentSlide < totalSlides - 1 && (
                                <button
                                    onClick={() => setCurrentSlide(prev => prev + 1)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors"
                                >
                                    <ChevronRight className="w-6 h-6 text-white" />
                                </button>
                            )}
                        </div>

                        {/* Dots Indicator */}
                        <div className="flex justify-center gap-2 mt-4">
                            {slides.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => goToSlide(index)}
                                    className={cn(
                                        "w-2 h-2 rounded-full transition-all",
                                        index === currentSlide
                                            ? "bg-white w-6"
                                            : "bg-white/40 hover:bg-white/60"
                                    )}
                                />
                            ))}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
