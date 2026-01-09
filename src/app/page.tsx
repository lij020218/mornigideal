"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Send, Sparkles, Clock, CheckCircle2, Calendar, Plus, Loader2, Target, X, Coffee, Utensils, Moon, Dumbbell, BookOpen, Briefcase, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TrendBriefingDetail } from "@/components/features/dashboard/TrendBriefingDetail";

interface Schedule {
    id: string;
    text: string;
    startTime: string;
    endTime?: string;
    completed?: boolean;
    skipped?: boolean;
    color?: string;
}

interface ChatAction {
    type: "add_schedule" | "open_briefing";
    label: string;
    data: Record<string, any>;
}

interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    actions?: ChatAction[];
}

interface RecommendationCard {
    id: string;
    title: string;
    description: string;
    estimatedTime: string;
    icon: string;
    category: string;
    priority?: string;
    action?: () => void;
}

type AppState = "idle" | "chatting" | "schedule-expanded";

const PLACEHOLDER_ROTATION = [
    "오늘 일정 추천해줘",
    "이 일정 내일로 옮겨줘",
    "브리핑 3줄 요약",
    "오늘 할 일 정리해줘",
    "트렌드 요약해줘",
];

export default function HomePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // Redirect if not authenticated
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    // State
    const [appState, setAppState] = useState<AppState>("idle");
    const [scheduleExpanded, setScheduleExpanded] = useState(false);
    const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [selectedBriefing, setSelectedBriefing] = useState<any>(null);
    const [trendBriefings, setTrendBriefings] = useState<any[]>([]);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [showRecommendations, setShowRecommendations] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isFetchingRecommendations = useRef(false);
    const hasFetchedRecommendations = useRef(false);

    // Load messages from localStorage on mount
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const savedMessages = localStorage.getItem(`chat_messages_${today}`);

        if (savedMessages) {
            try {
                const parsed = JSON.parse(savedMessages);
                // Convert timestamp strings back to Date objects
                const messagesWithDates = parsed.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                setMessages(messagesWithDates);
                console.log('[Home] Loaded messages from localStorage:', messagesWithDates.length);
            } catch (error) {
                console.error('[Home] Failed to parse saved messages:', error);
            }
        }

        // Clean up old messages (older than today)
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if (key.startsWith('chat_messages_') && key !== `chat_messages_${today}`) {
                localStorage.removeItem(key);
                console.log('[Home] Removed old messages:', key);
            }
        });
    }, []);

    // Save messages to localStorage whenever they change
    useEffect(() => {
        if (messages.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem(`chat_messages_${today}`, JSON.stringify(messages));
            console.log('[Home] Saved messages to localStorage:', messages.length);
        }
    }, [messages]);

    // Rotate placeholder every 4 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_ROTATION.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Fetch today's schedules and user profile
    useEffect(() => {
        if (!session?.user?.email) return;

        const fetchSchedules = async () => {
            try {
                const response = await fetch('/api/user/profile');
                if (response.ok) {
                    const data = await response.json();
                    const today = new Date().toISOString().split('T')[0];
                    const now = new Date();
                    const currentDay = now.getDay();

                    console.log('[Home] Fetched profile data:', data);
                    console.log('[Home] Custom goals:', data.profile?.customGoals);

                    // Store user profile for AI context
                    setUserProfile(data.profile);

                    // Include both specific date schedules AND recurring schedules for today
                    const todayGoals = data.profile?.customGoals?.filter((g: any) => {
                        const isSpecificDate = g.specificDate === today;
                        const isRecurringToday = g.daysOfWeek?.includes(currentDay);
                        console.log(`[Home] Checking goal "${g.text}": specificDate=${g.specificDate}, daysOfWeek=${g.daysOfWeek}, matches=${isSpecificDate || isRecurringToday}`);
                        return isSpecificDate || isRecurringToday;
                    }) || [];

                    // Load completion status from localStorage
                    const completions = JSON.parse(localStorage.getItem(`schedule_completions_${today}`) || '{}');
                    const schedulesWithStatus = todayGoals.map((g: any) => ({
                        ...g,
                        completed: completions[g.id]?.completed || false,
                        skipped: completions[g.id]?.skipped || false
                    }));

                    setTodaySchedules(schedulesWithStatus.sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')));
                    console.log('[Home] Loaded schedules:', schedulesWithStatus.length, schedulesWithStatus);
                }
            } catch (error) {
                console.error('[Home] Failed to fetch schedules:', error);
            }
        };

        fetchSchedules();

        // Listen for schedule updates
        const handleScheduleUpdate = () => {
            console.log('[Home] Schedule updated, refetching...');
            fetchSchedules();
        };

        window.addEventListener('schedule-added', handleScheduleUpdate);
        window.addEventListener('schedule-updated', handleScheduleUpdate);
        window.addEventListener('schedule-deleted', handleScheduleUpdate);

        // Poll for updates every 30 seconds
        const pollInterval = setInterval(fetchSchedules, 30000);

        return () => {
            window.removeEventListener('schedule-added', handleScheduleUpdate);
            window.removeEventListener('schedule-updated', handleScheduleUpdate);
            window.removeEventListener('schedule-deleted', handleScheduleUpdate);
            clearInterval(pollInterval);
        };
    }, [session]);

    // Fetch trend briefings
    useEffect(() => {
        if (!session?.user?.email || !userProfile) return;

        const fetchTrendBriefings = async () => {
            try {
                const params = new URLSearchParams({
                    job: userProfile.job || 'Professional',
                    goal: userProfile.goal || '',
                    interests: (userProfile.interests || []).join(','),
                });

                const response = await fetch(`/api/trend-briefing?${params.toString()}`);

                if (response.ok) {
                    const data = await response.json();
                    setTrendBriefings(data.trends || []);
                    console.log('[Home] Loaded trend briefings:', data.trends?.length);
                }
            } catch (error) {
                console.error('[Home] Failed to fetch trend briefings:', error);
            }
        };

        fetchTrendBriefings();
    }, [session, userProfile]);

    // Fetch AI recommendations (when idle)
    useEffect(() => {
        if (appState !== "idle" || !session?.user?.email) return;

        // Only fetch if we haven't fetched yet and we're not currently fetching
        if (hasFetchedRecommendations.current || isFetchingRecommendations.current) return;
        if (recommendations.length > 0) return;

        const fetchRecommendations = async () => {
            // Set flag to prevent duplicate calls
            isFetchingRecommendations.current = true;
            console.log('[Home] Fetching AI recommendations...');

            try {
                const response = await fetch('/api/ai-suggest-schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestCount: 3 }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const cards: RecommendationCard[] = data.suggestions.map((s: any) => ({
                        id: s.id || `rec-${Date.now()}`,
                        title: s.title,
                        description: s.description,
                        estimatedTime: s.estimatedTime,
                        icon: s.icon,
                        category: s.category,
                        priority: s.priority,
                    }));
                    setRecommendations(cards);
                    hasFetchedRecommendations.current = true;
                    console.log('[Home] AI recommendations fetched successfully:', cards.length);
                }
            } catch (error) {
                console.error('[Home] Failed to fetch recommendations:', error);
            } finally {
                isFetchingRecommendations.current = false;
            }
        };

        fetchRecommendations();
    }, [appState, session]);

    // Find current/next schedule
    const getCurrentSchedule = () => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const currentSchedule = todaySchedules.find(
            (s) => s.startTime <= currentTime && (!s.endTime || s.endTime >= currentTime)
        );

        if (currentSchedule) {
            return { schedule: currentSchedule, status: 'in-progress' as const };
        }

        const nextSchedule = todaySchedules.find((s) => s.startTime > currentTime);
        if (nextSchedule) {
            return { schedule: nextSchedule, status: 'upcoming' as const };
        }

        return null;
    };

    const currentScheduleInfo = getCurrentSchedule();

    // Get icon for schedule based on text
    const getScheduleIcon = (text: string) => {
        const lowerText = text.toLowerCase();

        // 식사
        if (lowerText.includes('아침') || lowerText.includes('breakfast')) return Coffee;
        if (lowerText.includes('점심') || lowerText.includes('lunch')) return Utensils;
        if (lowerText.includes('저녁') || lowerText.includes('dinner') || lowerText.includes('식사')) return Utensils;

        // 수면
        if (lowerText.includes('취침') || lowerText.includes('수면') || lowerText.includes('잠')) return Moon;

        // 운동
        if (lowerText.includes('운동') || lowerText.includes('헬스') || lowerText.includes('조깅') ||
            lowerText.includes('요가') || lowerText.includes('수영')) return Dumbbell;

        // 학습/독서
        if (lowerText.includes('공부') || lowerText.includes('학습') || lowerText.includes('독서') ||
            lowerText.includes('책')) return BookOpen;

        // 업무
        if (lowerText.includes('업무') || lowerText.includes('회의') || lowerText.includes('미팅') ||
            lowerText.includes('작업')) return Briefcase;

        // 기본값
        return Target;
    };

    // Get personalized message for schedule
    const getScheduleMessage = (text: string, status: 'in-progress' | 'upcoming') => {
        const lowerText = text.toLowerCase();

        if (status === 'in-progress') {
            // 집중 중일 때
            if (lowerText.includes('아침')) return '좋은 아침이에요! 맛있게 드세요 😊';
            if (lowerText.includes('점심')) return '점심 시간이에요! 맛있게 드세요 🍽️';
            if (lowerText.includes('저녁') || lowerText.includes('식사')) return '저녁 시간이에요! 맛있게 드세요 ✨';
            if (lowerText.includes('취침') || lowerText.includes('수면')) return '편안한 밤 되세요! 푹 쉬시길 🌙';
            if (lowerText.includes('운동') || lowerText.includes('헬스')) return '운동 시간이에요! 파이팅 💪';
            if (lowerText.includes('요가')) return '요가로 몸과 마음을 편안하게 🧘';
            if (lowerText.includes('조깅') || lowerText.includes('러닝')) return '달리기 시간이에요! 힘내세요 🏃';
            if (lowerText.includes('공부') || lowerText.includes('학습')) return '공부 시간이에요! 집중해볼까요? 📚';
            if (lowerText.includes('독서') || lowerText.includes('책')) return '독서 시간이에요! 좋은 책과 함께 📖';
            if (lowerText.includes('업무') || lowerText.includes('작업')) return '업무 시간이에요! 오늘도 화이팅 💼';
            if (lowerText.includes('회의') || lowerText.includes('미팅')) return '회의 시간이에요! 준비되셨나요? 🤝';
            return '지금 하고 있는 일에 집중하세요! 🎯';
        } else {
            // 곧 시작할 때
            if (lowerText.includes('아침')) return '곧 아침 식사 시간이에요!';
            if (lowerText.includes('점심')) return '곧 점심 시간이에요!';
            if (lowerText.includes('저녁') || lowerText.includes('식사')) return '곧 저녁 시간이에요!';
            if (lowerText.includes('취침') || lowerText.includes('수면')) return '곧 취침 시간이에요. 준비하세요';
            if (lowerText.includes('운동') || lowerText.includes('헬스') || lowerText.includes('요가')) return '곧 운동 시간! 준비운동 하세요';
            if (lowerText.includes('공부') || lowerText.includes('학습')) return '곧 학습 시간! 교재를 준비하세요';
            if (lowerText.includes('독서')) return '곧 독서 시간! 책을 펼쳐보세요';
            if (lowerText.includes('업무') || lowerText.includes('작업')) return '곧 업무 시작! 파일을 확인하세요';
            if (lowerText.includes('회의') || lowerText.includes('미팅')) return '곧 회의 시작! 자료를 준비하세요';
            return '다음 일정이 곧 시작됩니다!';
        }
    };

    // Handle send message
    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);
        setAppState("chatting"); // Hide recommendations when chatting

        try {
            const res = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    context: {
                        trendBriefings: trendBriefings,
                        schedules: todaySchedules,
                    },
                }),
            });

            if (!res.ok) throw new Error("Failed to get response");

            const data = await res.json();
            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: data.message,
                timestamp: new Date(),
                actions: data.actions || [],
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // Handle actions (e.g., add_schedule)
            if (data.actions && Array.isArray(data.actions)) {
                for (const action of data.actions) {
                    if (action.type === 'add_schedule' && action.data) {
                        try {
                            // Add schedule via API
                            const scheduleRes = await fetch("/api/user/schedule/add", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(action.data),
                            });

                            if (scheduleRes.ok) {
                                // Show success message
                                setMessages((prev) => [
                                    ...prev,
                                    {
                                        id: `system-${Date.now()}`,
                                        role: "system",
                                        content: `✅ "${action.data.text}" 일정이 추가되었습니다!`,
                                        timestamp: new Date(),
                                    },
                                ]);

                                // Trigger schedule update event
                                window.dispatchEvent(new CustomEvent('schedule-added', { detail: { source: 'ai-chat' } }));

                                // Refetch schedules
                                const profileRes = await fetch('/api/user/profile');
                                if (profileRes.ok) {
                                    const profileData = await profileRes.json();
                                    const today = new Date().toISOString().split('T')[0];
                                    const currentDay = new Date().getDay();
                                    const todayGoals = profileData.profile?.customGoals?.filter((g: any) => {
                                        const isSpecificDate = g.specificDate === today;
                                        const isRecurringToday = g.daysOfWeek?.includes(currentDay);
                                        return isSpecificDate || isRecurringToday;
                                    }) || [];

                                    const completions = JSON.parse(localStorage.getItem(`schedule_completions_${today}`) || '{}');
                                    const schedulesWithStatus = todayGoals.map((g: any) => ({
                                        ...g,
                                        completed: completions[g.id]?.completed || false,
                                        skipped: completions[g.id]?.skipped || false
                                    }));

                                    setTodaySchedules(schedulesWithStatus.sort((a: any, b: any) =>
                                        (a.startTime || '').localeCompare(b.startTime || '')
                                    ));
                                }
                            } else {
                                setMessages((prev) => [
                                    ...prev,
                                    {
                                        id: `error-${Date.now()}`,
                                        role: "system",
                                        content: "❌ 일정 추가에 실패했습니다.",
                                        timestamp: new Date(),
                                    },
                                ]);
                            }
                        } catch (error) {
                            console.error('[Home] Failed to add schedule from AI:', error);
                        }
                    }
                }
            }

            // After response, go back to idle to show recommendations
            setTimeout(() => {
                setAppState("idle");
            }, 1000);

        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: "죄송합니다. 응답을 가져오는데 실패했습니다.",
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Handle recommendation card click
    const handleAddRecommendation = async (card: RecommendationCard) => {
        try {
            // Add user message asking to add the schedule
            const userMessage: Message = {
                id: `user-${Date.now()}`,
                role: "user",
                content: `"${card.title}" 일정을 추가하고 싶어`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMessage]);

            // Send to AI to ask for time preference
            setIsLoading(true);
            setAppState("chatting");

            try {
                const aiRes = await fetch("/api/ai-chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: [...messages, userMessage].map((m) => ({
                            role: m.role,
                            content: m.content,
                        })),
                        context: {
                            pendingSchedule: {
                                title: card.title,
                                description: card.description,
                                estimatedTime: card.estimatedTime,
                                category: card.category,
                            },
                            trendBriefings: trendBriefings,
                            schedules: todaySchedules,
                        }
                    }),
                });

                if (aiRes.ok) {
                    const aiData = await aiRes.json();
                    const assistantMessage: Message = {
                        id: `assistant-${Date.now()}`,
                        role: "assistant",
                        content: aiData.message,
                        timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, assistantMessage]);

                    // Handle actions if AI returns them (e.g., add_schedule with suggested time)
                    if (aiData.actions && Array.isArray(aiData.actions)) {
                        for (const action of aiData.actions) {
                            if (action.type === 'add_schedule' && action.data) {
                                // AI might suggest a time, store it for user to confirm
                                console.log('[Home] AI suggested schedule:', action.data);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('[Home] Failed to get AI response:', error);
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `error-${Date.now()}`,
                        role: "assistant",
                        content: "죄송합니다. 일정 추가를 처리하는데 문제가 발생했습니다.",
                        timestamp: new Date(),
                    },
                ]);
            } finally {
                setIsLoading(false);
                // Go back to idle after a short delay
                setTimeout(() => {
                    setAppState("idle");
                }, 1000);
            }

            // Remove the card from recommendations
            setRecommendations((prev) => prev.filter((r) => r.id !== card.id));
        } catch (error) {
            console.error('[Home] Failed to handle recommendation:', error);
        }
    };

    if (status === "loading") {
        return (
            <div className="h-screen flex items-center justify-center md:ml-20">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-screen bg-background flex flex-col relative md:ml-20">
            {/* 1️⃣ TOP: Current Schedule Card */}
            <motion.div
                className="flex-shrink-0 px-6 pt-20 md:pt-6"
                initial={false}
                animate={{ height: scheduleExpanded ? "auto" : "auto" }}
            >
                <div className={cn(
                    "rounded-2xl transition-all",
                    currentScheduleInfo?.status === 'in-progress'
                        ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                        : currentScheduleInfo
                            ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                            : "bg-gradient-to-br from-gray-500/10 to-gray-600/10 border border-gray-500/30"
                )}>
                    {/* Collapsed View */}
                    <button
                        onClick={() => setScheduleExpanded(!scheduleExpanded)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 rounded-2xl transition-colors"
                    >
                        <div className="flex items-center gap-4 flex-1">
                            {currentScheduleInfo ? (
                                <>
                                    <div className={cn(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300",
                                        currentScheduleInfo.status === 'in-progress'
                                            ? "bg-gradient-to-br from-blue-500 to-cyan-600 shadow-blue-500/20"
                                            : "bg-gradient-to-br from-purple-500 to-pink-600 shadow-purple-500/20"
                                    )}>
                                        {(() => {
                                            const ScheduleIcon = getScheduleIcon(currentScheduleInfo.schedule.text);
                                            return <ScheduleIcon className="w-7 h-7 text-white" />;
                                        })()}
                                    </div>
                                    <div className="text-left flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={cn(
                                                "text-xs font-bold px-3 py-1 rounded-full border",
                                                currentScheduleInfo.status === 'in-progress'
                                                    ? "bg-blue-500 text-white border-blue-600 shadow-md"
                                                    : "bg-purple-500/80 text-white border-purple-600 shadow-md"
                                            )}>
                                                {currentScheduleInfo.status === 'in-progress' ? '집중 중' : '곧 시작'}
                                            </span>
                                            <span className="text-sm font-mono text-muted-foreground">
                                                {currentScheduleInfo.schedule.startTime}
                                            </span>
                                        </div>
                                        <p className="font-bold text-lg mb-1">{currentScheduleInfo.schedule.text}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {getScheduleMessage(currentScheduleInfo.schedule.text, currentScheduleInfo.status)}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-lg">
                                        <Sparkles className="w-7 h-7 text-white" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-bold text-lg mb-1">오늘 일정이 없습니다</p>
                                        <p className="text-xs text-muted-foreground">AI가 추천하는 일정을 추가해보세요</p>
                                    </div>
                                </>
                            )}
                        </div>
                        <ChevronDown
                            className={cn(
                                "w-5 h-5 text-muted-foreground transition-transform",
                                scheduleExpanded && "rotate-180"
                            )}
                        />
                    </button>

                    {/* Expanded View - Timeline */}
                    <AnimatePresence>
                        {scheduleExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden border-t border-white/10"
                            >
                                <div className="px-6 pb-6 pt-4 space-y-3 max-h-[400px] overflow-y-auto">
                                    {todaySchedules.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-8">
                                            오늘 등록된 일정이 없습니다
                                        </p>
                                    ) : (
                                        todaySchedules.map((schedule) => {
                                            const isCompleted = schedule.completed || false;
                                            const isSkipped = schedule.skipped || false;

                                            // Color maps matching dashboard
                                            const iconBgMap: Record<string, string> = {
                                                yellow: "bg-yellow-500",
                                                purple: "bg-purple-500",
                                                green: "bg-green-500",
                                                blue: "bg-blue-500",
                                                red: "bg-red-500",
                                                orange: "bg-orange-500",
                                                pink: "bg-pink-500",
                                                primary: "bg-primary"
                                            };
                                            const cardBgMap: Record<string, string> = {
                                                yellow: "bg-gradient-to-br from-yellow-500/20 to-yellow-600/20",
                                                purple: "bg-gradient-to-br from-purple-500/20 to-purple-600/20",
                                                green: "bg-gradient-to-br from-green-500/20 to-green-600/20",
                                                blue: "bg-gradient-to-br from-blue-500/20 to-blue-600/20",
                                                red: "bg-gradient-to-br from-red-500/20 to-red-600/20",
                                                orange: "bg-gradient-to-br from-orange-500/20 to-orange-600/20",
                                                pink: "bg-gradient-to-br from-pink-500/20 to-pink-600/20",
                                                primary: "bg-gradient-to-br from-primary/20 to-purple-500/20"
                                            };
                                            const cardBorderMap: Record<string, string> = {
                                                yellow: "border-yellow-500/50",
                                                purple: "border-purple-500/50",
                                                green: "border-green-500/50",
                                                blue: "border-blue-500/50",
                                                red: "border-red-500/50",
                                                orange: "border-orange-500/50",
                                                pink: "border-pink-500/50",
                                                primary: "border-primary/50"
                                            };
                                            const cardShadowMap: Record<string, string> = {
                                                yellow: "shadow-[0_0_15px_rgba(234,179,8,0.15)]",
                                                purple: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
                                                green: "shadow-[0_0_15px_rgba(34,197,94,0.15)]",
                                                blue: "shadow-[0_0_15px_rgba(59,130,246,0.15)]",
                                                red: "shadow-[0_0_15px_rgba(239,68,68,0.15)]",
                                                orange: "shadow-[0_0_15px_rgba(249,115,22,0.15)]",
                                                pink: "shadow-[0_0_15px_rgba(236,72,153,0.15)]",
                                                primary: "shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                                            };

                                            const color = schedule.color || 'primary';
                                            const iconBg = iconBgMap[color] || iconBgMap.primary;
                                            const cardBg = cardBgMap[color] || cardBgMap.primary;
                                            const cardBorder = cardBorderMap[color] || cardBorderMap.primary;
                                            const cardShadow = cardShadowMap[color] || cardShadowMap.primary;

                                            return (
                                                <motion.div
                                                    key={schedule.id}
                                                    whileHover={{ scale: 1.01 }}
                                                    className={cn(
                                                        "p-5 rounded-lg border transition-all",
                                                        isCompleted
                                                            ? "bg-green-500/10 border-green-500/30"
                                                            : isSkipped
                                                                ? "bg-gray-500/10 border-gray-500/30 opacity-60"
                                                                : `${cardBg} ${cardBorder} ${cardShadow}`
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className={cn(
                                                            "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                                                            isCompleted
                                                                ? "bg-green-500 text-white shadow-lg"
                                                                : isSkipped
                                                                    ? "bg-gray-400 text-white"
                                                                    : `${iconBg} text-white shadow-lg`
                                                        )}>
                                                            {isCompleted ? (
                                                                <CheckCircle2 className="w-6 h-6" />
                                                            ) : isSkipped ? (
                                                                <X className="w-6 h-6" />
                                                            ) : (
                                                                <Target className="w-6 h-6" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={cn(
                                                                "font-semibold text-base",
                                                                isCompleted && "text-green-400",
                                                                isSkipped && "line-through text-muted-foreground"
                                                            )}>
                                                                {schedule.text}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                                                                {schedule.startTime}
                                                                {schedule.endTime && ` - ${schedule.endTime}`}
                                                            </p>
                                                        </div>
                                                        {isCompleted && (
                                                            <div className="shrink-0 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-[11px] text-green-400 font-bold">
                                                                완료
                                                            </div>
                                                        )}
                                                        {isSkipped && (
                                                            <div className="shrink-0 px-2.5 py-1 rounded-full bg-gray-500/20 border border-gray-500/30 text-[11px] text-gray-400 font-bold">
                                                                놓침
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Action buttons */}
                                                    {!isCompleted && !isSkipped && (
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => {
                                                                    // Mark as completed
                                                                    setTodaySchedules(prev => prev.map(s =>
                                                                        s.id === schedule.id ? { ...s, completed: true, skipped: false } : s
                                                                    ));
                                                                    // Save to localStorage
                                                                    const today = new Date().toISOString().split('T')[0];
                                                                    const completions = JSON.parse(localStorage.getItem(`schedule_completions_${today}`) || '{}');
                                                                    completions[schedule.id] = { completed: true, skipped: false };
                                                                    localStorage.setItem(`schedule_completions_${today}`, JSON.stringify(completions));
                                                                }}
                                                                className="flex-1 h-9 bg-white/10 hover:bg-white/20 border border-white/10 text-foreground"
                                                            >
                                                                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                                                완료
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    // Mark as skipped
                                                                    setTodaySchedules(prev => prev.map(s =>
                                                                        s.id === schedule.id ? { ...s, skipped: true, completed: false } : s
                                                                    ));
                                                                    // Save to localStorage
                                                                    const today = new Date().toISOString().split('T')[0];
                                                                    const completions = JSON.parse(localStorage.getItem(`schedule_completions_${today}`) || '{}');
                                                                    completions[schedule.id] = { completed: false, skipped: true };
                                                                    localStorage.setItem(`schedule_completions_${today}`, JSON.stringify(completions));
                                                                }}
                                                                className="flex-1 h-9 hover:bg-white/10 text-muted-foreground"
                                                            >
                                                                <X className="w-4 h-4 mr-1.5" />
                                                                놓침
                                                            </Button>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            );
                                        })
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* 2️⃣ MIDDLE: Chat History + Recommendation Cards */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                {/* Chat History (최소화 - 마지막 3-5개만) */}
                <div className={cn(
                    "space-y-4",
                    appState === "idle" && recommendations.length > 0 && showRecommendations ? "pb-40" : "pb-6"
                )}>
                    {messages.length === 0 && appState === "idle" && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-foreground" />
                            </div>
                            <p className="text-sm font-medium mb-1">AI 비서와 대화해보세요</p>
                            <p className="text-xs text-muted-foreground">
                                일정, 학습, 목표에 대해 무엇이든 물어보세요
                            </p>
                        </div>
                    )}

                    {messages.map((message) => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "flex",
                                message.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            <div className="max-w-[80%] flex flex-col gap-2">
                                <div
                                    className={cn(
                                        "rounded-2xl px-4 py-3 text-sm",
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground rounded-br-md"
                                            : message.role === "system"
                                            ? "bg-green-100 text-green-900 border border-green-200"
                                            : "bg-muted border border-border rounded-bl-md"
                                    )}
                                >
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                </div>

                                {/* Action buttons */}
                                {message.actions && message.actions.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        {message.actions.map((action, idx) => (
                                            <Button
                                                key={idx}
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    if (action.type === 'open_briefing' && action.data.briefingId) {
                                                        // Find the full briefing object from trendBriefings
                                                        const fullBriefing = trendBriefings.find(
                                                            (b: any) => b.id === action.data.briefingId
                                                        );
                                                        if (fullBriefing) {
                                                            setSelectedBriefing(fullBriefing);
                                                        } else {
                                                            console.error('[Home] Briefing not found:', action.data.briefingId);
                                                        }
                                                    }
                                                }}
                                                className="w-full justify-start text-xs h-8"
                                            >
                                                {action.label}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-muted border border-border rounded-2xl rounded-bl-md px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    <span className="text-sm text-muted-foreground">생각 중...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

            </div>

            {/* 3️⃣ Recommendation Cards - Absolute positioned above input (Idle 상태에서만 표시) */}
            <AnimatePresence>
                {appState === "idle" && recommendations.length > 0 && showRecommendations && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="absolute bottom-32 left-0 right-0 px-6 pointer-events-none"
                    >
                        <div className="max-w-4xl mx-auto pointer-events-auto">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                                    <p className="font-semibold text-xs">AI 추천 일정</p>
                                    <span className="text-[10px] text-muted-foreground">{recommendations.length}</span>
                                </div>
                                <button
                                    onClick={() => setShowRecommendations(false)}
                                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    title="추천 숨기기"
                                >
                                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {recommendations.map((card, index) => {
                                    // 카테고리별 그라데이션 색상
                                    const gradients: Record<string, string> = {
                                        exercise: 'from-blue-500 to-blue-600',
                                        learning: 'from-purple-500 to-purple-600',
                                        productivity: 'from-green-500 to-green-600',
                                        wellness: 'from-pink-500 to-pink-600',
                                        leisure: 'from-orange-500 to-orange-600',
                                        social: 'from-indigo-500 to-indigo-600',
                                    };
                                    const gradient = gradients[card.category] || 'from-gray-500 to-gray-600';

                                    return (
                                        <motion.div
                                            key={card.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="relative group"
                                        >
                                            <div
                                                className={cn(
                                                    "relative h-full bg-gradient-to-br rounded-xl p-3 text-white overflow-hidden",
                                                    "hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer",
                                                    gradient
                                                )}
                                            >
                                                {/* 배경 패턴 - 크기 축소 */}
                                                <div className="absolute inset-0 opacity-10">
                                                    <div className="absolute top-0 right-0 w-20 h-20 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
                                                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
                                                </div>

                                                <div className="relative flex flex-col h-full">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <span className="text-2xl">{card.icon}</span>
                                                        <span className="text-[10px] font-medium bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                                                            {card.estimatedTime}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 mb-2">
                                                        <h3 className="font-bold text-sm mb-1 line-clamp-1 leading-tight">
                                                            {card.title}
                                                        </h3>
                                                        <p className="text-[10px] text-white/90 mb-1.5 line-clamp-1 leading-relaxed">
                                                            {card.description}
                                                        </p>
                                                        <div className="flex items-start gap-1 mt-1">
                                                            <Sparkles className="w-2.5 h-2.5 mt-0.5 flex-shrink-0 opacity-80" />
                                                            <p className="text-[9px] text-white/75 line-clamp-1 leading-relaxed">
                                                                {/* 개인화된 추천 이유 */}
                                                                {(() => {
                                                                    // priority에 따른 긴급도 메시지
                                                                    if (card.priority === 'high') {
                                                                        if (card.category === 'exercise') return '운동 일정이 부족하시네요!';
                                                                        if (card.category === 'wellness') return '휴식이 부족해 보여요';
                                                                        if (card.category === 'learning') return '성장을 위한 학습 시간을';
                                                                    }

                                                                    // 일반 메시지
                                                                    if (card.category === 'exercise') return '규칙적인 운동이 목표 달성을 도와요';
                                                                    if (card.category === 'learning') return '이런 활동이 당신을 성장시켜요';
                                                                    if (card.category === 'productivity') return '목표에 한 걸음 가까워져요';
                                                                    if (card.category === 'wellness') return '일과 삶의 균형이 필요해요';
                                                                    if (card.category === 'leisure') return '창의력을 높여줄 거예요';
                                                                    if (card.category === 'social') return '관계가 성장을 도울 거예요';
                                                                    return '지금 하면 좋은 활동이에요';
                                                                })()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddRecommendation(card)}
                                                        className="w-full h-7 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        추가
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 4️⃣ BOTTOM: Fixed Chat Input */}
            <div className="flex-shrink-0 px-6 pb-6">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-3 shadow-lg">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={PLACEHOLDER_ROTATION[placeholderIndex]}
                            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                            disabled={isLoading}
                        />
                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="h-9 w-9 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                        <button className="hover:text-foreground transition-colors">/일정추가</button>
                        <button className="hover:text-foreground transition-colors">/브리핑</button>
                        <button className="hover:text-foreground transition-colors">/분석</button>
                        {!showRecommendations && recommendations.length > 0 && appState === "idle" && (
                            <button
                                onClick={() => setShowRecommendations(true)}
                                className="hover:text-foreground transition-colors flex items-center gap-1"
                            >
                                <Sparkles className="w-3 h-3" />
                                추천 보기
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Trend Briefing Detail Popup */}
            <TrendBriefingDetail
                briefing={selectedBriefing}
                isOpen={!!selectedBriefing}
                onClose={() => setSelectedBriefing(null)}
                userLevel={userProfile?.level || 'intermediate'}
                userJob={userProfile?.job || ''}
            />
        </div>
    );
}
