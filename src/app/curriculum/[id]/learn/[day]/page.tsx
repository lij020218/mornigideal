"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Loader2, BookOpen, CheckCircle2, Sparkles, Trophy, Quote, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { markLearningComplete } from "@/lib/dailyGoals";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Slide {
    slideNumber: number;
    title: string;
    content: string;
    bulletPoints: string[];
    tip?: string;
    summary?: string[];
}

interface CurriculumItem {
    title: string;
    subtitle: string;
    icon: string;
    totalDays?: number;
}

interface UserProfile {
    job: string;
    level: string;
}

export default function LearningPage() {
    const params = useParams();
    const router = useRouter();
    const curriculumId = params.id as string;
    const day = params.day as string;

    const [curriculum, setCurriculum] = useState<CurriculumItem | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [lessonTitle, setLessonTitle] = useState("");
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loading, setLoading] = useState(false);
    const [started, setStarted] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        // Load curriculum item
        const savedCurriculum = localStorage.getItem("user_curriculum");
        if (savedCurriculum) {
            const items: CurriculumItem[] = JSON.parse(savedCurriculum);
            const index = parseInt(curriculumId);
            if (items[index]) {
                setCurriculum(items[index]);
            }
        }

        // Load user profile
        const savedProfile = localStorage.getItem("user_profile");
        if (savedProfile) {
            setUserProfile(JSON.parse(savedProfile));
        }

        // Check if this day's lesson was already completed
        const lessonKey = `lesson_${curriculumId}_${day}`;
        const savedLesson = localStorage.getItem(lessonKey);
        if (savedLesson) {
            const lessonData = JSON.parse(savedLesson);
            setSlides(lessonData.slides);
            setLessonTitle(lessonData.lessonTitle);
            setStarted(true);
            if (lessonData.completed) {
                setCompleted(true);
            }
        }
    }, [curriculumId, day]);

    const startLearning = async () => {
        if (!curriculum) return;

        setLoading(true);
        try {
            const response = await fetch("/api/generate-lesson", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    curriculumTitle: curriculum.title,
                    curriculumSubtitle: curriculum.subtitle,
                    dayNumber: day,
                    totalDays: curriculum.totalDays || 14,
                    userLevel: userProfile?.level || "mid",
                    userJob: userProfile?.job || "직장인"
                })
            });

            if (!response.ok) throw new Error("Failed to generate lesson");

            const data = await response.json();
            setSlides(data.slides);
            setLessonTitle(data.lessonTitle);
            setStarted(true);

            // Save to localStorage
            localStorage.setItem(`lesson_${curriculumId}_${day}`, JSON.stringify({
                lessonTitle: data.lessonTitle,
                slides: data.slides,
                completed: false
            }));
        } catch (error) {
            console.error("Error generating lesson:", error);
            alert("학습 콘텐츠를 생성하는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = () => {
        // Mark as completed
        setCompleted(true);

        // Trigger confetti
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#a855f7', '#ec4899', '#3b82f6']
        });

        // Update localStorage
        const lessonKey = `lesson_${curriculumId}_${day}`;
        const savedLesson = localStorage.getItem(lessonKey);
        if (savedLesson) {
            const lessonData = JSON.parse(savedLesson);
            lessonData.completed = true;
            localStorage.setItem(lessonKey, JSON.stringify(lessonData));
        }

        // Update curriculum progress
        const progressKey = `curriculum_progress_${curriculumId}`;
        const savedProgress = localStorage.getItem(progressKey);
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            const dayNum = parseInt(day);
            if (!progress.completedDays.includes(dayNum)) {
                progress.completedDays.push(dayNum);
                localStorage.setItem(progressKey, JSON.stringify(progress));
            }
        }

        // Mark learning complete for daily goals
        markLearningComplete(`lesson_${curriculumId}_${day}`);
    };

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setDirection(1);
            setCurrentSlide(currentSlide + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setDirection(-1);
            setCurrentSlide(currentSlide - 1);
        }
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0,
            scale: 0.95
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 50 : -50,
            opacity: 0,
            scale: 0.95
        })
    };

    if (!curriculum) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground animate-pulse">학습 정보를 불러오는 중...</p>
                </motion.div>
            </div>
        );
    }

    // Pre-learning state
    if (!started) {
        return (
            <div className="min-h-screen bg-background selection:bg-primary/30">
                <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />

                <header className="sticky top-0 z-50 glass border-b border-white/5 backdrop-blur-lg">
                    <div className="max-w-4xl mx-auto px-6 py-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/curriculum/${curriculumId}`)}
                            className="gap-2 hover:bg-white/5 rounded-full"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            뒤로
                        </Button>
                    </div>
                </header>

                <main className="max-w-2xl mx-auto px-6 py-16 relative z-10">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Card className="glass-card border-none p-10 text-center space-y-8 bg-black/20 backdrop-blur-xl">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", delay: 0.2 }}
                                className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto ring-1 ring-primary/20"
                            >
                                <BookOpen className="w-10 h-10 text-primary" />
                            </motion.div>

                            <div className="space-y-3">
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-sm font-medium text-primary uppercase tracking-wider"
                                >
                                    Day {day}
                                </motion.p>
                                <motion.h1
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60"
                                >
                                    {curriculum.title}
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="text-lg text-muted-foreground"
                                >
                                    {curriculum.subtitle}
                                </motion.p>
                            </div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="pt-4 space-y-6"
                            >
                                <p className="text-sm text-muted-foreground bg-white/5 py-3 px-4 rounded-lg inline-block">
                                    AI가 당신의 수준(<span className="text-primary font-semibold">{userProfile?.level === 'junior' ? '입문자' : userProfile?.level === 'senior' ? '고급자' : '중급자'}</span>)에 맞춰
                                    <br />오늘의 핵심 학습 콘텐츠를 생성합니다.
                                </p>

                                <Button
                                    size="lg"
                                    className="w-full h-14 text-lg gap-2 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                                    onClick={startLearning}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            맞춤형 콘텐츠 생성 중...
                                        </>
                                    ) : (
                                        <>
                                            학습 시작하기
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </Button>
                            </motion.div>
                        </Card>
                    </motion.div>
                </main>
            </div>
        );
    }

    // Learning in progress
    const slide = slides[currentSlide];
    const isLastSlide = currentSlide === slides.length - 1;

    return (
        <div className="min-h-screen bg-background flex flex-col selection:bg-primary/30 overflow-hidden">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />

            {/* Header */}
            <header className="sticky top-0 z-50 glass border-b border-white/5 backdrop-blur-lg">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/curriculum/${curriculumId}`)}
                        className="gap-2 hover:bg-white/5 rounded-full"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        나가기
                    </Button>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-muted-foreground tabular-nums">
                            {currentSlide + 1} / {slides.length}
                        </span>
                        {/* Progress bar */}
                        <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden ring-1 ring-white/10">
                            <motion.div
                                className="h-full bg-primary"
                                initial={{ width: 0 }}
                                animate={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
                                transition={{ duration: 0.5, ease: "circOut" }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 max-w-4xl mx-auto px-6 py-8 w-full relative z-10 flex flex-col">
                <AnimatePresence mode="wait" custom={direction}>
                    {slide && (
                        <motion.div
                            key={currentSlide}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            className="h-full flex flex-col"
                        >
                            <Card className="glass-card border-none h-full min-h-[500px] flex flex-col bg-black/20 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/20">
                                <CardContent className="p-8 md:p-12 flex-1 flex flex-col relative">
                                    {/* Slide number & title */}
                                    <div className="mb-8">
                                        <motion.span
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                            className="text-sm text-primary font-bold tracking-wider uppercase bg-primary/10 px-2 py-1 rounded"
                                        >
                                            Slide {slide.slideNumber}
                                        </motion.span>
                                        <motion.h2
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 }}
                                            className="text-3xl md:text-4xl font-bold mt-4 leading-tight"
                                        >
                                            {slide.title}
                                        </motion.h2>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar pb-20">
                                        {/* Main content */}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.4 }}
                                            className="text-lg leading-relaxed space-y-6 text-muted-foreground/90"
                                        >
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-white mt-6 mb-4" {...props} />,
                                                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-white/90 mt-5 mb-3" {...props} />,
                                                    h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-primary mt-4 mb-2" {...props} />,
                                                    p: ({ node, ...props }) => <p className="mb-4 leading-relaxed" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="space-y-2 mb-4" {...props} />,
                                                    ol: ({ node, ...props }) => <ol className="space-y-2 mb-4 list-decimal list-inside" {...props} />,
                                                    li: ({ node, ...props }) => (
                                                        <li className="flex gap-2" {...props}>
                                                            <span className="text-primary mt-1.5">•</span>
                                                            <span className="flex-1">{props.children}</span>
                                                        </li>
                                                    ),
                                                    blockquote: ({ node, ...props }) => (
                                                        <blockquote className="border-l-4 border-primary/50 pl-4 py-2 my-4 bg-white/5 rounded-r-lg italic text-muted-foreground" {...props} />
                                                    ),
                                                    code: ({ node, ...props }) => {
                                                        // Check if it's inline code or block code
                                                        const isInline = !String(props.children).includes('\n');
                                                        return isInline ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/20 text-primary font-semibold border border-primary/30 mx-0.5" {...props} />
                                                        ) : (
                                                            <code className="block bg-black/30 p-4 rounded-lg text-sm font-mono my-4 overflow-x-auto border-l-4 border-primary" {...props} />
                                                        );
                                                    },
                                                    strong: ({ node, ...props }) => <strong className="text-white font-bold bg-gradient-to-r from-primary/30 to-purple-500/30 px-2 py-0.5 rounded-md border-b-2 border-primary/50" {...props} />,
                                                    em: ({ node, ...props }) => <em className="text-primary/90 font-semibold not-italic underline decoration-primary/50 decoration-2 underline-offset-2" {...props} />,
                                                }}
                                            >
                                                {slide.content}
                                            </ReactMarkdown>
                                        </motion.div>

                                        {/* Summary */}
                                        {slide.summary && slide.summary.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.7 }}
                                                className="bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-4"
                                            >
                                                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    3줄 요약
                                                </h3>
                                                <ul className="space-y-3">
                                                    {slide.summary.map((line, index) => (
                                                        <li key={index} className="text-sm flex gap-3">
                                                            <span className="text-primary font-bold shrink-0">{index + 1}.</span>
                                                            <span className="leading-relaxed text-muted-foreground">{line}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </motion.div>
                                        )}

                                        {/* Tip */}
                                        {slide.tip && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.8 }}
                                                className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-6"
                                            >
                                                <div className="flex gap-4">
                                                    <span className="text-3xl">💡</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-yellow-500 mb-2">전문가 팁</p>
                                                        <p className="text-sm leading-relaxed text-yellow-200/80">
                                                            {slide.tip}
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Navigation - Inside Card */}
                                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-sm border-t border-white/5">
                                        <div className="flex items-center justify-between gap-4">
                                            <Button
                                                variant="outline"
                                                onClick={prevSlide}
                                                disabled={currentSlide === 0}
                                                className="gap-2 h-11 px-5 rounded-xl border-white/10 hover:bg-white/10"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                이전
                                            </Button>

                                            {isLastSlide ? (
                                                completed ? (
                                                    <Button
                                                        onClick={() => router.push(`/curriculum/${curriculumId}`)}
                                                        className="gap-2 h-11 px-6 rounded-xl bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        완료 - 목록으로
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        onClick={handleComplete}
                                                        className="gap-2 h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                                    >
                                                        <Trophy className="w-4 h-4" />
                                                        학습 완료하기
                                                    </Button>
                                                )
                                            ) : (
                                                <Button
                                                    onClick={nextSlide}
                                                    className="gap-2 h-11 px-6 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/30"
                                                >
                                                    다음
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

