"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Bell, CheckCircle2, Clock, Loader2, RefreshCw, Target, ArrowRight, User, Settings, Sun, BookOpen, Circle, Moon, Briefcase, Coffee, CalendarDays, Sparkles, XCircle, FileText, Heart, Gamepad2, Dumbbell, Film, Tv, Music, Headphones, Mic, Code, Laptop, Pen, Palette, Camera, Utensils, Home, Activity, TreePine, Rocket, Brain, BarChart3, Megaphone, FileCode, Hospital, Lightbulb, MapPin } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getDailyGoals, saveDailyGoals, markLearningComplete } from "@/lib/dailyGoals";
import { motion, AnimatePresence } from "framer-motion";
import { SchedulePopup, type CustomGoal } from "./SchedulePopup";
import { ScheduleNotificationManager } from "./ScheduleNotificationManager";
import { NotificationDropdown } from "./NotificationDropdown";
import { requestNotificationPermission, getTodayCompletions } from "@/lib/scheduleNotifications";
import { TrendBriefingSection } from "./TrendBriefingSection";
import { TrendBriefingDetail } from "./TrendBriefingDetail";
import { MaterialUploadDialog } from "./MaterialUploadDialog";
import { RecentMaterialsList } from "./RecentMaterialsList";
import { EmailSummarySection } from "./EmailSummarySection";
import { DailyBriefingPopup } from "./DailyBriefingPopup";
import { AppUsageTracker } from "./AppUsageTracker";
import { SmartInsightsWidget } from "./SmartInsightsWidget";
import { AIGreeting } from "./AIGreeting";
import { GoalSettingModal } from "../goals/GoalSettingModal";
import { WeeklyGoalsSummary } from "./WeeklyGoalsSummary";
import { CurrentScheduleCard } from "./CurrentScheduleCard";
import { UpcomingSchedules } from "./UpcomingSchedules";
import { SwipeableStats } from "./SwipeableStats";
import { getScheduleIcon } from "./scheduleUtils";
import { DailyRhythmTimeline } from "./DailyRhythmTimeline";
import { PeerInsightsCard } from "./PeerInsightsCard";


