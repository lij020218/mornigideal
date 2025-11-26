"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Briefcase, AlertCircle, Lightbulb, Target, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Material {
    id: string;
    title: string;
    content: string;
    type: "exam" | "work";
    analysis: any;
}

interface AnalysisViewProps {
    material: Material;
}

export function AnalysisView({ material }: AnalysisViewProps) {
    const router = useRouter();
    const isExam = material.type === "exam";
    const analysis = material.analysis;

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <Button
                    onClick={() => router.push("/dashboard")}
                    variant="ghost"
                    className="mb-4 text-muted-foreground hover:text-white hover:bg-white/10"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    대시보드로 돌아가기
                </Button>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "p-2 rounded-lg",
                                isExam ? "bg-blue-500/10" : "bg-purple-500/10"
                            )}>
                                {isExam ? (
                                    <BookOpen className="w-6 h-6 text-blue-400" />
                                ) : (
                                    <Briefcase className="w-6 h-6 text-purple-400" />
                                )}
                            </div>
                            <h1 className="text-3xl font-bold text-white">{material.title}</h1>
                        </div>
                        <div className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                            isExam
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        )}>
                            {isExam ? "시험용" : "업무용"}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
                    {/* Left: Original Content */}
                    <Card className="glass-card border-none overflow-hidden flex flex-col h-full bg-black/20">
                        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                            <h2 className="font-semibold text-white">원본 자료</h2>
                        </div>
                        <CardContent className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="prose prose-invert prose-sm max-w-none">
                                <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans leading-relaxed">
                                    {material.content}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right: Analysis */}
                    <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 h-full">
                        {/* Summary Card */}
                        <Card className="glass-card border-none bg-black/20">
                            <CardContent className="p-6">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                                    상세 요약
                                </h2>
                                <p className="text-gray-300 leading-relaxed">{analysis.summary}</p>
                            </CardContent>
                        </Card>

                        {/* Key Points Card */}
                        <Card className="glass-card border-none bg-black/20">
                            <CardContent className="p-6">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                                    <Target className="w-5 h-5 text-green-500" />
                                    핵심 내용
                                </h2>
                                <ul className="space-y-3">
                                    {analysis.keyPoints?.map((point: string, idx: number) => (
                                        <li key={idx} className="flex items-start gap-3 group">
                                            <CheckCircle2 className="w-5 h-5 text-green-500/50 mt-0.5 flex-shrink-0 group-hover:text-green-500 transition-colors" />
                                            <span className="text-gray-300 group-hover:text-white transition-colors">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        {isExam ? (
                            <>
                                {/* Exam Points */}
                                <Card className="glass-card border-none bg-black/20">
                                    <CardContent className="p-6">
                                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                            시험 출제 포인트
                                        </h2>
                                        <div className="space-y-4">
                                            {analysis.examPoints?.map((item: any, idx: number) => (
                                                <div key={idx} className="border-l-2 border-red-500/30 pl-4 hover:border-red-500 transition-colors">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-bold border",
                                                            item.importance === "상" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                                item.importance === "중" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                                                                    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                                        )}>
                                                            {item.importance}
                                                        </span>
                                                        <span className="font-semibold text-white">{item.point}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-400 mb-1">{item.reason}</p>
                                                    <p className="text-xs text-gray-500 italic">{item.difficulty}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Difficult Concepts */}
                                <Card className="glass-card border-none bg-black/20">
                                    <CardContent className="p-6">
                                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                                            <Lightbulb className="w-5 h-5 text-blue-500" />
                                            어려운 개념 쉽게 이해하기
                                        </h2>
                                        <div className="space-y-4">
                                            {analysis.difficultConcepts?.map((item: any, idx: number) => (
                                                <div key={idx} className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4 hover:bg-blue-500/10 transition-colors">
                                                    <h3 className="font-semibold text-blue-400 mb-2">{item.concept}</h3>
                                                    <p className="text-sm text-gray-300">{item.explanation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Insights */}
                                <Card className="glass-card border-none bg-black/20">
                                    <CardContent className="p-6">
                                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                                            <Lightbulb className="w-5 h-5 text-purple-500" />
                                            인사이트
                                        </h2>
                                        <ul className="space-y-2">
                                            {analysis.insights?.map((insight: string, idx: number) => (
                                                <li key={idx} className="flex items-start gap-2">
                                                    <span className="text-purple-500 font-bold mt-1">•</span>
                                                    <span className="text-gray-300">{insight}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            <>
                                {/* Work Insights */}
                                <Card className="glass-card border-none bg-black/20">
                                    <CardContent className="p-6">
                                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                                            <Lightbulb className="w-5 h-5 text-purple-500" />
                                            핵심 인사이트
                                        </h2>
                                        <div className="space-y-4">
                                            {analysis.insights?.map((item: any, idx: number) => (
                                                <div key={idx} className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-4 hover:bg-purple-500/10 transition-colors">
                                                    <h3 className="font-semibold text-purple-400 mb-2">{item.insight}</h3>
                                                    <p className="text-sm text-gray-300 mb-1"><strong className="text-purple-300">중요한 이유:</strong> {item.why}</p>
                                                    <p className="text-sm text-gray-400"><strong className="text-purple-300/70">영향:</strong> {item.impact}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Important Points */}
                                <Card className="glass-card border-none bg-black/20">
                                    <CardContent className="p-6">
                                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                                            <Target className="w-5 h-5 text-orange-500" />
                                            중요 포인트
                                        </h2>
                                        <div className="space-y-4">
                                            {analysis.importantPoints?.map((item: any, idx: number) => (
                                                <div key={idx} className="border-l-2 border-orange-500/30 pl-4 hover:border-orange-500 transition-colors">
                                                    <h3 className="font-semibold text-white mb-1">{item.point}</h3>
                                                    <p className="text-sm text-gray-300 mb-1"><strong className="text-orange-400">이유:</strong> {item.reason}</p>
                                                    <p className="text-sm text-gray-400"><strong className="text-orange-400/70">활용:</strong> {item.application}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Action Items */}
                                <Card className="glass-card border-none bg-black/20">
                                    <CardContent className="p-6">
                                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            실행 가능한 조언
                                        </h2>
                                        <ul className="space-y-3">
                                            {analysis.actionItems?.map((action: string, idx: number) => (
                                                <li key={idx} className="flex items-start gap-3 group">
                                                    <CheckCircle2 className="w-5 h-5 text-green-500/50 mt-0.5 flex-shrink-0 group-hover:text-green-500 transition-colors" />
                                                    <span className="text-gray-300 group-hover:text-white transition-colors">{action}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
