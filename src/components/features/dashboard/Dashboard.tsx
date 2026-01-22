"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Bell, CheckCircle2, Clock, Loader2, RefreshCw, Target, ArrowRight, User, Settings, Sun, BookOpen, Circle, Moon, Briefcase, Coffee, Edit3, Sparkles, XCircle, FileText, Heart, Gamepad2, Dumbbell, Film, Tv, Music, Headphones, Mic, Code, Laptop, Pen, Palette, Camera, Utensils, Home, Activity, TreePine, Rocket, Brain, BarChart3, Megaphone, FileCode, Hospital, Lightbulb, MapPin } from "lucide-react";
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
import { MaterialUploadDialog } from "./MaterialUploadDialog";
import { RecentMaterialsList } from "./RecentMaterialsList";
import { EmailSummarySection } from "./EmailSummarySection";
import { DailyBriefingPopup } from "./DailyBriefingPopup";
import { AppUsageTracker } from "./AppUsageTracker";
import { SmartInsightsWidget } from "./SmartInsightsWidget";
import { AIGreeting } from "./AIGreeting";
import { GoalSettingModal } from "../goals/GoalSettingModal";
import { WeeklyGoalsSummary } from "./WeeklyGoalsSummary";


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

    // Get icon for schedule based on text
    const getScheduleIcon = (text: string) => {
        const lowerText = text.toLowerCase();

        // 식사 (아침, 점심, 저녁 포함)
        if (lowerText.includes('식사') || lowerText.includes('아침') || lowerText.includes('점심') || lowerText.includes('저녁')) {
            return Utensils;
        }
        // 수면
        if (lowerText.includes('기상') || lowerText.includes('일어나')) {
            return Sun;
        }
        if (lowerText.includes('취침') || lowerText.includes('잠')) {
            return Moon;
        }
        // 업무 (시작/종료 포함)
        if (lowerText.includes('업무') || lowerText.includes('수업') || lowerText.includes('출근')) {
            if (lowerText.includes('종료')) {
                return CheckCircle2; // 종료는 체크 아이콘
            }
            return Briefcase;
        }
        // 운동
        if (lowerText.includes('운동') || lowerText.includes('헬스')) {
            return Dumbbell;
        }
        if (lowerText.includes('요가')) {
            return Activity;
        }
        // 건강
        if (lowerText.includes('병원') || lowerText.includes('진료')) {
            return Hospital;
        }
        if (lowerText.includes('거북목') || lowerText.includes('스트레칭')) {
            return Activity;
        }
        if (lowerText.includes('산책')) {
            return TreePine;
        }
        // 학습
        if (lowerText.includes('독서') || lowerText.includes('책') || lowerText.includes('읽기')) {
            return BookOpen;
        }
        if (lowerText.includes('공부') || lowerText.includes('학습')) {
            return Pen;
        }
        if (lowerText.includes('자기계발')) {
            return Lightbulb;
        }
        // 휴식
        if (lowerText.includes('휴식')) {
            return Coffee;
        }
        // 엔터테인먼트 (각 유형별 고유 아이콘)
        if (lowerText === '게임' || lowerText.includes('게임')) {
            return Gamepad2;
        }
        if (lowerText === '영화' || lowerText.includes('영화')) {
            return Film;
        }
        if (lowerText === '드라마' || lowerText.includes('드라마') || lowerText.includes('tv')) {
            return Tv;
        }
        if (lowerText.includes('음악')) {
            return Music;
        }
        // 여가 (일반)
        if (lowerText.includes('여가') || lowerText.includes('취미')) {
            return Heart;
        }
        // 프로젝트/스타트업/비즈니스
        if (lowerText.includes('스타트업') || lowerText.includes('린 스타트업') || lowerText.includes('mvp')) {
            return Rocket;
        }
        if (lowerText.includes('프로젝트') || lowerText.includes('실습')) {
            return Code;
        }
        if (lowerText.includes('ai') || lowerText.includes('알고리즘')) {
            return Brain;
        }
        if (lowerText.includes('분석')) {
            return BarChart3;
        }
        if (lowerText.includes('캠페인') || lowerText.includes('마케팅')) {
            return Megaphone;
        }
        if (lowerText.includes('기획') || lowerText.includes('콘텐츠')) {
            return FileText;
        }

        // 기본 아이콘 (매칭되지 않는 경우만)
        return Target;
    };

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
            console.log("Dashboard: 'open-daily-briefing' event received!");
            const currentData = dailyBriefingDataRef.current;

            if (currentData) {
                console.log("Showing existing briefing data");
                setShowDailyBriefing(true);
            } else {
                console.log("No data, starting auto-generation...");

                // Show loading state immediately (Popup handles null data by showing spinner)
                setShowDailyBriefing(true);

                try {
                    const res = await fetch("/api/user/daily-briefing/generate", { method: "POST" });

                    if (res.ok) {
                        const data = await res.json();

                        // Use the returned briefing directly from generation response
                        if (data.briefing) {
                            console.log("Briefing generated and received:", data.briefing);
                            setDailyBriefingData(data.briefing);
                            // Popup is already showing loading, it will update to content
                        } else {
                            // Only if not returned in body, try fetching as fallback
                            console.log("Briefing generated but not in body, trying fetch...");
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
        const handleOpenSchedulePopup = () => {
            console.log("Dashboard: 'open-schedule-popup' event received!");
            setShowSchedulePopup(true);
        };

        window.addEventListener('open-schedule-popup', handleOpenSchedulePopup);
        return () => window.removeEventListener('open-schedule-popup', handleOpenSchedulePopup);
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
                alert("커리큘럼 생성에 실패했습니다. 다시 시도해주세요.");
            }
        } catch (error) {
            console.error("Error generating curriculum:", error);
            alert("커리큘럼 생성 중 오류가 발생했습니다.");
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
                    console.log("[Dashboard] 프로필 새로고침 완료");
                }
            }
        } catch (error) {
            console.error("Error refreshing profile:", error);
        }
    };

    // Listen for schedule updates from TodaySuggestions
    useEffect(() => {
        const handleScheduleUpdate = () => {
            console.log("[Dashboard] 일정 업데이트 이벤트 수신, 프로필 새로고침");
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
            console.log('[Migration] No customGoals to migrate');
            return profile;
        }

        console.log('[Migration] Starting migration, customGoals count:', profile.customGoals.length);
        const migratedGoals = [...profile.customGoals];
        const today = new Date();
        let hasChanges = false;

        profile.customGoals.forEach((goal: any) => {
            // If goal has daysOfWeek but no specificDate, it's a template
            if (goal.daysOfWeek && goal.daysOfWeek.length > 0 && !goal.specificDate) {
                console.log('[Migration] Found template! Converting to calendar events:', goal.text, 'days:', goal.daysOfWeek);
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
            console.log('[Migration] Migration completed! New customGoals count:', migratedGoals.length);
            return {
                ...profile,
                customGoals: migratedGoals
            };
        }

        console.log('[Migration] No changes needed');
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
        console.log('Saving schedule:', newSchedule);
        console.log('Saving custom goals:', newCustomGoals);

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
        console.log(`[Dashboard] Deduplicated goals: ${newCustomGoals.length} -> ${uniqueCustomGoals.length}`);

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
        console.log('[Dashboard] 일정 업데이트 이벤트 발송 (SchedulePopup)');
        window.dispatchEvent(new CustomEvent('schedule-updated'));

        // Notify Header to reload profile
        window.dispatchEvent(new Event('profile-updated'));

        console.log('Updated profile:', updatedProfile);

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
                console.log('[Dashboard] Date changed from', lastCheckedDate, 'to', todayStr, '- refreshing page');
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
            console.log('[Dashboard] Briefing read event:', event.detail);
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
            console.log("Dashboard: 'open-daily-briefing' event received!");
            const currentData = dailyBriefingDataRef.current;

            if (currentData) {
                console.log("Showing existing briefing data");
                setShowDailyBriefing(true);
            } else {
                console.log("No data, starting auto-generation...");

                // Show loading state immediately (Popup handles null data by showing spinner)
                setShowDailyBriefing(true);

                try {
                    const res = await fetch("/api/user/daily-briefing/generate", { method: "POST" });

                    if (res.ok) {
                        const data = await res.json();

                        // Use the returned briefing directly from generation response
                        if (data.briefing) {
                            console.log("Briefing generated and received:", data.briefing);
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
        <div className="p-4 md:p-6 pt-20 md:pt-6 max-w-7xl mx-auto space-y-6 md:space-y-10 min-h-screen bg-background/50 backdrop-blur-sm overflow-visible">
            {/* Fixed Mobile Header */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border md:hidden">
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
                        <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                            <Clock className="w-6 h-6 text-primary" /> Daily Flow
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
                                <Edit3 className="w-4 h-4" /> <span className="hidden md:inline">일정 관리</span>
                            </Button>
                        </div>
                    </div>

                    {/* Mobile Layout: Goals -> Timeline -> Insights */}
                    <div className="flex flex-col gap-4 md:hidden">
                        {/* 1. Goals (Mobile) */}
                        <div className="grid grid-cols-2 gap-3">
                            {(() => {
                                // Dynamic Goal Card Logic (Same as Desktop)
                                if (!currentTime) return null;
                                const now = currentTime;
                                const currentDay = now.getDay();
                                const currentTimeValue = now.getHours() * 60 + now.getMinutes();

                                const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

                                // Show events with specificDate matching today OR recurring schedules for today's day
                                // IMPORTANT: If specificDate exists, ONLY show on that exact date (not as recurring)
                                const customItems = userProfile?.customGoals?.filter(g => {
                                    if (g.specificDate) {
                                        // Specific date events only show on that exact date
                                        return g.specificDate === todayStr;
                                    }
                                    // Recurring events (no specificDate) show on matching days of week
                                    if (!g.daysOfWeek?.includes(currentDay)) return false;
                                    // startDate가 있으면 해당 날짜 이후에만 표시
                                    if (g.startDate && todayStr < g.startDate) return false;
                                    // endDate가 있으면 해당 날짜까지만 표시 (목표 기간 제한)
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

                                // Only use calendar events (customItems)
                                const allSchedules = [...customItems];

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
                                    if (end < start) end += 24 * 60;
                                    return currentTimeValue >= start && currentTimeValue < end;
                                });

                                if (!targetSchedule) {
                                    targetSchedule = allSchedules.find(s => {
                                        const [sH, sM] = s.startTime.split(':').map(Number);
                                        const start = sH * 60 + sM;
                                        return start > currentTimeValue;
                                    });
                                }

                                if (!targetSchedule && allSchedules.length > 0) {
                                    targetSchedule = allSchedules[0];
                                }

                                if (targetSchedule) {
                                    const completionStatus = getTodayCompletions()[targetSchedule.id];
                                    const isCompleted = completionStatus?.completed === true;
                                    const [sH, sM] = targetSchedule.startTime.split(':').map(Number);
                                    const [eH, eM] = targetSchedule.endTime.split(':').map(Number);
                                    let start = sH * 60 + sM;
                                    let end = eH * 60 + eM;
                                    if (end < start) end += 24 * 60;
                                    const isActive = !isCompleted && currentTimeValue >= start && currentTimeValue < end;
                                    const isUpcoming = !isCompleted && currentTimeValue < start;
                                    const Icon = targetSchedule.icon;

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

                                    return (
                                        <motion.button
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => {
                                                if (targetSchedule.id === 'wake-up') updateDailyGoal("wakeUp", !dailyGoals.wakeUp);
                                            }}
                                            className={cn(
                                                "p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all",
                                                isCompleted ? "bg-green-500/10 border-green-500/30" :
                                                    (isActive || isUpcoming) ? "bg-purple-500/10 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.15)]" :
                                                        "bg-white/5 border-white/10"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center",
                                                isCompleted ? "bg-green-500 text-black" :
                                                    (isActive || isUpcoming) ? `${bgClass} text-white` :
                                                        "bg-white/10 text-muted-foreground"
                                            )}>
                                                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className={cn("w-4 h-4", isActive && "animate-pulse")} />}
                                            </div>
                                            <div>
                                                <p className={cn("font-semibold text-sm", (isActive || isUpcoming) && "text-purple-400")}>{targetSchedule.text}</p>
                                                <p className="text-xs text-muted-foreground">{targetSchedule.startTime}</p>
                                            </div>
                                        </motion.button>
                                    );
                                } else {
                                    return (
                                        <div className="p-3 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                                            <p className="text-xs">일정이 없습니다</p>
                                        </div>
                                    );
                                }
                            })()}

                            {/* Schedule Completion Goal */}
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
                                        "p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center",
                                        isGoalMet
                                            ? "bg-purple-500/10 border-purple-500/30"
                                            : "bg-white/5 border-white/10"
                                    )}>
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center",
                                            isGoalMet ? "bg-purple-500 text-white" : "bg-purple-500/20 text-purple-400"
                                        )}>
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">달성 ({completedCount}/{totalCount})</p>
                                            <div className="mt-1 h-1.5 w-16 bg-white/10 rounded-full overflow-hidden mx-auto">
                                                <motion.div
                                                    className="h-full bg-purple-500"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${completionRate}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

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
                        <Card className="glass-card border-none">
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
                                    currentTime={currentTime}
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
                onClose={() => setShowSchedulePopup(false)}
                initialSchedule={userProfile?.schedule}
                initialCustomGoals={userProfile?.customGoals}
                onSave={handleSaveSchedule}
            />

            {/* Goal Setting Modal */}
            <GoalSettingModal
                isOpen={showGoalModal}
                onClose={() => setShowGoalModal(false)}
                onGoalsUpdated={() => {
                    console.log("[Dashboard] Goals updated");
                }}
                onScheduleAdd={(newSchedules) => {
                    console.log("[Dashboard] Adding goal-based schedules:", newSchedules);
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

function DailyRhythmTimeline({ schedule, customGoals, dailyGoals, toggleCustomGoal, isMobile = false, currentTime }: {
    schedule?: UserProfile['schedule'];
    customGoals?: CustomGoal[];
    dailyGoals: DailyGoals;
    toggleCustomGoal: (id: string) => void;
    isMobile?: boolean;
    currentTime: Date | null;
}) {
    const [todayCompletions, setTodayCompletions] = useState<Record<string, any>>({});

    // Auto-scroll to active/upcoming item on mobile (must be before early return)
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateCompletions = () => {
            setTodayCompletions(getTodayCompletions());
        };

        updateCompletions();
        const interval = setInterval(updateCompletions, 60000);
        return () => clearInterval(interval);
    }, [customGoals]);

    // Note: This useEffect needs schedule-dependent variables, but must be here for hooks order
    // It will safely handle the case when schedule is undefined
    useEffect(() => {
        // Allow scrolling even without schedule - customGoals alone is enough
        if (!isMobile || !scrollContainerRef.current || !currentTime) return;
        if (!schedule && (!customGoals || customGoals.length === 0)) return;

        // Use a timeout to ensure the DOM is fully rendered before scrolling
        const scrollToActive = () => {
            if (!scrollContainerRef.current) return;

            const now = currentTime;
            const currentDayOfWeek = now.getDay();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTimeValue = currentHour * 60 + currentMinute;

            // Build timeline to find active index - 중복 제거 포함
            const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

            // 특정 날짜 일정 (우선순위 높음)
            const specificDateGoals = customGoals?.filter((g: any) => g.specificDate === todayStr && g.startTime) || [];

            // 반복 일정 (중복 제거)
            const recurringGoals = customGoals?.filter((g: any) => {
                if (g.specificDate) return false;
                if (!g.daysOfWeek?.includes(currentDayOfWeek)) return false;
                if (!g.startTime) return false;
                // Check date range constraints
                if (g.startDate && todayStr < g.startDate) return false;
                if (g.endDate && todayStr > g.endDate) return false;
                // 같은 이름 + 같은 시간의 특정 날짜 일정이 있으면 제외
                const hasDuplicate = specificDateGoals.some((sg: any) =>
                    sg.text === g.text && sg.startTime === g.startTime
                );
                return !hasDuplicate;
            }) || [];

            const allGoals = [...specificDateGoals, ...recurringGoals];

            // Only use customGoals for timeline - no longer using base schedule items
            const timelineItemsForScroll: Array<{ time: string; endTime?: string | undefined }> = allGoals
                .map((g: any) => ({ time: g.startTime!, endTime: g.endTime || undefined }))
                .sort((a, b) => {
                    const [aH, aM] = a.time.split(':').map(Number);
                    const [bH, bM] = b.time.split(':').map(Number);
                    return (aH * 60 + aM) - (bH * 60 + bM);
                });

            let activeIndex = -1;
            let nextIndex = -1;

            timelineItemsForScroll.forEach((item, i) => {
                const [h, m] = item.time.split(':').map(Number);
                const startTime = h * 60 + m;

                const nextItem = timelineItemsForScroll[i + 1];
                let nextStartTime = 24 * 60;

                if (nextItem) {
                    const [nh, nm] = nextItem.time.split(':').map(Number);
                    nextStartTime = nh * 60 + nm;
                }

                let endTime = nextStartTime;

                if (item.endTime) {
                    const [eh, em] = item.endTime.split(':').map(Number);
                    endTime = eh * 60 + em;
                    if (endTime < startTime) endTime += 24 * 60;
                }

                if (currentTimeValue >= startTime && currentTimeValue < endTime) {
                    activeIndex = i;
                }

                if (currentTimeValue < startTime && nextIndex === -1) {
                    nextIndex = i;
                }
            });

            const targetIndex = activeIndex !== -1 ? activeIndex : nextIndex;
            console.log('[Timeline] Scrolling to index:', targetIndex, 'activeIndex:', activeIndex, 'nextIndex:', nextIndex, 'totalItems:', timelineItemsForScroll.length);

            if (targetIndex !== -1 && scrollContainerRef.current) {
                // Get all timeline items
                const items = scrollContainerRef.current.querySelectorAll('[data-timeline-item]');
                console.log('[Timeline] Found', items.length, 'items in DOM, targeting index:', targetIndex);

                if (items.length > targetIndex) {
                    const targetItem = items[targetIndex] as HTMLElement;
                    const container = scrollContainerRef.current;

                    // Calculate scroll position to center the item
                    const itemLeft = targetItem.offsetLeft;
                    const itemWidth = targetItem.offsetWidth;
                    const containerWidth = container.clientWidth;
                    const scrollLeft = Math.max(0, itemLeft - (containerWidth / 2) + (itemWidth / 2));

                    console.log('[Timeline] Scroll calculation: itemLeft=', itemLeft, 'itemWidth=', itemWidth, 'containerWidth=', containerWidth, 'scrollLeft=', scrollLeft);

                    container.scrollTo({
                        left: scrollLeft,
                        behavior: 'smooth'
                    });
                }
            }
        };

        // Scroll with multiple attempts to ensure DOM is ready
        const timer0 = setTimeout(scrollToActive, 50);
        const timer1 = setTimeout(scrollToActive, 200);
        const timer2 = setTimeout(scrollToActive, 600);

        return () => {
            clearTimeout(timer0);
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [isMobile, schedule, customGoals, currentTime]);

    if (!schedule) return (
        <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-4">
            <p>일정을 설정하고 나만의 리듬을 찾아보세요.</p>
            <Button size="sm" onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="일정 추가/변경"]')?.click()}>일정 설정하기</Button>
        </div>
    );

    const now = currentTime || new Date(0); // Fallback to epoch if null (server-side safe)
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    // If currentTime is null, set a value that won't match any schedule (e.g. -1)
    const currentTimeValue = currentTime ? currentHour * 60 + currentMinute : -1;

    // Map activity labels to icons
    const activityIcons: Record<string, any> = {
        '기상': Sun,
        '업무 시작': Briefcase,
        '업무/수업 시작': Briefcase,
        '업무 종료': Briefcase,
        '업무/수업 종료': Briefcase,
        '취침': Moon,
        '아침 식사': Coffee,
        '점심 식사': Coffee,
        '저녁 식사': Coffee,
        '운동': Dumbbell,
        '독서': BookOpen,
        '자기계발': Target,
        '병원': Heart,
        '휴식/여가': Gamepad2,
        '영화': Film,
        '영화 감상': Film,
        '영화 보기': Film,
        '게임': Gamepad2,
        '게임하기': Gamepad2,
        'TV': Tv,
        'TV 시청': Tv,
        '드라마': Tv,
        '음악': Music,
        '음악 감상': Music,
        '팟캐스트': Headphones,
        '팟캐스트 청취': Headphones,
        '팟캐스트 듣기': Headphones,
        '코딩': Code,
        '프로그래밍': Code,
        '개발': Laptop,
        '공부': BookOpen,
        '학습': BookOpen,
        '글쓰기': Pen,
        '작문': Pen,
        '그림': Palette,
        '그리기': Palette,
        '미술': Palette,
        '사진': Camera,
        '촬영': Camera,
    };

    // Filter custom goals for today (both recurring and specific date)
    const currentDate = currentTime || new Date();
    const todayStr = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + String(currentDate.getDate()).padStart(2, '0');

    const todaysGoals = customGoals?.filter(goal => {
        // IMPORTANT: If specificDate exists, ONLY show on that exact date (not as recurring)
        if (goal.specificDate) {
            // Specific date events only show on that exact date
            return goal.specificDate === todayStr;
        }
        // Recurring events (no specificDate) show on matching days of week
        return goal.daysOfWeek?.includes(currentDayOfWeek);
    }) || [];

    // State for schedule detail popup
    const [selectedSchedule, setSelectedSchedule] = useState<{
        time: string;
        label: string;
        endTime?: string;
        location?: string;
        memo?: string;
        color: string;
    } | null>(null);

    // Build timeline items
    const baseTimelineItems: Array<{
        time: string;
        label: string;
        icon: any;
        color: string;
        goalId: string;
        endTime?: string;
        location?: string;
        memo?: string;
    }> = [];

    // Note: Base schedule items (schedule.wakeUp, etc.) are no longer added here.
    // We rely entirely on customGoals to ensure only user-configured schedules for the specific date are shown.

    // Add today's custom goals to timeline
    todaysGoals.forEach(goal => {
        if (goal.startTime) {
            // Try exact match first, then search for keywords in text
            let icon = activityIcons[goal.text];
            if (!icon) {
                // Search for keywords in the goal text
                const text = goal.text.toLowerCase();
                for (const [keyword, iconComponent] of Object.entries(activityIcons)) {
                    if (text.includes(keyword.toLowerCase())) {
                        icon = iconComponent;
                        break;
                    }
                }
                // Default to Target if no match found
                if (!icon) icon = Target;
            }

            baseTimelineItems.push({
                time: goal.startTime,
                label: goal.text,
                icon: icon,
                color: goal.color || 'purple',
                goalId: goal.id,
                endTime: goal.endTime,
                location: goal.location,
                memo: goal.memo,
            });
        }
    });

    // Remove duplicates: same time + same label = keep only first occurrence
    const uniqueItems = baseTimelineItems.filter((item, index, self) => {
        return index === self.findIndex(t =>
            t.time === item.time && t.label === item.label
        );
    });

    // Sort by time
    const timelineItems = uniqueItems.sort((a, b) => {
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
        const startTime = h * 60 + m;

        // Determine end time: strictly use item.endTime if available
        let endTime = startTime + 60; // Default duration fallback

        const nextItem = timelineItems[i + 1];
        let nextStartTime = 24 * 60;
        if (nextItem) {
            const [nh, nm] = nextItem.time.split(':').map(Number);
            nextStartTime = nh * 60 + nm;
        }

        if (item.endTime) {
            const [eh, em] = item.endTime.split(':').map(Number);
            endTime = eh * 60 + em;
            if (endTime < startTime) endTime += 24 * 60;
        } else {
            // If no explicit endTime, use next start time
            endTime = nextStartTime;
        }

        if (currentTimeValue >= startTime && currentTimeValue < endTime) {
            activeIndex = i;
        }

        if (currentTimeValue < startTime && nextIndex === -1) {
            nextIndex = i;
        }
    }

    const getColorClasses = (color: string, isActive: boolean = false) => {
        // NOTE: 'primary' is black in our theme, so we use 'purple' as default
        const normalizedColor = color === 'primary' || !color ? 'purple' : color;

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
        };

        const activeGradients: Record<string, string> = {
            yellow: 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
            blue: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]',
            purple: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]',
            green: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)]',
            red: 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]',
            orange: 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
            pink: 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.15)]',
            amber: 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
            cyan: 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
            indigo: 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]',
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
        };

        const badgeBgColors: Record<string, string> = {
            yellow: 'bg-yellow-500/20',
            blue: 'bg-blue-500/20',
            purple: 'bg-purple-500/20',
            green: 'bg-green-500/20',
            red: 'bg-red-500/20',
            orange: 'bg-orange-500/20',
            pink: 'bg-pink-500/20',
            amber: 'bg-amber-500/20',
            cyan: 'bg-cyan-500/20',
            indigo: 'bg-indigo-500/20',
        };

        return {
            bg: bgColors[normalizedColor] || bgColors.purple,
            activeGradient: activeGradients[normalizedColor] || activeGradients.purple,
            text: textColors[normalizedColor] || textColors.purple,
            border: borderColors[normalizedColor] || borderColors.purple,
            badgeBg: badgeBgColors[normalizedColor] || badgeBgColors.purple,
        };
    };

    return (
        <div className={cn(
            "relative",
            isMobile ? "w-full" : "pl-8 space-y-3"
        )}>
            {/* Empty State when no schedules for today */}
            {timelineItems.length === 0 && (
                <div className="text-center py-8 flex flex-col items-center gap-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-muted-foreground mb-2">오늘은 등록된 일정이 없네요!</p>
                        <p className="text-sm text-muted-foreground/70">나만의 루틴을 추가하고 하루를 계획해보세요.</p>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 border-primary/30 hover:bg-primary/10"
                        onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="일정 추가/변경"]')?.click()}
                    >
                        <Edit3 className="w-4 h-4" />
                        일정 추가하기
                    </Button>
                </div>
            )}

            {/* Enhanced Vertical line with gradient (Desktop only) */}
            {!isMobile && timelineItems.length > 0 && <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 via-primary/50 to-primary/30 rounded-full" />}

            {/* Mobile Horizontal Scroll Container */}
            {isMobile && (
                <div
                    ref={scrollContainerRef}
                    className="flex gap-3 overflow-x-auto py-6 scrollbar-hide snap-x snap-mandatory px-4"
                >
                    {timelineItems.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = index === activeIndex;
                        const isUpcoming = activeIndex === -1 && index === nextIndex;
                        const isPast = index < activeIndex || (activeIndex === -1 && index < nextIndex && nextIndex !== -1);
                        const colors = getColorClasses(item.color, isActive || isUpcoming);
                        const completion = todayCompletions[item.goalId];

                        console.log(`[Timeline] ${item.label}: color=${item.color}, isActive=${isActive}, isUpcoming=${isUpcoming}, gradient=${colors.activeGradient}`);

                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="snap-center shrink-0 cursor-pointer"
                                data-timeline-item
                                onClick={() => setSelectedSchedule({
                                    time: item.time,
                                    label: item.label,
                                    endTime: item.endTime,
                                    location: item.location,
                                    memo: item.memo,
                                    color: item.color,
                                })}
                            >
                                <div className={cn(
                                    "relative w-[140px] p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3",
                                    // Active state - 현재 진행중인 일정만 색상으로 강조
                                    isActive && item.color === 'yellow' && "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)] scale-105 z-10 ring-1 ring-yellow-500/50",
                                    isActive && item.color === 'blue' && "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-105 z-10 ring-1 ring-blue-500/50",
                                    isActive && item.color === 'purple' && "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)] scale-105 z-10 ring-1 ring-purple-500/50",
                                    isActive && item.color === 'green' && "bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)] scale-105 z-10 ring-1 ring-green-500/50",
                                    isActive && item.color === 'red' && "bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] scale-105 z-10 ring-1 ring-red-500/50",
                                    isActive && item.color === 'orange' && "bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)] scale-105 z-10 ring-1 ring-orange-500/50",
                                    isActive && item.color === 'pink' && "bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.15)] scale-105 z-10 ring-1 ring-pink-500/50",
                                    isActive && item.color === 'amber' && "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] scale-105 z-10 ring-1 ring-amber-500/50",
                                    isActive && item.color === 'indigo' && "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)] scale-105 z-10 ring-1 ring-indigo-500/50",
                                    isActive && item.color === 'cyan' && "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] scale-105 z-10 ring-1 ring-cyan-500/50",
                                    isActive && item.color === 'teal' && "bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)] scale-105 z-10 ring-1 ring-teal-500/50",
                                    isActive && item.color === 'emerald' && "bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] scale-105 z-10 ring-1 ring-emerald-500/50",
                                    isActive && item.color === 'violet' && "bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.15)] scale-105 z-10 ring-1 ring-violet-500/50",
                                    isActive && item.color === 'rose' && "bg-gradient-to-br from-rose-500/20 to-pink-500/20 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)] scale-105 z-10 ring-1 ring-rose-500/50",
                                    isActive && item.color === 'sky' && "bg-gradient-to-br from-sky-500/20 to-blue-500/20 border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.15)] scale-105 z-10 ring-1 ring-sky-500/50",
                                    isActive && (!item.color || item.color === 'primary') && "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)] scale-105 z-10 ring-1 ring-purple-500/50",
                                    // Upcoming state - 해당 일정 색상으로 은은하게 표시
                                    isUpcoming && item.color === 'yellow' && "bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30 ring-1 ring-yellow-500/20",
                                    isUpcoming && item.color === 'blue' && "bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 ring-1 ring-blue-500/20",
                                    isUpcoming && item.color === 'purple' && "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 ring-1 ring-purple-500/20",
                                    isUpcoming && item.color === 'green' && "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 ring-1 ring-green-500/20",
                                    isUpcoming && item.color === 'red' && "bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/30 ring-1 ring-red-500/20",
                                    isUpcoming && item.color === 'orange' && "bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/30 ring-1 ring-orange-500/20",
                                    isUpcoming && item.color === 'pink' && "bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-pink-500/30 ring-1 ring-pink-500/20",
                                    isUpcoming && item.color === 'amber' && "bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 ring-1 ring-amber-500/20",
                                    isUpcoming && item.color === 'indigo' && "bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20",
                                    isUpcoming && item.color === 'cyan' && "bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30 ring-1 ring-cyan-500/20",
                                    isUpcoming && item.color === 'teal' && "bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border-teal-500/30 ring-1 ring-teal-500/20",
                                    isUpcoming && item.color === 'emerald' && "bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20",
                                    isUpcoming && item.color === 'violet' && "bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/30 ring-1 ring-violet-500/20",
                                    isUpcoming && item.color === 'rose' && "bg-gradient-to-br from-rose-500/10 to-pink-500/10 border-rose-500/30 ring-1 ring-rose-500/20",
                                    isUpcoming && item.color === 'sky' && "bg-gradient-to-br from-sky-500/10 to-blue-500/10 border-sky-500/30 ring-1 ring-sky-500/20",
                                    isUpcoming && (!item.color || item.color === 'primary') && "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 ring-1 ring-purple-500/20",
                                    // Past and default states
                                    isPast && "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5 opacity-50 grayscale scale-95",
                                    !isActive && !isUpcoming && !isPast && "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
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
                                    <div className="text-center w-full px-1">
                                        <h4
                                            className={cn(
                                                "font-semibold text-sm mb-0.5 line-clamp-2 break-words",
                                                (isActive || isUpcoming) ? "text-gray-800 dark:text-white" : "text-gray-600 dark:text-gray-300"
                                            )}
                                            title={item.label}
                                        >
                                            {item.label.length > 30 ? item.label.substring(0, 30) + '...' : item.label}
                                        </h4>
                                        {isActive && (
                                            <p className={cn("text-[10px] font-bold animate-pulse", colors.text)}>
                                                현재 진행 중
                                            </p>
                                        )}
                                        {isUpcoming && (
                                            <p className={cn("text-[10px] font-bold", colors.text)}>
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
            {!isMobile && (
                <div
                    className="overflow-y-auto space-y-3 scrollbar-hide"
                    style={{
                        maxHeight: 'calc(5 * 100px)', // Approx 5 items height
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}
                >
                    {timelineItems.map((item, index) => {
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
                                className="relative flex items-center gap-4 group cursor-pointer"
                                onClick={() => setSelectedSchedule({
                                    time: item.time,
                                    label: item.label,
                                    endTime: item.endTime,
                                    location: item.location,
                                    memo: item.memo,
                                    color: item.color,
                                })}
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
                                        ? `${colors.activeGradient} shadow-md`
                                        : isUpcoming
                                            ? `${colors.activeGradient} shadow-md opacity-80`
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

                                            <div className="flex-1 min-w-0 max-w-[400px]">
                                                <h4
                                                    className={cn(
                                                        "font-semibold text-base truncate",
                                                        (isActive || isUpcoming) ? "text-gray-900" : "text-foreground"
                                                    )}
                                                    title={item.label}
                                                >
                                                    {item.label.length > 50 ? item.label.substring(0, 50) + '...' : item.label}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className={cn(
                                                        "text-sm font-mono",
                                                        (isActive || isUpcoming) ? "text-gray-700" : "text-muted-foreground"
                                                    )}>
                                                        {item.time}
                                                        {item.endTime && ` - ${item.endTime}`}
                                                    </p>
                                                    {isActive && (
                                                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", colors.badgeBg, colors.text)}>
                                                            진행 중
                                                        </span>
                                                    )}
                                                    {isUpcoming && (
                                                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", colors.badgeBg, colors.text)}>
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
            )}

            {/* Schedule Detail Popup */}
            <AnimatePresence>
                {selectedSchedule && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedSchedule(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header with color indicator */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={cn(
                                    "w-3 h-3 rounded-full",
                                    selectedSchedule.color === 'yellow' && "bg-yellow-500",
                                    selectedSchedule.color === 'blue' && "bg-blue-500",
                                    selectedSchedule.color === 'purple' && "bg-purple-500",
                                    selectedSchedule.color === 'green' && "bg-green-500",
                                    selectedSchedule.color === 'red' && "bg-red-500",
                                    selectedSchedule.color === 'orange' && "bg-orange-500",
                                    selectedSchedule.color === 'pink' && "bg-pink-500",
                                    selectedSchedule.color === 'amber' && "bg-amber-500",
                                    selectedSchedule.color === 'indigo' && "bg-indigo-500",
                                    selectedSchedule.color === 'cyan' && "bg-cyan-500",
                                    (!selectedSchedule.color || selectedSchedule.color === 'primary') && "bg-purple-500"
                                )} />
                                <h3 className="text-lg font-bold text-gray-900 flex-1">{selectedSchedule.label}</h3>
                                <button
                                    onClick={() => setSelectedSchedule(null)}
                                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <XCircle className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Time */}
                            <div className="flex items-center gap-2 text-gray-600 mb-3">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm font-mono">
                                    {selectedSchedule.time}
                                    {selectedSchedule.endTime && ` - ${selectedSchedule.endTime}`}
                                </span>
                            </div>

                            {/* Location */}
                            {selectedSchedule.location && (
                                <div className="flex items-center gap-2 text-gray-600 mb-3">
                                    <MapPin className="w-4 h-4" />
                                    <span className="text-sm">{selectedSchedule.location}</span>
                                </div>
                            )}

                            {/* Memo/Description */}
                            {selectedSchedule.memo && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <FileText className="w-3 h-3" />
                                        <span>세부사항</span>
                                    </div>
                                    <p className="text-sm text-gray-700">{selectedSchedule.memo}</p>
                                </div>
                            )}

                            {/* Close button */}
                            <Button
                                className="w-full mt-4"
                                variant="outline"
                                onClick={() => setSelectedSchedule(null)}
                            >
                                닫기
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
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
            const cacheKey = `peer_achievements_v2_${job}_${level}`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                try {
                    const { achievements: cachedAchievements, timestamp } = JSON.parse(cached);
                    const thirtyMinutesInMs = 30 * 60 * 1000;

                    if (Date.now() - timestamp < thirtyMinutesInMs) {
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
