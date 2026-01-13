"use client";

import { useState, useEffect, useRef } from "react";
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

    const lastFetchParamsRef = useRef<string>("");

    const fetchBriefings = async (forceRefresh = false) => {
        try {
            // Create a unique key for current parameters
            const currentParamsKey = JSON.stringify({ job, goal, interests: interests.sort() });

            // Prevent double fetch if parameters haven't changed and not forcing refresh
            if (!forceRefresh && lastFetchParamsRef.current === currentParamsKey && briefings.length > 0) {
                console.log('[TrendBriefing] Skipping duplicate fetch for same parameters');
                return;
            }

            setLoading(true);

            // Clean up old localStorage cache
            const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
            const cacheTimestamp = localStorage.getItem('trends_cache_timestamp');
            if (cacheTimestamp) {
                const cacheDate = new Date(cacheTimestamp).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
                if (cacheDate !== today) {
                    console.log('[TrendBriefing] Clearing outdated cache from', cacheDate);
                    localStorage.removeItem('trends_cache');
                    localStorage.removeItem('trends_cache_timestamp');
                    lastFetchParamsRef.current = ""; // Reset ref on new day
                }
            }

            // 1. forceRefresh가 아니면 먼저 사전 생성된 브리핑 확인
            if (!forceRefresh) {
                console.log('[TrendBriefing] Checking for pre-generated briefing...');
                const pregenResponse = await fetch('/api/trend-briefing/get');

                if (pregenResponse.ok) {
                    const pregenData = await pregenResponse.json();
                    if (pregenData.trends && pregenData.trends.length > 0) {
                        console.log('[TrendBriefing] Found pre-generated briefing!');

                        // Check if summaries need updating (old format: too long OR keyword-style)
                        // Keyword-style detection: contains comma/arrow patterns like "키워드, 키워드↑" or missing proper verb endings
                        const needsUpdate = pregenData.trends.some((t: any) => {
                            if (!t.summary) return false;
                            const summary = t.summary.replace('확인하세요!', '').trim();
                            // Too long
                            if (summary.length > 40) return true;
                            // Keyword style: has comma followed by space and more text, or has arrows
                            if (/,\s+\S/.test(summary) || /[↑↓]/.test(summary)) return true;
                            // Missing proper sentence ending (should end with 다, 요, 요! before 확인하세요)
                            if (!/[다요]\.\s*$/.test(summary) && !summary.endsWith('합니다.') && !summary.endsWith('했습니다.') && !summary.endsWith('됩니다.') && !summary.endsWith('했어요.')) return true;
                            return false;
                        });

                        if (needsUpdate) {
                            console.log('[TrendBriefing] Detected old format summaries, updating...');
                            try {
                                const updateResponse = await fetch('/api/trend-briefing/update-summaries', {
                                    method: 'POST'
                                });

                                if (updateResponse.ok) {
                                    const updateData = await updateResponse.json();
                                    console.log('[TrendBriefing] Summaries updated successfully!');
                                    setBriefings(updateData.trends);
                                } else {
                                    // If update fails, use old summaries
                                    setBriefings(pregenData.trends);
                                }
                            } catch (updateError) {
                                console.error('[TrendBriefing] Failed to update summaries:', updateError);
                                setBriefings(pregenData.trends);
                            }
                        } else {
                            setBriefings(pregenData.trends);
                        }

                        setLastUpdated(pregenData.generated_at || new Date().toISOString());
                        setIsCached(true);
                        setLoading(false);
                        lastFetchParamsRef.current = currentParamsKey; // Update ref

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
            lastFetchParamsRef.current = currentParamsKey; // Update ref

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

    // Extract the most relevant category from multi-category string
    const getPrimaryCategory = (category: string): string => {
        if (!category) return "General";

        // If multiple categories separated by / or , pick the first one
        const categories = category.split(/[\/,]/).map(c => c.trim());

        // Priority order for category selection (based on relevance)
        const priorityOrder = ["AI", "Tech", "Finance", "Business", "Strategy", "Innovation"];

        // Find the highest priority category from the list
        for (const priority of priorityOrder) {
            const found = categories.find(c => c.toLowerCase() === priority.toLowerCase());
            if (found) return found;
        }

        // If no priority match, return the first category
        return categories[0] || "General";
    };

    const getCategoryColor = (category: string) => {
        const primaryCat = getPrimaryCategory(category);
        const colors: Record<string, string> = {
            "AI": "bg-purple-100 text-purple-700 border-purple-200",
            "Business": "bg-blue-100 text-blue-700 border-blue-200",
            "Tech": "bg-emerald-100 text-emerald-700 border-emerald-200",
            "Finance": "bg-amber-100 text-amber-700 border-amber-200",
            "Strategy": "bg-rose-100 text-rose-700 border-rose-200",
            "Innovation": "bg-cyan-100 text-cyan-700 border-cyan-200",
        };
        return colors[primaryCat] || "bg-gray-100 text-gray-700 border-gray-200";
    };

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-blue-400" />
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
                        className="text-xs md:text-sm px-3 border-border hover:bg-muted transition-all"
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
                <div className="md:col-span-1 bg-card border border-border rounded-xl p-5 flex flex-col justify-between group transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center gap-2 text-muted-foreground mb-3">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <Target className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">My Goal</span>
                    </div>
                    <div>
                        <p className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
                            {goal || "목표를 설정해주세요"}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                            {job}
                        </div>
                    </div>
                </div>

                {/* Interests Card */}
                <div className="md:col-span-2 bg-card border border-border rounded-xl p-5 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">Interest Areas</span>
                        </div>
                        <Popover open={isInterestOpen} onOpenChange={setIsInterestOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-3 text-xs bg-muted hover:bg-muted/80 border border-border rounded-full">
                                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                                    추가
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 p-3 bg-white border-border shadow-lg">
                                <form onSubmit={handleAddInterestSubmit} className="space-y-2">
                                    <h4 className="font-medium text-sm text-foreground">관심 분야 추가</h4>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newInterest}
                                            onChange={(e) => setNewInterest(e.target.value)}
                                            placeholder="예: 화장품, AI, 마케팅"
                                            className="h-8 text-sm bg-muted border-border"
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
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted border border-border text-foreground hover:bg-muted/80 transition-all group/tag cursor-default"
                                >
                                    {interest}
                                    {onRemoveInterest && (
                                        <button
                                            onClick={() => onRemoveInterest(interest)}
                                            className="opacity-0 group-hover/tag:opacity-100 text-muted-foreground hover:text-red-500 transition-all -mr-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </span>
                            ))
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground opacity-60">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-dashed border-border">
                                    <Plus className="w-4 h-4" />
                                </div>
                                <span className="italic">관심 분야를 추가하여 맞춤형 뉴스를 받아보세요</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 rounded-xl bg-muted animate-pulse border border-border" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {briefings.map((briefing) => (
                        <motion.div
                            key={briefing.id}
                            layoutId={briefing.id}
                            onClick={() => onSelectBriefing(briefing)}
                            whileHover={{ y: -4 }}
                            className="group cursor-pointer relative flex flex-col justify-between h-full bg-card border border-border rounded-xl p-5 transition-all duration-300 hover:shadow-lg"
                        >
                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border", getCategoryColor(briefing.category))}>
                                        {getPrimaryCategory(briefing.category)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full">{briefing.time}</span>
                                </div>
                                <h3 className="font-bold text-base md:text-lg leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                    {briefing.title}
                                </h3>
                                <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                                    {briefing.summary}
                                </p>
                            </div>

                            <div className="mt-5 pt-4 border-t border-border flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    {briefing.source}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                                    <span>Read More</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </div>
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
