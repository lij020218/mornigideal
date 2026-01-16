"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft, ChevronRight, X, Loader2, BookOpen,
    Maximize2, Minimize2, Check, FileText, Lightbulb
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Slide {
    slideNumber: number;
    title: string;
    content: string[];
    notes?: string;
    visualSuggestion?: string;
}

interface SlideViewerProps {
    curriculumId: string;
    dayNumber: number;
    dayTitle: string;
    dayDescription: string;
    objectives: string[];
    topic: string;
    currentLevel: string;
    targetLevel: string;
    onClose: () => void;
    onComplete: () => void;
}

export function SlideViewer({
    curriculumId,
    dayNumber,
    dayTitle,
    dayDescription,
    objectives,
    topic,
    currentLevel,
    targetLevel,
    onClose,
    onComplete,
}: SlideViewerProps) {
    const [slides, setSlides] = useState<Slide[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showNotes, setShowNotes] = useState(false);

    useEffect(() => {
        fetchSlides();
    }, [curriculumId, dayNumber]);

    const fetchSlides = async () => {
        setIsLoading(true);
        try {
            // First try to get existing slides
            const getRes = await fetch(
                `/api/ai-learning-slides?curriculumId=${curriculumId}&dayNumber=${dayNumber}`
            );

            if (getRes.ok) {
                const data = await getRes.json();
                if (data.slides && data.slides.length > 0) {
                    setSlides(data.slides);
                    setIsLoading(false);
                    return;
                }
            }

            // If no existing slides, generate new ones
            const postRes = await fetch("/api/ai-learning-slides", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    curriculumId,
                    dayNumber,
                    dayTitle,
                    dayDescription,
                    objectives,
                    topic,
                    currentLevel,
                    targetLevel,
                }),
            });

            if (postRes.ok) {
                const data = await postRes.json();
                setSlides(data.slides || []);
            }
        } catch (error) {
            console.error("[SlideViewer] Failed to fetch slides:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    };

    const handlePrev = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight" || e.key === " ") {
            handleNext();
        } else if (e.key === "ArrowLeft") {
            handlePrev();
        } else if (e.key === "Escape") {
            if (isFullscreen) {
                setIsFullscreen(false);
            } else {
                onClose();
            }
        }
    };

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentSlide, slides.length, isFullscreen]);

    const isLastSlide = currentSlide === slides.length - 1;
    const progressPercent = slides.length > 0 ? ((currentSlide + 1) / slides.length) * 100 : 0;

    if (isLoading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            >
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">슬라이드 생성 중...</h3>
                    <p className="text-sm text-muted-foreground">
                        AI가 맞춤형 학습 슬라이드를 만들고 있어요
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        약 30초 정도 소요될 수 있습니다
                    </p>
                </div>
            </motion.div>
        );
    }

    if (slides.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            >
                <div className="text-center">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">슬라이드를 불러올 수 없습니다</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        다시 시도해주세요
                    </p>
                    <Button onClick={onClose} variant="outline">
                        닫기
                    </Button>
                </div>
            </motion.div>
        );
    }

    const slide = slides[currentSlide];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
                "fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-slate-900 to-slate-950",
                isFullscreen ? "" : "p-4 md:p-8"
            )}
        >
            {/* Header */}
            {!isFullscreen && (
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="font-bold">Day {dayNumber}: {dayTitle}</h2>
                            <p className="text-xs text-muted-foreground">{topic}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setShowNotes(!showNotes)}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                        >
                            <Lightbulb className="w-4 h-4" />
                            노트
                        </Button>
                        <Button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            variant="outline"
                            size="sm"
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-4 h-4" />
                            ) : (
                                <Maximize2 className="w-4 h-4" />
                            )}
                        </Button>
                        <Button onClick={onClose} variant="ghost" size="sm">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Slide Content */}
            <div className={cn(
                "flex-1 flex flex-col",
                isFullscreen ? "p-8" : ""
            )}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 bg-white/[0.03] rounded-2xl p-8 md:p-12 flex flex-col"
                    >
                        {/* Slide Number */}
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-xs text-muted-foreground">
                                {slide.slideNumber} / {slides.length}
                            </span>
                            {slide.visualSuggestion && (
                                <span className="text-xs text-purple-400 flex items-center gap-1">
                                    💡 {slide.visualSuggestion}
                                </span>
                            )}
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl md:text-4xl font-bold mb-8 text-purple-100">
                            {slide.title}
                        </h1>

                        {/* Content */}
                        <div className="flex-1 space-y-4">
                            {slide.content.map((point, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex items-start gap-4"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-purple-400 font-medium">{index + 1}</span>
                                    </div>
                                    <p className="text-lg md:text-xl text-slate-200 leading-relaxed">
                                        {point}
                                    </p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Notes Panel */}
                        <AnimatePresence>
                            {showNotes && slide.notes && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <Lightbulb className="w-4 h-4 text-amber-400" />
                                        <span className="text-sm font-medium text-amber-300">학습 노트</span>
                                    </div>
                                    <p className="text-sm text-amber-100/80">{slide.notes}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-4">
                <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-4">
                <Button
                    onClick={handlePrev}
                    disabled={currentSlide === 0}
                    variant="outline"
                    className="gap-2"
                >
                    <ChevronLeft className="w-4 h-4" />
                    이전
                </Button>

                <div className="flex items-center gap-2">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentSlide(index)}
                            className={cn(
                                "w-2 h-2 rounded-full transition-all",
                                index === currentSlide
                                    ? "w-6 bg-purple-500"
                                    : "bg-white/20 hover:bg-white/40"
                            )}
                        />
                    ))}
                </div>

                {isLastSlide ? (
                    <Button
                        onClick={onComplete}
                        className="gap-2 bg-green-500 hover:bg-green-600"
                    >
                        <Check className="w-4 h-4" />
                        학습 완료
                    </Button>
                ) : (
                    <Button
                        onClick={handleNext}
                        className="gap-2"
                    >
                        다음
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="text-center mt-4 text-xs text-muted-foreground">
                <kbd className="px-2 py-1 rounded bg-white/10">←</kbd>
                <span className="mx-2">이전</span>
                <kbd className="px-2 py-1 rounded bg-white/10">→</kbd>
                <span className="mx-2">다음</span>
                <kbd className="px-2 py-1 rounded bg-white/10">ESC</kbd>
                <span className="mx-2">닫기</span>
            </div>
        </motion.div>
    );
}
