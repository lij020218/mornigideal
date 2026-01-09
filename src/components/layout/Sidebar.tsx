"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, CalendarDays, Lightbulb, TrendingUp, User, Settings, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
    const [isOpen, setIsOpen] = useState(true); // 기본값을 true로 (데스크톱에서 열림)
    const [isMobile, setIsMobile] = useState(false);
    const pathname = usePathname();

    // Detect mobile/desktop and set initial state
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // 모바일이면 닫힌 상태로, 데스크톱이면 열린 상태로
            if (mobile && isOpen) {
                setIsOpen(false);
            } else if (!mobile && !isOpen) {
                setIsOpen(true);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Hide sidebar on certain pages
    const hiddenPages = ["/login", "/signup", "/onboarding", "/reset"];
    const isLearningPage = pathname?.includes("/learn/");

    if (hiddenPages.includes(pathname || "") || isLearningPage) {
        return null;
    }

    return (
        <>
            {/* Mobile Hamburger Button - Only on mobile when closed */}
            {isMobile && !isOpen && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="fixed top-4 left-4 z-[60] bg-card/90 backdrop-blur-sm border border-border hover:bg-muted"
                    onClick={() => setIsOpen(true)}
                >
                    <Menu className="w-5 h-5" />
                </Button>
            )}

            {/* Mobile Overlay - Only on mobile when open */}
            <AnimatePresence>
                {isOpen && isMobile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                        onClick={() => setIsOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    x: isMobile && !isOpen ? "-100%" : 0,
                }}
                transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                }}
                className={cn(
                    "fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col py-6 z-50",
                    "w-56 md:w-20"
                )}
            >
                {/* Logo (Desktop) or Close Button (Mobile) */}
                {isMobile ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="mb-8 mx-6 self-start"
                        onClick={() => setIsOpen(false)}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                ) : (
                    <Link href="/" className="mb-8 mx-auto">
                        <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                            <span className="text-white font-bold text-lg">F</span>
                        </div>
                    </Link>
                )}

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
                                onClick={() => isMobile && setIsOpen(false)}
                            >
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={cn(
                                        "rounded-xl flex items-center transition-colors relative",
                                        "md:w-14 md:h-14 md:justify-center",
                                        "w-full h-12 px-4 gap-3",
                                        isActive
                                            ? "bg-foreground text-white"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
                                    <span className="md:hidden text-sm font-medium">{item.label}</span>
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

                                {/* Tooltip - Desktop only */}
                                <div className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
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
                                onClick={() => isMobile && setIsOpen(false)}
                            >
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={cn(
                                        "rounded-xl flex items-center transition-colors",
                                        "md:w-14 md:h-14 md:justify-center",
                                        "w-full h-12 px-4 gap-3",
                                        isActive
                                            ? "bg-foreground text-white"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className="w-5 h-5 flex-shrink-0" />
                                    <span className="md:hidden text-sm font-medium">{item.label}</span>
                                </motion.div>

                                {/* Tooltip - Desktop only */}
                                <div className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                    <div className="bg-foreground text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg">
                                        {item.label}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </motion.aside>
        </>
    );
}
