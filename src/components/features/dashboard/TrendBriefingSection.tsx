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
            "AI": "bg-purple-500/20 text-purple-400 border-purple-500/30",
            "Business": "bg-blue-500/20 text-blue-400 border-blue-500/30",
            "Tech": "bg-green-500/20 text-green-400 border-green-500/30",
            "Finance": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
            "Strategy": "bg-red-500/20 text-red-400 border-red-500/30",
            "Innovation": "bg-pink-500/20 text-pink-400 border-pink-500/30",
        };
        return colors[category] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
    };

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Newspaper className="w-6 h-6 text-blue-500" /> 오늘의 트렌드 브리핑
                </h2>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-muted-foreground">
                            {isCached ? "캐시됨" : "새로 생성됨"} • {new Date(lastUpdated).toLocaleString('ko-KR')}
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-white gap-2"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                        {refreshing ? "생성 중..." : "새로고침"}
                    </Button>
                </div>
            </div>

            <Card className="glass-card border-none overflow-hidden">
                <CardContent className="p-6">
                    {loading && !refreshing ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : briefings.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>트렌드 브리핑을 불러올 수 없습니다</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <AnimatePresence mode="popLayout">
                                {briefings.map((briefing, index) => (
                                    <motion.div
                                        key={briefing.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="cursor-pointer"
                                        onClick={() => onSelectBriefing(briefing)}
                                    >
                                        <Card className="h-full bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                                            <CardContent className="p-5 flex flex-col h-full">
                                                {/* Category Badge */}
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className={cn(
                                                        "px-2.5 py-1 text-xs font-medium rounded-full border",
                                                        getCategoryColor(briefing.category)
                                                    )}>
                                                        {briefing.category}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {briefing.time}
                                                    </span>
                                                </div>

                                                {/* Title */}
                                                <h3 className="font-semibold text-base mb-2 line-clamp-2 min-h-[3rem]">
                                                    {briefing.title}
                                                </h3>

                                                {/* Summary */}
                                                <p className="text-sm text-muted-foreground line-clamp-3 mb-3 flex-1">
                                                    {briefing.summary}
                                                </p>

                                                {/* Source */}
                                                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                                                    <span className="text-xs font-medium text-primary">
                                                        {briefing.source}
                                                    </span>
                                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                                </div>
                                            </CardContent>
                                        </Card>
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
