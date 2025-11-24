"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Bell, CheckCircle2, Clock, Loader2, RefreshCw, Target, ArrowRight, User, Settings, Sun, BookOpen, Circle, Moon, Briefcase, Coffee, Edit3, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getDailyGoals, saveDailyGoals, markLearningComplete } from "@/lib/dailyGoals";
import { motion, AnimatePresence } from "framer-motion";
import { SchedulePopup, type CustomGoal } from "./SchedulePopup";
import { ScheduleNotificationManager } from "./ScheduleNotificationManager";
import { NotificationDropdown } from "./NotificationDropdown";
import { requestNotificationPermission, getTodayCompletions } from "@/lib/scheduleNotifications";
import { TrendBriefingSection } from "./TrendBriefingSection";
import { TrendBriefingDetail } from "./TrendBriefingDetail";

interface DashboardProps {
    username: string;
}

interface UserProfile {
    job: string;
    goal: string;
    level: string;
    schedule?: {
        wakeUp: string;
        workStart: string;
        workEnd: string;
        sleep: string;
    };
    customGoals?: CustomGoal[];
    interests?: string[];
}

interface CurriculumItem {
    title: string;
    subtitle: string;
    icon: string;
}

interface DailyGoals {
    wakeUp: boolean;
    learning: number;
    exercise: boolean;
    trendBriefing: number;
    customGoals: Record<string, boolean>;
}

interface UserSettings {
    wakeUpTime: string;
    exerciseEnabled: boolean;
}

