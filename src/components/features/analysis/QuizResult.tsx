"use client";

import { Trophy, TrendingUp, TrendingDown, BookOpen, Lightbulb } from "lucide-react";

interface QuizResultData {
    score: number;
    totalScore: number;
    percentage: number;
    strengths: string[];
    weaknesses: Array<{
        concept: string;
        pages: number[];
    }>;
    advice: string;
    breakdown: {
        trueFalse: { correct: number; total: number };
        multipleChoice: { correct: number; total: number };
        essay: { score: number; total: number };
    };
}

interface QuizResultProps {
    result: QuizResultData;
}

export function QuizResult({ result }: QuizResultProps) {
    const getScoreColor = () => {
        if (result.percentage >= 90) return 'text-emerald-400';
        if (result.percentage >= 70) return 'text-blue-400';
        if (result.percentage >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getScoreGrade = () => {
        if (result.percentage >= 90) return 'A';
        if (result.percentage >= 80) return 'B';
        if (result.percentage >= 70) return 'C';
        if (result.percentage >= 60) return 'D';
        return 'F';
    };

    return (
        <div className="space-y-6 animate-slide-up">
            {/* Score Card */}
            <div className="relative rounded-2xl p-8 bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-cyan-500/20 border border-white/20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 blur-xl opacity-50 pointer-events-none" />

                <div className="relative flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Trophy className="w-8 h-8 text-yellow-400" />
                            <h2 className="text-2xl font-bold text-white">퀴즈 결과</h2>
                        </div>
                        <p className="text-sm text-gray-300">총 15문제 중 {result.score}문제 정답</p>
                    </div>
                    <div className="text-right">
                        <div className={`text-5xl font-bold ${getScoreColor()}`}>
                            {result.percentage.toFixed(0)}%
                        </div>
                        <div className="text-2xl font-bold text-white mt-1">
                            {getScoreGrade()} 등급
                        </div>
                    </div>
                </div>

                {/* Breakdown */}
                <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm">
                        <p className="text-xs text-muted-foreground mb-1">참/거짓</p>
                        <p className="text-lg font-bold text-white">
                            {result.breakdown.trueFalse.correct}/{result.breakdown.trueFalse.total}
                        </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm">
                        <p className="text-xs text-muted-foreground mb-1">객관식</p>
                        <p className="text-lg font-bold text-white">
                            {result.breakdown.multipleChoice.correct}/{result.breakdown.multipleChoice.total}
                        </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm">
                        <p className="text-xs text-muted-foreground mb-1">주관식</p>
                        <p className="text-lg font-bold text-white">
                            {result.breakdown.essay.score.toFixed(0)}/{result.breakdown.essay.total}
                        </p>
                    </div>
                </div>
            </div>

            {/* Strengths */}
            {result.strengths.length > 0 && (
                <div className="border border-green-500/30 rounded-xl p-6 bg-green-500/5">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        <h3 className="text-lg font-bold text-green-100">강점</h3>
                    </div>
                    <ul className="space-y-2">
                        {result.strengths.map((strength, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-green-200">
                                <span className="text-green-400 mt-0.5">✓</span>
                                <span>{strength}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Weaknesses */}
            {result.weaknesses.length > 0 && (
                <div className="border border-orange-500/30 rounded-xl p-6 bg-orange-500/5">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingDown className="w-5 h-5 text-orange-400" />
                        <h3 className="text-lg font-bold text-orange-100">보완이 필요한 부분</h3>
                    </div>
                    <div className="space-y-4">
                        {result.weaknesses.map((weakness, idx) => (
                            <div key={idx} className="bg-white/5 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <p className="text-sm font-semibold text-orange-200">{weakness.concept}</p>
                                    <div className="flex items-center gap-1">
                                        <BookOpen className="w-4 h-4 text-orange-400" />
                                        <span className="text-xs text-orange-300">
                                            슬라이드 {weakness.pages.join(', ')}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    원본 자료의 해당 슬라이드를 다시 확인해보세요.
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* AI Advice */}
            <div className="border border-blue-500/30 rounded-xl p-6 bg-blue-500/5">
                <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-bold text-blue-100">학습 조언</h3>
                </div>
                <p className="text-sm text-blue-200 leading-relaxed whitespace-pre-line">
                    {result.advice}
                </p>
            </div>

            {/* Motivational Message */}
            <div className="text-center p-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-white/10">
                <p className="text-sm text-gray-300">
                    {result.percentage >= 80
                        ? "훌륭합니다! 핵심 개념을 잘 이해하고 계시네요. 계속해서 학습을 이어가세요."
                        : result.percentage >= 60
                            ? "잘하고 계십니다! 약점 부분을 보완하면 더 나은 결과를 얻을 수 있습니다."
                            : "포기하지 마세요! 약점 부분을 집중적으로 복습하면 실력이 크게 향상될 것입니다."}
                </p>
            </div>
        </div>
    );
}
