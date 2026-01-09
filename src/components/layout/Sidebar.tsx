"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MessageSquare, CalendarDays, Lightbulb, TrendingUp, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    {
        label: "채팅",
        href: "/",
        icon: MessageSquare,
        description: "AI 채팅",
    },
    {
        label: "일정",
        href: "/dashboard",
        icon: CalendarDays,
        description: "일정 관리",
    },
    {
        label: "인사이트",
        href: "/insights",
        icon: Lightbulb,
        description: "트렌드 & 이메일",
    },
    {
        label: "성장",
        href: "/growth",
        icon: TrendingUp,
        description: "학습 & 분석",
    },
];

const BOTTOM_ITEMS = [
    {
        label: "마이페이지",
        href: "/mypage",
        icon: User,
    },
    {
        label: "설정",
        href: "/settings",
        icon: Settings,
    },
];

export function Sidebar() {
    const pathname = usePathname();

    // Hide sidebar on certain pages
    const hiddenPages = ["/login", "/signup", "/onboarding", "/reset"];
    const isLearningPage = pathname?.includes("/learn/");

    if (hiddenPages.includes(pathname || "") || isLearningPage) {
        return null;
    }

    return (
        <aside className="fixed left-0 top-0 h-screen w-20 bg-card border-r border-border flex flex-col items-center py-6 z-50">
            {/* Logo */}
            <Link href="/" className="mb-8">
                <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                    <span className="text-white font-bold text-lg">F</span>
                </div>
            </Link>

            {/* Main Navigation */}
            <nav className="flex-1 flex flex-col gap-2 w-full px-3">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="relative group"
                        >
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                    "w-14 h-14 rounded-xl flex items-center justify-center transition-colors relative",
                                    isActive
                                        ? "bg-foreground text-white"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className="w-6 h-6" />
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-indicator"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-foreground rounded-r-full"
                                        style={{ left: -12 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 500,
                                            damping: 30,
                                        }}
                                    />
                                )}
                            </motion.div>

                            {/* Tooltip */}
                            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                <div className="bg-foreground text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg">
                                    <p className="font-medium">{item.label}</p>
                                    <p className="text-xs text-white/70">{item.description}</p>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Navigation */}
            <div className="flex flex-col gap-2 w-full px-3">
                {BOTTOM_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="relative group"
                        >
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                    "w-14 h-14 rounded-xl flex items-center justify-center transition-colors",
                                    isActive
                                        ? "bg-foreground text-white"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className="w-5 h-5" />
                            </motion.div>

                            {/* Tooltip */}
                            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                <div className="bg-foreground text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg">
                                    {item.label}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </aside>
    );
}
