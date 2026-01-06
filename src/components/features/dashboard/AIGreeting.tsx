"use client";

import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Target, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIGreetingProps {
    username: string;
    currentTime: Date;
    userProfile: {
        job: string;
        goal: string;
        level: string;
    } | null;
    habitInsights?: {
        insight: string;
        suggestion: string;
        emoji: string;
        category: string;
    };
}

export function AIGreeting({ username, currentTime, userProfile, habitInsights }: AIGreetingProps) {
    const hour = currentTime.getHours();

    const getTimeBasedGreeting = () => {
        if (hour >= 5 && hour < 12) return { text: "상쾌한 아침입니다", emoji: "☀️", gradient: "from-amber-500/20 to-orange-500/20" };
        if (hour >= 12 && hour < 15) return { text: "집중력이 최고조인 시간", emoji: "🚀", gradient: "from-blue-500/20 to-cyan-500/20" };
        if (hour >= 15 && hour < 18) return { text: "오후의 마지막 스퍼트", emoji: "💪", gradient: "from-purple-500/20 to-pink-500/20" };
        if (hour >= 18 && hour < 20) return { text: "저녁 성장 시간", emoji: "🔥", gradient: "from-orange-500/20 to-red-500/20" };
        if (hour >= 20 && hour < 22) return { text: "오늘을 정리하는 시간", emoji: "🌙", gradient: "from-indigo-500/20 to-purple-500/20" };
        return { text: "충분한 휴식이 필요해요", emoji: "😴", gradient: "from-slate-500/20 to-gray-500/20" };
    };

    const greeting = getTimeBasedGreeting();

    const getMotivationalMessage = () => {
        if (!userProfile) return "프로필을 설정하고 맞춤형 성장 계획을 받아보세요";

        const { job, goal } = userProfile;

        if (hour >= 5 && hour < 12) {
            return `${goal || "목표"}를 향한 하루를 시작해보세요`;
        }
        if (hour >= 12 && hour < 18) {
            return `${job}로서 한 걸음 더 성장하는 중입니다`;
        }
        if (hour >= 18 && hour < 22) {
            return "오늘 하루도 성장에 한 걸음 더 가까워졌어요";
        }
        return "내일의 성장을 위해 충분한 휴식을 취하세요";
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden"
        >
            {/* Main Greeting Card */}
            <div className={cn(
                "relative rounded-2xl border border-white/10 p-8 bg-gradient-to-br backdrop-blur-sm",
                greeting.gradient
            )}>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />

                <div className="relative z-10 space-y-6">
                    {/* Primary Greeting */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0]
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    repeatDelay: 5
                                }}
                                className="text-4xl"
                            >
                                {greeting.emoji}
                            </motion.div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                                    {hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"}, {username}
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {greeting.text}
                                </p>
                            </div>
                        </div>

                        <p className="text-lg text-foreground/90 font-medium pl-14">
                            {getMotivationalMessage()}
                        </p>
                    </div>

                    {/* AI Insights Section */}
                    {habitInsights && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                            {/* Habit Insight */}
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-purple-500/15 to-blue-500/15 border border-purple-500/30">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-2xl shrink-0">
                                    {habitInsights.emoji}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-purple-300 font-bold mb-1 uppercase tracking-wider">AI Insight</p>
                                    <p className="font-semibold text-sm text-white leading-snug">
                                        {habitInsights.insight}
                                    </p>
                                </div>
                            </div>

                            {/* AI Suggestion */}
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/15 border border-blue-500/30">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-5 h-5 text-blue-300" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-blue-300 font-bold mb-1 uppercase tracking-wider">Suggestion</p>
                                    <p className="text-sm text-white/90 leading-snug">
                                        {habitInsights.suggestion}
                                    </p>
                                </div>
                            </div>

                            {/* User Goal */}
                            {userProfile?.goal && (
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/30">
                                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                                        <Target className="w-5 h-5 text-amber-300" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-amber-300 font-bold mb-1 uppercase tracking-wider">My Goal</p>
                                        <p className="text-sm text-white/90 leading-snug font-medium">
                                            {userProfile.goal}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
