"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    ArrowRight,
    ArrowLeft,
    Sparkles,
    BookOpen,
    Target,
    TrendingUp,
    Mail,
    Calendar,
    Clock,
    CheckCircle,
    BarChart3,
    LineChart,
    Brain,
    Lightbulb,
    Users,
    Bell,
    Repeat,
    Zap,
    PlayCircle,
    MousePointerClick,
    LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GuideSlide {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconBg: string;
    color: string;
    content: React.ReactNode;
}

interface GuideSlidesProps {
    onComplete: () => void;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    },
    exit: {
        opacity: 0,
        transition: {
            staggerChildren: 0.05,
            staggerDirection: -1
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 300, damping: 24 }
    },
    exit: { y: -20, opacity: 0 }
};

const iconVariants = {
    initial: { scale: 0.8, opacity: 0, rotate: -10 },
    animate: {
        scale: 1,
        opacity: 1,
        rotate: 0,
        transition: { type: "spring", stiffness: 200, damping: 20, delay: 0.1 }
    },
    exit: { scale: 0.8, opacity: 0 }
};

export function GuideSlides({ onComplete }: GuideSlidesProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [direction, setDirection] = useState(0);

    const slides: GuideSlide[] = [
        // Slide 0: Welcome
        {
            id: "welcome",
            title: "준비 완료!",
            subtitle: "A.ideal의 핵심 기능을 소개해드릴게요",
            icon: <Sparkles className="w-10 h-10 text-white" />,
            iconBg: "bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/30",
            color: "text-primary",
            content: (
                <div className="text-center space-y-6 py-4">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="p-6 rounded-2xl bg-gradient-to-b from-white/10 to-transparent border border-white/5 backdrop-blur-sm"
                    >
                        <p className="text-lg text-white mb-2 font-medium">
                            당신의 <span className="text-purple-400 font-bold">성장</span>을 위한
                            <span className="text-primary font-bold"> AI 개인 비서</span>
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            A.ideal은 단순한 학습 도구가 아닙니다.<br />
                            목표 설정부터 일정 관리, 트렌드 파악까지<br />
                            당신의 커리어 여정을 함께합니다.
                        </p>
                    </motion.div>
                </div>
            )
        },
        // Slide 1: Schedule Management
        {
            id: "schedule",
            title: "스마트한 일정 관리",
            subtitle: "단순한 캘린더 그 이상의 경험",
            icon: <Calendar className="w-8 h-8 text-white" />,
            iconBg: "bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/30",
            color: "text-cyan-400",
            content: (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { icon: <LayoutDashboard className="w-5 h-5" />, title: "주간 타임라인", desc: "하루 흐름 시각화", color: "text-cyan-400", bg: "bg-cyan-400/10" },
                            { icon: <Repeat className="w-5 h-5" />, title: "자동 반복", desc: "루틴 자동 등록", color: "text-blue-400", bg: "bg-blue-400/10" },
                            { icon: <MousePointerClick className="w-5 h-5" />, title: "드래그 & 드롭", desc: "손쉬운 시간 조정", color: "text-indigo-400", bg: "bg-indigo-400/10" },
                            { icon: <CheckCircle className="w-5 h-5" />, title: "목표 달성률", desc: "실시간 성과 추적", color: "text-teal-400", bg: "bg-teal-400/10" }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                variants={itemVariants}
                                className={cn("p-4 rounded-xl border border-white/10 hover:border-white/20 transition-colors flex flex-col gap-2", item.bg)}
                            >
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-white/10", item.color)}>
                                    {item.icon}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm text-white">{item.title}</h4>
                                    <p className="text-[11px] text-white/60">{item.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )
        },
        // Slide 2: Growth Insights
        {
            id: "insights",
            title: "데이터 기반 성장",
            subtitle: "매일 아침, 나만의 성장 리포트",
            icon: <BarChart3 className="w-8 h-8 text-white" />,
            iconBg: "bg-gradient-to-br from-purple-400 to-pink-600 shadow-lg shadow-purple-500/30",
            color: "text-purple-400",
            content: (
                <div className="space-y-4">
                    <motion.div variants={itemVariants} className="relative p-5 rounded-xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 border border-purple-500/20 overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -mr-10 -mt-10" />

                        <div className="relative z-10 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-white text-base mb-1">데일리 브리핑</h4>
                                <p className="text-sm text-white/70 mb-3">
                                    어제의 성과 분석과 오늘의 추천 일정을<br />
                                    매일 아침 AI가 정리해드립니다.
                                </p>
                                <div className="flex gap-2">
                                    <span className="px-2 py-1 rounded-md bg-white/10 text-[10px] text-purple-200 border border-purple-500/30">학습 통계</span>
                                    <span className="px-2 py-1 rounded-md bg-white/10 text-[10px] text-pink-200 border border-pink-500/30">동료 비교</span>
                                    <span className="px-2 py-1 rounded-md bg-white/10 text-[10px] text-blue-200 border border-blue-500/30">강점 분석</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                            <LineChart className="w-5 h-5 text-green-400 mx-auto mb-2" />
                            <p className="text-xs text-white/60">성장 그래프</p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                            <Target className="w-5 h-5 text-red-400 mx-auto mb-2" />
                            <p className="text-xs text-white/60">목표 달성</p>
                        </div>
                    </motion.div>
                </div>
            )
        },
        // Slide 3: Trend Briefing
        {
            id: "trends",
            title: "트렌드 브리핑",
            subtitle: "업계 최신 동향을 놓치지 마세요",
            icon: <TrendingUp className="w-8 h-8 text-white" />,
            iconBg: "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30",
            color: "text-emerald-400",
            content: (
                <div className="space-y-4">
                    <motion.div variants={itemVariants} className="p-1 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                        <div className="bg-[#121212]/90 rounded-lg p-4 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <h4 className="font-bold text-emerald-400 flex items-center gap-2">
                                    <Zap className="w-4 h-4" /> AI News Curator
                                </h4>
                            </div>

                            <ul className="space-y-3">
                                {[
                                    { title: "맞춤형 뉴스", desc: "내 직무와 관련된 핵심 뉴스만 필터링" },
                                    { title: "3줄 요약", desc: "바쁜 아침, 핵심만 빠르게 파악" },
                                    { title: "인사이트", desc: "단순 정보를 넘어선 실무 적용 포인트" }
                                ].map((item, idx) => (
                                    <motion.li
                                        key={idx}
                                        className="flex items-start gap-3"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5 + (idx * 0.1) }}
                                    >
                                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-white">{item.title}</p>
                                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                                        </div>
                                    </motion.li>
                                ))}
                            </ul>
                        </div>
                    </motion.div>
                </div>
            )
        },
        // Slide 4: AI Analysis & Curriculum
        {
            id: "learning",
            title: "AI 학습 파트너",
            subtitle: "자료 분석부터 커리큘럼까지",
            icon: <Brain className="w-8 h-8 text-white" />,
            iconBg: "bg-gradient-to-br from-orange-400 to-red-600 shadow-lg shadow-orange-500/30",
            color: "text-orange-400",
            content: (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                        <motion.div variants={itemVariants} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                                <BookOpen className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white text-sm">PDF 자료 분석</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    자료를 업로드하면 AI가 핵심을 요약하고<br />
                                    예상 질문과 퀴즈를 생성합니다.
                                </p>
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                                <Target className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white text-sm">맞춤 커리큘럼</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    현재 실력과 목표를 분석하여<br />
                                    12일 완성 최적의 로드맵을 제안합니다.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            )
        },
        // Slide 5: Integration
        {
            id: "integration",
            title: "강력한 연동 기능",
            subtitle: "더 편리한 사용을 위한 팁",
            icon: <Zap className="w-8 h-8 text-white" />,
            iconBg: "bg-gradient-to-br from-slate-600 to-slate-800 shadow-lg shadow-white/10",
            color: "text-white",
            content: (
                <div className="space-y-3">
                    <motion.div variants={itemVariants} className="p-4 rounded-xl bg-[#EA4335]/10 border border-[#EA4335]/30 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                            <Mail className="w-5 h-5 text-[#EA4335]" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-sm">Gmail 연동</h4>
                            <p className="text-xs text-white/70">중요 메일 요약 & 일정 자동 추출</p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="p-4 rounded-xl bg-[#FF0000]/10 border border-[#FF0000]/30 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                            <PlayCircle className="w-5 h-5 text-[#FF0000]" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-sm">YouTube 추천</h4>
                            <p className="text-xs text-white/70">직무 관련 알짜 영상 큐레이션</p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="mt-4 p-3 rounded-lg bg-white/5 text-center">
                        <p className="text-xs text-muted-foreground">
                            ⚙️ 설정 페이지에서 언제든 연동을 관리할 수 있습니다.
                        </p>
                    </motion.div>
                </div>
            )
        }
    ];

    const slideCount = slides.length;

    const handleNext = () => {
        if (currentSlide < slideCount - 1) {
            setDirection(1);
            setCurrentSlide(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const handlePrev = () => {
        if (currentSlide > 0) {
            setDirection(-1);
            setCurrentSlide(prev => prev - 1);
        }
    };

    const currentSlideData = slides[currentSlide];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md mx-auto"
        >
            <Card className="glass-card border-none overflow-hidden shadow-2xl bg-black/40 backdrop-blur-xl ring-1 ring-white/10">
                <CardContent className="p-0 relative min-h-[500px] flex flex-col">
                    {/* Background decorations */}
                    <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                    <div className={cn(
                        "absolute top-[-20%] right-[-20%] w-[300px] h-[300px] rounded-full blur-[80px] opacity-20 transition-colors duration-700 pointer-events-none",
                        currentSlideData.color.replace('text-', 'bg-')
                    )} />

                    {/* Header Section */}
                    <div className="pt-10 px-8 pb-4 text-center relative z-10">
                        <div className="flex justify-center mb-6">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`icon-${currentSlide}`}
                                    variants={iconVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className={cn(
                                        "w-20 h-20 rounded-2xl flex items-center justify-center transform shadow-2xl",
                                        currentSlideData.iconBg
                                    )}
                                >
                                    {currentSlideData.icon}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={`text-${currentSlide}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h2 className="text-2xl font-bold mb-2 text-white tracking-tight">{currentSlideData.title}</h2>
                                <p className="text-sm text-white/60 font-medium">{currentSlideData.subtitle}</p>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 px-8 py-2 relative z-10">
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={`content-${currentSlide}`}
                                custom={direction}
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="h-full"
                            >
                                {currentSlideData.content}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Footer Section */}
                    <div className="p-6 mt-auto border-t border-white/5 bg-black/20 backdrop-blur-md relative z-20">
                        {/* Progress Bar */}
                        <div className="flex gap-1.5 mb-6 justify-center">
                            {slides.map((_, index) => (
                                <motion.div
                                    key={index}
                                    className={cn(
                                        "h-1.5 rounded-full transition-all duration-500",
                                        index === currentSlide ? "w-8 bg-white" : "w-1.5 bg-white/20"
                                    )}
                                    animate={{
                                        width: index === currentSlide ? 32 : 6,
                                        backgroundColor: index === currentSlide ? "#ffffff" : "rgba(255,255,255,0.2)"
                                    }}
                                />
                            ))}
                        </div>

                        <div className="flex justify-between items-center gap-4">
                            <Button
                                variant="ghost"
                                onClick={handlePrev}
                                disabled={currentSlide === 0}
                                className={cn(
                                    "text-white/50 hover:text-white hover:bg-white/5 transition-colors",
                                    currentSlide === 0 && "opacity-0 pointer-events-none"
                                )}
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>

                            <Button
                                onClick={handleNext}
                                className={cn(
                                    "flex-1 max-w-[200px] h-12 rounded-xl text-base font-semibold shadow-lg transition-all duration-300",
                                    "bg-white text-black hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98]",
                                    currentSlide === slideCount - 1 && "bg-gradient-to-r from-primary to-purple-600 text-white hover:shadow-primary/50"
                                )}
                            >
                                {currentSlide === slideCount - 1 ? (
                                    <span className="flex items-center justify-center gap-2">
                                        시작하기 <Sparkles className="w-5 h-5" />
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        다음 단계 <ArrowRight className="w-5 h-5" />
                                    </span>
                                )}
                            </Button>

                            {/* Blank spacer for alignment when prev button is hidden */}
                            <div className={cn("w-10", currentSlide !== 0 && "hidden")} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
