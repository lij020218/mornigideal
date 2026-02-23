"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Achievement {
    person: string;
    achievement: string;
}

export function PeerInsightsCard({ job, level }: { job: string; level: string }) {
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
