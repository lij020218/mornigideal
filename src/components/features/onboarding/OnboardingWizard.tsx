"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, Check, Brain, Loader2, Briefcase, GraduationCap, Sparkles, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Step = "userType" | "major" | "field" | "goal" | "schedule" | "customGoals" | "quiz" | "analysis";
type UserType = "worker" | "student" | null;

interface QuizQuestion {
    question: string;
    options: string[];
    answer: number;
}

interface CustomGoal {
    id: string;
    text: string;
    time: "morning" | "afternoon" | "evening";
}

export function OnboardingWizard() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("userType");
    const [userType, setUserType] = useState<UserType>(null);
    const [selection, setSelection] = useState({
        userType: "",
        major: "",
        field: "",
        goal: "",
        level: "",
        schedule: {
            wakeUp: "07:00",
            workStart: "09:00",
            workEnd: "18:00",
            sleep: "23:00"
        },
        customGoals: [] as CustomGoal[]
    });
    const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<number[]>([]);
    const [score, setScore] = useState(0);
    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [strengths, setStrengths] = useState<string[]>([]);
    const [weaknesses, setWeaknesses] = useState<string[]>([]);
    const [direction, setDirection] = useState(0);

    const handleUserTypeSelect = (type: UserType) => {
        setUserType(type);
        setSelection(prev => ({ ...prev, userType: type === "worker" ? "직장인" : "대학생" }));
        setDirection(1);
        if (type === "student") {
            setStep("major");
        } else {
            setStep("field");
        }
    };

    const handleNext = async () => {
        setDirection(1);
        if (step === "major") {
            setStep("field");
        } else if (step === "field") {
            setStep("goal");
        } else if (step === "goal") {
            setStep("schedule");
        } else if (step === "schedule") {
            setStep("customGoals");
        } else if (step === "customGoals") {
            setLoadingQuiz(true);
            try {
                const response = await fetch("/api/generate-quiz", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userType: selection.userType,
                        major: selection.major,
                        field: selection.field,
                        goal: selection.goal
                    }),
                });
                const data = await response.json();
                if (data.quiz) {
                    setQuiz(data.quiz);
                    setStep("quiz");
                }
            } catch (error) {
                console.error("Failed to generate quiz", error);
            } finally {
                setLoadingQuiz(false);
            }
        }
    };

    const handleQuizAnswer = (optionIndex: number) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestionIndex] = optionIndex;
        setAnswers(newAnswers);
    };

    const handlePrevQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < quiz.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            // Calculate final score
            let finalScore = 0;
            answers.forEach((ans, idx) => {
                if (ans === quiz[idx].answer) finalScore++;
            });

            // Quiz finished, analyze and determine level
            let level = "junior";
            if (finalScore >= 8) level = "senior";
            else if (finalScore >= 4) level = "mid";

            // Analyze strengths and weaknesses
            analyzePerformance(finalScore, level);
        }
    };

    const analyzePerformance = async (finalScore: number, level: string) => {
        setSelection(prev => ({ ...prev, level }));
        setStep("analysis");

        try {
            // Analyze strengths and weaknesses
            const analysisResponse = await fetch("/api/analyze-strengths", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userType: selection.userType,
                    major: selection.major,
                    field: selection.field,
                    goal: selection.goal,
                    score: finalScore,
                    level: level,
                    totalQuestions: quiz.length
                }),
            });

            const analysisData = await analysisResponse.json();
            setStrengths(analysisData.strengths || []);
            setWeaknesses(analysisData.weaknesses || []);

            // Generate curriculum based on analysis
            const finalSelection = {
                ...selection,
                level,
                job: selection.userType === "대학생"
                    ? `${selection.major} ${selection.userType}`
                    : selection.field,
                goal: selection.goal,
                strengths: analysisData.strengths,
                weaknesses: analysisData.weaknesses
            };

            const response = await fetch("/api/generate-curriculum", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalSelection),
            });

            const data = await response.json();

            if (data.curriculum) {
                localStorage.setItem("user_curriculum", JSON.stringify(data.curriculum));
                localStorage.setItem("user_profile", JSON.stringify(finalSelection));

                // Save profile to Supabase
                try {
                    await fetch("/api/user/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(finalSelection),
                    });
                } catch (profileError) {
                    console.error("Failed to save profile to database:", profileError);
                    // Continue anyway as localStorage has the data
                }
            }
        } catch (error) {
            console.error("Failed to analyze and generate curriculum", error);
        } finally {
            setTimeout(() => router.push("/dashboard"), 2000);
        }
    };

    const canProceed = () => {
        if (step === "major") return selection.major.length > 0;
        if (step === "field") return selection.field.length > 0;
        if (step === "goal") return selection.goal.length > 0;
        if (step === "schedule") return true; // Always valid as it has defaults
        if (step === "customGoals") return true; // Optional
        return false;
    };

    const getProgressSteps = () => {
        if (userType === "student") {
            return ["userType", "major", "field", "goal", "schedule", "customGoals", "quiz"];
        }
        return ["userType", "field", "goal", "schedule", "customGoals", "quiz"];
    };

    const progressSteps = getProgressSteps();
    const currentStepIndex = progressSteps.indexOf(step);

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

    return (
        <div className="w-full max-w-2xl mx-auto p-4">
            <div className="mb-8 flex justify-between items-center">
                <div className="flex gap-2">
                    {progressSteps.slice(0, -1).map((s, i) => (
                        <motion.div
                            key={s}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "4rem", opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className={cn(
                                "h-2 rounded-full transition-all duration-500",
                                i <= currentStepIndex || step === "analysis"
                                    ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                    : "bg-white/10"
                            )}
                        />
                    ))}
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                    {step === "analysis" ? "ANALYZING" : `${currentStepIndex + 1} / ${progressSteps.length - 1}`}
                </span>
            </div>

            <AnimatePresence mode="wait" custom={direction}>
                {step === "userType" && (
                    <motion.div
                        key="userType"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <Card className="glass-card border-none overflow-hidden">
                            <CardHeader>
                                <CardTitle className="text-3xl">어떤 분이신가요?</CardTitle>
                                <CardDescription>당신의 상황에 맞는 맞춤형 커리큘럼을 설계해드립니다.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <motion.button
                                    whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.1)" }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleUserTypeSelect("worker")}
                                    className="w-full p-8 rounded-xl border border-white/10 bg-white/5 transition-all flex items-center gap-6 group"
                                >
                                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Briefcase className="w-8 h-8 text-primary" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <h3 className="font-semibold text-xl mb-1 group-hover:text-primary transition-colors">직장인 / 취업 준비생</h3>
                                        <p className="text-sm text-muted-foreground">현재 업무 역량 향상 또는 취업을 준비하고 있어요</p>
                                    </div>
                                    <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.1)" }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleUserTypeSelect("student")}
                                    className="w-full p-8 rounded-xl border border-white/10 bg-white/5 transition-all flex items-center gap-6 group"
                                >
                                    <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <GraduationCap className="w-8 h-8 text-purple-400" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <h3 className="font-semibold text-xl mb-1 group-hover:text-purple-400 transition-colors">대학생</h3>
                                        <p className="text-sm text-muted-foreground">전공과 관련된 역량을 키우고 싶어요</p>
                                    </div>
                                    <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                                </motion.button>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {step === "major" && (
                    <motion.div
                        key="major"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <Card className="glass-card border-none">
                            <CardHeader>
                                <CardTitle className="text-3xl">어떤 학과에 재학 중이신가요?</CardTitle>
                                <CardDescription>학과명을 입력해주세요 (예: 컴퓨터공학과, 경영학과, 심리학과)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    placeholder="학과를 입력하세요..."
                                    value={selection.major}
                                    onChange={(e) => setSelection({ ...selection, major: e.target.value })}
                                    className="text-lg p-6 h-16 bg-white/5 border-white/10 focus:border-primary/50 transition-all"
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && selection.major && handleNext()}
                                />
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {step === "field" && (
                    <motion.div
                        key="field"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <Card className="glass-card border-none">
                            <CardHeader>
                                <CardTitle className="text-3xl">
                                    {userType === "student" ? "관심 있는 분야는 무엇인가요?" : "어떤 분야에서 일하시나요?"}
                                </CardTitle>
                                <CardDescription>
                                    {userType === "student"
                                        ? "앞으로 진출하고 싶은 분야를 입력해주세요 (예: AI 개발, 마케팅, UX 디자인)"
                                        : "현재 업무 분야를 입력해주세요 (예: 디지털 마케팅, 프론트엔드 개발, HR)"
                                    }
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    placeholder="분야를 입력하세요..."
                                    value={selection.field}
                                    onChange={(e) => setSelection({ ...selection, field: e.target.value })}
                                    className="text-lg p-6 h-16 bg-white/5 border-white/10 focus:border-primary/50 transition-all"
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && selection.field && handleNext()}
                                />
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {step === "goal" && (
                    <motion.div
                        key="goal"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <Card className="glass-card border-none">
                            <CardHeader>
                                <CardTitle className="text-3xl">구체적인 목표가 있나요?</CardTitle>
                                <CardDescription>
                                    {userType === "student"
                                        ? "달성하고 싶은 목표를 자유롭게 적어주세요 (예: 대기업 취업, 창업 준비, 대학원 진학)"
                                        : "이루고 싶은 목표를 자유롭게 적어주세요 (예: 팀장 승진, 연봉 협상, 이직 준비)"
                                    }
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    placeholder="목표를 입력하세요..."
                                    value={selection.goal}
                                    onChange={(e) => setSelection({ ...selection, goal: e.target.value })}
                                    className="text-lg p-6 h-16 bg-white/5 border-white/10 focus:border-primary/50 transition-all"
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && selection.goal && handleNext()}
                                />
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {step === "schedule" && (
                    <motion.div
                        key="schedule"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <Card className="glass-card border-none">
                            <CardHeader>
                                <CardTitle className="text-3xl">하루 일과를 알려주세요</CardTitle>
                                <CardDescription>당신의 라이프사이클에 맞춰 최적의 학습 시간을 추천해드립니다.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">기상 시간</label>
                                    <Input
                                        type="time"
                                        value={selection.schedule.wakeUp}
                                        onChange={(e) => setSelection({
                                            ...selection,
                                            schedule: { ...selection.schedule, wakeUp: e.target.value }
                                        })}
                                        className="text-lg p-4 h-14 bg-white/5 border-white/10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">취침 시간</label>
                                    <Input
                                        type="time"
                                        value={selection.schedule.sleep}
                                        onChange={(e) => setSelection({
                                            ...selection,
                                            schedule: { ...selection.schedule, sleep: e.target.value }
                                        })}
                                        className="text-lg p-4 h-14 bg-white/5 border-white/10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">업무/학업 시작</label>
                                    <Input
                                        type="time"
                                        value={selection.schedule.workStart}
                                        onChange={(e) => setSelection({
                                            ...selection,
                                            schedule: { ...selection.schedule, workStart: e.target.value }
                                        })}
                                        className="text-lg p-4 h-14 bg-white/5 border-white/10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">업무/학업 종료</label>
                                    <Input
                                        type="time"
                                        value={selection.schedule.workEnd}
                                        onChange={(e) => setSelection({
                                            ...selection,
                                            schedule: { ...selection.schedule, workEnd: e.target.value }
                                        })}
                                        className="text-lg p-4 h-14 bg-white/5 border-white/10"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {step === "customGoals" && (
                    <motion.div
                        key="customGoals"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <Card className="glass-card border-none">
                            <CardHeader>
                                <CardTitle className="text-3xl">나만의 데일리 목표</CardTitle>
                                <CardDescription>매일 지키고 싶은 습관이나 목표를 추가해보세요. (선택사항)</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex gap-2">
                                    <Input
                                        id="new-goal-input"
                                        placeholder="예: 하루 1시간 운동하기, 물 2L 마시기"
                                        className="text-lg p-4 h-14 bg-white/5 border-white/10 flex-1"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                const input = e.currentTarget as HTMLInputElement;
                                                if (input.value.trim()) {
                                                    setSelection({
                                                        ...selection,
                                                        customGoals: [
                                                            ...selection.customGoals,
                                                            {
                                                                id: Date.now().toString(),
                                                                text: input.value.trim(),
                                                                time: "morning" // Default
                                                            }
                                                        ]
                                                    });
                                                    input.value = "";
                                                }
                                            }
                                        }}
                                    />
                                    <Button
                                        className="h-14 px-6"
                                        onClick={() => {
                                            const input = document.getElementById("new-goal-input") as HTMLInputElement;
                                            if (input.value.trim()) {
                                                setSelection({
                                                    ...selection,
                                                    customGoals: [
                                                        ...selection.customGoals,
                                                        {
                                                            id: Date.now().toString(),
                                                            text: input.value.trim(),
                                                            time: "morning" // Default
                                                        }
                                                    ]
                                                });
                                                input.value = "";
                                            }
                                        }}
                                    >
                                        추가
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {selection.customGoals.map((goal) => (
                                        <motion.div
                                            key={goal.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                                        >
                                            <div className="flex-1 font-medium">{goal.text}</div>
                                            <select
                                                value={goal.time}
                                                onChange={(e) => {
                                                    const newGoals = selection.customGoals.map(g =>
                                                        g.id === goal.id ? { ...g, time: e.target.value as any } : g
                                                    );
                                                    setSelection({ ...selection, customGoals: newGoals });
                                                }}
                                                className="bg-black/20 border-none rounded px-2 py-1 text-sm text-muted-foreground"
                                            >
                                                <option value="morning">아침</option>
                                                <option value="afternoon">오후</option>
                                                <option value="evening">저녁</option>
                                            </select>
                                            <button
                                                onClick={() => {
                                                    const newGoals = selection.customGoals.filter(g => g.id !== goal.id);
                                                    setSelection({ ...selection, customGoals: newGoals });
                                                }}
                                                className="text-muted-foreground hover:text-red-400"
                                            >
                                                ×
                                            </button>
                                        </motion.div>
                                    ))}
                                    {selection.customGoals.length === 0 && (
                                        <p className="text-center text-muted-foreground py-4">
                                            아직 추가된 목표가 없습니다.
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {step === "quiz" && quiz.length > 0 && (
                    <motion.div
                        key="quiz"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <Card className="glass-card border-none">
                            <CardHeader>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-yellow-500" />
                                        강점/약점 진단 테스트
                                    </span>
                                    <span className="text-sm font-medium text-primary">{currentQuestionIndex + 1} / {quiz.length}</span>
                                </div>
                                <CardTitle className="text-2xl leading-relaxed">{quiz[currentQuestionIndex].question}</CardTitle>
                                <div className="h-2 w-full bg-white/10 rounded-full mt-4 overflow-hidden">
                                    <motion.div
                                        className="h-full bg-primary"
                                        initial={{ width: `${(currentQuestionIndex / quiz.length) * 100}%` }}
                                        animate={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {quiz[currentQuestionIndex].options.map((option, index) => (
                                    <motion.button
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.1)" }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleQuizAnswer(index)}
                                        className={cn(
                                            "w-full p-5 rounded-xl border text-left transition-all hover:border-primary/50",
                                            answers[currentQuestionIndex] === index
                                                ? "bg-primary/20 border-primary text-primary"
                                                : "bg-white/5 border-white/10"
                                        )}
                                    >
                                        <span className="font-medium">{option}</span>
                                        {answers[currentQuestionIndex] === index && <Check className="w-5 h-5 float-right" />}
                                    </motion.button>
                                ))}

                                <div className="flex justify-between mt-8 pt-4 border-t border-white/10">
                                    <Button
                                        variant="ghost"
                                        onClick={handlePrevQuestion}
                                        disabled={currentQuestionIndex === 0}
                                        className="text-muted-foreground hover:text-white"
                                    >
                                        이전
                                    </Button>
                                    <Button
                                        onClick={handleNextQuestion}
                                        disabled={answers[currentQuestionIndex] === undefined}
                                        className="px-8"
                                    >
                                        {currentQuestionIndex === quiz.length - 1 ? "결과 보기" : "다음"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {step === "analysis" && (
                    <motion.div
                        key="analysis"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-20"
                    >
                        <div className="relative w-40 h-40 mx-auto mb-10">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 rounded-full bg-primary/30 blur-xl"
                            />
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30"
                            />
                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-2 rounded-full border-2 border-dashed border-purple-500/30"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    <Brain className="w-16 h-16 text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
                                </motion.div>
                            </div>
                        </div>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400"
                        >
                            AI 분석 중...
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed"
                        >
                            당신의 답변을 바탕으로 <span className="text-primary font-semibold">강점과 약점</span>을 분석하고<br />
                            <span className="text-white font-semibold">최적의 커리큘럼</span>을 생성하고 있습니다.
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {step !== "analysis" && step !== "quiz" && step !== "userType" && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 flex justify-end"
                >
                    <Button
                        size="lg"
                        onClick={handleNext}
                        disabled={!canProceed() || loadingQuiz}
                        className="text-lg px-8 h-14 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                    >
                        {loadingQuiz ? (
                            <>
                                <Loader2 className="mr-2 w-5 h-5 animate-spin" /> 퀴즈 생성 중...
                            </>
                        ) : (
                            <>
                                다음으로 <ArrowRight className="ml-2 w-5 h-5" />
                            </>
                        )}
                    </Button>
                </motion.div>
            )}
        </div>
    );
}
