"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Sparkles, RefreshCw, X, Dumbbell, Calendar, BookOpen,
    Target, Zap, TrendingUp, Coffee, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SmartSuggestion {
    id: string;
    type: 'activity' | 'health' | 'event' | 'learning' | 'productivity';
    title: string;
    message: string;
    actionText?: string;
    actionUrl?: string;
    priority: 'high' | 'medium' | 'low';
    icon: string;
}

const iconMap: Record<string, any> = {
    Dumbbell,
    Calendar,
    BookOpen,
    Target,
    Zap,
    TrendingUp,
    Coffee,
    Sparkles,
    AlertCircle,
};

const typeColors = {
    activity: "bg-blue-50 border-blue-200",
    health: "bg-green-50 border-green-200",
    event: "bg-purple-50 border-purple-200",
    learning: "bg-orange-50 border-orange-200",
    productivity: "bg-red-50 border-red-200",
};

const typeGradients = {
    activity: "from-blue-500 to-cyan-500",
    health: "from-green-500 to-emerald-500",
    event: "from-purple-500 to-pink-500",
    learning: "from-orange-500 to-yellow-500",
    productivity: "from-red-500 to-rose-500",
};

export function SmartSuggestionCard() {
    const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    const fetchSuggestions = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/smart-suggestions');

            if (!response.ok) {
                throw new Error('Failed to fetch suggestions');
            }

            const data = await response.json();
            const items = data.suggestions || [];
            setSuggestions(items);
            // 추천 노출 이벤트 로깅
            if (items.length > 0) {
                fetch("/api/user/events/log", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        eventType: "ai_suggestion_shown",
                        startAt: new Date().toISOString(),
                        metadata: {
                            suggestions: items.map((s: any) => ({
                                id: s.id,
                                category: s.type || s.category,
                                title: s.title,
                            })),
                            source: "smart_suggestion_card",
                            hour: new Date().getHours(),
                        },
                    }),
                }).catch(() => {});
            }
        } catch (err) {
            console.error('[SmartSuggestion] Error:', err);
            setError("제안을 불러오는데 실패했습니다");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => new Set([...prev, id]));
        // 추천 거부 이벤트 로깅
        const dismissed = suggestions.find(s => s.id === id);
        if (dismissed) {
            fetch("/api/user/events/log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventType: "ai_suggestion_dismissed",
                    startAt: new Date().toISOString(),
                    metadata: {
                        suggestion_id: id,
                        category: dismissed.type || dismissed.category,
                        title: dismissed.title,
                        source: "smart_suggestion_card",
                    },
                }),
            }).catch(() => {});
        }
    };

    const visibleSuggestions = suggestions.filter(s => !dismissedIds.has(s.id));

    if (loading) {
        return (
            <Card className="glass-card border-none overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">AI가 맞춤 제안을 생성하는 중...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || visibleSuggestions.length === 0) {
        return null; // Don't show anything if no suggestions
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-lg font-bold text-foreground">AI 어시스턴트의 제안</h2>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={fetchSuggestions}
                    disabled={loading}
                    className="h-8 w-8 rounded-full hover:bg-black/5"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </Button>
            </div>

            <AnimatePresence mode="popLayout">
                {visibleSuggestions.map((suggestion, index) => {
                    const Icon = iconMap[suggestion.icon] || Sparkles;

                    return (
                        <motion.div
                            key={suggestion.id}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -100, scale: 0.95 }}
                            transition={{
                                delay: index * 0.1,
                                type: "spring",
                                stiffness: 300,
                                damping: 25
                            }}
                        >
                            <Card className={cn(
                                "relative overflow-hidden border backdrop-blur-sm",
                                typeColors[suggestion.type]
                            )}>
                                {/* Animated gradient blob */}
                                <div className={cn(
                                    "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30",
                                    "bg-gradient-to-br",
                                    typeGradients[suggestion.type]
                                )} />

                                <CardContent className="p-4 relative">
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className={cn(
                                            "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                                            "bg-white"
                                        )}>
                                            <Icon className={cn("w-6 h-6",
                                                suggestion.type === 'activity' && "text-blue-500",
                                                suggestion.type === 'health' && "text-green-500",
                                                suggestion.type === 'event' && "text-purple-500",
                                                suggestion.type === 'learning' && "text-orange-500",
                                                suggestion.type === 'productivity' && "text-red-500"
                                            )} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h3 className="font-semibold text-foreground leading-tight">
                                                    {suggestion.title}
                                                </h3>
                                                <button
                                                    onClick={() => handleDismiss(suggestion.id)}
                                                    className="shrink-0 w-6 h-6 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors"
                                                >
                                                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                </button>
                                            </div>

                                            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                                                {suggestion.message}
                                            </p>

                                            {suggestion.actionText && (
                                                suggestion.actionUrl ? (
                                                    <Link href={suggestion.actionUrl}>
                                                        <Button
                                                            size="sm"
                                                            className={cn(
                                                                "h-8 text-xs font-medium shadow-md",
                                                                "bg-gradient-to-r text-white border-0",
                                                                typeGradients[suggestion.type],
                                                                "hover:opacity-90 transition-opacity"
                                                            )}
                                                        >
                                                            {suggestion.actionText}
                                                        </Button>
                                                    </Link>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 text-xs bg-white border-black/10 hover:bg-black/5"
                                                    >
                                                        {suggestion.actionText}
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Priority indicator */}
                                    {suggestion.priority === 'high' && (
                                        <div className="absolute top-2 right-2">
                                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
