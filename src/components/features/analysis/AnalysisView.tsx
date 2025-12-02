"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, BookOpen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Brain, Loader2, Pen } from "lucide-react";
import { PDFViewer } from "./PDFViewer";
import { AccordionContent } from "./AccordionContent";
import { QuizView } from "./QuizView";
import { QuizResult } from "./QuizResult";
import { DrawingCanvas } from "./DrawingCanvas";
import 'katex/dist/katex.min.css';

interface PageAnalysis {
    page: number;
    title: string;
    content: string;
    keyPoints?: string[];
}

interface Material {
    id: string;
    title: string;
    content: string;
    type: "exam" | "work";
    file_url?: string | null;
    analysis: {
        page_analyses?: PageAnalysis[];
    };
    created_at: string;
}

interface AnalysisViewProps {
    material: Material;
    onPageChange?: (page: number) => void;
}

export function AnalysisView({ material: initialMaterial, onPageChange }: AnalysisViewProps) {
    const [material, setMaterial] = useState<Material>(initialMaterial);
    const [activeTab, setActiveTab] = useState<'summary' | 'quiz'>('summary');
    const [quiz, setQuiz] = useState<any>(null);
    const [quizResult, setQuizResult] = useState<any>(null);
    const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
    const [isGradingQuiz, setIsGradingQuiz] = useState(false);
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [isDrawingModeRight, setIsDrawingModeRight] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);

    const pageAnalyses = material.analysis?.page_analyses || [];
    const totalSlides = pageAnalyses.length;

    // Sync with parent when slide changes
    useEffect(() => {
        if (onPageChange) {
            onPageChange(currentSlide + 1);
        }
    }, [currentSlide, onPageChange]);

    // Poll for updates while analysis is incomplete
    useEffect(() => {
        const checkForUpdates = async () => {
            try {
                const response = await fetch(`/api/materials/${material.id}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.material) {
                        const newPageCount = data.material.analysis?.page_analyses?.length || 0;
                        const oldPageCount = material.analysis?.page_analyses?.length || 0;

                        if (newPageCount > oldPageCount) {
                            console.log(`[POLLING] New pages detected: ${oldPageCount} -> ${newPageCount}`);
                            setMaterial(data.material);
                        }
                    }
                }
            } catch (error) {
                console.error("[POLLING] Error:", error);
            }
        };

        // Poll every 2 seconds while analysis is running
        // Keep polling until we get a stable page count (no new pages for 2 checks)
        let lastPageCount = pageAnalyses.length;
        let stableCount = 0;

        const interval = setInterval(async () => {
            await checkForUpdates();
            const currentCount = pageAnalyses.length;

            if (currentCount === lastPageCount) {
                stableCount++;
                // Stop polling after 2 consecutive checks with same count (4 seconds of stability)
                if (stableCount >= 2) {
                    clearInterval(interval);
                    console.log("[POLLING] Analysis complete, stopping poll");
                }
            } else {
                stableCount = 0;
                lastPageCount = currentCount;
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [material.id, pageAnalyses.length]);

    // Auto-generate quiz in background when analysis is complete
    useEffect(() => {
        const autoGenerateQuiz = async () => {
            // Only generate if:
            // 1. We have slides (analysis complete)
            // 2. Quiz hasn't been generated yet
            // 3. Not currently loading
            if (pageAnalyses.length > 0 && !quiz && !isLoadingQuiz) {
                console.log('[QUIZ] Auto-generating quiz in background...');
                await loadQuiz();
            }
        };

        // Wait a bit after analysis completes to avoid race condition
        const timer = setTimeout(autoGenerateQuiz, 3000);
        return () => clearTimeout(timer);
    }, [pageAnalyses.length]); // Only trigger when slide count changes


    const loadQuiz = async () => {
        if (quiz) return; // Already loaded

        setIsLoadingQuiz(true);
        try {
            const response = await fetch('/api/generate-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageAnalyses,
                    type: material.type
                })
            });

            const data = await response.json();
            if (data.success) {
                setQuiz(data.quiz);
            } else {
                throw new Error(data.error || 'Failed to generate quiz');
            }
        } catch (error: any) {
            console.error('Quiz generation error:', error);
            // alert('퀴즈 생성에 실패했습니다: ' + error.message);
        } finally {
            setIsLoadingQuiz(false);
        }
    };

    const handleQuizSubmit = async (answers: any) => {
        setIsGradingQuiz(true);
        try {
            const response = await fetch('/api/grade-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quiz,
                    answers,
                    type: material.type
                })
            });

            const data = await response.json();
            if (data.success) {
                setQuizResult(data.result);
            } else {
                throw new Error(data.error || 'Failed to grade quiz');
            }
        } catch (error: any) {
            console.error('Quiz grading error:', error);
            alert('채점에 실패했습니다: ' + error.message);
        } finally {
            setIsGradingQuiz(false);
        }
    };

    const handleTabChange = (tab: 'summary' | 'quiz') => {
        setActiveTab(tab);
        // No need to manually load quiz - it's auto-generated in background
        // User will see loading state if quiz is still being generated
    };

    const handlePrevSlide = () => {
        setCurrentSlide(prev => Math.max(0, prev - 1));
    };

    const handleNextSlide = () => {
        setCurrentSlide(prev => Math.min(totalSlides - 1, prev + 1));
    };

    console.log("AnalysisView render:", {
        has_file_url: !!material.file_url,
        file_url: material.file_url,
        title: material.title,
        totalSlides,
        currentSlide
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full animate-fade-in">
            {/* Left: Original PDF */}
            <div className="glass-card rounded-2xl h-full overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <FileText className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-semibold text-sm">원본 자료</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => setIsDrawingMode(!isDrawingMode)}
                                size="sm"
                                variant={isDrawingMode ? "default" : "ghost"}
                                className="text-xs"
                            >
                                <Pen className="w-3 h-3 mr-1" />
                                {isDrawingMode ? "필기 중" : "필기"}
                            </Button>
                            <Badge variant={material.type === "exam" ? "default" : "secondary"} className="bg-white/10 hover:bg-white/20 text-white border-none">
                                {material.type === "exam" ? "시험 자료" : "업무 자료"}
                            </Badge>
                        </div>
                    </div>

                    {material.file_url && !isDrawingMode && (
                        <div id="pdf-controls-container" />
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    {material.file_url ? (
                        <>
                            {/* PDF Viewer (always visible as background) */}
                            <div className={isDrawingMode ? "pointer-events-none" : ""}>
                                <PDFViewer
                                    fileUrl={material.file_url}
                                    onPageChange={() => { }}
                                    renderControls={({ pageNumber, numPages, scale, zoomIn, zoomOut }) => (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-xs font-medium text-gray-300 tabular-nums">
                                                페이지 {pageNumber} / {numPages}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={zoomOut}
                                                    size="icon"
                                                    variant="ghost"
                                                    className="w-7 h-7 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                    disabled={scale <= 0.5}
                                                >
                                                    <ZoomOut className="w-3.5 h-3.5" />
                                                </Button>
                                                <span className="text-xs font-medium text-gray-300 w-12 text-center tabular-nums">
                                                    {Math.round(scale * 100)}%
                                                </span>
                                                <Button
                                                    onClick={zoomIn}
                                                    size="icon"
                                                    variant="ghost"
                                                    className="w-7 h-7 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                    disabled={scale >= 2.0}
                                                >
                                                    <ZoomIn className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                />
                            </div>

                            {/* Drawing Canvas Overlay - always visible, but interactive only in drawing mode */}
                            <div className={`absolute inset-0 z-10 p-4 ${isDrawingMode ? 'bg-black/5' : 'pointer-events-none'}`}>
                                <DrawingCanvas
                                    width={800}
                                    height={1000}
                                    storageKey={`drawing-left-${material.id}`}
                                    readOnly={!isDrawingMode}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="p-6 relative">
                            {/* Text Content */}
                            <div className={`whitespace-pre-wrap text-sm leading-relaxed text-gray-300 ${isDrawingMode ? 'pointer-events-none' : ''}`}>
                                {material.content}
                            </div>

                            {/* Drawing Canvas Overlay for Text - always visible */}
                            <div className={`absolute inset-0 z-10 p-6 ${isDrawingMode ? 'bg-black/5' : 'pointer-events-none'}`}>
                                <DrawingCanvas
                                    width={800}
                                    height={1000}
                                    storageKey={`drawing-left-text-${material.id}`}
                                    readOnly={!isDrawingMode}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: AI Summary / Quiz */}
            <div className="glass-card rounded-2xl h-full overflow-hidden flex flex-col">
                {/* Header with Tabs */}
                <div className="p-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <BookOpen className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">AI 분석</h3>
                                <p className="text-[10px] text-muted-foreground">학습 자료 분석 완료</p>
                            </div>
                        </div>

                        {/* Tab Buttons and Drawing Toggle */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1">
                                <Button
                                    onClick={() => handleTabChange('summary')}
                                    size="sm"
                                    variant={activeTab === 'summary' ? 'default' : 'ghost'}
                                    className={`text-xs ${activeTab === 'summary' ? '' : 'text-gray-400 hover:text-white'}`}
                                >
                                    <BookOpen className="w-3 h-3 mr-1" />
                                    AI 요약
                                </Button>
                                <Button
                                    onClick={() => handleTabChange('quiz')}
                                    size="sm"
                                    variant={activeTab === 'quiz' ? 'default' : 'ghost'}
                                    className={`text-xs ${activeTab === 'quiz' ? '' : 'text-gray-400 hover:text-white'}`}
                                >
                                    <Brain className="w-3 h-3 mr-1" />
                                    퀴즈
                                </Button>
                            </div>
                            <Button
                                onClick={() => setIsDrawingModeRight(!isDrawingModeRight)}
                                size="sm"
                                variant={isDrawingModeRight ? "default" : "ghost"}
                                className="text-xs"
                            >
                                <Pen className="w-3 h-3 mr-1" />
                                {isDrawingModeRight ? "필기 중" : "필기"}
                            </Button>
                        </div>
                    </div>

                    {/* Show slide count for Summary Tab */}
                    {activeTab === 'summary' && (
                        <div className="flex items-center justify-center bg-black/20 rounded-full p-2">
                            <span className="text-xs font-medium text-center tabular-nums">
                                총 {totalSlides}개 슬라이드
                            </span>
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className={`flex-1 ${isDrawingModeRight ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} p-6 relative`}>
                    <div className={isDrawingModeRight ? "pointer-events-none" : ""}>
                        {activeTab === 'summary' ? (
                            /* Summary Content - Slider View */
                            pageAnalyses.length > 0 ? (
                                <div className="h-full flex flex-col">
                                    {/* Navigation Controls - Moved to Top */}
                                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handlePrevSlide}
                                            disabled={currentSlide === 0}
                                            className="text-gray-400 hover:text-white"
                                        >
                                            <ChevronLeft className="w-4 h-4 mr-1" />
                                            이전
                                        </Button>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {currentSlide + 1} / {totalSlides}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleNextSlide}
                                            disabled={currentSlide === totalSlides - 1}
                                            className="text-gray-400 hover:text-white"
                                        >
                                            다음
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>

                                    <div className="flex-1">
                                        {/* Current Slide Content */}
                                        <div className="space-y-6 animate-fade-in" key={currentSlide}>
                                            <div className="relative">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                                                <div className="pl-6">
                                                    <div className="flex items-baseline gap-3 mb-6">
                                                        <h3 className="text-xl font-bold text-gradient flex-1">{pageAnalyses[currentSlide].title}</h3>
                                                    </div>
                                                    <AccordionContent content={pageAnalyses[currentSlide].content} />
                                                </div>
                                            </div>

                                            {pageAnalyses[currentSlide].keyPoints && pageAnalyses[currentSlide].keyPoints!.length > 0 && (
                                                <div className="pt-6 border-t border-white/10">
                                                    <h4 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                                        {material.type === "exam" ? (
                                                            <>
                                                                <BookOpen className="w-5 h-5 text-blue-400" />
                                                                <span className="text-blue-100">시험 포인트</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <FileText className="w-5 h-5 text-purple-400" />
                                                                <span className="text-purple-100">핵심 인사이트</span>
                                                            </>
                                                        )}
                                                    </h4>
                                                    <ul className="space-y-3">
                                                        {pageAnalyses[currentSlide].keyPoints!.map((point, idx) => (
                                                            <li key={idx} className="flex gap-3 group">
                                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary/30 transition-colors shrink-0 mt-0.5">
                                                                    {idx + 1}
                                                                </span>
                                                                <span className="text-sm leading-relaxed text-gray-300 group-hover:text-white transition-colors">{point}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                        <FileText className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p>분석 결과가 아직 생성되지 않았습니다.</p>
                                </div>
                            )
                        ) : (
                            /* Quiz Content */
                            isLoadingQuiz ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">퀴즈 생성 중...</p>
                                    <p className="text-xs text-muted-foreground">15문제를 만들고 있습니다</p>
                                </div>
                            ) : isGradingQuiz ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">채점 중...</p>
                                    <p className="text-xs text-muted-foreground">AI가 답변을 분석하고 있습니다</p>
                                </div>
                            ) : quizResult ? (
                                <QuizResult result={quizResult} />
                            ) : quiz ? (
                                <QuizView quiz={quiz} onSubmit={handleQuizSubmit} />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <Brain className="w-16 h-16 text-primary opacity-50" />
                                    <p className="text-sm text-muted-foreground">퀴즈를 불러오는 중 오류가 발생했습니다</p>
                                </div>
                            )
                        )}
                    </div>

                    {/* Drawing Canvas Overlay for Right Panel - only visible on summary tab */}
                    {activeTab === 'summary' && (
                        <div className={`absolute inset-0 z-10 p-6 ${isDrawingModeRight ? 'bg-black/5' : 'pointer-events-none'}`}>
                            <DrawingCanvas
                                width={800}
                                height={1000}
                                storageKey={`drawing-right-${material.id}-page-${currentSlide}`}
                                readOnly={!isDrawingModeRight}
                            />
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
