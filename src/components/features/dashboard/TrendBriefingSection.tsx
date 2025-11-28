"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, RefreshCw, ExternalLink, Loader2, Newspaper, Target, Plus, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { RecommendedMedia } from "./RecommendedMedia";

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
    goal?: string;
    interests?: string[];
    onSelectBriefing: (briefing: TrendBriefing) => void;
    onAddInterest?: (interest: string) => void;
    onRemoveInterest?: (interest: string) => void;
}

export function TrendBriefingSection({ job, goal, interests = [], onSelectBriefing, onAddInterest, onRemoveInterest }: TrendBriefingSectionProps) {
    const [briefings, setBriefings] = useState<TrendBriefing[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>("");
    const [isCached, setIsCached] = useState(false);
    const [newInterest, setNewInterest] = useState("");
    const [isInterestOpen, setIsInterestOpen] = useState(false);
    const [viewedTitles, setViewedTitles] = useState<string[]>([]); // 이미 본 뉴스 제목 추적

    const fetchBriefings = async (forceRefresh = false) => {
        try {
            setLoading(true);

            // 1. forceRefresh가 아니면 먼저 사전 생성된 브리핑 확인
            if (!forceRefresh) {
                console.log('[TrendBriefing] Checking for pre-generated briefing...');
                const pregenResponse = await fetch('/api/trend-briefing/get');

                if (pregenResponse.ok) {
                    const pregenData = await pregenResponse.json();
                    if (pregenData.trends && pregenData.trends.length > 0) {
                        console.log('[TrendBriefing] Found pre-generated briefing!');
                        setBriefings(pregenData.trends);
                        setLastUpdated(pregenData.generated_at || new Date().toISOString());
                        setIsCached(true);
                        setLoading(false);

                        // 이미 본 뉴스 제목 저장
                        setViewedTitles(prev => [...prev, ...pregenData.trends.map((t: any) => t.title)]);
                        return;
                    }
                }
                console.log('[TrendBriefing] No pre-generated briefing, generating on-demand...');
            }

            // 2. 실시간 생성 (fallback 또는 forceRefresh)
            const params = new URLSearchParams({ job });
            if (goal) params.append("goal", goal);
            if (interests.length > 0) params.append("interests", interests.join(","));
            if (forceRefresh) params.append("forceRefresh", "true");

            // 새로고침 시 이미 본 뉴스 제외
            if (forceRefresh && viewedTitles.length > 0) {
                params.append("exclude", viewedTitles.join("|||")); // |||로 구분
            }

            const response = await fetch(`/api/trend-briefing?${params.toString()}`);
            if (!response.ok) throw new Error("Failed to fetch briefings");

            const data = await response.json();
            const newTrends = data.trends || [];
            setBriefings(newTrends);
            setLastUpdated(data.lastUpdated || new Date().toISOString());
            setIsCached(data.cached || false);

            // 새로 본 뉴스 제목 추가
            if (forceRefresh) {
                setViewedTitles(prev => [...prev, ...newTrends.map((t: any) => t.title)]);
            }
        } catch (error) {
            console.error("[TrendBriefing] Error fetching briefings:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBriefings();
    }, [job, goal, interests.length]); // Re-fetch when context changes

    const handleRefresh = () => {
        setRefreshing(true);
        fetchBriefings(true); // Force refresh to get new briefings based on interests
    };

    const handleAddInterestSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newInterest.trim() && onAddInterest) {
            onAddInterest(newInterest.trim());
            setNewInterest("");
            setIsInterestOpen(false);
        }
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
            className="space-y-6"
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

            {/* Context Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Goal Card */}
                <div className="md:col-span-1 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-xl p-4 flex flex-col justify-between group hover:border-white/20 transition-all">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Target className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium uppercase tracking-wider">My Goal</span>
                    </div>
                    <div>
                        <p className="font-semibold text-white group-hover:text-primary transition-colors line-clamp-2">
                            {goal || "목표를 설정해주세요"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{job}</p>
                    </div>
                </div>

                {/* Interests Card */}
                <div className="md:col-span-2 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-medium uppercase tracking-wider">Interest Areas</span>
                        </div>
                        <Popover open={isInterestOpen} onOpenChange={setIsInterestOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs hover:bg-white/10">
                                    <Plus className="w-3 h-3 mr-1" />
                                    추가
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 p-3 bg-[#1a1a1a] border-white/10 text-white">
                                <form onSubmit={handleAddInterestSubmit} className="space-y-2">
                                    <h4 className="font-medium text-sm">관심 분야 추가</h4>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newInterest}
                                            onChange={(e) => setNewInterest(e.target.value)}
                                            placeholder="예: 화장품, AI, 마케팅"
                                            className="h-8 text-sm bg-white/5 border-white/10"
                                            autoFocus
                                        />
                                        <Button type="submit" size="sm" className="h-8 px-3">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </form>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {interests.length > 0 ? (
                            interests.map((interest, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all group"
                                >
                                    {interest}
                                    {onRemoveInterest && (
                                        <button
                                            onClick={() => onRemoveInterest(interest)}
                                            className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </span>
                            ))
                        ) : (
                            <span className="text-sm text-muted-foreground italic">관심 분야를 추가하여 맞춤형 뉴스를 받아보세요</span>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 rounded-xl bg-white/5 animate-pulse border border-white/5" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {briefings.map((briefing) => (
                        <motion.div
                            key={briefing.id}
                            layoutId={briefing.id}
                            onClick={() => onSelectBriefing(briefing)}
                            className="group cursor-pointer relative flex flex-col justify-between h-full bg-gradient-to-br from-white/5 to-white/0 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all hover:shadow-lg hover:shadow-purple-500/5 hover:-translate-y-1"
                        >
                            <div className="space-y-3">
                                <div className="flex justify-between items-start">
                                    <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider", getCategoryColor(briefing.category))}>
                                        {briefing.category}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">{briefing.time}</span>
                                </div>
                                <h3 className="font-bold text-base md:text-lg leading-snug group-hover:text-primary transition-colors line-clamp-2">
                                    {briefing.title}
                                </h3>
                                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                    {briefing.summary}
                                </p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    {briefing.source}
                                </div>
                                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors opacity-0 group-hover:opacity-100" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
            {/* Recommended Media Section */}
            <RecommendedMedia job={job} goal={goal} interests={interests} />
        </motion.section>
    );
}
