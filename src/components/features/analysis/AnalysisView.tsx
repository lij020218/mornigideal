"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, BookOpen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Brain, Loader2, Pen, ThumbsUp, ThumbsDown, Eye, Layers } from "lucide-react";
import { PDFViewer } from "./PDFViewer";
import { AccordionContent } from "./AccordionContent";
import { QuizView } from "./QuizView";
import { QuizResult } from "./QuizResult";
import { DrawingCanvas } from "./DrawingCanvas";
import 'katex/dist/katex.min.css';
import { toast } from "sonner";

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
        content?: string;
        concepts_content?: string;
        quiz?: any; // Added quiz to material analysis
    };
    created_at: string;
}

interface AnalysisViewProps {
    material: Material;
    onPageChange?: (page: number) => void;
}

// Helper to clean slide title
function cleanSlideTitle(title: string): string {
    // Remove HTML tags like <mark>, <strong>, etc.
    let cleaned = title.replace(/<[^>]+>/g, '');

    // Remove "Lecture N:", "Chapter N:", "Section N:" patterns
    cleaned = cleaned.replace(/^(Lecture|Chapter|Section|Part|Module)\s+\d+\s*:\s*/i, '');

    // Remove leading numbers like "1.", "2.1", etc.
    cleaned = cleaned.replace(/^\d+\.?\d*\s+/, '');

    // Remove emojis at the start
    cleaned = cleaned.replace(/^[\p{Emoji}]\s+/u, '');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned || title; // Fallback to original if empty
}

