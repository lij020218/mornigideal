"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, Brain, Loader2, Briefcase, GraduationCap, Sparkles, Target, TrendingUp, BookOpen, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { GuideSlides } from "./GuideSlides";

type Step = "userType" | "major" | "field" | "experience" | "goal" | "interests" | "analysis" | "guide";
type UserType = "worker" | "student" | null;

const INTEREST_OPTIONS = [
    { id: "ai", label: "AI/인공지능", icon: "🤖" },
    { id: "startup", label: "스타트업/창업", icon: "🚀" },
    { id: "marketing", label: "마케팅/브랜딩", icon: "📢" },
    { id: "development", label: "개발/프로그래밍", icon: "💻" },
    { id: "design", label: "디자인/UX", icon: "🎨" },
    { id: "finance", label: "재테크/투자", icon: "💰" },
    { id: "selfdev", label: "자기계발", icon: "📚" },
    { id: "health", label: "건강/운동", icon: "💪" },
];

const EXPERIENCE_OPTIONS = [
    { value: "student", label: "학생/취준생", description: "아직 본격적인 경력이 없어요" },
    { value: "junior", label: "1-3년차", description: "이제 막 시작했어요" },
    { value: "mid", label: "4-7년차", description: "어느 정도 경험이 쌓였어요" },
    { value: "senior", label: "8년차 이상", description: "풍부한 경험이 있어요" },
];

