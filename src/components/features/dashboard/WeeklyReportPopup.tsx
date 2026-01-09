"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, BookOpen, Calendar, Award, Target, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

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

                                    {/* Key Metrics Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Schedule Completion */}
                                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                    <Calendar className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <h3 className="font-semibold text-gray-900">일정 완료율</h3>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-3xl font-bold text-gray-900">
                                                        {reportData.scheduleAnalysis.completionRate.toFixed(0)}%
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {getChangeIcon(reportData.comparisonWithLastWeek.completionRateChange)}
                                                        <span className={`text-sm font-medium ${getChangeColor(reportData.comparisonWithLastWeek.completionRateChange)}`}>
                                                            {Math.abs(reportData.comparisonWithLastWeek.completionRateChange).toFixed(1)}%p
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-500">
                                                    {reportData.scheduleAnalysis.completedSchedules} / {reportData.scheduleAnalysis.totalSchedules} 일정 완료
                                                </p>
                                            </div>
                                        </div>

                                        {/* Reading */}
                                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                                    <BookOpen className="w-5 h-5 text-purple-600" />
                                                </div>
                                                <h3 className="font-semibold text-gray-900">브리핑 읽기</h3>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-3xl font-bold text-gray-900">
                                                        {reportData.trendBriefingAnalysis.totalRead}개
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {getChangeIcon(reportData.comparisonWithLastWeek.readingChange)}
                                                        <span className={`text-sm font-medium ${getChangeColor(reportData.comparisonWithLastWeek.readingChange)}`}>
                                                            {Math.abs(reportData.comparisonWithLastWeek.readingChange).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-500">
                                                    🔥 {reportData.trendBriefingAnalysis.readingStreak}일 연속 학습
                                                </p>
                                            </div>
                                        </div>

                                        {/* Consistency */}
                                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                                    <Award className="w-5 h-5 text-green-600" />
                                                </div>
                                                <h3 className="font-semibold text-gray-900">일관성 점수</h3>
                                            </div>
                                            <div className="space-y-2">
                                                <span className="text-3xl font-bold text-gray-900">
                                                    {reportData.growthMetrics.consistencyScore.toFixed(0)}
                                                </span>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all"
                                                        style={{ width: `${reportData.growthMetrics.consistencyScore}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Category Breakdown */}
                                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <Target className="w-5 h-5 text-blue-600" />
                                            활동 카테고리
                                        </h3>
                                        <div className="space-y-3">
                                            {Object.entries(reportData.scheduleAnalysis.categoryBreakdown).map(([category, count]) => {
                                                const labels: Record<string, string> = {
                                                    work: '💼 업무',
                                                    learning: '📚 학습',
                                                    exercise: '💪 운동',
                                                    wellness: '🧘 웰빙',
                                                    other: '🎯 기타',
                                                };
                                                const total = reportData.scheduleAnalysis.totalSchedules;
                                                const percentage = total > 0 ? (count / total) * 100 : 0;

                                                return (
                                                    <div key={category}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-medium text-gray-700">{labels[category]}</span>
                                                            <span className="text-sm text-gray-500">{count}개 ({percentage.toFixed(0)}%)</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                            <div
                                                                className="bg-blue-500 h-1.5 rounded-full transition-all"
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
                </>
            )}
        </AnimatePresence>
    );
}