interface DashboardProps {
    username: string;
    initialProfile: UserProfile | null;
    initialMaterials: any[] | null;
    initialCurriculum: CurriculumInput[] | null;
    initialTrendBriefing: any | null;
    initialHabitInsights?: any | null;
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

type CurriculumInput =
    | CurriculumItem
    | { curriculum_data: CurriculumItem[] }
    | { curriculum: CurriculumItem[] };

const isCurriculumItem = (value: CurriculumInput): value is CurriculumItem => {
    return (
        typeof value === "object" &&
        value !== null &&
        "title" in value &&
        "subtitle" in value &&
        "icon" in value
    );
};

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

export function Dashboard({
    username,
    initialProfile,
    initialMaterials,
    initialCurriculum,
    initialTrendBriefing,
    initialHabitInsights
}: DashboardProps) {

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showSchedulePopup, setShowSchedulePopup] = useState(false);
    const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile);
    const [linkedGoalData, setLinkedGoalData] = useState<{ id: string; title: string; type: 'weekly' | 'monthly' | 'yearly' } | null>(null);
    const [completionUpdateTrigger, setCompletionUpdateTrigger] = useState(0); // Force re-render on completion change

    // Listen for schedule completion changes from other components/pages
    useEffect(() => {
        const handleCompletionChange = () => {
            setCompletionUpdateTrigger(prev => prev + 1);
        };

        window.addEventListener("schedule-completion-changed", handleCompletionChange);
        return () => {
            window.removeEventListener("schedule-completion-changed", handleCompletionChange);
        };
    }, []);

    // Process curriculum data - handle both direct array and nested curriculum property
    const processedCurriculum = useMemo<CurriculumItem[]>(() => {
        if (!initialCurriculum || initialCurriculum.length === 0) return [];

        // Check if first item has 'curriculum_data' property (from user_curriculums table)
        if (initialCurriculum[0] && typeof initialCurriculum[0] === 'object' && 'curriculum_data' in initialCurriculum[0]) {
            const extracted = initialCurriculum[0].curriculum_data;
            return Array.isArray(extracted) ? extracted : [];
        }

        // Check if first item has 'curriculum' property (legacy structure)
        if (initialCurriculum[0] && typeof initialCurriculum[0] === 'object' && 'curriculum' in initialCurriculum[0]) {
            const extracted = initialCurriculum[0].curriculum;
            return Array.isArray(extracted) ? extracted : [];
        }

        // Direct array structure (already processed)
        return initialCurriculum.filter(isCurriculumItem);
    }, [initialCurriculum]);

    const [curriculum, setCurriculum] = useState<CurriculumItem[]>(processedCurriculum);
    const [generatingCurriculum, setGeneratingCurriculum] = useState(false);
    // const [loadingCurriculum, setLoadingCurriculum] = useState(true); // No longer needed
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
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [curriculumProgress, setCurriculumProgress] = useState<Record<number, { completed: number; total: number }>>({});
    const [selectedBriefing, setSelectedBriefing] = useState<any>(initialTrendBriefing);
    const [showBriefingDetail, setShowBriefingDetail] = useState(false);
    const [showMaterialUpload, setShowMaterialUpload] = useState(false);

    // Daily Briefing States
    const [showDailyBriefing, setShowDailyBriefing] = useState(false);
    const [dailyBriefingData, setDailyBriefingData] = useState<any>(null);
    const dailyBriefingDataRef = useRef(dailyBriefingData);

    useEffect(() => {
        dailyBriefingDataRef.current = dailyBriefingData;
    }, [dailyBriefingData]);

    useEffect(() => {
        const fetchBriefing = async () => {
            try {
                const res = await fetch('/api/user/daily-briefing');
                if (res.ok) {
                    const data = await res.json();
                    if (data.briefing) {
                        setDailyBriefingData(data.briefing);
                        if (!data.briefing.is_read) {
                            setShowDailyBriefing(true);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch daily briefing", e);
            }
        };
        fetchBriefing();

        const handleOpenDailyBriefing = async () => {
            const currentData = dailyBriefingDataRef.current;

            if (currentData) {
                setShowDailyBriefing(true);
            } else {

                // Show loading state immediately (Popup handles null data by showing spinner)
                setShowDailyBriefing(true);

                try {
                    const res = await fetch("/api/user/daily-briefing/generate", { method: "POST" });

                    if (res.ok) {
                        const data = await res.json();

                        // Use the returned briefing directly from generation response
                        if (data.briefing) {
                            setDailyBriefingData(data.briefing);
                            // Popup is already showing loading, it will update to content
                        } else {
                            // Only if not returned in body, try fetching as fallback
                            const fetchRes = await fetch('/api/user/daily-briefing');
                            if (fetchRes.ok) {
                                const fetchData = await fetchRes.json();
                                if (fetchData.briefing) {
                                    setDailyBriefingData(fetchData.briefing);
                                } else {
                                    console.error("Briefing generated but not returned (fallback failed)");
                                    setShowDailyBriefing(false);
                                }
                            } else {
                                console.error("Generation OK but fetch failed");
                                setShowDailyBriefing(false);
                            }
                        }
                    } else {
                        console.error("Generation failed");
                        setShowDailyBriefing(false);
                    }
                } catch (e) {
                    console.error("Error generating briefing", e);
                    setShowDailyBriefing(false);
                }
            }
        };

        window.addEventListener('open-daily-briefing', handleOpenDailyBriefing);
        return () => window.removeEventListener('open-daily-briefing', handleOpenDailyBriefing);
    }, []);

    // Listen for open-schedule-popup event from LongTermGoalsWidget
    useEffect(() => {
        const handleOpenSchedulePopup = (event: CustomEvent) => {
            // Support both old format (linkedGoalId, linkedGoalTitle, goalType) and new format (linkedGoal)
            const { linkedGoal, linkedGoalId, linkedGoalTitle, goalType } = event.detail || {};

            if (linkedGoal) {
                setLinkedGoalData({
                    id: linkedGoal.id,
                    title: linkedGoal.title,
                    type: linkedGoal.type
                });
            } else if (linkedGoalId) {
                setLinkedGoalData({
                    id: linkedGoalId,
                    title: linkedGoalTitle,
                    type: goalType
                });
            }
            setShowSchedulePopup(true);
        };

        window.addEventListener('open-schedule-popup', handleOpenSchedulePopup as EventListener);
        return () => window.removeEventListener('open-schedule-popup', handleOpenSchedulePopup as EventListener);
    }, []);

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
                toast.error("커리큘럼 생성에 실패했습니다.");
            }
        } catch (error) {
            console.error("Error generating curriculum:", error);
            toast.error("커리큘럼 생성 중 오류가 발생했습니다.");
        } finally {
            setGeneratingCurriculum(false);
        }
    };

    const saveProfileToSupabase = async (updatedProfile: UserProfile) => {
        try {
            const response = await fetch("/api/user/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profile: updatedProfile }),
            });

            if (!response.ok) {
                console.error("Failed to save profile to Supabase");
                // Optionally revert state here if needed, but for now we just log
            }
        } catch (error) {
            console.error("Error saving profile:", error);
        }
    };

    // Refresh user profile from server
    const refreshUserProfile = async () => {
        try {
            const response = await fetch("/api/user/profile");
            if (response.ok) {
                const data = await response.json();
                if (data.profile) {
                    setUserProfile(data.profile);
                    // Update localStorage as well
                    localStorage.setItem("user_profile", JSON.stringify(data.profile));
                }
            }
        } catch (error) {
            console.error("Error refreshing profile:", error);
        }
    };

    // Listen for schedule updates from TodaySuggestions
    useEffect(() => {
        const handleScheduleUpdate = () => {
            refreshUserProfile();
        };

        window.addEventListener('schedule-added', handleScheduleUpdate);
        window.addEventListener('schedule-updated', handleScheduleUpdate);
        window.addEventListener('schedule-deleted', handleScheduleUpdate);

        return () => {
            window.removeEventListener('schedule-added', handleScheduleUpdate);
            window.removeEventListener('schedule-updated', handleScheduleUpdate);
            window.removeEventListener('schedule-deleted', handleScheduleUpdate);
        };
    }, []);

    const migrateGoalsToCalendar = (profile: UserProfile): UserProfile => {
        if (!profile.customGoals || profile.customGoals.length === 0) {
            return profile;
        }

        const migratedGoals = [...profile.customGoals];
        const today = new Date();
        let hasChanges = false;

        profile.customGoals.forEach((goal: any) => {
            // If goal has daysOfWeek but no specificDate, it's a template
            if (goal.daysOfWeek && goal.daysOfWeek.length > 0 && !goal.specificDate) {
                hasChanges = true;

                // Generate calendar events for next 8 weeks
                goal.daysOfWeek.forEach((dayOfWeek: number) => {
                    for (let week = 0; week < 8; week++) {
                        const targetDate = new Date(today);
                        const currentDay = today.getDay();
                        let daysUntilTarget = dayOfWeek - currentDay + (week * 7);
                        if (week === 0 && daysUntilTarget < 0) {
                            daysUntilTarget += 7;
                        }
                        targetDate.setDate(today.getDate() + daysUntilTarget);

                        const dateStr = targetDate.getFullYear() + '-' +
                            String(targetDate.getMonth() + 1).padStart(2, '0') + '-' +
                            String(targetDate.getDate()).padStart(2, '0');

                        migratedGoals.push({
                            id: `${goal.id}-${dayOfWeek}-${week}-${Date.now()}`,
                            text: goal.text,
                            time: goal.time,
                            startTime: goal.startTime,
                            endTime: goal.endTime,
                            color: goal.color,
                            specificDate: dateStr,
                            notificationEnabled: goal.notificationEnabled || false,
                        });
                    }
                });
            }
        });

        if (hasChanges) {
            return {
                ...profile,
                customGoals: migratedGoals
            };
        }

        return profile;
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
        saveProfileToSupabase(updatedProfile);
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
        saveProfileToSupabase(updatedProfile);
    };
    const handleSaveSchedule = (newSchedule: any, newCustomGoals: any) => {

        // Deduplicate newCustomGoals first
        const uniqueGoalsMap = new Map<string, CustomGoal>();
        newCustomGoals.forEach((goal: CustomGoal) => {
            const sortedDays = goal.daysOfWeek ? [...goal.daysOfWeek].sort().join(',') : '';
            const key = `${goal.text}-${goal.startTime}-${goal.endTime}-${sortedDays}-${goal.specificDate || ''}`;
            if (!uniqueGoalsMap.has(key)) {
                uniqueGoalsMap.set(key, goal);
            }
        });
        const uniqueCustomGoals = Array.from(uniqueGoalsMap.values());

        // Migrate daysOfWeek-only goals to calendar events
        const migratedGoals = [...uniqueCustomGoals];
        const today = new Date();

        uniqueCustomGoals.forEach((goal: any) => {
            // If goal has daysOfWeek but no specificDate, it's a template
            if (goal.daysOfWeek && goal.daysOfWeek.length > 0 && !goal.specificDate) {
                // Check if calendar events already exist for this template
                const hasCalendarEvents = uniqueCustomGoals.some((g: any) =>
                    g.specificDate &&
                    g.text === goal.text &&
                    g.startTime === goal.startTime
                );

                if (!hasCalendarEvents) {
                    // Generate calendar events for next 8 weeks
                    goal.daysOfWeek.forEach((dayOfWeek: number) => {
                        for (let week = 0; week < 8; week++) {
                            const targetDate = new Date(today);
                            const currentDay = today.getDay();
                            let daysUntilTarget = dayOfWeek - currentDay + (week * 7);
                            if (week === 0 && daysUntilTarget < 0) {
                                daysUntilTarget += 7;
                            }
                            targetDate.setDate(today.getDate() + daysUntilTarget);

                            const dateStr = targetDate.getFullYear() + '-' +
                                String(targetDate.getMonth() + 1).padStart(2, '0') + '-' +
                                String(targetDate.getDate()).padStart(2, '0');

                            migratedGoals.push({
                                id: `${goal.id}-${dayOfWeek}-${week}`,
                                text: goal.text,
                                time: goal.time,
                                startTime: goal.startTime,
                                endTime: goal.endTime,
                                color: goal.color,
                                specificDate: dateStr,
                                notificationEnabled: goal.notificationEnabled || false,
                                // Preserve goal linking
                                linkedGoalId: goal.linkedGoalId,
                                linkedGoalType: goal.linkedGoalType,
                            });
                        }
                    });
                }
            }
        });

        let updatedProfile: UserProfile;

        if (userProfile) {
            updatedProfile = {
                ...userProfile,
                schedule: newSchedule,
                customGoals: migratedGoals
            };
        } else {
            // If userProfile is null, we need to load it from localStorage or create a minimal one
            const savedProfile = localStorage.getItem('user_profile');
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                updatedProfile = {
                    ...parsed,
                    schedule: newSchedule,
                    customGoals: migratedGoals
                } as UserProfile;
            } else {
                // Create a minimal profile - this shouldn't happen in normal flow
                updatedProfile = {
                    job: "",
                    goal: "",
                    level: "", schedule: newSchedule,
                    customGoals: migratedGoals
                } as UserProfile;
            }
        }

        setUserProfile(updatedProfile);
        localStorage.setItem("user_profile", JSON.stringify(updatedProfile));
        saveProfileToSupabase(updatedProfile);

        // Notify Dashboard to refresh schedule
        window.dispatchEvent(new CustomEvent('schedule-updated'));

        // Notify Header to reload profile
        window.dispatchEvent(new Event('profile-updated'));


        if (newSchedule.wakeUp !== userSettings.wakeUpTime) {
            const newSettings = { ...userSettings, wakeUpTime: newSchedule.wakeUp };
            setUserSettings(newSettings);
            localStorage.setItem("user_settings", JSON.stringify(newSettings));
        }
    };

    useEffect(() => {
        setCurrentTime(new Date());
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
        // Clock timer
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        setCurrentTime(new Date());

        return () => clearInterval(timer);
    }, []);

    // 날짜 변경 감지 (자정 또는 새벽 5시 기준)
    const [lastCheckedDate, setLastCheckedDate] = useState<string>('');
    useEffect(() => {
        const getTodayStr = () => {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        };

        const checkDateChange = () => {
            const todayStr = getTodayStr();
            if (lastCheckedDate && lastCheckedDate !== todayStr) {
                window.location.reload();
            }
            setLastCheckedDate(todayStr);
        };

        // 초기 날짜 설정
        setLastCheckedDate(getTodayStr());

        // 10초마다 날짜 변경 체크
        const interval = setInterval(checkDateChange, 10000);
        return () => clearInterval(interval);
    }, [lastCheckedDate]);

    // Listen for briefing read events to update dailyGoals in real-time
    useEffect(() => {
        const handleBriefingRead = (event: CustomEvent<{ briefingId: string; readCount: number }>) => {
            setDailyGoals(prev => ({
                ...prev,
                trendBriefing: event.detail.readCount
            }));
        };

        window.addEventListener('briefing-read', handleBriefingRead as EventListener);

        return () => {
            window.removeEventListener('briefing-read', handleBriefingRead as EventListener);
        };
    }, []);

    // Initialize daily goals from localStorage
    useEffect(() => {
        const savedGoals = getDailyGoals();
        setDailyGoals(savedGoals);

        // Check for completed learning
        if (completedLearning.size > 0) {
            // Logic to update daily goals based on completed learning if needed
        }

        // Request notification permission
        requestNotificationPermission();

        // Fetch Daily Briefing
        const fetchBriefing = async () => {
            try {
                const res = await fetch('/api/user/daily-briefing');
                if (res.ok) {
                    const data = await res.json();
                    if (data.briefing) {
                        setDailyBriefingData(data.briefing);
                        if (!data.briefing.is_read) {
                            setShowDailyBriefing(true);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch daily briefing", e);
            }
        };
        fetchBriefing();

        // Listen for open daily briefing event from Header
        // Use Ref to access latest data without triggering re-renders of the effect
        const handleOpenDailyBriefing = async () => {
            const currentData = dailyBriefingDataRef.current;

            if (currentData) {
                setShowDailyBriefing(true);
            } else {

                // Show loading state immediately (Popup handles null data by showing spinner)
                setShowDailyBriefing(true);

                try {
                    const res = await fetch("/api/user/daily-briefing/generate", { method: "POST" });

                    if (res.ok) {
                        const data = await res.json();

                        // Use the returned briefing directly from generation response
                        if (data.briefing) {
                            setDailyBriefingData(data.briefing);
                        } else {
                            // Fallback fetch
                            const fetchRes = await fetch('/api/user/daily-briefing');
                            if (fetchRes.ok) {
                                const fetchData = await fetchRes.json();
                                if (fetchData.briefing) {
                                    setDailyBriefingData(fetchData.briefing);
                                } else {
                                    console.error("Briefing generated but not returned (fallback failed)");
                                    setShowDailyBriefing(false);
                                }
                            } else {
                                console.error("Generation OK but fetch failed");
                                setShowDailyBriefing(false);
                            }
                        }
                    } else {
                        console.error("Generation failed");
                        setShowDailyBriefing(false);
                    }
                } catch (e) {
                    console.error("Error generating briefing", e);
                    setShowDailyBriefing(false);
                }
            }
        };

        window.addEventListener('open-daily-briefing', handleOpenDailyBriefing);

        return () => {
            window.removeEventListener('open-daily-briefing', handleOpenDailyBriefing);
        };
    }, []); // Empty dependency array to prevent infinite re-renders

    // Handler for closing the briefing popup
    const handleCloseBriefing = async () => {
        setShowDailyBriefing(false);

        if (dailyBriefingData?.id && !dailyBriefingData.is_read) {
            try {
                // Call API to mark as read
                await fetch('/api/user/daily-briefing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ briefingId: dailyBriefingData.id })
                });

                // Update local state to reflect read status
                setDailyBriefingData((prev: any) => prev ? { ...prev, is_read: true } : null);
            } catch (e) {
                console.error("Failed to mark briefing as read", e);
            }
        }
    };

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
        <div className="p-3 sm:p-4 md:p-6 pt-16 sm:pt-18 md:pt-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-10 min-h-screen overflow-visible">
            {/* Fixed Mobile Header - Glassmorphism */}
            <div className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/20 md:hidden">
                <div className="flex items-center justify-between px-4 py-3">
                    <Link href="/dashboard" className="flex items-center">
                        <div className="w-10 h-10 bg-foreground text-background rounded-xl flex items-center justify-center font-bold text-lg">
                            F
                        </div>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="relative"
                                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                            >
                                <Bell className="w-5 h-5" />
                            </Button>
                            {showNotificationDropdown && (
                                <NotificationDropdown
                                    goals={userProfile?.customGoals || []}
                                    isOpen={showNotificationDropdown}
                                    onClose={() => setShowNotificationDropdown(false)}
                                />
                            )}
                        </div>
                        <div className="relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                            >
                                <User className="w-5 h-5" />
                            </Button>
                            {showProfileMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-2 z-50">
                                    <Link href="/mypage" className="block px-4 py-2 hover:bg-accent">
                                        마이페이지
                                    </Link>
                                    <Link href="/settings" className="block px-4 py-2 hover:bg-accent">
                                        설정
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ScheduleNotificationManager goals={userProfile?.customGoals || []} />
            {showDailyBriefing && dailyBriefingData && (
                <DailyBriefingPopup
                    isOpen={showDailyBriefing}
                    onClose={handleCloseBriefing}
                    data={dailyBriefingData.content}
                    username={(userProfile as any)?.name || '사용자'}
                />
            )}

            {/* AI Greeting Header */}
            <AIGreeting
                username={username}
                currentTime={currentTime || new Date()}
                userProfile={userProfile ? {
                    job: userProfile.job,
                    goal: userProfile.goal,
                    level: userProfile.level
                } : null}
                habitInsights={initialHabitInsights}
            />

            {/* Dashboard Content */}
            {/* Dashboard Content */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2 overflow-visible"
            >
                <motion.section variants={itemVariants} className="space-y-2 overflow-visible">

                    {/* Daily Flow Header */}
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl md:text-2xl font-bold flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                <Clock className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-gradient">Daily Flow</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-white gap-2"
                                onClick={() => setShowGoalModal(true)}
                            >
                                <Target className="w-4 h-4" /> <span className="hidden md:inline">목표 설정</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-white gap-2"
                                onClick={() => setShowSchedulePopup(true)}
                            >
                                <CalendarDays className="w-4 h-4" /> <span className="hidden md:inline">일정 관리</span>
                            </Button>
                        </div>
                    </div>

                    {/* Mobile Layout: Current Schedule -> Upcoming -> Stats */}
                    <div className="flex flex-col gap-4 md:hidden">
                        {/* 1. Current Schedule Card (Prominent) */}
                        {(() => {
                            if (!currentTime) return null;
                            const now = currentTime;
                            const currentDay = now.getDay();
                            const currentTimeValue = now.getHours() * 60 + now.getMinutes();
                            const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

                            const customItems = userProfile?.customGoals?.filter(g => {
                                if (g.specificDate) return g.specificDate === todayStr;
                                if (!g.daysOfWeek?.includes(currentDay)) return false;
                                if (g.startDate && todayStr < g.startDate) return false;
                                if (g.endDate && todayStr > g.endDate) return false;
                                return true;
                            }).map(g => ({
                                id: g.id,
                                text: g.text,
                                startTime: g.startTime!,
                                endTime: g.endTime!,
                                icon: getScheduleIcon(g.text),
                                color: g.color || 'primary',
                                location: g.location,
                                memo: g.memo,
                                detailedInfo: g.detailedInfo,
                            })) || [];

                            const allSchedules = [...customItems].sort((a, b) => {
                                const [aH, aM] = a.startTime.split(':').map(Number);
                                const [bH, bM] = b.startTime.split(':').map(Number);
                                return (aH * 60 + aM) - (bH * 60 + bM);
                            });

                            // Find current active schedule
                            let currentSchedule = allSchedules.find(s => {
                                const [sH, sM] = s.startTime.split(':').map(Number);
                                const [eH, eM] = s.endTime.split(':').map(Number);
                                let start = sH * 60 + sM;
                                let end = eH * 60 + eM;
                                if (end < start) end += 24 * 60;
                                return currentTimeValue >= start && currentTimeValue < end;
                            });

                            // If no active, find next upcoming
                            if (!currentSchedule) {
                                currentSchedule = allSchedules.find(s => {
                                    const [sH, sM] = s.startTime.split(':').map(Number);
                                    return sH * 60 + sM > currentTimeValue;
                                });
                            }

                            // Find upcoming schedules (excluding current)
                            const upcomingSchedules = allSchedules.filter(s => {
                                if (currentSchedule && s.id === currentSchedule.id) return false;
                                const [sH, sM] = s.startTime.split(':').map(Number);
                                return sH * 60 + sM > currentTimeValue;
                            });

                            // Calculate completion stats
                            const completions = getTodayCompletions();
                            const completedCount = allSchedules.filter(s => completions[s.id]?.completed === true).length;

                            return (
                                <>
                                    <CurrentScheduleCard
                                        schedule={currentSchedule || null}
                                        allSchedules={allSchedules}
                                        currentTime={currentTime}
                                        onToggleComplete={toggleCustomGoal}
                                        onScheduleClick={() => setShowSchedulePopup(true)}
                                    />

                                    {/* 3. Upcoming Schedules (Smaller) */}
                                    {upcomingSchedules.length > 0 && (
                                        <UpcomingSchedules
                                            schedules={upcomingSchedules}
                                            currentTime={currentTime}
                                            onToggleComplete={toggleCustomGoal}
                                            onViewAll={() => setShowSchedulePopup(true)}
                                        />
                                    )}

                                    {/* 4. Swipeable Stats (Circular Progress) */}
                                    <SwipeableStats
                                        scheduleCompletion={{
                                            completed: completedCount,
                                            total: allSchedules.length,
                                        }}
                                        briefingCompletion={{
                                            read: dailyGoals.trendBriefing,
                                            total: 6,
                                        }}
                                    />

                                    {/* 5. Growth Insights (Mobile) */}
                                    <Card className="glass-card border-none">
                                        <CardContent className="p-4">
                                            <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                                                <Users className="w-4 h-4 text-purple-400" /> 성장 인사이트
                                            </h3>
                                            <PeerInsightsCard
                                                job={userProfile?.job || "마케터"}
                                                level={userProfile?.level || "중급"}
                                            />
                                        </CardContent>
                                    </Card>
                                </>
                            );
                        })()}
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
                                        currentTime={currentTime}
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
                                                {(() => {
                                                    // Calculate schedule completion rate for counter
                                                    const now = currentTime || new Date();
                                                    const currentDay = now.getDay();
                                                    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
                                                    const todaySchedules = userProfile?.customGoals?.filter(g => {
                                                        if (g.specificDate) return g.specificDate === todayStr;
                                                        if (!g.daysOfWeek?.includes(currentDay)) return false;
                                                        if (g.startDate && todayStr < g.startDate) return false;
                                                        if (g.endDate && todayStr > g.endDate) return false;
                                                        return true;
                                                    }) || [];
                                                    const completions = getTodayCompletions();
                                                    const completedCount = todaySchedules.filter(s => completions[s.id]?.completed === true).length;
                                                    const totalCount = todaySchedules.length;
                                                    const scheduleGoalMet = totalCount > 0 && (completedCount / totalCount) >= 0.7;
                                                    return [dailyGoals.wakeUp, scheduleGoalMet, dailyGoals.trendBriefing >= 6].filter(v => v === true).length;
                                                })()}/3
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                            {/* Dynamic Schedule Goal */}
                                            {(() => {
                                                // Find current or next schedule
                                                if (!currentTime) return null;
                                                const now = currentTime;
                                                const currentDay = now.getDay();
                                                // --- Daily Flow Logic ---
                                                const currentTimeValue = now.getHours() * 60 + now.getMinutes();

                                                // 1. Prepare Custom Goals (both recurring and specific date)
                                                const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

                                                // Show events that either match today's date OR recurring events for today's day of week
                                                // IMPORTANT: If specificDate exists, ONLY show on that exact date (not as recurring)
                                                const customItems = userProfile?.customGoals?.filter(g => {
                                                    if (g.specificDate) {
                                                        // Specific date events only show on that exact date
                                                        return g.specificDate === todayStr;
                                                    }
                                                    // Recurring events (no specificDate) show on matching days of week
                                                    if (!g.daysOfWeek?.includes(currentDay)) return false;
                                                    if (g.startDate && todayStr < g.startDate) return false;
                                                    if (g.endDate && todayStr > g.endDate) return false;
                                                    return true;
                                                }).map(g => ({
                                                    id: g.id,
                                                    text: g.text,
                                                    startTime: g.startTime!,
                                                    endTime: g.endTime!,
                                                    icon: getScheduleIcon(g.text),
                                                    color: g.color || 'primary',
                                                    type: 'custom'
                                                })) || [];

                                                // 2. Use filtered calendar and recurring events
                                                const allSchedules = [...customItems];

                                                // 4. Find Active or Next Schedule
                                                // Sort by start time
                                                allSchedules.sort((a, b) => {
                                                    const [aH, aM] = a.startTime.split(':').map(Number);
                                                    const [bH, bM] = b.startTime.split(':').map(Number);
                                                    return (aH * 60 + aM) - (bH * 60 + bM);
                                                });

                                                let targetSchedule = allSchedules.find(s => {
                                                    const [sH, sM] = s.startTime.split(':').map(Number);
                                                    const [eH, eM] = s.endTime.split(':').map(Number);
                                                    let start = sH * 60 + sM;
                                                    let end = eH * 60 + eM;

                                                    // Handle overnight (e.g. sleep)
                                                    if (end < start) end += 24 * 60;

                                                    // Adjust current time for overnight check if needed
                                                    // (Simple check: if current < start and start is late, maybe we are in previous day's overnight?)
                                                    // For now, simple range check.
                                                    return currentTimeValue >= start && currentTimeValue < end;
                                                });

                                                // If no active schedule, find next upcoming
                                                if (!targetSchedule) {
                                                    targetSchedule = allSchedules.find(s => {
                                                        const [sH, sM] = s.startTime.split(':').map(Number);
                                                        const start = sH * 60 + sM;
                                                        return start > currentTimeValue;
                                                    });
                                                }

                                                // If still null (end of day), show first item of tomorrow (Wake Up)
                                                if (!targetSchedule && allSchedules.length > 0) {
                                                    targetSchedule = allSchedules[0];
                                                }

                                                // 5. Render Card
                                                if (targetSchedule) {
                                                    const completionStatus = getTodayCompletions()[targetSchedule.id];
                                                    const isCompleted = completionStatus?.completed === true;

                                                    // Recalculate active state for visual
                                                    const [sH, sM] = targetSchedule.startTime.split(':').map(Number);
                                                    const [eH, eM] = targetSchedule.endTime.split(':').map(Number);
                                                    let start = sH * 60 + sM;
                                                    let end = eH * 60 + eM;
                                                    if (end < start) end += 24 * 60;
                                                    const isActive = !isCompleted && currentTimeValue >= start && currentTimeValue < end;
                                                    const isUpcoming = !isCompleted && currentTimeValue < start;

                                                    const Icon = targetSchedule.icon;

                                                    // Color mapping for safe Tailwind classes
                                                    const colorMap: Record<string, string> = {
                                                        yellow: "bg-yellow-500",
                                                        purple: "bg-purple-500",
                                                        green: "bg-green-500",
                                                        blue: "bg-blue-500",
                                                        red: "bg-red-500",
                                                        orange: "bg-orange-500",
                                                        pink: "bg-pink-500",
                                                        primary: "bg-purple-600"
                                                    };
                                                    const bgClass = colorMap[targetSchedule.color] || "bg-purple-600";

                                                    // Color maps for NOW badge and active card styling
                                                    const cardBgMap: Record<string, string> = {
                                                        yellow: "bg-gradient-to-br from-yellow-500/20 to-yellow-600/20",
                                                        purple: "bg-gradient-to-br from-purple-500/20 to-purple-600/20",
                                                        green: "bg-gradient-to-br from-green-500/20 to-green-600/20",
                                                        blue: "bg-gradient-to-br from-blue-500/20 to-blue-600/20",
                                                        red: "bg-gradient-to-br from-red-500/20 to-red-600/20",
                                                        orange: "bg-gradient-to-br from-orange-500/20 to-orange-600/20",
                                                        pink: "bg-gradient-to-br from-pink-500/20 to-pink-600/20",
                                                        primary: "bg-gradient-to-br from-purple-500/20 to-purple-600/20"
                                                    };
                                                    const cardBorderMap: Record<string, string> = {
                                                        yellow: "border-yellow-500/50",
                                                        purple: "border-purple-500/50",
                                                        green: "border-green-500/50",
                                                        blue: "border-blue-500/50",
                                                        red: "border-red-500/50",
                                                        orange: "border-orange-500/50",
                                                        pink: "border-pink-500/50",
                                                        primary: "border-purple-500/50"
                                                    };
                                                    const cardShadowMap: Record<string, string> = {
                                                        yellow: "shadow-[0_0_15px_rgba(234,179,8,0.15)]",
                                                        purple: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
                                                        green: "shadow-[0_0_15px_rgba(34,197,94,0.15)]",
                                                        blue: "shadow-[0_0_15px_rgba(59,130,246,0.15)]",
                                                        red: "shadow-[0_0_15px_rgba(239,68,68,0.15)]",
                                                        orange: "shadow-[0_0_15px_rgba(249,115,22,0.15)]",
                                                        pink: "shadow-[0_0_15px_rgba(236,72,153,0.15)]",
                                                        primary: "shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                                                    };
                                                    const badgeBgMap: Record<string, string> = {
                                                        yellow: "bg-yellow-500/20",
                                                        purple: "bg-purple-500/20",
                                                        green: "bg-green-500/20",
                                                        blue: "bg-blue-500/20",
                                                        red: "bg-red-500/20",
                                                        orange: "bg-orange-500/20",
                                                        pink: "bg-pink-500/20",
                                                        primary: "bg-purple-500/20"
                                                    };
                                                    const badgeBorderMap: Record<string, string> = {
                                                        yellow: "border-yellow-500/30",
                                                        purple: "border-purple-500/30",
                                                        green: "border-green-500/30",
                                                        blue: "border-blue-500/30",
                                                        red: "border-red-500/30",
                                                        orange: "border-orange-500/30",
                                                        pink: "border-pink-500/30",
                                                        primary: "border-purple-500/30"
                                                    };
                                                    const textColorMap: Record<string, string> = {
                                                        yellow: "text-yellow-400",
                                                        purple: "text-purple-400",
                                                        green: "text-green-400",
                                                        blue: "text-blue-400",
                                                        red: "text-red-400",
                                                        orange: "text-orange-400",
                                                        pink: "text-pink-400",
                                                        primary: "text-purple-400"
                                                    };

                                                    const cardBg = cardBgMap[targetSchedule.color] || cardBgMap.primary;
                                                    const cardBorder = cardBorderMap[targetSchedule.color] || cardBorderMap.primary;
                                                    const cardShadow = cardShadowMap[targetSchedule.color] || cardShadowMap.primary;
                                                    const badgeBg = badgeBgMap[targetSchedule.color] || badgeBgMap.primary;
                                                    const badgeBorder = badgeBorderMap[targetSchedule.color] || badgeBorderMap.primary;
                                                    const textColor = textColorMap[targetSchedule.color] || textColorMap.primary;

                                                    return (
                                                        <motion.div
                                                            whileHover={{ scale: 1.01 }}
                                                            className={cn(
                                                                "p-5 rounded-lg text-left transition-all border",
                                                                isCompleted
                                                                    ? "bg-green-500/10 border-green-500/30"
                                                                    : (isActive || isUpcoming)
                                                                        ? `${cardBg} ${cardBorder} ${cardShadow}`
                                                                        : "bg-white/5 border-white/5"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn(
                                                                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                                                                    isCompleted
                                                                        ? "bg-green-500 text-white shadow-lg"
                                                                        : (isActive || isUpcoming)
                                                                            ? `${bgClass} text-white shadow-lg`
                                                                            : "bg-white/10 text-muted-foreground"
                                                                )}>
                                                                    {isCompleted ? (
                                                                        <CheckCircle2 className="w-6 h-6" />
                                                                    ) : (
                                                                        <Icon className={cn("w-6 h-6", isActive && "animate-pulse")} />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={cn(
                                                                        "font-semibold text-base",
                                                                        isCompleted ? "text-green-400" : (isActive || isUpcoming) && textColor
                                                                    )}>
                                                                        {targetSchedule.text.length > 12
                                                                            ? `${targetSchedule.text.substring(0, 12)}...`
                                                                            : targetSchedule.text}
                                                                    </p>
                                                                    <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                                                                        {targetSchedule.startTime} - {targetSchedule.endTime}
                                                                    </p>
                                                                </div>
                                                                {isCompleted ? (
                                                                    <div className="shrink-0 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-[11px] text-green-400 font-bold">
                                                                        완료
                                                                    </div>
                                                                ) : isActive ? (
                                                                    <div className={cn("shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-bold animate-pulse", badgeBg, badgeBorder, textColor)}>
                                                                        NOW
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </motion.div>
                                                    );
                                                } else {
                                                    // Fallback if no schedule at all
                                                    return <div className="p-5 rounded-lg border border-dashed border-white/10 text-center text-muted-foreground">일정이 없습니다.</div>;
                                                }
                                            })()}

                                            {/* Schedule Completion Rate */}
                                            {(() => {
                                                // Calculate today's schedule completion rate
                                                const now = currentTime || new Date();
                                                const currentDay = now.getDay();
                                                const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

                                                const todaySchedules = userProfile?.customGoals?.filter(g => {
                                                    if (g.specificDate) {
                                                        return g.specificDate === todayStr;
                                                    }
                                                    if (!g.daysOfWeek?.includes(currentDay)) return false;
                                                    if (g.startDate && todayStr < g.startDate) return false;
                                                    if (g.endDate && todayStr > g.endDate) return false;
                                                    return true;
                                                }) || [];

                                                const completions = getTodayCompletions();
                                                const completedCount = todaySchedules.filter(s => completions[s.id]?.completed === true).length;
                                                const totalCount = todaySchedules.length;
                                                const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                                                const isGoalMet = totalCount > 0 && completionRate >= 70;

                                                return (
                                                    <div className={cn(
                                                        "p-5 rounded-lg border flex items-center gap-4",
                                                        isGoalMet
                                                            ? "bg-purple-500/10 border-purple-500/30"
                                                            : "bg-white/5 border-white/5"
                                                    )}>
                                                        <div className={cn(
                                                            "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                                                            isGoalMet ? "bg-purple-500 text-white" : "bg-purple-500/20 text-purple-400"
                                                        )}>
                                                            <CheckCircle2 className="w-6 h-6" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-base">일정 달성률</p>
                                                            <div className="mt-2 h-2 w-24 bg-white/10 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    className="h-full bg-purple-500"
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${completionRate}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <span className="font-mono text-sm font-bold">{completedCount}/{totalCount}</span>
                                                    </div>
                                                );
                                            })()}

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

                {/* Weekly Goals Section */}
                <motion.section variants={itemVariants} className="mt-6">
                    <WeeklyGoalsSummary />
                </motion.section>
            </motion.div>

            <SchedulePopup
                isOpen={showSchedulePopup}
                onClose={() => {
                    setShowSchedulePopup(false);
                    setLinkedGoalData(null); // Clear linked goal data when closing
                }}
                initialSchedule={userProfile?.schedule}
                initialCustomGoals={userProfile?.customGoals}
                onSave={handleSaveSchedule}
                linkedGoalData={linkedGoalData}
            />

            {/* Goal Setting Modal */}
            <GoalSettingModal
                isOpen={showGoalModal}
                onClose={() => setShowGoalModal(false)}
                onGoalsUpdated={() => {
                }}
                onScheduleAdd={(newSchedules) => {
                    const currentGoals = userProfile?.customGoals || [];
                    handleSaveSchedule(userProfile?.schedule || {}, [...currentGoals, ...newSchedules]);
                }}
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

            {/* Material Upload Dialog */}
            <MaterialUploadDialog
                open={showMaterialUpload}
                onOpenChange={setShowMaterialUpload}
            />

            <DailyBriefingPopup
                isOpen={showDailyBriefing}
                onClose={handleCloseBriefing}
                data={dailyBriefingData}
                username={username}
            />

            {/* Schedule Notification Manager - Only use user's custom goals, not hardcoded defaults */}
            {userProfile && (
                <ScheduleNotificationManager
                    goals={userProfile.customGoals || []}
                />
            )}
        </div>
    );
}