// Helper to parse markdown content into slides
function parseContentToSlides(content: string): PageAnalysis[] {
    if (!content) return [];

    const lines = content.split('\n');
    const slides: PageAnalysis[] = [];
    let currentSlide: PageAnalysis | null = null;
    let slideIndex = 0;

    for (const line of lines) {
        // Match ## Title pattern (allow leading whitespace)
        const headingMatch = line.match(/^\s*##\s+(.+)$/);

        if (headingMatch) {
            // Save previous slide
            if (currentSlide) {
                slides.push(currentSlide);
            }

            // Clean the title
            const rawTitle = headingMatch[1].trim();
            const cleanedTitle = cleanSlideTitle(rawTitle);

            // Start new slide
            currentSlide = {
                page: slideIndex + 1,
                title: cleanedTitle,
                content: '',
                keyPoints: [] // Key points are now embedded in content
            };
            slideIndex++;
        } else if (currentSlide) {
            // Add line to current slide
            currentSlide.content += line + '\n';
        }
    }

    // Add last slide
    if (currentSlide) {
        slides.push(currentSlide);
    }

    // Filter out slides with empty content (whitespace only)
    return slides.filter(slide => slide.content.trim().length > 0);
}

export function AnalysisView({ material: initialMaterial, onPageChange }: AnalysisViewProps) {
    const [material, setMaterial] = useState<Material>(initialMaterial);
    const [activeTab, setActiveTab] = useState<'summary' | 'concepts' | 'quiz'>('summary');
    const [quiz, setQuiz] = useState<any>(initialMaterial.analysis?.quiz || null); // Initialize with existing quiz if available
    const [quizResult, setQuizResult] = useState<any>(null);
    const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
    const [isGradingQuiz, setIsGradingQuiz] = useState(false);
    const [conceptsContent, setConceptsContent] = useState<string | null>(initialMaterial.analysis?.concepts_content || null);
    const [isLoadingConcepts, setIsLoadingConcepts] = useState(false);
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [isDrawingModeRight, setIsDrawingModeRight] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [qualityRating, setQualityRating] = useState<'poor' | 'good' | null>(null);
    const [isSubmittingRating, setIsSubmittingRating] = useState(false);
    const [mobileView, setMobileView] = useState<'pdf' | 'analysis'>('analysis'); // Mobile toggle

    // Derive slides from either legacy page_analyses or new content string
    const pageAnalyses = material.analysis?.page_analyses ||
        (material.analysis?.content ? parseContentToSlides(material.analysis.content) : []);
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

                        const newContentLength = data.material.analysis?.content?.length || 0;
                        const oldContentLength = material.analysis?.content?.length || 0;

                        if (newPageCount > oldPageCount || newContentLength > oldContentLength) {
                            setMaterial(data.material);
                        }

                        // Update concepts if generated elsewhere
                        if (data.material.analysis?.concepts_content && !conceptsContent) {
                            setConceptsContent(data.material.analysis.concepts_content);
                        }

                        // Update quiz if generated elsewhere
                        if (data.material.analysis?.quiz && !quiz) {
                            setQuiz(data.material.analysis.quiz);
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
                }
            } else {
                stableCount = 0;
                lastPageCount = currentCount;
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [material.id, pageAnalyses.length, conceptsContent, quiz]);

    // Auto-generate quiz in background when analysis is complete
    useEffect(() => {
        const autoGenerateQuiz = async () => {
            // Only generate if:
            // 1. We have slides (analysis complete)
            // 2. Quiz hasn't been generated yet
            // 3. Not currently loading
            if (pageAnalyses.length > 0 && !quiz && !isLoadingQuiz) {
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
                    type: material.type,
                    materialId: material.id
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

    const loadConcepts = async () => {
        if (conceptsContent) return;
        toast.error('핵심 개념 생성 기능은 현재 준비 중입니다');
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
            toast.error('채점에 실패했습니다');
        } finally {
            setIsGradingQuiz(false);
        }
    };

    const handleTabChange = (tab: 'summary' | 'concepts' | 'quiz') => {
        setActiveTab(tab);
        if (tab === 'concepts' && !conceptsContent) {
            loadConcepts();
        }
        if (tab === 'quiz' && !quiz && !isLoadingQuiz) {
            // Retry loading quiz if it failed previously or hasn't started
            loadQuiz();
        }
    };

    const handlePrevSlide = () => {
        setCurrentSlide(prev => Math.max(0, prev - 1));
    };

    const handleNextSlide = () => {
        setCurrentSlide(prev => Math.min(totalSlides - 1, prev + 1));
    };

    // Load quality rating
    useEffect(() => {
        const loadRating = async () => {
            try {
                const response = await fetch(`/api/material/rate?materialId=${material.id}`);
                if (response.ok) {
                    const data = await response.json();
                    setQualityRating(data.rating);
                }
            } catch (error) {
                console.error('Failed to load quality rating:', error);
            }
        };
        loadRating();
    }, [material.id]);

    const handleQualityRating = async (rating: 'poor' | 'good') => {
        setIsSubmittingRating(true);
        try {
            const response = await fetch('/api/material/rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    materialId: material.id,
                    rating
                })
            });

            if (response.ok) {
                setQualityRating(rating);
            } else {
                throw new Error('Failed to submit rating');
            }
        } catch (error) {
            console.error('Rating submission error:', error);
            toast.error('평가 제출에 실패했습니다');
        } finally {
            setIsSubmittingRating(false);
        }
    };


    // Mobile View Toggle Component
    const MobileViewToggle = () => (
        <div className="lg:hidden flex items-center justify-center gap-2 p-2 bg-black/20 rounded-xl mb-4">
            <Button
                onClick={() => setMobileView('pdf')}
                size="sm"
                variant={mobileView === 'pdf' ? 'default' : 'ghost'}
                className={`flex-1 text-xs ${mobileView === 'pdf' ? '' : 'text-gray-400'}`}
            >
                <Eye className="w-3 h-3 mr-1.5" />
                원본 자료
            </Button>
            <Button
                onClick={() => setMobileView('analysis')}
                size="sm"
                variant={mobileView === 'analysis' ? 'default' : 'ghost'}
                className={`flex-1 text-xs ${mobileView === 'analysis' ? '' : 'text-gray-400'}`}
            >
                <Layers className="w-3 h-3 mr-1.5" />
                AI 분석
            </Button>
        </div>
    );

    // Render Summary Content (reusable for both desktop and mobile)
    const renderSummaryContent = () => (
        pageAnalyses.length > 0 ? (
            <div className="h-full flex flex-col">
                {/* Navigation Controls */}
                <div className="flex items-center justify-between mb-4 md:mb-6 pb-3 md:pb-4 border-b border-white/10">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePrevSlide}
                        disabled={currentSlide === 0}
                        className="text-gray-400 hover:text-white px-2 md:px-3"
                    >
                        <ChevronLeft className="w-4 h-4 md:mr-1" />
                        <span className="hidden md:inline">이전</span>
                    </Button>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                        {currentSlide + 1} / {totalSlides}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNextSlide}
                        disabled={currentSlide === totalSlides - 1}
                        className="text-gray-400 hover:text-white px-2 md:px-3"
                    >
                        <span className="hidden md:inline">다음</span>
                        <ChevronRight className="w-4 h-4 md:ml-1" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Current Slide Content */}
                    <div className="space-y-4 md:space-y-6 animate-fade-in" key={currentSlide}>
                        <div className="relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                            <div className="pl-4 md:pl-6">
                                <div className="flex items-baseline gap-2 md:gap-3 mb-4 md:mb-6">
                                    <h3 className="text-lg md:text-xl font-bold text-gradient flex-1 leading-tight">{pageAnalyses[currentSlide].title}</h3>
                                </div>
                                <div className="text-sm md:text-base">
                                    <AccordionContent content={pageAnalyses[currentSlide].content} />
                                </div>
                            </div>
                        </div>

                        {pageAnalyses[currentSlide].keyPoints && pageAnalyses[currentSlide].keyPoints!.length > 0 && (
                            <div className="pt-4 md:pt-6 border-t border-white/10">
                                <h4 className="text-base md:text-lg font-semibold flex items-center gap-2 mb-3 md:mb-4">
                                    {material.type === "exam" ? (
                                        <>
                                            <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                                            <span className="text-blue-100">시험 포인트</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
                                            <span className="text-purple-100">핵심 인사이트</span>
                                        </>
                                    )}
                                </h4>
                                <ul className="space-y-2 md:space-y-3">
                                    {pageAnalyses[currentSlide].keyPoints!.map((point, idx) => (
                                        <li key={idx} className="flex gap-2 md:gap-3 group">
                                            <span className="flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full bg-white/5 border border-white/10 text-[10px] md:text-xs font-bold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary/30 transition-colors shrink-0 mt-0.5">
                                                {idx + 1}
                                            </span>
                                            <span className="text-xs md:text-sm leading-relaxed text-gray-300 group-hover:text-white transition-colors">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Quality Rating Section */}
                        <div className="pt-4 md:pt-6 border-t border-white/10 mt-4 md:mt-6">
                            <h4 className="text-xs md:text-sm font-semibold mb-2 md:mb-3 text-gray-300">
                                이 분석이 도움이 되셨나요?
                            </h4>
                            <div className="flex items-center gap-2 md:gap-3">
                                <Button
                                    onClick={() => handleQualityRating('good')}
                                    disabled={isSubmittingRating}
                                    variant={qualityRating === 'good' ? 'default' : 'outline'}
                                    size="sm"
                                    className={`flex-1 text-xs md:text-sm ${qualityRating === 'good' ? 'bg-green-600 hover:bg-green-700' : 'border-white/20 hover:bg-white/10'}`}
                                >
                                    <ThumbsUp className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                                    좋음
                                </Button>
                                <Button
                                    onClick={() => handleQualityRating('poor')}
                                    disabled={isSubmittingRating}
                                    variant={qualityRating === 'poor' ? 'default' : 'outline'}
                                    size="sm"
                                    className={`flex-1 text-xs md:text-sm ${qualityRating === 'poor' ? 'bg-red-600 hover:bg-red-700' : 'border-white/20 hover:bg-white/10'}`}
                                >
                                    <ThumbsDown className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                                    별로임
                                </Button>
                            </div>
                            {qualityRating && (
                                <p className="text-[10px] md:text-xs text-muted-foreground mt-2 text-center">
                                    평가해 주셔서 감사합니다! 더 나은 분석을 제공하겠습니다.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="p-8 md:p-12 text-center text-muted-foreground flex flex-col items-center gap-3 md:gap-4">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/5 flex items-center justify-center">
                    <FileText className="w-6 h-6 md:w-8 md:h-8 opacity-20" />
                </div>
                <p className="text-sm">분석 결과가 아직 생성되지 않았습니다.</p>
            </div>
        )
    );

    return (
        <div className="h-full animate-fade-in">
            {/* Mobile View Toggle */}
            <MobileViewToggle />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 h-full">
                {/* Left: Original PDF */}
                <div className={`glass-card rounded-2xl h-full overflow-hidden flex flex-col ${mobileView !== 'pdf' ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-3 md:p-4 border-b border-white/10 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                                    <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                                </div>
                                <span className="font-semibold text-xs md:text-sm">원본 자료</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => setIsDrawingMode(!isDrawingMode)}
                                    size="sm"
                                    variant={isDrawingMode ? "default" : "ghost"}
                                    className="text-[10px] md:text-xs h-7 md:h-8 px-2 md:px-3"
                                >
                                    <Pen className="w-3 h-3 mr-1" />
                                    <span className="hidden sm:inline">{isDrawingMode ? "필기 중" : "필기"}</span>
                                </Button>
                                <Badge variant={material.type === "exam" ? "default" : "secondary"} className="bg-white/10 hover:bg-white/20 text-white border-none text-[10px] md:text-xs">
                                    {material.type === "exam" ? "시험" : "업무"}
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
                                                <span className="text-[10px] md:text-xs font-medium text-gray-300 tabular-nums">
                                                    페이지 {pageNumber} / {numPages}
                                                </span>
                                                <div className="flex items-center gap-1 md:gap-2">
                                                    <Button
                                                        onClick={zoomOut}
                                                        size="icon"
                                                        variant="ghost"
                                                        className="w-6 h-6 md:w-7 md:h-7 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                        disabled={scale <= 0.5}
                                                    >
                                                        <ZoomOut className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                                    </Button>
                                                    <span className="text-[10px] md:text-xs font-medium text-gray-300 w-8 md:w-12 text-center tabular-nums">
                                                        {Math.round(scale * 100)}%
                                                    </span>
                                                    <Button
                                                        onClick={zoomIn}
                                                        size="icon"
                                                        variant="ghost"
                                                        className="w-6 h-6 md:w-7 md:h-7 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                        disabled={scale >= 2.0}
                                                    >
                                                        <ZoomIn className="w-3 h-3 md:w-3.5 md:h-3.5" />
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
                            <div className="p-4 md:p-6 relative">
                                {/* Text Content */}
                                <div className={`whitespace-pre-wrap text-xs md:text-sm leading-relaxed text-gray-300 ${isDrawingMode ? 'pointer-events-none' : ''}`}>
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
                <div className={`glass-card rounded-2xl h-full overflow-hidden flex flex-col ${mobileView !== 'analysis' ? 'hidden lg:flex' : 'flex'}`}>
                    {/* Header with Tabs */}
                    <div className="p-3 md:p-4 border-b border-white/10 shrink-0">
                        <div className="flex items-center justify-between mb-2 md:mb-3">
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="p-1.5 md:p-2 rounded-lg bg-blue-500/10">
                                    <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-xs md:text-sm">AI 분석</h3>
                                    <p className="text-[9px] md:text-[10px] text-muted-foreground hidden sm:block">학습 자료 분석 완료</p>
                                </div>
                            </div>

                            {/* Tab Buttons and Drawing Toggle */}
                            <div className="flex items-center gap-1 md:gap-2">
                                <div className="flex items-center gap-0.5 md:gap-1 bg-black/20 rounded-lg p-0.5 md:p-1">
                                    <Button
                                        onClick={() => handleTabChange('summary')}
                                        size="sm"
                                        variant={activeTab === 'summary' ? 'default' : 'ghost'}
                                        className={`text-[10px] md:text-xs h-6 md:h-7 px-1.5 md:px-2 ${activeTab === 'summary' ? '' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <BookOpen className="w-3 h-3 md:mr-1" />
                                        <span className="hidden md:inline">AI 요약</span>
                                    </Button>
                                    <Button
                                        onClick={() => handleTabChange('concepts')}
                                        size="sm"
                                        variant={activeTab === 'concepts' ? 'default' : 'ghost'}
                                        className={`text-[10px] md:text-xs h-6 md:h-7 px-1.5 md:px-2 ${activeTab === 'concepts' ? '' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Brain className="w-3 h-3 md:mr-1" />
                                        <span className="hidden md:inline">핵심 개념</span>
                                    </Button>
                                    <Button
                                        onClick={() => handleTabChange('quiz')}
                                        size="sm"
                                        variant={activeTab === 'quiz' ? 'default' : 'ghost'}
                                        className={`text-[10px] md:text-xs h-6 md:h-7 px-1.5 md:px-2 ${activeTab === 'quiz' ? '' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <FileText className="w-3 h-3 md:mr-1" />
                                        <span className="hidden md:inline">퀴즈</span>
                                    </Button>
                                </div>
                                <Button
                                    onClick={() => setIsDrawingModeRight(!isDrawingModeRight)}
                                    size="sm"
                                    variant={isDrawingModeRight ? "default" : "ghost"}
                                    className="text-[10px] md:text-xs h-6 md:h-7 px-1.5 md:px-2 hidden md:flex"
                                >
                                    <Pen className="w-3 h-3 md:mr-1" />
                                    <span className="hidden lg:inline">{isDrawingModeRight ? "필기 중" : "필기"}</span>
                                </Button>
                            </div>
                        </div>

                        {/* Show slide count for Summary Tab */}
                        {activeTab === 'summary' && (
                            <div className="flex items-center justify-center bg-black/20 rounded-full py-1.5 md:py-2 px-3">
                                <span className="text-[10px] md:text-xs font-medium text-center tabular-nums">
                                    총 {totalSlides}개 슬라이드
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Content Area */}
                    <div className={`flex-1 ${isDrawingModeRight ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} p-4 md:p-6 relative`}>
                        <div className={isDrawingModeRight ? "pointer-events-none" : ""}>
                            {activeTab === 'summary' ? (
                                /* Summary Content - Slider View */
                                renderSummaryContent()
                            ) : activeTab === 'concepts' ? (
                                /* Core Concepts Content */
                                isLoadingConcepts ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 md:gap-4">
                                        <Loader2 className="w-8 h-8 md:w-12 md:h-12 animate-spin text-primary" />
                                        <p className="text-xs md:text-sm text-muted-foreground">핵심 개념 추출 중...</p>
                                        <p className="text-[10px] md:text-xs text-muted-foreground">AI가 중요한 개념을 정리하고 있습니다</p>
                                    </div>
                                ) : conceptsContent ? (
                                    <div className="space-y-4 md:space-y-6 animate-fade-in">
                                        <div className="relative">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-500 to-teal-500 rounded-full" />
                                            <div className="pl-4 md:pl-6">
                                                <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-gradient">핵심 개념 정리</h3>
                                                <div className="text-sm md:text-base">
                                                    <AccordionContent content={conceptsContent} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 md:gap-4">
                                        <Brain className="w-12 h-12 md:w-16 md:h-16 text-primary opacity-50" />
                                        <p className="text-xs md:text-sm text-muted-foreground">핵심 개념을 불러올 수 없습니다</p>
                                        <Button onClick={loadConcepts} variant="outline" size="sm" className="text-xs">
                                            다시 시도
                                        </Button>
                                    </div>
                                )
                            ) : (
                                /* Quiz Content */
                                isLoadingQuiz ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 md:gap-4">
                                        <Loader2 className="w-8 h-8 md:w-12 md:h-12 animate-spin text-primary" />
                                        <p className="text-xs md:text-sm text-muted-foreground">퀴즈 생성 중...</p>
                                        <p className="text-[10px] md:text-xs text-muted-foreground">15문제를 만들고 있습니다</p>
                                    </div>
                                ) : isGradingQuiz ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 md:gap-4">
                                        <Loader2 className="w-8 h-8 md:w-12 md:h-12 animate-spin text-primary" />
                                        <p className="text-xs md:text-sm text-muted-foreground">채점 중...</p>
                                        <p className="text-[10px] md:text-xs text-muted-foreground">AI가 답변을 분석하고 있습니다</p>
                                    </div>
                                ) : quizResult ? (
                                    <QuizResult result={quizResult} />
                                ) : quiz ? (
                                    <QuizView quiz={quiz} onSubmit={handleQuizSubmit} />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 md:gap-4">
                                        <Brain className="w-12 h-12 md:w-16 md:h-16 text-primary opacity-50" />
                                        <p className="text-xs md:text-sm text-muted-foreground">퀴즈를 불러오는 중 오류가 발생했습니다</p>
                                        <Button onClick={loadQuiz} variant="outline" size="sm" className="text-xs">
                                            다시 시도
                                        </Button>
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
                                    storageKey={`drawing-right-${material.id}-slide-${currentSlide}`}
                                    readOnly={!isDrawingModeRight}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
