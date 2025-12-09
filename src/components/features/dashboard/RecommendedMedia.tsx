"use client";

import { useState, useEffect } from "react";
import { Play, Sparkles, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MediaItem {
    id: string;
    title: string;
    channel: string;
    type: 'youtube';
    tags: string[];
    duration: string;
    description: string;
}

interface RecommendedMediaProps {
    job: string;
    goal?: string;
    interests: string[];
}

export function RecommendedMedia({ job, goal, interests }: RecommendedMediaProps) {
    const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Helper to get "Business Date" (Day starts at 5 AM)
    const getBusinessDate = () => {
        const now = new Date();
        if (now.getHours() < 5) {
            now.setDate(now.getDate() - 1);
        }
        return now.toISOString().split('T')[0];
    };

    const fetchRecommendations = async (forceRefresh = false) => {
        setLoading(true);
        setError(false);

        const today = getBusinessDate();
        const cacheKey = `daily_rec_${job}_${goal}`;
        const historyKey = `rec_history_${job}`;

        // 1. Check Cache (Skip if forceRefresh is true)
        if (!forceRefresh) {
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { date, items } = JSON.parse(cached);
                    if (date === today && items.length > 0) {
                        setRecommendations(items);
                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.error("Cache read error", e);
            }
        }

        // 2. Fetch New Data (with exclusion)
        try {
            // Load history to exclude
            const history = JSON.parse(localStorage.getItem(historyKey) || "[]");

            const response = await fetch("/api/recommendations/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    job,
                    goal,
                    interests,
                    exclude: history.slice(-50) // Send last 50 items to avoid huge payload
                })
            });

            if (!response.ok) throw new Error("Failed to fetch recommendations");

            const data = await response.json();
            const newItems = data.recommendations || [];

            if (newItems.length > 0) {
                setRecommendations(newItems);

                // Update Cache
                localStorage.setItem(cacheKey, JSON.stringify({
                    date: today,
                    items: newItems
                }));

                // Update History (Add new titles)
                const newTitles = newItems.map((item: MediaItem) => item.title);
                const updatedHistory = [...history, ...newTitles];
                // Keep history reasonable size (e.g. last 200)
                localStorage.setItem(historyKey, JSON.stringify(updatedHistory.slice(-200)));
            }
        } catch (err) {
            console.error("Error fetching recommendations:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecommendations();
    }, [job, goal, interests.length]);

    if (error) {
        return (
            <div className="text-center p-4 text-muted-foreground text-sm">
                <p>추천 콘텐츠를 불러오지 못했습니다.</p>
                <Button variant="link" onClick={() => fetchRecommendations(true)} className="text-primary h-auto p-0 mt-1">
                    다시 시도
                </Button>
            </div>
        );
    }

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-xl font-bold text-white">당신을 위한 추천 콘텐츠</h2>
                </div>
                {!loading && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchRecommendations(true)}
                        className="h-8 w-8 p-0 rounded-full hover:bg-white/10"
                    >
                        <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {loading ? (
                    // Skeleton Loading
                    [1, 2, 3].map((i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden h-full flex flex-col animate-pulse">
                            <div className="h-32 bg-white/5" />
                            <div className="p-4 flex-1 space-y-3">
                                <div className="h-4 bg-white/5 rounded w-3/4" />
                                <div className="h-3 bg-white/5 rounded w-full" />
                                <div className="h-3 bg-white/5 rounded w-1/2" />
                            </div>
                        </div>
                    ))
                ) : (
                    recommendations.map((item, index) => (
                        <motion.a
                            key={item.id || index}
                            href={`https://www.youtube.com/watch?v=${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group block"
                        >
                            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-all hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 h-full flex flex-col">
                                {/* YouTube Thumbnail */}
                                <div className="h-32 w-full relative overflow-hidden bg-gradient-to-br from-red-900/40 to-black">
                                    {/* Actual Thumbnail Image */}
                                    <img
                                        src={`https://img.youtube.com/vi/${item.id}/hqdefault.jpg`}
                                        alt={item.title}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        loading="lazy"
                                    />

                                    {/* Dark overlay on hover */}
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

                                    {/* Play button overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                            <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                                        </div>
                                    </div>

                                    {/* Duration badge */}
                                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 rounded text-[10px] font-mono text-white backdrop-blur-sm">
                                        {item.duration}
                                    </div>
                                </div>

                                <div className="p-4 flex-1 flex flex-col">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-red-500/10 text-red-400 border-red-500/20">
                                            YouTube
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate flex-1">
                                            {item.channel}
                                        </span>
                                    </div>

                                    <h3 className="font-semibold text-sm md:text-base leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                                        {item.title}
                                    </h3>

                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
                                        {item.description}
                                    </p>

                                    <div className="flex flex-wrap gap-1.5 mt-auto">
                                        {item.tags?.slice(0, 2).map(tag => (
                                            <span key={tag} className="text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.a>
                    ))
                )}
            </div>
        </section>
    );
}
