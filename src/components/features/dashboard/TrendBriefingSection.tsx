"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, RefreshCw, ExternalLink, Loader2, Newspaper, Target, Plus, X, Sparkles, Check, ChevronDown, ChevronUp } from "lucide-react";
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
    onReadBriefing?: (readCount: number) => void;
}

export function TrendBriefingSection({ job, goal, interests = [], onSelectBriefing, onAddInterest, onRemoveInterest, onReadBriefing }: TrendBriefingSectionProps) {
    const [briefings, setBriefings] = useState<TrendBriefing[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>("");
    const [isCached, setIsCached] = useState(false);
    const [newInterest, setNewInterest] = useState("");
    const [isMobileInterestOpen, setIsMobileInterestOpen] = useState(false);
    const [isDesktopInterestOpen, setIsDesktopInterestOpen] = useState(false);
    const [viewedTitles, setViewedTitles] = useState<string[]>([]); // 이미 본 뉴스 제목 추적
    const [readBriefings, setReadBriefings] = useState<Set<string>>(new Set()); // 읽은 브리핑 ID 추적
    const [isContextExpanded, setIsContextExpanded] = useState(false); // 모바일에서 컨텍스트 카드 펼침 상태

    const lastFetchParamsRef = useRef<string>("");

    // Load read briefings from localStorage on mount
    useEffect(() => {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const storedReadKey = `read_briefings_${today}`;
        const storedRead = localStorage.getItem(storedReadKey);
        if (storedRead) {
            try {
                const readIds = JSON.parse(storedRead);
                const readSet = new Set<string>(readIds);
                setReadBriefings(readSet);

                // 저장된 읽음 개수를 부모에게 전달
                if (onReadBriefing) {
                    onReadBriefing(readSet.size);
                }
            } catch (e) {
                console.error('[TrendBriefing] Failed to parse read briefings:', e);
            }
        }

        // Clean up old read data (older than today)
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('read_briefings_') && key !== storedReadKey) {
                localStorage.removeItem(key);
            }
        });
    }, [onReadBriefing]);

    // Mark briefing as read
    const markAsRead = (briefingId: string) => {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const storedReadKey = `read_briefings_${today}`;

        setReadBriefings(prev => {
            // 이미 읽은 브리핑이면 무시
            if (prev.has(briefingId)) return prev;

            const newSet = new Set(prev);
            newSet.add(briefingId);
            // Save to localStorage
            localStorage.setItem(storedReadKey, JSON.stringify([...newSet]));

            // 읽음 개수를 부모에게 전달
            if (onReadBriefing) {
                onReadBriefing(newSet.size);
            }

            return newSet;
        });
    };

    // Handle briefing click - mark as read and call onSelectBriefing
    const handleBriefingClick = (briefing: TrendBriefing) => {
        markAsRead(briefing.id);
        onSelectBriefing(briefing);
    };

    const fetchBriefings = async (forceRefresh = false) => {
        try {
            // Create a unique key for current parameters
            const currentParamsKey = JSON.stringify({ job, goal, interests: interests.sort() });

            // Prevent double fetch if parameters haven't changed and not forcing refresh
            if (!forceRefresh && lastFetchParamsRef.current === currentParamsKey && briefings.length > 0) {
                return;
            }

            setLoading(true);

            // Clean up old localStorage cache
            const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
            const cacheTimestamp = localStorage.getItem('trends_cache_timestamp');
            if (cacheTimestamp) {
                const cacheDate = new Date(cacheTimestamp).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
                if (cacheDate !== today) {
                    localStorage.removeItem('trends_cache');
                    localStorage.removeItem('trends_cache_timestamp');
                    lastFetchParamsRef.current = ""; // Reset ref on new day
                }
            }

            // 1. forceRefresh가 아니면 먼저 사전 생성된 브리핑 확인
            if (!forceRefresh) {
                const pregenResponse = await fetch('/api/trend-briefing/get');

                if (pregenResponse.ok) {
                    const pregenData = await pregenResponse.json();
                    if (pregenData.trends && pregenData.trends.length > 0) {

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
                            try {
                                const updateResponse = await fetch('/api/trend-briefing/update-summaries', {
                                    method: 'POST'
                                });

                                if (updateResponse.ok) {
                                    const updateData = await updateResponse.json();
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

    const handleAddInterestSubmit = (e: React.FormEvent, isMobile: boolean = false) => {
        e.preventDefault();
        if (newInterest.trim() && onAddInterest) {
            onAddInterest(newInterest.trim());
            setNewInterest("");
            if (isMobile) {
                setIsMobileInterestOpen(false);
            } else {
                setIsDesktopInterestOpen(false);
            }
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
                <h2 className="text-xl font-semibold flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <Newspaper className="w-5 h-5 text-white" />
                    </div>
                    <span className="hidden sm:inline text-gradient">오늘의 트렌드 브리핑</span>
                    <span className="sm:hidden text-gradient">트렌드 브리핑</span>
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

            {/* Context Cards Section - Compact on Mobile */}
            {/* Mobile: Collapsible horizontal strip */}
            <div className="md:hidden">
                <button
                    onClick={() => setIsContextExpanded(!isContextExpanded)}
                    className="w-full bg-card border border-border rounded-xl p-3 flex items-center justify-between"
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="p-1 rounded-md bg-primary/10">
                                <Target className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="text-sm font-medium truncate max-w-[120px]">{goal || "목표 설정"}</span>
                        </div>
                        <div className="h-4 w-px bg-border flex-shrink-0" />
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            <Sparkles className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                            {interests.length > 0 ? (
                                <div className="flex gap-1 overflow-hidden">
                                    {interests.slice(0, 2).map((interest, idx) => (
                                        <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded-full truncate max-w-[60px]">
                                            {interest}
                                        </span>
                                    ))}
                                    {interests.length > 2 && (
                                        <span className="text-xs text-muted-foreground">+{interests.length - 2}</span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground">관심사 추가</span>
                            )}
                        </div>
                    </div>
                    {isContextExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                </button>

                {/* Expanded content on mobile */}
                <AnimatePresence>
                    {isContextExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-3 space-y-3">
                                {/* Goal Card - Mobile */}
                                <div className="bg-card border border-border rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                        <div className="p-1 rounded-md bg-primary/10 text-primary">
                                            <Target className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider">My Goal</span>
                                    </div>
                                    <p className="font-semibold text-sm text-foreground">
                                        {goal || "목표를 설정해주세요"}
                                    </p>
                                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                        <span className="w-1 h-1 rounded-full bg-primary/50"></span>
                                        {job}
                                    </div>
                                </div>

                                {/* Interests Card - Mobile */}
                                <div className="bg-card border border-border rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <div className="p-1 rounded-md bg-purple-100 text-purple-600">
                                                <Sparkles className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Interest Areas</span>
                                        </div>
                                        <Popover open={isMobileInterestOpen} onOpenChange={setIsMobileInterestOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] bg-muted hover:bg-muted/80 border border-border rounded-full">
                                                    <Plus className="w-3 h-3 mr-1" />
                                                    추가
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                className="w-60 p-3 bg-white border-border shadow-lg z-[100]"
                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                                onInteractOutside={(e) => {
                                                    // Prevent closing when interacting with input on mobile
                                                    const target = e.target as HTMLElement;
                                                    if (target.tagName === 'INPUT' || target.closest('form')) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                            >
                                                <form onSubmit={(e) => handleAddInterestSubmit(e, true)} className="space-y-2">
                                                    <h4 className="font-medium text-sm text-foreground">관심 분야 추가</h4>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={newInterest}
                                                            onChange={(e) => setNewInterest(e.target.value)}
                                                            placeholder="예: 화장품, AI, 마케팅"
                                                            className="h-8 text-sm bg-muted border-border"
                                                        />
                                                        <Button type="submit" size="sm" className="h-8 px-3">
                                                            <Plus className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </form>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {interests.length > 0 ? (
                                            interests.map((interest, idx) => (
                                                <span
                                                    key={idx}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-muted border border-border text-foreground"
                                                >
                                                    {interest}
                                                    {onRemoveInterest && (
                                                        <button
                                                            onClick={() => onRemoveInterest(interest)}
                                                            className="text-muted-foreground hover:text-red-500 transition-all"
                                                        >
                                                            <X className="w-2.5 h-2.5" />
                                                        </button>
                                                    )}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">관심 분야를 추가해보세요</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Desktop: Original grid layout */}
            <div className="hidden md:grid md:grid-cols-3 gap-4">
                {/* Goal Card */}
                <div className="md:col-span-1 glass-card glass-card-hover rounded-xl p-5 flex flex-col justify-between group">
                    <div className="flex items-center gap-2 text-muted-foreground mb-3">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25">
                            <Target className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gradient">My Goal</span>
                    </div>
                    <div>
                        <p className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
                            {goal || "목표를 설정해주세요"}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"></span>
                            {job}
                        </div>
                    </div>
                </div>

                {/* Interests Card */}
                <div className="md:col-span-2 glass-card glass-card-hover rounded-xl p-5 flex flex-col justify-between relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md shadow-amber-500/25">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-gradient-subtle">Interest Areas</span>
                        </div>
                        <Popover open={isDesktopInterestOpen} onOpenChange={setIsDesktopInterestOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-3 text-xs bg-muted hover:bg-muted/80 border border-border rounded-full">
                                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                                    추가
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-60 p-3 bg-white border-border shadow-lg z-[100]"
                                onOpenAutoFocus={(e) => e.preventDefault()}
                                onInteractOutside={(e) => {
                                    // Prevent closing when interacting with input
                                    const target = e.target as HTMLElement;
                                    if (target.tagName === 'INPUT' || target.closest('form')) {
                                        e.preventDefault();
                                    }
                                }}
                            >
                                <form onSubmit={(e) => handleAddInterestSubmit(e, false)} className="space-y-2">
                                    <h4 className="font-medium text-sm text-foreground">관심 분야 추가</h4>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newInterest}
                                            onChange={(e) => setNewInterest(e.target.value)}
                                            placeholder="예: 화장품, AI, 마케팅"
                                            className="h-8 text-sm bg-muted border-border"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 rounded-xl bg-muted animate-pulse border border-border" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {briefings.map((briefing) => {
                        const isRead = readBriefings.has(briefing.id);
                        return (
                            <motion.div
                                key={briefing.id}
                                layoutId={briefing.id}
                                onClick={() => handleBriefingClick(briefing)}
                                whileHover={{ y: -4 }}
                                className={cn(
                                    "group cursor-pointer relative flex flex-col justify-between h-full rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 transition-all duration-300",
                                    isRead
                                        ? "glass-card opacity-70"
                                        : "glass-card glass-card-hover"
                                )}
                            >
                                {/* 읽음 표시 배지 */}
                                {isRead && (
                                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                                        <Check className="w-3 h-3" />
                                        읽음
                                    </div>
                                )}

                                {/* 안읽음 표시 (그라데이션 점) */}
                                {!isRead && (
                                    <div className="absolute top-3 right-3">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gradient-to-r from-amber-500 to-orange-500"></span>
                                        </span>
                                    </div>
                                )}

                                <div className="space-y-2 sm:space-y-3 md:space-y-4">
                                    <div className="flex justify-between items-start pr-10 sm:pr-12">
                                        <span className={cn("text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full uppercase tracking-wider border", getCategoryColor(briefing.category))}>
                                            {getPrimaryCategory(briefing.category)}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full">{briefing.time}</span>
                                    </div>
                                    <h3 className={cn(
                                        "font-bold text-base md:text-lg leading-snug transition-colors line-clamp-2",
                                        isRead
                                            ? "text-muted-foreground group-hover:text-foreground"
                                            : "text-foreground group-hover:text-gradient"
                                    )}>
                                        {briefing.title}
                                    </h3>
                                    <p className={cn(
                                        "text-sm leading-relaxed font-medium",
                                        isRead ? "text-muted-foreground/70" : "text-foreground/80"
                                    )}>
                                        {briefing.summary}
                                        {!briefing.summary?.includes('확인하세요') && (
                                            <span className="text-primary font-semibold"> 확인하세요!</span>
                                        )}
                                    </p>
                                </div>

                                <div className="mt-5 pt-4 border-t border-border flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className={cn("w-1.5 h-1.5 rounded-full", isRead ? "bg-green-500" : "bg-gradient-to-r from-amber-500 to-orange-500")} />
                                        {briefing.source}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gradient font-medium opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                                        <span>{isRead ? "다시 보기" : "Read More"}</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
            {/* Recommended Media Section */}
            <RecommendedMedia job={job} goal={goal} interests={interests} />
        </motion.section>
    );
}