export function Dashboard({ username }: DashboardProps) {

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showSchedulePopup, setShowSchedulePopup] = useState(false);
    const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [curriculum, setCurriculum] = useState<CurriculumItem[]>([]);
    const [generatingCurriculum, setGeneratingCurriculum] = useState(false);
    const [dailyGoals, setDailyGoals] = useState<DailyGoals>({
        wakeUp: false,
        learning: 0,
        exercise: false,
        trendBriefing: 0,
        customGoals: {}
    });
    const [userSettings, setUserSettings] = useState<UserSettings>({
        wakeUpTime: "07:00",
        exerciseEnabled: false,
    });
    const [completedLearning, setCompletedLearning] = useState<Set<string>>(new Set());
    const [readBriefings, setReadBriefings] = useState<Set<string>>(new Set());
    const [currentTime, setCurrentTime] = useState(new Date());
    const [curriculumProgress, setCurriculumProgress] = useState<Record<number, { completed: number; total: number }>>({});
    const [selectedBriefing, setSelectedBriefing] = useState<any>(null);
    const [showBriefingDetail, setShowBriefingDetail] = useState(false);

    const getCurriculumProgress = (curriculumId: number) => {
        const progressKey = `curriculum_progress_${curriculumId}`;
        const savedProgress = localStorage.getItem(progressKey);
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            return {
                completed: progress.completedDays?.length || 0,
                total: progress.totalDays || 12
            };
        }
        return { completed: 0, total: 12 };
    };

    const updateDailyGoal = (key: keyof DailyGoals, value: any) => {
        const newGoals = { ...dailyGoals, [key]: value };
        setDailyGoals(newGoals);
        saveDailyGoals(newGoals);
    };

    const toggleCustomGoal = (goalId: string) => {
        const newCustomGoals = {
            ...dailyGoals.customGoals,
            [goalId]: !dailyGoals.customGoals?.[goalId]
        };
        updateDailyGoal("customGoals", newCustomGoals);
    };

    const handleLearningComplete = (learningId: string) => {
        if (completedLearning.has(learningId)) return;

        const wasNew = markLearningComplete(learningId);
        if (wasNew) {
            setCompletedLearning(prev => new Set([...prev, learningId]));
            setDailyGoals(getDailyGoals());
        }
    };

    const handleGenerateCurriculum = async () => {
        if (!userProfile) {
            window.location.href = "/onboarding";
            return;
        }

        setGeneratingCurriculum(true);
        try {
            const response = await fetch("/api/generate-curriculum", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    job: userProfile.job,
                    goal: userProfile.goal,
                    level: userProfile.level,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setCurriculum(data.curriculum);
                localStorage.setItem("user_curriculum", JSON.stringify(data.curriculum));
            } else {
                alert("커리큘럼 생성에 실패했습니다. 다시 시도해주세요.");
            }
        } catch (error) {
            console.error("Error generating curriculum:", error);
            alert("커리큘럼 생성 중 오류가 발생했습니다.");
        } finally {
            setGeneratingCurriculum(false);
        }
    };

    const handleAddInterest = (interest: string) => {
        if (!userProfile) return;
        const currentInterests = userProfile.interests || [];
        if (currentInterests.includes(interest)) return;

        const updatedProfile = {
            ...userProfile,
            interests: [...currentInterests, interest]
        };

        setUserProfile(updatedProfile);
        localStorage.setItem("user_profile", JSON.stringify(updatedProfile));
    };

    const handleRemoveInterest = (interest: string) => {
        if (!userProfile) return;
        const currentInterests = userProfile.interests || [];

        const updatedProfile = {
            ...userProfile,
            interests: currentInterests.filter(i => i !== interest)
        };

        setUserProfile(updatedProfile);
        localStorage.setItem("user_profile", JSON.stringify(updatedProfile));
    };

    const handleSaveSchedule = (newSchedule: any, newCustomGoals: any) => {
        console.log('Saving schedule:', newSchedule);
        console.log('Saving custom goals:', newCustomGoals);

        let updatedProfile: UserProfile;

        if (userProfile) {
            updatedProfile = {
                ...userProfile,
                schedule: newSchedule,
                customGoals: newCustomGoals
            };
        } else {
            // If userProfile is null, we need to load it from localStorage or create a minimal one
            const savedProfile = localStorage.getItem('user_profile');
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                updatedProfile = {
                    ...parsed,
                    schedule: newSchedule,
                    customGoals: newCustomGoals
                } as UserProfile;
            } else {
                // Create a minimal profile - this shouldn't happen in normal flow
                updatedProfile = {
                    job: "",
                    goal: "",
                    level: "", schedule: newSchedule,
                    customGoals: newCustomGoals
                } as UserProfile;
            }
        }

        setUserProfile(updatedProfile);
        localStorage.setItem("user_profile", JSON.stringify(updatedProfile));

        console.log('Updated profile:', updatedProfile);

        if (newSchedule.wakeUp !== userSettings.wakeUpTime) {
            const newSettings = { ...userSettings, wakeUpTime: newSchedule.wakeUp };
            setUserSettings(newSettings);
            localStorage.setItem("user_settings", JSON.stringify(newSettings));
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (curriculum.length > 0) {
            const progressData: Record<number, { completed: number; total: number }> = {};
            curriculum.forEach((_, index) => {
                progressData[index] = getCurriculumProgress(index);
            });
            setCurriculumProgress(progressData);
        }
    }, [completedLearning, curriculum.length]);

    useEffect(() => {
        const loadProfile = async () => {
            console.log('===== Dashboard useEffect: Loading profile =====');

            // First try localStorage
            const savedProfile = localStorage.getItem("user_profile");

            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                console.log('Loaded user_profile from localStorage:', parsed);
                setUserProfile(parsed);
            } else {
                // If not in localStorage, try fetching from Supabase
                console.log('No localStorage profile, fetching from database...');
                try {
                    const response = await fetch("/api/user/profile");
                    if (response.ok) {
                        const data = await response.json();
                        if (data.profile) {
                            console.log('Loaded profile from database:', data.profile);
                            // Preserve any existing interests from localStorage
                            const existingProfile = localStorage.getItem("user_profile");
                            let mergedProfile = data.profile;
                            if (existingProfile) {
                                const existing = JSON.parse(existingProfile);
                                mergedProfile = {
                                    ...data.profile,
                                    interests: existing.interests || data.profile.interests || [],
                                    customGoals: existing.customGoals || data.profile.customGoals || []
                                };
                            }
                            setUserProfile(mergedProfile);
                            localStorage.setItem("user_profile", JSON.stringify(mergedProfile));
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch profile from database:', error);
                }
            }

            // Load curriculum from API (with localStorage fallback)
            const savedCurriculum = localStorage.getItem("user_curriculum");
            if (savedCurriculum) {
                setCurriculum(JSON.parse(savedCurriculum));
            }

            try {
                const curriculumResponse = await fetch("/api/user/curriculum");
                if (curriculumResponse.ok) {
                    const curriculumData = await curriculumResponse.json();
                    if (curriculumData.curriculums && curriculumData.curriculums.length > 0) {
                        // Extract curriculum_data from first curriculum
                        const latestCurriculum = curriculumData.curriculums[0];
                        if (latestCurriculum.curriculum_data) {
                            console.log('Loaded curriculum from API:', latestCurriculum.curriculum_data);
                            setCurriculum(latestCurriculum.curriculum_data);
                            localStorage.setItem("user_curriculum", JSON.stringify(latestCurriculum.curriculum_data));
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch curriculum from API:', error);
            }

            const savedSettings = localStorage.getItem("user_settings");
            if (savedSettings) {
                setUserSettings(JSON.parse(savedSettings));
            }

            setDailyGoals(getDailyGoals());


            // Request notification permission
            requestNotificationPermission();
        };

        loadProfile();
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                stiffness: 100
            }
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-10 min-h-screen bg-background/50 backdrop-blur-sm">
            <ScheduleNotificationManager goals={userProfile?.customGoals || []} />

            {/* Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 pb-1">
                        Good {currentTime.getHours() < 12 ? "Morning" : currentTime.getHours() < 18 ? "Afternoon" : "Evening"}, {username}
                    </h1>
                    <p className="text-muted-foreground mt-1">오늘도 성장을 위한 하루가 시작되었습니다.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="relative">
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full glass hover:bg-white/10 transition-colors"
                            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                        >
                            <Bell className="w-5 h-5" />
                            {/* Notification badge */}
                            {(userProfile?.schedule || (userProfile?.customGoals && userProfile.customGoals.some(g =>
                                g.daysOfWeek?.includes(new Date().getDay()) && g.notificationEnabled
                            ))) && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background" />
                                )}
                        </Button>
                        {userProfile && (
                            <NotificationDropdown
                                goals={[
                                    // Add basic schedule as custom goals for notifications
                                    ...(userProfile.schedule ? [
                                        {
                                            id: 'wake-up',
                                            text: '기상',
                                            time: 'morning' as const,
                                            startTime: userProfile.schedule.wakeUp,
                                            endTime: userProfile.schedule.wakeUp,
                                            color: 'yellow',
                                            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                                            notificationEnabled: true,
                                        },
                                        {
                                            id: 'work-start',
                                            text: '업무 시작',
                                            time: 'morning' as const,
                                            startTime: userProfile.schedule.workStart,
                                            endTime: userProfile.schedule.workStart,
                                            color: 'purple',
                                            daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
                                            notificationEnabled: true,
                                        },
                                        {
                                            id: 'work-end',
                                            text: '업무 종료',
                                            time: 'evening' as const,
                                            startTime: userProfile.schedule.workEnd,
                                            endTime: userProfile.schedule.workEnd,
                                            color: 'green',
                                            daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
                                            notificationEnabled: true,
                                        },
                                        {
                                            id: 'sleep',
                                            text: '취침',
                                            time: 'evening' as const,
                                            startTime: userProfile.schedule.sleep,
                                            endTime: userProfile.schedule.sleep,
                                            color: 'blue',
                                            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                                            notificationEnabled: true,
                                        },
                                    ] : []),
                                    // Add custom goals
                                    ...(userProfile.customGoals || []),
                                ]}
                                isOpen={showNotificationDropdown}
                                onClose={() => setShowNotificationDropdown(false)}
                            />
                        )}
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all shadow-lg shadow-primary/20"
                        />
                        <AnimatePresence>
                            {showProfileMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowProfileMenu(false)}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        className="absolute right-0 top-12 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 py-2 backdrop-blur-xl"
                                    >
                                        <div className="px-4 py-3 border-b border-white/5 mb-2">
                                            <p className="text-sm font-medium text-white">{username}</p>
                                            <p className="text-xs text-muted-foreground truncate">{userProfile?.job || "User"}</p>
                                        </div>
                                        <Link
                                            href="/mypage"
                                            className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-white/5 transition-colors text-gray-300 hover:text-white"
                                            onClick={() => setShowProfileMenu(false)}
                                        >
                                            <User className="w-4 h-4" />
                                            마이페이지
                                        </Link>
                                        <Link
                                            href="/settings"
                                            className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-white/5 transition-colors text-gray-300 hover:text-white"
                                            onClick={() => setShowProfileMenu(false)}
                                        >
                                            <Settings className="w-4 h-4" />
                                            설정
                                        </Link>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header >

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-10"
            >
                {/* 1. Daily Flow Section */}
                <motion.section variants={itemVariants} className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                            <Clock className="w-6 h-6 text-primary" /> Daily Flow
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-white gap-2"
                            onClick={() => setShowSchedulePopup(true)}
                        >
                            <Edit3 className="w-4 h-4" /> <span className="hidden md:inline">일정 관리</span>
                        </Button>
                    </div>

                    {/* Mobile Layout: Goals -> Timeline -> Insights */}
                    <div className="flex flex-col gap-4 md:hidden">
                        {/* 1. Goals (Mobile) */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Wake Up Goal */}
                            <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => updateDailyGoal("wakeUp", !dailyGoals.wakeUp)}
                                className={cn(
                                    "p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all",
                                    dailyGoals.wakeUp
                                        ? "bg-green-500/10 border-green-500/30"
                                        : "bg-white/5 border-white/10"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center",
                                    dailyGoals.wakeUp ? "bg-green-500 text-black" : "bg-white/10 text-muted-foreground"
                                )}>
                                    <Sun className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">기상</p>
                                    <p className="text-xs text-muted-foreground">{userSettings.wakeUpTime}</p>
                                </div>
                            </motion.button>

                            {/* Learning Goal */}
                            <div className={cn(
                                "p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center",
                                dailyGoals.learning >= 2
                                    ? "bg-purple-500/10 border-purple-500/30"
                                    : "bg-white/5 border-white/10"
                            )}>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center",
                                    dailyGoals.learning >= 2 ? "bg-purple-500 text-white" : "bg-purple-500/20 text-purple-400"
                                )}>
                                    <BookOpen className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">학습 ({dailyGoals.learning}/2)</p>
                                    <div className="mt-1 h-1.5 w-16 bg-white/10 rounded-full overflow-hidden mx-auto">
                                        <motion.div
                                            className="h-full bg-purple-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min((dailyGoals.learning / 2) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Trend Briefing Goal */}
                            <div className={cn(
                                "p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center",
                                dailyGoals.trendBriefing >= 6
                                    ? "bg-blue-500/10 border-blue-500/30"
                                    : "bg-white/5 border-white/10"
                            )}>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center",
                                    dailyGoals.trendBriefing >= 6 ? "bg-blue-500 text-white" : "bg-blue-500/20 text-blue-400"
                                )}>
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">브리핑 ({dailyGoals.trendBriefing}/6)</p>
                                    <div className="mt-1 h-1.5 w-16 bg-white/10 rounded-full overflow-hidden mx-auto">
                                        <motion.div
                                            className="h-full bg-blue-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min((dailyGoals.trendBriefing / 6) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Schedule Change Button (Mobile) */}
                            <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowSchedulePopup(true)}
                                className="p-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors flex flex-col items-center justify-center gap-2"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                    <Edit3 className="w-4 h-4 text-primary" />
                                </div>
                                <p className="font-semibold text-sm text-primary">일정 변경</p>
                            </motion.button>
                        </div>

                        {/* 2. Timeline (Mobile - Horizontal) */}
                        <Card className="glass-card border-none overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold flex items-center gap-2 text-sm">
                                        <Sparkles className="w-4 h-4 text-yellow-500" /> 나의 하루 리듬
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-muted-foreground hover:text-white gap-1.5 px-2"
                                        onClick={() => setShowSchedulePopup(true)}
                                    >
                                        <Edit3 className="w-3.5 h-3.5" /> 일정 관리
                                    </Button>
                                </div>
                                <DailyRhythmTimeline
                                    schedule={userProfile?.schedule}
                                    customGoals={userProfile?.customGoals}
                                    dailyGoals={dailyGoals}
                                    toggleCustomGoal={toggleCustomGoal}
                                    isMobile={true}
                                />
                            </CardContent>
                        </Card>

                        {/* 3. Insights (Mobile) */}
                        <div className="h-40">
                            <PeerInsightsCard
                                job={userProfile?.job || "마케터"}
                                level={userProfile?.level || "중급"}
                            />
                        </div>
                    </div>

                    {/* Desktop Layout: Original Grid */}
                    <Card className="glass-card border-none overflow-hidden relative hidden md:block">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-50" />
                        <CardContent className="p-6 relative">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Left: Timeline (5 cols) */}
                                <div className="lg:col-span-5 border-r border-white/10 pr-8">
                                    <h3 className="text-base font-semibold mb-6 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-yellow-500" /> 나의 하루 리듬
                                    </h3>
                                    <DailyRhythmTimeline
                                        schedule={userProfile?.schedule}
                                        customGoals={userProfile?.customGoals}
                                        dailyGoals={dailyGoals}
                                        toggleCustomGoal={toggleCustomGoal}
                                    />
                                </div>

                                {/* Right: Goals & Insights (7 cols) */}
                                <div className="lg:col-span-7 flex flex-col gap-3">
                                    {/* Top: Daily Goals - Takes up half */}
                                    <div className="flex-1 flex flex-col">
                                        <div className="flex justify-between items-center mb-5">
                                            <h3 className="text-lg font-bold flex items-center gap-2">
                                                <Target className="w-5 h-5 text-red-500" /> 오늘의 핵심 목표
                                            </h3>
                                            <span className="text-sm font-bold px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                                                {[dailyGoals.wakeUp, dailyGoals.learning >= 2, dailyGoals.trendBriefing >= 6].filter(v => v === true).length}/3
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                            {/* Dynamic Schedule Goal */}
                                            {(() => {
                                                // Find current or next schedule
                                                const now = new Date();
                                                const currentDay = now.getDay();
                                                const currentTimeValue = now.getHours() * 60 + now.getMinutes();

                                                const schedules = userProfile?.customGoals?.filter(g =>
                                                    g.daysOfWeek?.includes(currentDay)
                                                ) || [];

                                                // Sort by time
                                                schedules.sort((a, b) => {
                                                    const [aH, aM] = a.startTime!.split(':').map(Number);
                                                    const [bH, bM] = b.startTime!.split(':').map(Number);
                                                    return (aH * 60 + aM) - (bH * 60 + bM);
                                                });

                                                // Find active or next
                                                let targetSchedule = schedules.find(s => {
                                                    const [sH, sM] = s.startTime!.split(':').map(Number);
                                                    const [eH, eM] = s.endTime!.split(':').map(Number);
                                                    const start = sH * 60 + sM;
                                                    const end = eH * 60 + eM;
                                                    return currentTimeValue >= start && currentTimeValue < end;
                                                });

                                                if (!targetSchedule) {
                                                    targetSchedule = schedules.find(s => {
                                                        const [sH, sM] = s.startTime!.split(':').map(Number);
                                                        const start = sH * 60 + sM;
                                                        return start > currentTimeValue;
                                                    });
                                                }

                                                // Default to Wake Up if no schedule found or it's early
                                                if (!targetSchedule) {
                                                    return (
                                                        <motion.button
                                                            whileHover={{ scale: 1.01 }}
                                                            whileTap={{ scale: 0.99 }}
                                                            onClick={() => updateDailyGoal("wakeUp", !dailyGoals.wakeUp)}
                                                            className={cn(
                                                                "p-5 rounded-lg text-left transition-all border flex items-center gap-4",
                                                                dailyGoals.wakeUp
                                                                    ? "bg-green-500/10 border-green-500/30"
                                                                    : "bg-white/5 border-white/5 hover:bg-white/10"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                                                                dailyGoals.wakeUp ? "bg-green-500 text-black" : "bg-white/10 text-muted-foreground"
                                                            )}>
                                                                <Sun className="w-6 h-6" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-semibold text-base">기상 목표</p>
                                                                <p className="text-sm text-muted-foreground mt-0.5">{userSettings.wakeUpTime} 기상</p>
                                                            </div>
                                                            {dailyGoals.wakeUp ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-muted-foreground/50" />}
                                                        </motion.button>
                                                    );
                                                }

                                                // Render Dynamic Schedule
                                                const completionStatus = getTodayCompletions()[targetSchedule.id];
                                                const isCompleted = completionStatus?.completed === true;
                                                const [sH, sM] = targetSchedule.startTime!.split(':').map(Number);
                                                const startVal = sH * 60 + sM;
                                                const isActive = !isCompleted && currentTimeValue >= startVal && currentTimeValue < (parseInt(targetSchedule.endTime!.split(':')[0]) * 60 + parseInt(targetSchedule.endTime!.split(':')[1]));

                                                return (
                                                    <motion.div
                                                        whileHover={{ scale: 1.01 }}
                                                        className={cn(
                                                            "p-5 rounded-lg text-left transition-all border flex items-center gap-4 relative overflow-hidden",
                                                            isCompleted
                                                                ? "bg-green-500/10 border-green-500/30"
                                                                : isActive
                                                                    ? "bg-gradient-to-br from-primary/20 to-purple-500/20 border-primary/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                                                                    : "bg-white/5 border-white/5"
                                                        )}
                                                    >
                                                        {isCompleted && (
                                                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-[10px] text-green-400 font-bold">
                                                                완료
                                                            </div>
                                                        )}
                                                        {isActive && !isCompleted && (
                                                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[10px] text-primary font-bold animate-pulse">
                                                                NOW
                                                            </div>
                                                        )}

                                                        <div className={cn(
                                                            "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                                                            isCompleted
                                                                ? "bg-green-500 text-white shadow-lg"
                                                                : isActive
                                                                    ? "bg-primary text-white shadow-lg"
                                                                    : "bg-white/10 text-muted-foreground"
                                                        )}>
                                                            {isCompleted ? (
                                                                <CheckCircle2 className="w-6 h-6" />
                                                            ) : (
                                                                <Clock className={cn("w-6 h-6", isActive && "animate-pulse")} />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={cn(
                                                                "font-semibold text-base",
                                                                isCompleted ? "text-green-400" : isActive && "text-primary"
                                                            )}>
                                                                {targetSchedule.text}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                                                                {targetSchedule.startTime} - {targetSchedule.endTime}
                                                            </p>
                                                        </div>
                                                        {isCompleted && <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />}
                                                    </motion.div>
                                                );
                                            })()}

                                            {/* Learning Goal */}
                                            <div className={cn(
                                                "p-5 rounded-lg border flex items-center gap-4",
                                                dailyGoals.learning >= 2
                                                    ? "bg-purple-500/10 border-purple-500/30"
                                                    : "bg-white/5 border-white/5"
                                            )}>
                                                <div className={cn(
                                                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                                                    dailyGoals.learning >= 2 ? "bg-purple-500 text-white" : "bg-purple-500/20 text-purple-400"
                                                )}>
                                                    <BookOpen className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-base">학습 완료</p>
                                                    <div className="mt-2 h-2 w-24 bg-white/10 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full bg-purple-500"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min((dailyGoals.learning / 2) * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <span className="font-mono text-sm font-bold">{dailyGoals.learning}/2</span>
                                            </div>

                                            {/* Trend Briefing Goal */}
                                            <div className={cn(
                                                "p-5 rounded-lg border flex items-center gap-4",
                                                dailyGoals.trendBriefing >= 6
                                                    ? "bg-blue-500/10 border-blue-500/30"
                                                    : "bg-white/5 border-white/5"
                                            )}>
                                                <div className={cn(
                                                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                                                    dailyGoals.trendBriefing >= 6 ? "bg-blue-500 text-white" : "bg-blue-500/20 text-blue-400"
                                                )}>
                                                    <TrendingUp className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-base">트렌드 브리핑</p>
                                                    <div className="mt-2 h-2 w-24 bg-white/10 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full bg-blue-500"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min((dailyGoals.trendBriefing / 6) * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <span className="font-mono text-sm font-bold">{dailyGoals.trendBriefing}/6</span>
                                            </div>

                                            {/* Add Schedule Button */}
                                            <motion.button
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                                onClick={() => setShowSchedulePopup(true)}
                                                className="p-5 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center justify-center gap-4"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <Target className="w-6 h-6 text-primary" />
                                                </div>
                                                <p className="text-base font-semibold text-primary">일정 추가/변경</p>
                                            </motion.button>
                                        </div>
                                    </div>

                                    {/* Bottom: Growth Insights - Takes up half */}
                                    <div className="flex-1 flex flex-col">
                                        <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
                                            <Users className="w-5 h-5 text-purple-400" /> 성장 인사이트
                                        </h3>
                                        <div className="flex-1">
                                            <PeerInsightsCard
                                                job={userProfile?.job || "마케터"}
                                                level={userProfile?.level || "중급"}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.section>

                {/* 2. Today's Growth (Curriculum) */}
                <motion.section variants={itemVariants} className="space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-500" /> 오늘의 성장
                    </h2>

                    {/* Progress Overview Card */}
                    <Card className="glass-card border-none overflow-hidden">
                        <CardContent className="p-4 md:p-6">
                            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                                {/* Left: Circular Progress */}
                                <div className="relative w-24 h-24 md:w-32 md:h-32 shrink-0">
                                    {/* Mobile SVG */}
                                    <svg className="w-24 h-24 md:hidden transform -rotate-90">
                                        <circle
                                            cx="48"
                                            cy="48"
                                            r="42"
                                            stroke="currentColor"
                                            strokeWidth="6"
                                            fill="none"
                                            className="text-white/10"
                                        />
                                        <circle
                                            cx="48"
                                            cy="48"
                                            r="42"
                                            stroke="currentColor"
                                            strokeWidth="6"
                                            fill="none"
                                            strokeDasharray={`${2 * Math.PI * 42}`}
                                            strokeDashoffset={`${2 * Math.PI * 42 * (1 - (completedLearning.size / Math.max(curriculum.length, 1)))}`}
                                            className="text-primary transition-all duration-1000 ease-out"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    {/* Desktop SVG */}
                                    <svg className="hidden md:block w-32 h-32 transform -rotate-90">
                                        <circle
                                            cx="64"
                                            cy="64"
                                            r="56"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            fill="none"
                                            className="text-white/10"
                                        />
                                        <circle
                                            cx="64"
                                            cy="64"
                                            r="56"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            fill="none"
                                            strokeDasharray={`${2 * Math.PI * 56}`}
                                            strokeDashoffset={`${2 * Math.PI * 56 * (1 - (completedLearning.size / Math.max(curriculum.length, 1)))}`}
                                            className="text-primary transition-all duration-1000 ease-out"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl md:text-3xl font-bold">{completedLearning.size}</span>
                                        <span className="text-[10px] md:text-xs text-muted-foreground">/ {curriculum.length}</span>
                                    </div>
                                </div>

                                {/* Right: Stats Grid */}
                                <div className="flex-1 w-full grid grid-cols-2 gap-2 md:gap-4">
                                    {/* Completion Rate */}
                                    <div className="bg-gradient-to-br from-green-500/10 to-transparent p-2.5 md:p-4 rounded-lg border border-green-500/20">
                                        <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                            <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-green-500" />
                                            <span className="text-xs md:text-sm font-medium text-muted-foreground">완료율</span>
                                        </div>
                                        <div className="text-lg md:text-2xl font-bold text-green-500">
                                            {curriculum.length > 0 ? Math.round((completedLearning.size / curriculum.length) * 100) : 0}%
                                        </div>
                                    </div>

                                    {/* Total Learning */}
                                    <div className="bg-gradient-to-br from-blue-500/10 to-transparent p-2.5 md:p-4 rounded-lg border border-blue-500/20">
                                        <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                            <BookOpen className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />
                                            <span className="text-xs md:text-sm font-medium text-muted-foreground">전체 학습</span>
                                        </div>
                                        <div className="text-lg md:text-2xl font-bold text-blue-500">
                                            {curriculum.length}개
                                        </div>
                                    </div>

                                    {/* Remaining */}
                                    <div className="bg-gradient-to-br from-orange-500/10 to-transparent p-2.5 md:p-4 rounded-lg border border-orange-500/20">
                                        <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                            <Target className="w-3 h-3 md:w-4 md:h-4 text-orange-500" />
                                            <span className="text-xs md:text-sm font-medium text-muted-foreground">남은 학습</span>
                                        </div>
                                        <div className="text-lg md:text-2xl font-bold text-orange-500">
                                            {curriculum.length - completedLearning.size}개
                                        </div>
                                    </div>

                                    {/* Today's Goal */}
                                    <div className="bg-gradient-to-br from-purple-500/10 to-transparent p-2.5 md:p-4 rounded-lg border border-purple-500/20">
                                        <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                            <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-purple-500" />
                                            <span className="text-xs md:text-sm font-medium text-muted-foreground">오늘 목표</span>
                                        </div>
                                        <div className="text-lg md:text-2xl font-bold text-purple-500">
                                            {dailyGoals.learning}/2
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-4 md:mt-6">
                                <div className="flex justify-between items-center mb-1.5 md:mb-2">
                                    <span className="text-xs md:text-sm font-medium">학습 진행도</span>
                                    <span className="text-xs md:text-sm text-muted-foreground">
                                        {completedLearning.size} / {curriculum.length} 완료
                                    </span>
                                </div>
                                <div className="h-2 md:h-3 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-primary to-purple-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${curriculum.length > 0 ? (completedLearning.size / curriculum.length) * 100 : 0}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Curriculum List */}
                    <Card className="glass-card border-none">
                        <CardContent className="p-3 md:p-6">
                            {!userProfile ? (
                                <div className="text-center py-8 md:py-12 flex flex-col items-center justify-center h-full">
                                    <p className="text-sm md:text-base text-muted-foreground mb-3 md:mb-4">성장 여정을 시작하려면 온보딩을 완료해주세요.</p>
                                    <Button onClick={() => window.location.href = "/onboarding"} size="sm" className="md:h-10">
                                        <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                                        <span className="text-sm md:text-base">성장 여정 시작하기</span>
                                    </Button>
                                </div>
                            ) : curriculum.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                    {curriculum.map((item, index) => {
                                        const learningId = `curriculum_${index}_${item.title}`;
                                        const isCompleted = completedLearning.has(learningId);
                                        const progress = curriculumProgress[index] || { completed: 0, total: 12 };
                                        const completedLessons = progress.completed;
                                        const totalLessons = progress.total;
                                        const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

                                        return (
                                            <motion.div
                                                key={index}
                                                whileHover={{ y: -4, scale: 1.02 }}
                                                className={cn(
                                                    "p-3.5 md:p-5 rounded-xl border border-white/5 bg-white/5 cursor-pointer transition-all hover:bg-white/10 hover:shadow-lg hover:shadow-primary/10 flex flex-col h-full",
                                                    isCompleted && "bg-green-500/5 border-green-500/20"
                                                )}
                                                onClick={() => window.location.href = `/curriculum/${index}`}
                                            >
                                                {/* Header with icon and title */}
                                                <div className="flex items-start gap-2.5 md:gap-3 mb-3 md:mb-4">
                                                    <div className={cn(
                                                        "w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center shrink-0 transition-all",
                                                        isCompleted
                                                            ? "bg-green-500/20 text-green-500"
                                                            : "bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary"
                                                    )}>
                                                        <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn("font-semibold text-sm md:text-base mb-0.5 md:mb-1", isCompleted && "line-through text-muted-foreground")}>
                                                            {item.title}
                                                        </p>
                                                        <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2">{item.subtitle}</p>
                                                    </div>
                                                </div>

                                                {/* Progress Section */}
                                                <div className="mt-auto space-y-2 md:space-y-3">
                                                    {/* Stats Row */}
                                                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                                                        <div className="flex items-center gap-1.5 md:gap-2">
                                                            <div className={cn(
                                                                "px-1.5 md:px-2 py-0.5 md:py-1 rounded-full flex items-center gap-0.5 md:gap-1",
                                                                isCompleted
                                                                    ? "bg-green-500/20 text-green-500"
                                                                    : "bg-primary/20 text-primary"
                                                            )}>
                                                                <Target className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                                <span className="font-semibold">{progressPercent}%</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-muted-foreground">
                                                            {completedLessons}/{totalLessons} 완료
                                                        </span>
                                                    </div>

                                                    {/* Progress Bar */}
                                                    <div className="relative">
                                                        <div className="h-1.5 md:h-2 bg-white/5 rounded-full overflow-hidden">
                                                            <motion.div
                                                                className={cn(
                                                                    "h-full rounded-full",
                                                                    isCompleted
                                                                        ? "bg-gradient-to-r from-green-500 to-emerald-500"
                                                                        : "bg-gradient-to-r from-primary to-purple-500"
                                                                )}
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${progressPercent}%` }}
                                                                transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Footer */}
                                                    <div className="pt-2 md:pt-3 border-t border-white/5 flex items-center justify-between">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleLearningComplete(learningId);
                                                            }}
                                                            className={cn(
                                                                "text-[10px] md:text-xs font-medium flex items-center gap-0.5 md:gap-1 transition-colors",
                                                                isCompleted
                                                                    ? "text-green-500 hover:text-green-400"
                                                                    : "text-muted-foreground hover:text-primary"
                                                            )}
                                                        >
                                                            {isCompleted ? (
                                                                <>
                                                                    <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                                    완료됨
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Circle className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                                    진행중
                                                                </>
                                                            )}
                                                        </button>
                                                        <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                                    <p className="text-muted-foreground mb-4">아직 생성된 커리큘럼이 없습니다.</p>
                                    <Button onClick={handleGenerateCurriculum} disabled={generatingCurriculum}>
                                        {generatingCurriculum ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                                        커리큘럼 생성하기
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.section>

                {/* 3. Trend Briefing Section */}
                {userProfile && (
                    <TrendBriefingSection
                        job={userProfile.job}
                        goal={userProfile.goal}
                        interests={userProfile.interests}
                        onAddInterest={handleAddInterest}
                        onRemoveInterest={handleRemoveInterest}
                        onSelectBriefing={(briefing) => {
                            setSelectedBriefing(briefing);
                            setShowBriefingDetail(true);

                            // Increment trend briefing count if not already read
                            if (!readBriefings.has(briefing.id)) {
                                setReadBriefings(prev => new Set([...prev, briefing.id]));
                                const newCount = Math.min(dailyGoals.trendBriefing + 1, 6);
                                updateDailyGoal("trendBriefing", newCount);
                            }
                        }}
                    />
                )}

            </motion.div>

            <SchedulePopup
                isOpen={showSchedulePopup}
                onClose={() => setShowSchedulePopup(false)}
                initialSchedule={userProfile?.schedule}
                initialCustomGoals={userProfile?.customGoals}
                onSave={handleSaveSchedule}
            />

            {/* Trend Briefing Detail Modal */}
            <TrendBriefingDetail
                briefing={selectedBriefing}
                isOpen={showBriefingDetail}
                onClose={() => {
                    setShowBriefingDetail(false);
                    setSelectedBriefing(null);
                }}
                userLevel={userProfile?.level || ""}
                userJob={userProfile?.job || ""}
            />

            {/* Schedule Notification Manager */}
            {
                userProfile && (
                    <ScheduleNotificationManager
                        goals={[
                            // Add basic schedule as custom goals for notifications
                            ...(userProfile.schedule ? [
                                {
                                    id: 'wake-up',
                                    text: '기상',
                                    time: 'morning' as const,
                                    startTime: userProfile.schedule.wakeUp,
                                    endTime: userProfile.schedule.wakeUp,
                                    color: 'yellow',
                                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                                    notificationEnabled: true,
                                },
                                {
                                    id: 'work-start',
                                    text: '업무 시작',
                                    time: 'morning' as const,
                                    startTime: userProfile.schedule.workStart,
                                    endTime: userProfile.schedule.workStart,
                                    color: 'purple',
                                    daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
                                    notificationEnabled: true,
                                },
                                {
                                    id: 'work-end',
                                    text: '업무 종료',
                                    time: 'evening' as const,
                                    startTime: userProfile.schedule.workEnd,
                                    endTime: userProfile.schedule.workEnd,
                                    color: 'green',
                                    daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
                                    notificationEnabled: true,
                                },
                                {
                                    id: 'sleep',
                                    text: '취침',
                                    time: 'evening' as const,
                                    startTime: userProfile.schedule.sleep,
                                    endTime: userProfile.schedule.sleep,
                                    color: 'blue',
                                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                                    notificationEnabled: true,
                                },
                            ] : []),
                            // Add custom goals
                            ...(userProfile.customGoals || []),
                        ]}
                    />
                )
            }
        </div >
    );
}

function DailyRhythmTimeline({ schedule, customGoals, dailyGoals, toggleCustomGoal, isMobile = false }: {
    schedule?: UserProfile['schedule'];
    customGoals?: CustomGoal[];
    dailyGoals: DailyGoals;
    toggleCustomGoal: (id: string) => void;
    isMobile?: boolean;
}) {
    const [todayCompletions, setTodayCompletions] = useState<Record<string, any>>({});

    useEffect(() => {
        const updateCompletions = () => {
            setTodayCompletions(getTodayCompletions());
        };

        updateCompletions();
        const interval = setInterval(updateCompletions, 60000);
        return () => clearInterval(interval);
    }, [customGoals]);

    if (!schedule) return (
        <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-4">
            <p>일정을 설정하고 나만의 리듬을 찾아보세요.</p>
            <Button size="sm" onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="일정 추가/변경"]')?.click()}>일정 설정하기</Button>
        </div>
    );

    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeValue = currentHour * 60 + currentMinute;

    // Map activity labels to icons
    const activityIcons: Record<string, any> = {
        '기상': Sun,
        '업무 시작': Briefcase,
        '업무 종료': Briefcase,
        '취침': Moon,
        '아침 식사': Coffee,
        '점심 식사': Coffee,
        '저녁 식사': Coffee,
        '운동': Target,
        '독서': BookOpen,
        '자기계발': Target,
    };

    // Build base timeline items from schedule
    const baseTimelineItems: Array<{
        time: string;
        label: string;
        icon: any;
        color: string;
        goalId: string;
        endTime?: string;
    }> = [
            { time: schedule.wakeUp, label: "기상", icon: Sun, color: "yellow", goalId: 'wake-up' },
            { time: schedule.workStart, label: "업무 시작", icon: Briefcase, color: "purple", goalId: 'work-start' },
            { time: schedule.workEnd, label: "업무 종료", icon: Briefcase, color: "green", goalId: 'work-end' },
            { time: schedule.sleep, label: "취침", icon: Moon, color: "blue", goalId: 'sleep' },
        ];

    // Filter custom goals for today
    const todaysGoals = customGoals?.filter(goal =>
        goal.daysOfWeek?.includes(currentDayOfWeek)
    ) || [];

    // Add today's custom goals to timeline
    todaysGoals.forEach(goal => {
        if (goal.startTime) {
            const icon = activityIcons[goal.text] || Target;
            baseTimelineItems.push({
                time: goal.startTime,
                label: goal.text,
                icon: icon,
                color: goal.color || 'primary',
                goalId: goal.id,
                endTime: goal.endTime,
            });
        }
    });

    // Sort by time
    const timelineItems = baseTimelineItems.sort((a, b) => {
        const [aHour, aMin] = a.time.split(':').map(Number);
        const [bHour, bMin] = b.time.split(':').map(Number);
        return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });

    // Find active and next indices
    let activeIndex = -1;
    let nextIndex = -1;

    for (let i = 0; i < timelineItems.length; i++) {
        const item = timelineItems[i];
        const [h, m] = item.time.split(':').map(Number);
        const itemTime = h * 60 + m;

        const nextItem = timelineItems[i + 1];
        let nextTime = 24 * 60; // End of day
        if (nextItem) {
            const [nh, nm] = nextItem.time.split(':').map(Number);
            nextTime = nh * 60 + nm;
        }

        if (currentTimeValue >= itemTime && currentTimeValue < nextTime) {
            activeIndex = i;
            break;
        }

        if (currentTimeValue < itemTime && nextIndex === -1) {
            nextIndex = i;
        }
    }

    const getColorClasses = (color: string, isActive: boolean = false) => {
        const bgColors: Record<string, string> = {
            yellow: isActive ? 'bg-yellow-500' : 'bg-yellow-500/30',
            blue: isActive ? 'bg-blue-500' : 'bg-blue-500/30',
            purple: isActive ? 'bg-purple-500' : 'bg-purple-500/30',
            green: isActive ? 'bg-green-500' : 'bg-green-500/30',
            red: isActive ? 'bg-red-500' : 'bg-red-500/30',
            orange: isActive ? 'bg-orange-500' : 'bg-orange-500/30',
            pink: isActive ? 'bg-pink-500' : 'bg-pink-500/30',
            amber: isActive ? 'bg-amber-500' : 'bg-amber-500/30',
            cyan: isActive ? 'bg-cyan-500' : 'bg-cyan-500/30',
            indigo: isActive ? 'bg-indigo-500' : 'bg-indigo-500/30',
            primary: isActive ? 'bg-primary' : 'bg-primary/30',
        };

        const textColors: Record<string, string> = {
            yellow: 'text-yellow-400',
            blue: 'text-blue-400',
            purple: 'text-purple-400',
            green: 'text-green-400',
            red: 'text-red-400',
            orange: 'text-orange-400',
            pink: 'text-pink-400',
            amber: 'text-amber-400',
            cyan: 'text-cyan-400',
            indigo: 'text-indigo-400',
            primary: 'text-primary',
        };

        const borderColors: Record<string, string> = {
            yellow: 'border-yellow-500/30',
            blue: 'border-blue-500/30',
            purple: 'border-purple-500/30',
            green: 'border-green-500/30',
            red: 'border-red-500/30',
            orange: 'border-orange-500/30',
            pink: 'border-pink-500/30',
            amber: 'border-amber-500/30',
            cyan: 'border-cyan-500/30',
            indigo: 'border-indigo-500/30',
            primary: 'border-primary/30',
        };

        return {
            bg: bgColors[color] || bgColors.primary,
            text: textColors[color] || textColors.primary,
            border: borderColors[color] || borderColors.primary,
        };
    };

    return (
        <div className={cn(
            "relative",
            isMobile ? "w-full" : "pl-8 space-y-3"
        )}>
            {/* Enhanced Vertical line with gradient (Desktop only) */}
            {!isMobile && <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 via-primary/50 to-primary/30 rounded-full" />}

            {/* Mobile Horizontal Scroll Container */}
            {isMobile && (
                <div className="flex gap-3 overflow-x-auto pb-4 pt-1 scrollbar-hide snap-x snap-mandatory px-1">
                    {timelineItems.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = index === activeIndex;
                        const isUpcoming = activeIndex === -1 && index === nextIndex;
                        const isPast = index < activeIndex || (activeIndex === -1 && index < nextIndex && nextIndex !== -1);
                        const colors = getColorClasses(item.color, isActive || isUpcoming);
                        const completion = todayCompletions[item.goalId];

                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="snap-center shrink-0"
                            >
                                <div className={cn(
                                    "relative w-[140px] p-3 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3",
                                    isActive
                                        ? "bg-gradient-to-b from-white/10 to-white/5 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)] scale-105 z-10"
                                        : isUpcoming
                                            ? "bg-gradient-to-b from-primary/10 to-primary/5 border-primary/30 shadow-[0_0_15px_rgba(168,85,247,0.1)] scale-105 z-10"
                                            : isPast
                                                ? "bg-white/5 border-white/5 opacity-60 grayscale-[0.5]"
                                                : "bg-white/5 border-white/10"
                                )}>
                                    {/* Connection Line (Visual only) */}
                                    {index < timelineItems.length - 1 && (
                                        <div className="absolute top-1/2 -right-4 w-4 h-0.5 bg-white/10 z-0" />
                                    )}

                                    {/* Time Badge */}
                                    <div className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border",
                                        isActive || isUpcoming
                                            ? "bg-white/10 border-white/20 text-white"
                                            : "bg-black/20 border-white/5 text-muted-foreground"
                                    )}>
                                        {item.time}
                                    </div>

                                    {/* Icon Circle */}
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative",
                                        colors.bg,
                                        (isActive || isUpcoming) && "shadow-lg ring-2 ring-white/20"
                                    )}>
                                        <Icon className={cn("w-5 h-5", (isActive || isUpcoming) ? "text-white" : colors.text)} />
                                        {isActive && (
                                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="text-center w-full">
                                        <h4 className={cn(
                                            "font-semibold text-sm mb-0.5 truncate w-full",
                                            (isActive || isUpcoming) ? "text-white" : "text-gray-300"
                                        )}>
                                            {item.label}
                                        </h4>
                                        {isActive && (
                                            <p className="text-[10px] text-primary font-medium animate-pulse">
                                                현재 진행 중
                                            </p>
                                        )}
                                        {isUpcoming && (
                                            <p className="text-[10px] text-primary font-medium">
                                                예정됨
                                            </p>
                                        )}
                                    </div>

                                    {/* Completion status */}
                                    {completion && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className={cn(
                                                "text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5",
                                                completion.completed
                                                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                                            )}
                                        >
                                            {completion.completed ? (
                                                <>
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    완료
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    미완료
                                                </>
                                            )}
                                        </motion.span>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Desktop Vertical Layout */}
            {!isMobile && timelineItems.map((item, index) => {
                const Icon = item.icon;
                const completion = todayCompletions[item.goalId];
                const isActive = index === activeIndex;
                const isUpcoming = activeIndex === -1 && index === nextIndex;
                const isPast = index < activeIndex || (activeIndex === -1 && index < nextIndex && nextIndex !== -1);
                const colors = getColorClasses(item.color, isActive || isUpcoming);

                return (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative flex items-center gap-4 group"
                    >
                        {/* Enhanced Timeline dot with glow effect */}
                        <div className={cn(
                            "absolute -left-8 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center z-10 transition-all",
                            colors.bg,
                            (isActive || isUpcoming) && "ring-4 ring-white/20 scale-110 shadow-lg shadow-primary/50"
                        )}>
                            <div className={cn(
                                "w-2 h-2 rounded-full",
                                (isActive || isUpcoming) ? "bg-white" : "bg-background/50"
                            )} />
                        </div>

                        {/* Enhanced Content card */}
                        <div className={cn(
                            "flex-1 rounded-xl p-4 border transition-all w-full",
                            isActive
                                ? "bg-gradient-to-r from-white/10 to-white/5 border-white/20 shadow-md"
                                : isUpcoming
                                    ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30"
                                    : isPast
                                        ? "bg-white/5 border-white/5 opacity-60"
                                        : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                        )}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Icon with colored background */}
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                                        colors.bg,
                                        (isActive || isUpcoming) && "shadow-lg"
                                    )}>
                                        <Icon className={cn("w-5 h-5", (isActive || isUpcoming) ? "text-white" : colors.text)} />
                                    </div>

                                    <div>
                                        <h4 className={cn(
                                            "font-semibold text-base",
                                            (isActive || isUpcoming) && "text-white"
                                        )}>
                                            {item.label}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className={cn(
                                                "text-sm font-mono",
                                                (isActive || isUpcoming) ? "text-white/70" : "text-muted-foreground"
                                            )}>
                                                {item.time}
                                                {item.endTime && ` - ${item.endTime}`}
                                            </p>
                                            {isActive && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                                                    진행 중
                                                </span>
                                            )}
                                            {isUpcoming && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                                                    예정됨
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Completion status */}
                                {completion && (
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className={cn(
                                            "text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5",
                                            completion.completed
                                                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                                        )}
                                    >
                                        {completion.completed ? (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                완료
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="w-3.5 h-3.5" />
                                                미완료
                                            </>
                                        )}
                                    </motion.span>
                                )}
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}

interface Achievement {
    person: string;
    achievement: string;
}

function PeerInsightsCard({ job, level }: { job: string; level: string }) {
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchAchievements = async () => {
            const cacheKey = `peer_achievements_${job}_${level}`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                try {
                    const { achievements: cachedAchievements, timestamp } = JSON.parse(cached);
                    const twoHoursInMs = 2 * 60 * 60 * 1000;

                    if (Date.now() - timestamp < twoHoursInMs) {
                        setAchievements(cachedAchievements);
                        setCurrentIndex(0);
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    // Invalid cache, continue to fetch
                }
            }

            try {
                const response = await fetch("/api/peer-insights", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ job, level })
                });

                if (!response.ok) throw new Error("Failed to fetch achievements");

                const data = await response.json();
                setAchievements(data.achievements);
                setCurrentIndex(0);

                localStorage.setItem(cacheKey, JSON.stringify({
                    achievements: data.achievements,
                    timestamp: Date.now()
                }));

                setLoading(false);
            } catch (err) {
                console.error("Error fetching peer achievements:", err);
                setError(true);
                setLoading(false);
                setAchievements([
                    { person: `성공하는 ${job}`, achievement: "체계적인 학습과 노력으로 목표를 달성하고 있습니다" },
                    { person: "동료 전문가", achievement: "지속적인 자기계발로 전문성을 강화하고 있습니다" },
                    { person: "업계 리더", achievement: "혁신적인 시도로 영향력을 확대하고 있습니다" }
                ]);
            }
        };

        fetchAchievements();
    }, [job, level]);

    // Auto-rotate every 10 seconds
    useEffect(() => {
        if (achievements.length === 0) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % achievements.length);
        }, 20000);  // 20 seconds

        return () => clearInterval(interval);
    }, [achievements.length]);

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-lg p-6 md:p-8 border border-purple-500/20 flex items-center gap-4 md:gap-6 animate-pulse h-full">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-purple-500/10" />
                <div className="flex-1 space-y-3">
                    <div className="h-5 bg-white/5 rounded w-1/3" />
                    <div className="h-4 bg-white/5 rounded w-full" />
                    <div className="h-4 bg-white/5 rounded w-4/5" />
                </div>
            </div>
        );
    }

    if (achievements.length === 0) {
        return (
            <div className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-lg p-6 md:p-8 border border-purple-500/20 flex items-center gap-4 md:gap-6 h-full">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 md:w-8 md:h-8 text-purple-400" />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold mb-2 text-base">동료들의 인사이트</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        성장 데이터를 불러오는 중...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-lg p-4 md:p-6 border border-purple-500/20 h-full flex flex-col relative overflow-hidden group">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <div className="flex items-start gap-4 md:gap-5 flex-1 min-w-0 z-10">
                <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                    <Users className="w-5 h-5 md:w-7 md:h-7 text-purple-400" />
                </div>

                <div className="flex-1 min-w-0 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-1">
                        <div>
                            <h4 className="font-bold text-sm md:text-base text-white/90">동료들의 인사이트</h4>
                            <p className="text-xs md:text-sm text-purple-400 font-medium truncate">
                                {achievements[currentIndex].person}
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative">
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={currentIndex}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="text-muted-foreground text-xs md:text-sm leading-relaxed"
                            >
                                {achievements[currentIndex].achievement}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Progress indicator - Always visible at bottom */}
            <div className="flex gap-1.5 mt-3 justify-center z-10 shrink-0">
                {achievements.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={cn(
                            "h-1 rounded-full transition-all duration-300",
                            idx === currentIndex
                                ? "bg-purple-500 w-6 md:w-8 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                                : "bg-white/10 w-1.5 hover:bg-white/30"
                        )}
                    />
                ))}
            </div>
        </div>
    );
}
