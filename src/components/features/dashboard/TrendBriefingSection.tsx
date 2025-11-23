"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, RefreshCw, ExternalLink, Loader2, Newspaper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TrendBriefing {
    id: string;
    title: string;
    category: string;
    summary: string;
    time: string;
    imageColor: string;
    originalUrl: string;
    imageUrl?: string;
    source: string;
    relevance?: string;
}

interface TrendBriefingSectionProps {
    job: string;
    onSelectBriefing: (briefing: TrendBriefing) => void;
}

export function TrendBriefingSection({ job, onSelectBriefing }: TrendBriefingSectionProps) {
    const [briefings, setBriefings] = useState<TrendBriefing[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>("");
    const [isCached, setIsCached] = useState(false);

    const fetchBriefings = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/trend-briefing?job=${encodeURIComponent(job)}`);
            if (!response.ok) throw new Error("Failed to fetch briefings");

            const data = await response.json();
            setBriefings(data.trends || []);
            setLastUpdated(data.lastUpdated || "");
            setIsCached(data.cached || false);
        } catch (error) {
            console.error("Error fetching briefings:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBriefings();
    }, [job]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchBriefings();
    };

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            "AI": "bg-purple-500/20 text-purple-300 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]",
            "Business": "bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]",
            "Tech": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
            "Finance": "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
            "Strategy": "bg-rose-500/20 text-rose-300 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]",
            "Innovation": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]",
        };
        return colors[category] || "bg-gray-500/20 text-gray-300 border-gray-500/30";
    };

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    <Newspaper className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                    <span className="hidden sm:inline">오늘의 트렌드 브리핑</span>
                    <span className="sm:hidden">트렌드 브리핑</span>
                </h2>
                <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
                    {lastUpdated && (
                        <span className="text-[10px] md:text-xs text-muted-foreground flex-1 sm:flex-none font-mono">
                            {isCached ? "캐시됨" : "새로 생성됨"} • {new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs md:text-sm px-3 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-all"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5", refreshing && "animate-spin")} />
                        <span className="hidden md:inline">{refreshing ? "생성 중..." : "새로고침"}</span>
                    </Button>
                </div>
            </div>

            <Card className="glass-card border-none overflow-hidden bg-black/20 backdrop-blur-xl">
                <CardContent className="p-3 md:p-6">
                    {loading && !refreshing ? (
                        <div className="flex flex-col items-center justify-center py-12 md:py-20 gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                                <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin text-blue-400 relative z-10" />
                            </div>
                            <p className="text-sm text-muted-foreground animate-pulse">트렌드를 분석하고 있습니다...</p>
                        </div>
                    ) : briefings.length === 0 ? (
                        <div className="text-center py-12 md:py-20 text-muted-foreground">
                            <Newspaper className="w-10 h-10 md:w-14 md:h-14 mx-auto mb-3 md:mb-4 opacity-30" />
                            <p className="text-sm md:text-base">트렌드 브리핑을 불러올 수 없습니다</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                            <AnimatePresence mode="popLayout">
                                {briefings.map((briefing, index) => (
                                    <motion.div
                                        key={briefing.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileHover={{ y: -5, scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="cursor-pointer group h-full"
                                        onClick={() => onSelectBriefing(briefing)}
                                    >
                                        <div className="h-full relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-white/10 hover:to-white/5 transition-all duration-300 shadow-lg hover:shadow-primary/10 hover:border-white/20">
                                            {/* Hover Glow Effect */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                            <div className="p-4 md:p-5 flex flex-col h-full relative z-10">
                                                {/* Category Badge */}
                                                <div className="flex items-center justify-between mb-3 md:mb-4">
                                                    <span className={cn(
                                                        "px-2.5 py-1 text-[10px] md:text-xs font-bold rounded-full border backdrop-blur-md",
                                                        getCategoryColor(briefing.category)
                                                    )}>
                                                        {briefing.category}
                                                    </span>
                                                    <span className="text-[10px] md:text-xs text-muted-foreground font-mono">
                                                        {briefing.time}
                                                    </span>
                                                </div>

                                                {/* Title */}
                                                <h3 className="font-bold text-base md:text-lg mb-2 md:mb-3 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                                                    {briefing.title}
                                                </h3>

                                                {/* Summary */}
                                                <p className="text-xs md:text-sm text-muted-foreground/80 line-clamp-3 mb-4 flex-1 leading-relaxed">
                                                    {briefing.summary}
                                                </p>

                                                {/* Footer */}
                                                <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                                                    <span className="text-[10px] md:text-xs font-medium text-white/50 group-hover:text-white/80 transition-colors flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-white/30 group-hover:bg-primary transition-colors" />
                                                        {briefing.source}
                                                    </span>
                                                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                                        <ExternalLink className="w-3 h-3" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.section>
    );
}
