"use client";

import { motion } from "framer-motion";
import { Sparkles, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { WeatherDisplay } from "./WeatherDisplay";

interface AIGreetingProps {
    username: string;
    currentTime: Date;
    userProfile: {
        job: string;
        goal: string;
        level: string;
        schedule?: {
            wakeUp: string;
            workStart: string;
            workEnd: string;
            sleep: string;
        };
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
    const minute = currentTime.getMinutes();
    const currentMinutes = hour * 60 + minute; // Total minutes since midnight

    // Helper to convert "HH:MM" to minutes
    const timeToMinutes = (time: string): number => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const getScheduleAwareGreeting = () => {
        const schedule = userProfile?.schedule;
        const dayOfWeek = currentTime.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Default time-based greeting if no schedule
        if (!schedule) {
            return getDefaultGreeting();
        }

        const wakeUpMins = timeToMinutes(schedule.wakeUp);
        const workStartMins = timeToMinutes(schedule.workStart);
        const workEndMins = timeToMinutes(schedule.workEnd);
        const sleepMins = timeToMinutes(schedule.sleep);

        // Calculate time until next event
        const minsUntilWorkStart = workStartMins - currentMinutes;
        const minsUntilWorkEnd = workEndMins - currentMinutes;
        const minsUntilSleep = sleepMins - currentMinutes;

        // Early morning - just woke up (within 30 mins of wake up)
        if (currentMinutes >= wakeUpMins && currentMinutes < wakeUpMins + 30) {
            return {
                period: "Morning",
                korean: "좋은 아침이에요! 오늘의 첫 걸음을 시작해볼까요? ☀️",
                context: "wakeup"
            };
        }

        // Before work - preparing
        if (currentMinutes >= wakeUpMins + 30 && currentMinutes < workStartMins) {
            if (minsUntilWorkStart <= 30) {
                return {
                    period: "Morning",
                    korean: "곧 업무 시작! 마음의 준비를 해볼까요? 💪",
                    context: "pre-work"
                };
            }
            return {
                period: "Morning",
                korean: "여유로운 아침, 오늘 하루를 계획해보세요 ✨",
                context: "morning-prep"
            };
        }

        // During work hours
        if (currentMinutes >= workStartMins && currentMinutes < workEndMins) {
            const workProgress = (currentMinutes - workStartMins) / (workEndMins - workStartMins);

            // First hour of work
            if (workProgress < 0.15) {
                return {
                    period: "Morning",
                    korean: "업무 시작! 가장 중요한 일부터 시작하세요 🎯",
                    context: "work-start"
                };
            }

            // Morning focus time (before lunch)
            if (hour >= 10 && hour < 12) {
                return {
                    period: "Morning",
                    korean: "집중력 최고조! 지금이야말로 성장의 기회입니다 🔥",
                    context: "peak-focus"
                };
            }

            // Lunch time (12-13)
            if (hour >= 12 && hour < 13) {
                return {
                    period: "Afternoon",
                    korean: "잠시 휴식, 점심 맛있게 드세요! 🍚",
                    context: "lunch"
                };
            }

            // Post-lunch slump (13-15)
            if (hour >= 13 && hour < 15) {
                return {
                    period: "Afternoon",
                    korean: "식곤증 올 시간, 가볍게 스트레칭 어때요? 🧘",
                    context: "post-lunch"
                };
            }

            // Afternoon sprint
            if (hour >= 15 && hour < 17) {
                return {
                    period: "Afternoon",
                    korean: "마무리 스퍼트! 오늘의 목표를 달성하세요 🚀",
                    context: "afternoon-sprint"
                };
            }

            // End of work approaching (last hour)
            if (minsUntilWorkEnd <= 60 && minsUntilWorkEnd > 0) {
                return {
                    period: "Afternoon",
                    korean: "퇴근까지 조금! 오늘 할 일을 마무리해요 ✅",
                    context: "work-ending"
                };
            }

            return {
                period: "Afternoon",
                korean: "꾸준함이 실력! 지금 이 순간에 집중하세요 💫",
                context: "working"
            };
        }

        // After work - personal growth time
        if (currentMinutes >= workEndMins && currentMinutes < workEndMins + 60) {
            return {
                period: "Evening",
                korean: "수고했어요! 이제 나를 위한 시간이에요 🌟",
                context: "post-work"
            };
        }

        // Evening self-development (before 20:00)
        if (hour >= 18 && hour < 20) {
            return {
                period: "Evening",
                korean: "저녁 성장 시간! 배움에는 끝이 없어요 📚",
                context: "evening-growth"
            };
        }

        // Wind down time (20:00 - 22:00)
        if (hour >= 20 && hour < 22) {
            return {
                period: "Evening",
                korean: "하루 마무리, 오늘의 성장을 돌아보세요 🌙",
                context: "wind-down"
            };
        }

        // Before sleep
        if (minsUntilSleep > 0 && minsUntilSleep <= 60) {
            return {
                period: "Night",
                korean: "곧 취침 시간! 푹 자고 내일 또 파이팅 😴",
                context: "pre-sleep"
            };
        }

        // Late night (after sleep time or before wake up)
        if (currentMinutes >= sleepMins || currentMinutes < wakeUpMins) {
            return {
                period: "Night",
                korean: "숙면이 최고의 회복이에요. 편안한 밤 되세요 🌜",
                context: "night"
            };
        }

        return getDefaultGreeting();
    };

    const getDefaultGreeting = () => {
        // Early Morning (5-7AM)
        if (hour >= 5 && hour < 7) {
            return {
                period: "Morning",
                korean: "좋은 아침입니다! 오늘도 목표를 향해 한 걸음씩 나아가볼까요?",
                context: "default"
            };
        }

        // Morning (7-9AM)
        if (hour >= 7 && hour < 9) {
            return {
                period: "Morning",
                korean: "상쾌한 아침이에요. 오늘 가장 중요한 일부터 시작해보세요!",
                context: "default"
            };
        }

        // Late Morning (9-12PM)
        if (hour >= 9 && hour < 12) {
            return {
                period: "Morning",
                korean: "집중력이 가장 좋은 오전 시간입니다. 중요한 업무를 처리하기 딱 좋아요!",
                context: "default"
            };
        }

        // Lunch Time (12-1PM)
        if (hour >= 12 && hour < 13) {
            return {
                period: "Afternoon",
                korean: "점심 시간이에요. 잠시 휴식을 취하며 에너지를 충전하세요!",
                context: "default"
            };
        }

        // Early Afternoon (1-3PM)
        if (hour >= 13 && hour < 15) {
            return {
                period: "Afternoon",
                korean: "오후 업무를 시작해볼까요? 짧은 스트레칭으로 몸을 깨워보세요!",
                context: "default"
            };
        }

        // Late Afternoon (3-6PM)
        if (hour >= 15 && hour < 18) {
            return {
                period: "Afternoon",
                korean: "오늘 계획한 일들을 점검하고 마무리해볼 시간이에요!",
                context: "default"
            };
        }

        // Early Evening (6-8PM)
        if (hour >= 18 && hour < 20) {
            return {
                period: "Evening",
                korean: "수고하셨어요! 이제 자기계발이나 취미 활동으로 나를 위한 시간을 가져보세요",
                context: "default"
            };
        }

        // Late Evening (8-10PM)
        if (hour >= 20 && hour < 22) {
            return {
                period: "Evening",
                korean: "오늘 하루를 돌아보며 내일을 준비하는 시간입니다. 잘 하셨어요!",
                context: "default"
            };
        }

        // Night (10PM-5AM)
        return {
            period: "Night",
            korean: "충분한 휴식이 내일의 에너지가 됩니다. 편안한 밤 보내세요!",
            context: "default"
        };
    };

    const greeting = getScheduleAwareGreeting();

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-6"
        >
            {/* Minimal Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 pb-1">
                        Good {greeting.period}, <br className="md:hidden" />
                        <span className="font-light text-gray-500">{username}</span>
                    </h1>
                    <p className="text-base md:text-lg text-muted-foreground mt-2 font-medium tracking-tight">
                        {greeting.korean}
                    </p>
                </div>

                {/* Time & Weather Display - Desktop */}
                <div className="hidden md:flex items-start gap-6">
                    {/* Time */}
                    <div className="flex flex-col items-end gap-1">
                        <span className="font-mono text-3xl font-light tracking-tighter text-gray-400">
                            {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs text-gray-400 font-medium tracking-widest uppercase">Current Time</span>
                    </div>

                    {/* Weather - Next to Clock */}
                    <WeatherDisplay inline />
                </div>
            </div>

            {/* AI Insights Strip - Horizontal Scroll on Mobile */}
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide pt-2">
                {/* Weather Chip - Mobile Only */}
                <div className="md:hidden">
                    <WeatherDisplay compact />
                </div>

                {/* AI Insight Chip */}
                {habitInsights && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex-shrink-0 flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/40 backdrop-blur-md border border-white/50 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:bg-white/60 transition-all duration-300"
                    >
                        <div className="w-8 h-8 rounded-full bg-blue-100/80 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap tracking-tight">
                            {habitInsights.insight}
                        </span>
                    </motion.div>
                )}

                {/* Suggestion Chip */}
                {habitInsights?.suggestion && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex-shrink-0 flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/40 backdrop-blur-md border border-white/50 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:bg-white/60 transition-all duration-300"
                    >
                        <div className="w-8 h-8 rounded-full bg-purple-100/80 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap tracking-tight">
                            {habitInsights.suggestion}
                        </span>
                    </motion.div>
                )}

                {/* Goal Chip */}
                {userProfile?.goal && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex-shrink-0 flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/40 backdrop-blur-md border border-white/50 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:bg-white/60 transition-all duration-300"
                    >
                        <div className="w-8 h-8 rounded-full bg-amber-100/80 flex items-center justify-center">
                            <Target className="w-4 h-4 text-amber-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap max-w-[200px] truncate tracking-tight">
                            {userProfile.goal}
                        </span>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}
