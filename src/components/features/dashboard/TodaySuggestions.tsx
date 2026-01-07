"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Plus, Clock, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Suggestion {
    id: string;
    title: string;
    description: string;
    action: string;
    category: "exercise" | "learning" | "productivity" | "wellness";
    estimatedTime: string;
    priority: "high" | "medium" | "low";
    icon: string;
}

interface TodaySuggestionsProps {
    userProfile: {
        job: string;
        goal: string;
        level: string;
    } | null;
    currentTime: Date;
    onAddToSchedule?: (suggestion: Suggestion) => void;
}

export function TodaySuggestions({ userProfile, currentTime, onAddToSchedule }: TodaySuggestionsProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showDurationInput, setShowDurationInput] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
    const [durationInput, setDurationInput] = useState("");

    const hour = currentTime.getHours();

    // Load added suggestions from localStorage on mount
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const storedKey = `added_suggestions_${today}`;

        const stored = localStorage.getItem(storedKey);

        if (stored) {
            try {
                const addedIds = JSON.parse(stored);
                setAddedSuggestions(new Set(addedIds));
            } catch (e) {
                console.error('Failed to parse stored suggestions:', e);
            }
        }
    }, []);

    // Generate time-based suggestions
    useEffect(() => {
        if (userProfile) {
            fetchAISuggestions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hour, userProfile?.job, userProfile?.goal]);


    const fetchAISuggestions = async () => {
        if (!userProfile) {
            setSuggestions([]);
            return;
        }

        try {
            setLoading(true);
            console.log('[TodaySuggestions] AI 추천 요청 시작');

            // Get added schedules from state
            const addedSchedulesList = Array.from(addedSuggestions);

            const response = await fetch("/api/ai-suggest-schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userProfile: {
                        job: userProfile.job,
                        goal: userProfile.goal,
                    },
                    addedSchedules: addedSchedulesList,
                    timeOfDay: hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "evening",
                }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('[TodaySuggestions] AI 추천 응답:', data);

                if (data.suggestions && data.suggestions.length > 0) {
                    setSuggestions(data.suggestions);
                } else {
                    console.warn('[TodaySuggestions] AI 추천 결과가 비어있음');
                    setSuggestions([]);
                }
            } else {
                console.error('[TodaySuggestions] AI 추천 요청 실패:', response.status);
                setSuggestions([]);
            }
        } catch (error) {
            console.error('[TodaySuggestions] AI 추천 에러:', error);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddClick = (suggestion: Suggestion) => {
        setSelectedSuggestion(suggestion);
        setDurationInput(suggestion.estimatedTime); // Pre-fill with AI's estimate
        setShowDurationInput(true);
    };

    const handleConfirmAdd = async () => {
        if (!selectedSuggestion || !durationInput.trim()) return;

        try {
            setLoading(true);
            setShowDurationInput(false);

            const now = new Date();
            const today = now.toISOString().split('T')[0];

            // Map category to color
            const categoryColorMap: Record<string, string> = {
                exercise: 'pink',
                learning: 'cyan',
                productivity: 'purple',
                wellness: 'green',
            };

            // Add to schedule with user-specified duration
            const response = await fetch("/api/user/schedule/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: selectedSuggestion.action,
                    specificDate: today,
                    findAvailableSlot: true,
                    estimatedDuration: durationInput,
                    color: categoryColorMap[selectedSuggestion.category] || 'blue',
                }),
            });

            if (response.ok) {
                const newAddedSet = new Set(addedSuggestions).add(selectedSuggestion.action);
                setAddedSuggestions(newAddedSet);

                const storedKey = `added_suggestions_${today}`;
                localStorage.setItem(storedKey, JSON.stringify(Array.from(newAddedSet)));

                console.log('[TodaySuggestions] 카드 추가됨:', selectedSuggestion.action);

                // 이벤트 로깅 (사용자 행동 패턴 수집)
                try {
                    await fetch("/api/user/events/log", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            eventType: "schedule_added",
                            startAt: new Date().toISOString(),
                            metadata: {
                                activity: selectedSuggestion.action,
                                category: selectedSuggestion.category,
                                estimatedTime: durationInput,
                                source: "ai_suggestion",
                            },
                        }),
                    });
                    console.log('[TodaySuggestions] 이벤트 로깅 완료');
                } catch (error) {
                    console.error('[TodaySuggestions] 이벤트 로깅 실패:', error);
                }

                // Fetch ONE new suggestion to replace this one
                console.log('[TodaySuggestions] 1개의 새로운 추천 요청');
                const addedSchedulesList = Array.from(newAddedSet);

                const newSuggestionResponse = await fetch("/api/ai-suggest-schedules", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userProfile: {
                            job: userProfile?.job,
                            goal: userProfile?.goal,
                        },
                        addedSchedules: addedSchedulesList,
                        timeOfDay: hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "evening",
                        requestCount: 1, // Request only 1 new suggestion
                    }),
                });

                if (newSuggestionResponse.ok) {
                    const newData = await newSuggestionResponse.json();
                    if (newData.suggestions && newData.suggestions.length > 0) {
                        // Replace the added suggestion with the new one
                        setSuggestions(prevSuggestions => {
                            const index = prevSuggestions.findIndex(s => s.id === selectedSuggestion.id);
                            if (index !== -1) {
                                const newSuggestions = [...prevSuggestions];
                                newSuggestions[index] = newData.suggestions[0];
                                return newSuggestions;
                            }
                            return prevSuggestions;
                        });
                    }
                }

                // Notify Dashboard to refresh schedule
                console.log("[TodaySuggestions] 일정 업데이트 이벤트 발송");
                window.dispatchEvent(new CustomEvent('schedule-updated'));

                // Get AI resource recommendations
                console.log("[TodaySuggestions] 일정 추가 성공, AI 리소스 요청 시작:", selectedSuggestion.action);
                const resourceResponse = await fetch("/api/ai-resource-recommend", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        activity: selectedSuggestion.action,
                        category: selectedSuggestion.category,
                    }),
                });

                console.log("[TodaySuggestions] AI 리소스 응답 상태:", resourceResponse.status);

                if (resourceResponse.ok) {
                    const resourceData = await resourceResponse.json();
                    console.log("[TodaySuggestions] AI 리소스 데이터:", resourceData);

                    // Send message to AI chat by dispatching custom event
                    const chatMessage = `✅ "${selectedSuggestion.action}" 일정이 추가되었습니다!\n\n${resourceData.recommendation}`;
                    console.log("[TodaySuggestions] AI 채팅 이벤트 발송:", chatMessage);

                    window.dispatchEvent(new CustomEvent('ai-chat-message', {
                        detail: {
                            role: 'assistant',
                            content: chatMessage,
                        }
                    }));

                    // Auto-open AI chat after 500ms
                    setTimeout(() => {
                        console.log("[TodaySuggestions] AI 채팅 오픈 이벤트 발송");
                        window.dispatchEvent(new CustomEvent('ai-chat-open'));
                    }, 500);
                } else {
                    console.error("[TodaySuggestions] AI 리소스 요청 실패:", await resourceResponse.text());
                }

                if (onAddToSchedule) {
                    onAddToSchedule(selectedSuggestion);
                }
            }
        } catch (error) {
            console.error("Failed to add suggestion to schedule:", error);
        } finally {
            setLoading(false);
            setDurationInput("");
            setSelectedSuggestion(null);
        }
    };

    const getCategoryStyle = (category: string) => {
        const styles = {
            exercise: "border-l-rose-400",
            learning: "border-l-blue-400",
            productivity: "border-l-purple-400",
            wellness: "border-l-emerald-400",
        };
        return styles[category as keyof typeof styles] || styles.productivity;
    };

    const getIconBg = (category: string) => {
        const styles = {
            exercise: "bg-rose-100/80 text-rose-600",
            learning: "bg-blue-100/80 text-blue-600",
            productivity: "bg-purple-100/80 text-purple-600",
            wellness: "bg-emerald-100/80 text-emerald-600",
        };
        return styles[category as keyof typeof styles] || styles.productivity;
    };

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 280;
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    if (suggestions.length === 0) return null;

    return (
        <div className="space-y-4 overflow-visible">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800 tracking-tight">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    <span className="bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent opacity-90">
                        Smart Suggestions
                    </span>
                </h2>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/50 hover:bg-white" onClick={() => scroll('left')}>
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/50 hover:bg-white" onClick={() => scroll('right')}>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    </Button>
                </div>
            </div>

            {/* Horizontal Scroll Carousel */}
            <div
                ref={scrollContainerRef}
                className="flex gap-4 overflow-x-auto overflow-y-visible pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory scrollbar-hide pt-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {suggestions.map((suggestion, index) => {
                    const isAdded = addedSuggestions.has(suggestion.action);

                    return (
                        <motion.div
                            key={suggestion.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                                "flex-shrink-0 w-[280px] snap-start",
                                "relative overflow-visible rounded-2xl p-5 transition-all duration-300",
                                "bg-white/40 backdrop-blur-xl border border-white/60",
                                "shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]",
                                "hover:bg-white/60 hover:-translate-y-1",
                                "border-l-[6px]", // Focus color indicator
                                getCategoryStyle(suggestion.category),
                                isAdded && "opacity-60 grayscale-[0.5]"
                            )}
                        >
                            {/* Icon + Title */}
                            <div className="flex items-start gap-3 mb-3">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border border-white/50", getIconBg(suggestion.category))}>
                                    {suggestion.icon}
                                </div>
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <h3 className="font-bold text-gray-900 truncate tracking-tight text-[15px]">
                                        {suggestion.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 truncate mt-0.5 font-medium">
                                        {suggestion.description}
                                    </p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white/50 px-2.5 py-1 rounded-full border border-white/20">
                                    <Clock className="w-3.5 h-3.5" />
                                    {suggestion.estimatedTime}
                                </div>

                                {isAdded ? (
                                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold bg-green-50/80 px-3 py-1.5 rounded-full">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Added
                                    </div>
                                ) : (
                                    <Button
                                        size="sm"
                                        onClick={() => handleAddClick(suggestion)}
                                        disabled={loading}
                                        className="h-8 px-4 text-xs font-semibold bg-gray-900 hover:bg-black text-white rounded-full shadow-lg shadow-gray-200 transition-all hover:scale-105 active:scale-95"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <>
                                                <Plus className="w-3.5 h-3.5 mr-1.5" />
                                                Add
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Center Modal with Backdrop */}
            <AnimatePresence>
                {showDurationInput && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/30 z-[9998]"
                            onClick={() => {
                                setShowDurationInput(false);
                                setDurationInput("");
                                setSelectedSuggestion(null);
                            }}
                        />

                        {/* Centered Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] bg-white rounded-xl p-5 shadow-2xl border border-gray-200 z-[9999]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p className="text-sm text-gray-700 mb-3 font-semibold">
                                소요 시간
                            </p>

                            <input
                                type="text"
                                value={durationInput}
                                onChange={(e) => setDurationInput(e.target.value)}
                                placeholder="예: 30분, 1시간"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-4"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && durationInput.trim()) {
                                        handleConfirmAdd();
                                    }
                                    if (e.key === 'Escape') {
                                        setShowDurationInput(false);
                                        setDurationInput("");
                                        setSelectedSuggestion(null);
                                    }
                                }}
                            />

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setShowDurationInput(false);
                                        setDurationInput("");
                                        setSelectedSuggestion(null);
                                    }}
                                    className="flex-1 h-9 text-sm"
                                >
                                    취소
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleConfirmAdd}
                                    disabled={!durationInput.trim() || loading}
                                    className="flex-1 h-9 text-sm bg-gray-900 hover:bg-black text-white"
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        "추가"
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
