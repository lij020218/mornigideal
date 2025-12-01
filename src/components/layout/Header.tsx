"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, User, Settings, Sparkles, LogOut } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationDropdown } from "@/components/features/dashboard/NotificationDropdown";
import { DailyBriefingModal } from "@/components/features/dashboard/DailyBriefingModal";
import { getDailyGoals } from "@/lib/dailyGoals";
import { signOut } from "next-auth/react";

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
    customGoals?: any[];
    interests?: string[];
}

import { usePathname } from "next/navigation";

export function Header() {
    const pathname = usePathname();
    const isLearningPage = pathname?.includes("/learn/");
    const isLandingPage = pathname === "/";
    const isOnboardingPage = pathname === "/onboarding";

    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
    const [username, setUsername] = useState("User");

    // Daily Briefing State
    const [showDailyBriefing, setShowDailyBriefing] = useState(false);
    const [dailyBriefingData, setDailyBriefingData] = useState<any>(null);
    const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            // Load username
            // In a real app, this would come from auth session.
            // For now, we'll try to get it from localStorage or default to "User"
            // The Dashboard prop 'username' was passed from page.tsx which got it from searchParams or default.
            // We'll assume a default or stored value if possible, but for now "User" is safe.
            // Actually, let's try to fetch it from the same API if possible, or just use "User".

            const savedProfile = localStorage.getItem("user_profile");
            if (savedProfile) {
                setUserProfile(JSON.parse(savedProfile));
            }

            try {
                const response = await fetch("/api/user/profile");
                if (response.ok) {
                    const data = await response.json();
                    if (data.profile) {
                        setUserProfile(data.profile);
                        localStorage.setItem("user_profile", JSON.stringify(data.profile));
                    }
                }
            } catch (error) {
                console.error("Failed to fetch profile:", error);
            }
        };

        loadProfile();

        // Listen for profile updates from Dashboard
        const handleProfileUpdate = () => {
            const savedProfile = localStorage.getItem("user_profile");
            if (savedProfile) {
                console.log("[Header] Profile updated, reloading from localStorage");
                setUserProfile(JSON.parse(savedProfile));
            }
        };

        window.addEventListener('profile-updated', handleProfileUpdate);
        return () => {
            window.removeEventListener('profile-updated', handleProfileUpdate);
        };
    }, []);

    const loadOrGenerateBriefing = async () => {
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `daily_briefing_${today}`;

        // 1. Check localStorage first (fastest)
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                setDailyBriefingData(JSON.parse(cached));
                setShowDailyBriefing(true);
                return;
            } catch (e) {
                console.error('[Header] Failed to parse cached briefing', e);
            }
        }

        if (!userProfile) return;

        setIsGeneratingBriefing(true);
        setShowDailyBriefing(true);

        try {
            // 2. Try to load pre-generated briefing from API
            console.log('[Header] Checking for pre-generated briefing...');
            const pregenResponse = await fetch('/api/daily-briefing/get');

            if (pregenResponse.ok) {
                const pregenData = await pregenResponse.json();
                if (pregenData.briefing) {
                    console.log('[Header] Found pre-generated briefing!');
                    setDailyBriefingData(pregenData.briefing);
                    localStorage.setItem(cacheKey, JSON.stringify(pregenData.briefing));
                    localStorage.setItem("last_briefing_date", today);
                    setIsGeneratingBriefing(false);
                    return;
                }
            }

            // 3. If no pre-generated briefing, generate on-demand (fallback)
            console.log('[Header] No pre-generated briefing found, generating now...');

            const trendsResponse = await fetch(`/api/trend-briefing?job=${userProfile.job}&interests=${userProfile.interests?.join(',')}`);
            const trendsData = await trendsResponse.json();

            const { getPreviousDailyGoals } = await import("@/lib/dailyGoals");
            const yesterdayGoals = getPreviousDailyGoals();

            const response = await fetch("/api/daily-briefing/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userProfile,
                    yesterdayGoals: yesterdayGoals || {},
                    todaySchedule: userProfile.schedule,
                    yesterdayTrends: trendsData.trends || []
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setDailyBriefingData(data);
                localStorage.setItem(cacheKey, JSON.stringify(data));
                localStorage.setItem("last_briefing_date", today);
            } else {
                setShowDailyBriefing(false);
            }
        } catch (error) {
            console.error("[Header] Error loading/generating briefing:", error);
            setShowDailyBriefing(false);
        } finally {
            setIsGeneratingBriefing(false);
        }
    };

    if (isLearningPage || isLandingPage || isOnboardingPage) return null;

    return (
        <>
            <DailyBriefingModal
                isOpen={showDailyBriefing}
                onClose={() => setShowDailyBriefing(false)}
                data={dailyBriefingData}
                isLoading={isGeneratingBriefing}
            />

            <header className="fixed top-0 left-0 right-0 z-40 flex justify-between items-center px-4 md:px-6 py-3 bg-background/80 backdrop-blur-md border-b border-white/5">
                <Link href="/" className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
                    A.ideal
                </Link>

                <div className="flex gap-3 md:gap-4 items-center">
                    {/* Notification Bell */}
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full hover:bg-white/10 transition-colors relative"
                            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                        >
                            <Bell className="w-5 h-5" />
                            {(userProfile?.schedule || (userProfile?.customGoals && userProfile.customGoals.some(g =>
                                g.daysOfWeek?.includes(new Date().getDay()) && g.notificationEnabled
                            ))) && (
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
                                )}
                        </Button>
                        {userProfile && (
                            <NotificationDropdown
                                goals={[
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
                                            daysOfWeek: [1, 2, 3, 4, 5],
                                            notificationEnabled: true,
                                        },
                                        {
                                            id: 'work-end',
                                            text: '업무 종료',
                                            time: 'evening' as const,
                                            startTime: userProfile.schedule.workEnd,
                                            endTime: userProfile.schedule.workEnd,
                                            color: 'green',
                                            daysOfWeek: [1, 2, 3, 4, 5],
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
                                    ...(userProfile.customGoals || []),
                                ]}
                                isOpen={showNotificationDropdown}
                                onClose={() => setShowNotificationDropdown(false)}
                            />
                        )}
                    </div>

                    {/* Profile Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all shadow-lg shadow-primary/20"
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

                                        <button
                                            onClick={() => {
                                                loadOrGenerateBriefing();
                                                setShowProfileMenu(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors text-yellow-400 hover:text-yellow-300 flex items-center gap-3"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            일일 브리핑
                                        </button>

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

                                        <div className="border-t border-white/5 my-2" />

                                        <button
                                            onClick={async () => {
                                                // Clear all localStorage data
                                                localStorage.clear();
                                                // Sign out using NextAuth client-side signOut
                                                await signOut({ callbackUrl: '/login' });
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors text-red-400 hover:text-red-300 flex items-center gap-3"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            로그아웃
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>
            {/* Spacer for fixed header */}
            <div className="h-16" />
        </>
    );
}
