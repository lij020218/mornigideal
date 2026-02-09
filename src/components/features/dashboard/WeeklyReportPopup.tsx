"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, BookOpen, Calendar, Award, Target, ArrowUpRight, ArrowDownRight, Minus, Flame, Clock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { WeeklyReportStoryShare } from "./WeeklyReportStoryShare";

// Donut Chart Component
function DonutChart({
    percentage,
    size = 80,
    strokeWidth = 8,
    color = "rgb(59, 130, 246)",
}: {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
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
                    stroke="rgba(0,0,0,0.1)"
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
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold">{percentage.toFixed(0)}%</span>
            </div>
        </div>
    );
}

// Horizontal Progress Bar
function ProgressBar({
    label,
    value,
    maxValue,
    color,
    icon
}: {
    label: string;
    value: number;
    maxValue: number;
    color: string;
    icon?: string;
}) {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                    {icon && <span className="text-xs">{icon}</span>}
                    <span className="text-gray-700">{label}</span>
                </span>
                <span className="font-medium text-gray-900">{value}개</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </div>
        </div>
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
    narrative?: string;
}

interface WeeklyReportPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WeeklyReportPopup({ isOpen, onClose }: WeeklyReportPopupProps) {
    const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
    const [loading, setLoading] = useState(false);
    const [showStoryShare, setShowStoryShare] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchReport();
        }
    }, [isOpen]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/weekly-report');
            if (response.ok) {
                const data = await response.json();
                setReportData(data.report);
            }
        } catch (error) {
            console.error('Failed to fetch weekly report:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    };

    const getChangeIcon = (value: number) => {
        if (value > 0) return <ArrowUpRight className="w-4 h-4 text-green-500" />;
        if (value < 0) return <ArrowDownRight className="w-4 h-4 text-red-500" />;
        return <Minus className="w-4 h-4 text-gray-400" />;
    };

    const getChangeColor = (value: number) => {
        if (value > 0) return 'text-green-600';
        if (value < 0) return 'text-red-600';
        return 'text-gray-500';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50"
                        onClick={onClose}
                    />

                    {/* Popup */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90%] md:max-w-4xl md:max-h-[85vh] bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-2">
                                        <TrendingUp className="w-7 h-7" />
                                        주간 성장 리포트
                                    </h2>
                                    {reportData && (
                                        <p className="text-blue-100 text-sm mt-1">
                                            {formatDate(reportData.period.start)} - {formatDate(reportData.period.end)} (Week {reportData.period.weekNumber})
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {reportData && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowStoryShare(true)}
                                            className="text-white hover:bg-white/20 rounded-full"
                                        >
                                            <Share2 className="w-5 h-5" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={onClose}
                                        className="text-white hover:bg-white/20 rounded-full"
                                    >
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                                </div>
                            ) : reportData ? (
                                <>
                                    {/* AI Narrative */}
                                    {reportData.narrative && (
                                        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
                                            <div className="prose prose-sm max-w-none">
                                                <ReactMarkdown>{reportData.narrative}</ReactMarkdown>
                                            </div>
                                        </div>
                                    )}

                                    {/* Key Metrics Grid with Visual Charts */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Schedule Completion with Donut */}
                                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                                        <Calendar className="w-4 h-4 text-blue-600" />
                                                    </div>
                                                    <h3 className="font-semibold text-gray-900 text-sm">일정 완료율</h3>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {getChangeIcon(reportData.comparisonWithLastWeek.completionRateChange)}
                                                    <span className={`text-xs font-medium ${getChangeColor(reportData.comparisonWithLastWeek.completionRateChange)}`}>
                                                        {Math.abs(reportData.comparisonWithLastWeek.completionRateChange).toFixed(1)}%p
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-center mb-3">
                                                <DonutChart
                                                    percentage={reportData.scheduleAnalysis.completionRate}
                                                    size={80}
                                                    strokeWidth={8}
                                                    color="rgb(59, 130, 246)"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 text-center">
                                                {reportData.scheduleAnalysis.completedSchedules} / {reportData.scheduleAnalysis.totalSchedules} 완료
                                            </p>
                                        </div>

                                        {/* Reading with Streak */}
                                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                                        <BookOpen className="w-4 h-4 text-purple-600" />
                                                    </div>
                                                    <h3 className="font-semibold text-gray-900 text-sm">브리핑 읽기</h3>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {getChangeIcon(reportData.comparisonWithLastWeek.readingChange)}
                                                    <span className={`text-xs font-medium ${getChangeColor(reportData.comparisonWithLastWeek.readingChange)}`}>
                                                        {Math.abs(reportData.comparisonWithLastWeek.readingChange).toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-center gap-4 mb-2">
                                                <div className="text-center">
                                                    <span className="text-3xl font-bold text-gray-900">{reportData.trendBriefingAnalysis.totalRead}</span>
                                                    <p className="text-xs text-gray-500">읽음</p>
                                                </div>
                                                <div className="h-10 w-px bg-gray-200" />
                                                <div className="text-center">
                                                    <div className="flex items-center gap-1">
                                                        <Flame className="w-4 h-4 text-orange-500" />
                                                        <span className="text-xl font-bold text-orange-500">
                                                            {reportData.trendBriefingAnalysis.readingStreak}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500">연속</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Consistency with Donut */}
                                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                                    <Award className="w-4 h-4 text-green-600" />
                                                </div>
                                                <h3 className="font-semibold text-gray-900 text-sm">일관성 점수</h3>
                                            </div>
                                            <div className="flex justify-center mb-3">
                                                <DonutChart
                                                    percentage={reportData.growthMetrics.consistencyScore}
                                                    size={80}
                                                    strokeWidth={8}
                                                    color={
                                                        reportData.growthMetrics.consistencyScore >= 70 ? "rgb(34, 197, 94)" :
                                                        reportData.growthMetrics.consistencyScore >= 40 ? "rgb(234, 179, 8)" :
                                                        "rgb(239, 68, 68)"
                                                    }
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 text-center">
                                                {reportData.growthMetrics.consistencyScore >= 70 ? "훌륭해요!" :
                                                 reportData.growthMetrics.consistencyScore >= 40 ? "조금 더 힘내세요" : "화이팅!"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Category Breakdown with Visual Bars */}
                                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <Target className="w-5 h-5 text-blue-600" />
                                            활동 카테고리
                                        </h3>
                                        <div className="space-y-3">
                                            {Object.entries(reportData.scheduleAnalysis.categoryBreakdown).map(([category, count]) => {
                                                const labels: Record<string, string> = {
                                                    work: '업무',
                                                    learning: '학습',
                                                    exercise: '운동',
                                                    wellness: '웰빙',
                                                    other: '기타',
                                                };
                                                const icons: Record<string, string> = {
                                                    work: '💼',
                                                    learning: '📚',
                                                    exercise: '💪',
                                                    wellness: '🧘',
                                                    other: '🎯',
                                                };
                                                const colors: Record<string, string> = {
                                                    work: 'rgb(59, 130, 246)',
                                                    learning: 'rgb(168, 85, 247)',
                                                    exercise: 'rgb(239, 68, 68)',
                                                    wellness: 'rgb(34, 197, 94)',
                                                    other: 'rgb(107, 114, 128)',
                                                };

                                                return (
                                                    <ProgressBar
                                                        key={category}
                                                        label={labels[category]}
                                                        value={count}
                                                        maxValue={reportData.scheduleAnalysis.totalSchedules}
                                                        color={colors[category]}
                                                        icon={icons[category]}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Quick Stats Row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-blue-50 rounded-xl p-4 text-center">
                                            <Calendar className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                                            <p className="text-xl font-bold text-blue-900">{reportData.scheduleAnalysis.completedSchedules}</p>
                                            <p className="text-xs text-blue-600">완료 일정</p>
                                        </div>
                                        <div className="bg-purple-50 rounded-xl p-4 text-center">
                                            <BookOpen className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                                            <p className="text-xl font-bold text-purple-900">{reportData.trendBriefingAnalysis.totalRead}</p>
                                            <p className="text-xs text-purple-600">읽은 브리핑</p>
                                        </div>
                                        <div className="bg-green-50 rounded-xl p-4 text-center">
                                            <Award className="w-5 h-5 text-green-600 mx-auto mb-1" />
                                            <p className="text-xl font-bold text-green-900">{reportData.growthMetrics.newHabitsFormed}</p>
                                            <p className="text-xs text-green-600">새 습관</p>
                                        </div>
                                        <div className="bg-amber-50 rounded-xl p-4 text-center">
                                            <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                                            <p className="text-xl font-bold text-amber-900">{Math.round(reportData.growthMetrics.timeInvested / 60)}h</p>
                                            <p className="text-xs text-amber-600">투자 시간</p>
                                        </div>
                                    </div>

                                    {/* Insights */}
                                    {reportData.insights.achievements.length > 0 && (
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                                            <h3 className="font-semibold text-green-900 mb-3">✨ 이번 주 성취</h3>
                                            <ul className="space-y-2">
                                                {reportData.insights.achievements.map((achievement, index) => (
                                                    <li key={index} className="text-sm text-green-800">{achievement}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {reportData.insights.recommendations.length > 0 && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                                            <h3 className="font-semibold text-blue-900 mb-3">💡 다음 주 추천</h3>
                                            <ul className="space-y-2">
                                                {reportData.insights.recommendations.map((recommendation, index) => (
                                                    <li key={index} className="text-sm text-blue-800">{recommendation}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-20 text-gray-500">
                                    리포트를 불러올 수 없습니다.
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                            <Button
                                onClick={onClose}
                                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                            >
                                닫기
                            </Button>
                        </div>
                    </motion.div>

                    {/* Story Share Modal */}
                    <WeeklyReportStoryShare
                        isOpen={showStoryShare}
                        onClose={() => setShowStoryShare(false)}
                        reportData={reportData}
                    />
                </>
            )}
        </AnimatePresence>
    );
}
