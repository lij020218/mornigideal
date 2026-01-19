"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, User, Settings, Sparkles, LogOut } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationDropdown } from "@/components/features/dashboard/NotificationDropdown";
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

    const handleBriefingClick = () => {
        // Trigger event that Dashboard will listen to
        window.dispatchEvent(new CustomEvent('open-daily-briefing'));
        setShowProfileMenu(false);
    };

    // Hide on landing, onboarding, login, signup pages
    const hideHeaderPages = ["/", "/onboarding", "/login", "/signup", "/reset"];
    if (isLearningPage || hideHeaderPages.includes(pathname || "")) return null;

    return (
        <>
            {/* Desktop only - on mobile, notification/profile are in Sidebar top bar */}
            <header className="hidden md:flex fixed top-0 left-20 right-0 z-40 justify-between items-center px-4 md:px-6 py-3 glass rounded-none border-t-0 border-x-0">
                <Link href="/dashboard" className="text-lg font-bold text-foreground">
                    Fi.eri
                </Link>

                <div className="flex gap-3 md:gap-4 items-center">
                    {/* Notification Bell */}
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full hover:bg-black/5 transition-colors relative text-foreground"
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
                                goals={userProfile.customGoals || []}
                                isOpen={showNotificationDropdown}
                                onClose={() => setShowNotificationDropdown(false)}
                            />
                        )}
                    </div>

                    {/* Profile Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="w-9 h-9 rounded-full bg-foreground cursor-pointer hover:ring-2 hover:ring-foreground/30 transition-all shadow-md"
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
                                        className="absolute right-0 top-12 w-56 bg-white border border-border rounded-xl shadow-lg z-50 py-2"
                                    >
                                        <div className="px-4 py-3 border-b border-border mb-2">
                                            <p className="text-sm font-medium text-foreground">{username}</p>
                                            <p className="text-xs text-muted-foreground truncate">{userProfile?.job || "User"}</p>
                                        </div>

                                        <button
                                            onClick={handleBriefingClick}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors text-foreground flex items-center gap-3"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            일일 브리핑
                                        </button>

                                        <Link
                                            href="/mypage"
                                            className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted transition-colors text-foreground"
                                            onClick={() => setShowProfileMenu(false)}
                                        >
                                            <User className="w-4 h-4" />
                                            마이페이지
                                        </Link>
                                        <Link
                                            href="/settings"
                                            className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted transition-colors text-foreground"
                                            onClick={() => setShowProfileMenu(false)}
                                        >
                                            <Settings className="w-4 h-4" />
                                            설정
                                        </Link>

                                        <div className="border-t border-border my-2" />

                                        <button
                                            onClick={async () => {
                                                // Clear all localStorage data
                                                localStorage.clear();
                                                // Sign out using NextAuth client-side signOut
                                                await signOut({ callbackUrl: '/login' });
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors text-red-600 flex items-center gap-3"
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
            {/* Spacer for fixed header - desktop only */}
            <div className="hidden md:block h-16" />
        </>
    );
}