export function OnboardingWizard() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("userType");
    const [userType, setUserType] = useState<UserType>(null);
    const [selection, setSelection] = useState({
        userType: "",
        major: "",
        field: "",
        experience: "",
        goal: "",
        interests: [] as string[],
        level: ""
    });
    const [isLoading, setIsLoading] = useState(false);
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
            setStep("experience");
        } else if (step === "experience") {
            setStep("goal");
        } else if (step === "goal") {
            setStep("interests");
        } else if (step === "interests") {
            await saveProfileAndFinish();
        }
    };

    const toggleInterest = (interestId: string) => {
        setSelection(prev => ({
            ...prev,
            interests: prev.interests.includes(interestId)
                ? prev.interests.filter(i => i !== interestId)
                : [...prev.interests, interestId]
        }));
    };

    const saveProfileAndFinish = async () => {
        setIsLoading(true);
        setStep("analysis");

        try {
            // Determine level from experience
            let level = "junior";
            if (selection.experience === "senior") level = "senior";
            else if (selection.experience === "mid") level = "mid";
            else if (selection.experience === "junior") level = "junior";
            else level = "beginner";

            const finalSelection = {
                ...selection,
                level,
                job: selection.userType === "대학생"
                    ? `${selection.major} ${selection.userType}`
                    : selection.field,
                goal: selection.goal,
            };

            // Save to localStorage first
            localStorage.setItem("user_profile", JSON.stringify(finalSelection));

            // Generate curriculum
            const response = await fetch("/api/generate-curriculum", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalSelection),
            });

            const data = await response.json();

            if (data.curriculum) {
                localStorage.setItem("user_curriculum", JSON.stringify(data.curriculum));

                // Save to Supabase
                try {
                    await fetch("/api/user/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ profile: finalSelection }),
                    });

                    await fetch("/api/user/curriculum", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            curriculum_id: data.curriculum[0]?.id || "default",
                            curriculum_data: data.curriculum
                        }),
                    });

                    console.log('Successfully saved curriculum and profile to database');
                } catch (apiError) {
                    console.error("Failed to save to database:", apiError);
                }
            }
        } catch (error) {
            console.error("Failed to generate curriculum", error);
        } finally {
            setTimeout(() => setStep("guide"), 2000);
        }
    };

    const canProceed = () => {
        if (step === "major") return selection.major.length > 0;
        if (step === "field") return selection.field.length > 0;
        if (step === "experience") return selection.experience.length > 0;
        if (step === "goal") return selection.goal.length > 0;
        if (step === "interests") return selection.interests.length > 0;
        return false;
    };

    const getProgressSteps = () => {
        if (userType === "student") {
            return ["userType", "major", "field", "experience", "goal", "interests", "guide"];
        }
        return ["userType", "field", "experience", "goal", "interests", "guide"];
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
                            animate={{ width: "3rem", opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className={cn(
                                "h-2 rounded-full transition-all duration-500",
                                i <= currentStepIndex || step === "analysis"
                                    ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                    : "bg-muted"
                            )}
                        />
                    ))}
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                    {step === "analysis" ? "SETTING UP" : `${currentStepIndex + 1} / ${progressSteps.length - 1}`}
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
                        <Card className="bg-card border border-border shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-3xl text-foreground">어떤 분이신가요?</CardTitle>
                                <CardDescription className="text-muted-foreground">당신의 상황에 맞는 맞춤형 경험을 제공해드립니다.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleUserTypeSelect("worker")}
                                    className="w-full p-6 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-all flex items-center gap-6 group"
                                >
                                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Briefcase className="w-7 h-7 text-primary" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <h3 className="font-semibold text-xl mb-1 text-foreground group-hover:text-primary transition-colors">직장인 / 취업 준비생</h3>
                                        <p className="text-sm text-muted-foreground">현재 업무 역량 향상 또는 취업을 준비하고 있어요</p>
                                    </div>
                                    <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleUserTypeSelect("student")}
                                    className="w-full p-6 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-all flex items-center gap-6 group"
                                >
                                    <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <GraduationCap className="w-7 h-7 text-purple-400" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <h3 className="font-semibold text-xl mb-1 text-foreground group-hover:text-purple-400 transition-colors">대학생</h3>
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
                        <Card className="bg-card border border-border shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-3xl text-foreground">어떤 학과에 재학 중이신가요?</CardTitle>
                                <CardDescription className="text-muted-foreground">학과명을 입력해주세요 (예: 컴퓨터공학과, 경영학과, 심리학과)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    placeholder="학과를 입력하세요..."
                                    value={selection.major}
                                    onChange={(e) => setSelection({ ...selection, major: e.target.value })}
                                    className="text-lg p-6 h-16 bg-muted border-border focus:border-primary/50 transition-all text-foreground placeholder:text-muted-foreground"
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
                        <Card className="bg-card border border-border shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-3xl text-foreground">
                                    {userType === "student" ? "관심 있는 분야는 무엇인가요?" : "어떤 분야에서 일하시나요?"}
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
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
                                    className="text-lg p-6 h-16 bg-muted border-border focus:border-primary/50 transition-all text-foreground placeholder:text-muted-foreground"
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && selection.field && handleNext()}
                                />
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {step === "experience" && (
                    <motion.div
                        key="experience"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <Card className="bg-card border border-border shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-3xl text-foreground flex items-center gap-3">
                                    <Clock className="w-8 h-8 text-primary" />
                                    경력이 어느 정도 되셨나요?
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">해당 분야에서의 경험을 선택해주세요</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {EXPERIENCE_OPTIONS.map((option, index) => (
                                    <motion.button
                                        key={option.value}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setSelection({ ...selection, experience: option.value })}
                                        className={cn(
                                            "w-full p-5 rounded-xl border text-left transition-all",
                                            selection.experience === option.value
                                                ? "bg-primary/20 border-primary"
                                                : "bg-muted/50 border-border hover:bg-muted"
                                        )}
                                    >
                                        <span className={cn(
                                            "font-semibold text-lg",
                                            selection.experience === option.value ? "text-primary" : "text-foreground"
                                        )}>{option.label}</span>
                                        <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                                    </motion.button>
                                ))}
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
                        <Card className="bg-card border border-border shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-3xl text-foreground flex items-center gap-3">
                                    <Target className="w-8 h-8 text-primary" />
                                    구체적인 목표가 있나요?
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
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
                                    className="text-lg p-6 h-16 bg-muted border-border focus:border-primary/50 transition-all text-foreground placeholder:text-muted-foreground"
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && selection.goal && handleNext()}
                                />
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {step === "interests" && (
                    <motion.div
                        key="interests"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <Card className="bg-card border border-border shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-3xl text-foreground flex items-center gap-3">
                                    <Sparkles className="w-8 h-8 text-yellow-500" />
                                    관심 있는 주제를 선택해주세요
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">여러 개 선택 가능해요. 트렌드 브리핑과 추천에 반영됩니다.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-3">
                                    {INTEREST_OPTIONS.map((interest, index) => (
                                        <motion.button
                                            key={interest.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: index * 0.05 }}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => toggleInterest(interest.id)}
                                            className={cn(
                                                "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                                                selection.interests.includes(interest.id)
                                                    ? "bg-primary/20 border-primary"
                                                    : "bg-muted/50 border-border hover:bg-muted"
                                            )}
                                        >
                                            <span className="text-2xl">{interest.icon}</span>
                                            <span className={cn(
                                                "font-medium",
                                                selection.interests.includes(interest.id) ? "text-primary" : "text-foreground"
                                            )}>{interest.label}</span>
                                        </motion.button>
                                    ))}
                                </div>
                                {selection.interests.length > 0 && (
                                    <p className="text-sm text-muted-foreground mt-4 text-center">
                                        {selection.interests.length}개 선택됨
                                    </p>
                                )}
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
                            설정 중...
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed"
                        >
                            당신의 정보를 바탕으로<br />
                            <span className="text-foreground font-semibold">맞춤형 경험</span>을 준비하고 있습니다.
                        </motion.p>
                    </motion.div>
                )}

                {step === "guide" && (
                    <GuideSlides onComplete={() => router.push("/dashboard")} />
                )}
            </AnimatePresence>

            {step !== "analysis" && step !== "userType" && step !== "guide" && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 flex justify-end"
                >
                    <Button
                        size="lg"
                        onClick={handleNext}
                        disabled={!canProceed() || isLoading}
                        className="text-lg px-8 h-14 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 w-5 h-5 animate-spin" /> 설정 중...
                            </>
                        ) : step === "interests" ? (
                            <>
                                완료 <Sparkles className="ml-2 w-5 h-5" />
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
