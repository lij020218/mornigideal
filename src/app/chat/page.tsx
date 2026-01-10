"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Send, Sparkles, Clock, CheckCircle2, Calendar, Plus, Loader2, Menu, X as CloseIcon, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Schedule {
    id: string;
    text: string;
    startTime: string;
    endTime?: string;
    completed?: boolean;
    skipped?: boolean;
    color?: string;
}

interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
}

interface RecommendationCard {
    id: string;
    title: string;
    description: string;
    estimatedTime: string;
    icon: string;
    category: string;
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

export default function ChatPage() {
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
    const [showRecommendations, setShowRecommendations] = useState(false);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [chatHistory, setChatHistory] = useState<{ date: string; title: string }[]>([]);
    const [showSidebar, setShowSidebar] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Helper function to get chat date (5am cutoff)
    const getChatDate = () => {
        const now = new Date();
        const hour = now.getHours();

        // If before 5am, use previous day
        if (hour < 5) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday.toISOString().split('T')[0];
        }

        return now.toISOString().split('T')[0];
    };

    // Initialize currentDate with 5am cutoff
    const [currentDate, setCurrentDate] = useState<string>(getChatDate());

    // Load messages from localStorage on mount
    useEffect(() => {
        const today = getChatDate();
        setCurrentDate(today);

        const savedMessages = localStorage.getItem(`chat_messages_${today}`);
        if (savedMessages) {
            try {
                const parsed = JSON.parse(savedMessages);
                const messagesWithDates = parsed.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                setMessages(messagesWithDates);
                console.log('[Chat] Loaded messages from localStorage:', messagesWithDates.length);
            } catch (error) {
                console.error('[Chat] Failed to parse saved messages:', error);
            }
        }

        // Load chat history
        const allKeys = Object.keys(localStorage);
        const chatDates = allKeys
            .filter(key => key.startsWith('chat_messages_'))
            .map(key => key.replace('chat_messages_', ''))
            .sort((a, b) => b.localeCompare(a)); // 최신순 정렬

        const history = chatDates
            .filter(date => date !== today) // 오늘 제외
            .map(date => {
                const messages = localStorage.getItem(`chat_messages_${date}`);
                let title = date;
                try {
                    const parsed = JSON.parse(messages || '[]');
                    if (parsed.length > 0 && parsed[0].content) {
                        title = parsed[0].content.substring(0, 30) + (parsed[0].content.length > 30 ? '...' : '');
                    }
                } catch (e) {
                    // ignore
                }
                return { date, title };
            });

        setChatHistory(history);
    }, []);

    // Send initial greeting message with AI recommendations if no messages exist
    useEffect(() => {
        // Only send greeting if:
        // 1. No messages in the current chat
        // 2. Session is loaded
        // 3. Not already loading
        // 4. Schedules are loaded
        if (messages.length === 0 && session?.user && !isLoading && todaySchedules.length >= 0) {
            const sendGreeting = async () => {
                try {
                    const now = new Date();
                    const hour = now.getHours();
                    const today = getChatDate();

                    // Check if we already sent greeting today
                    const greetingSentKey = `greeting_sent_${today}`;
                    if (localStorage.getItem(greetingSentKey)) {
                        console.log('[Chat] Greeting already sent today');
                        return;
                    }

                    console.log('[Chat] Sending initial greeting message with recommendations');

                    // Generate greeting based on time of day
                    let greeting = '안녕하세요!';
                    if (hour >= 5 && hour < 12) greeting = '좋은 아침이에요!';
                    else if (hour >= 12 && hour < 18) greeting = '좋은 오후에요!';
                    else if (hour >= 18 && hour < 22) greeting = '좋은 저녁이에요!';
                    else greeting = '아직도 깨어 계시네요!';

                    // Fetch AI recommendations
                    let recommendationsText = '';
                    try {
                        const currentHour = now.getHours();
                        const response = await fetch('/api/ai-suggest-schedules', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                requestCount: 5,
                                currentHour: currentHour
                            }),
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.suggestions && data.suggestions.length > 0) {
                                recommendationsText = '\n\n오늘 이런 활동은 어떠세요?\n\n';
                                data.suggestions.forEach((s: any, idx: number) => {
                                    recommendationsText += `${idx + 1}. ${s.icon} **${s.title}**\n   ${s.description} (약 ${s.estimatedTime})\n\n`;
                                });
                                recommendationsText += '원하시는 활동이 있으면 말씀해주세요. 일정에 추가해드릴게요!';
                            }
                        }
                    } catch (error) {
                        console.error('[Chat] Failed to fetch recommendations:', error);
                    }

                    const greetingMessage: Message = {
                        id: `assistant-greeting-${Date.now()}`,
                        role: 'assistant',
                        content: `${greeting} 오늘 하루 어떻게 보내실 계획이신가요?\n\n저는 당신의 일정 관리와 성장을 돕는 AI 어시스턴트예요.${recommendationsText}\n\n궁금한 점이나 도움이 필요하신 것이 있으면 언제든 말씀해주세요! 😊`,
                        timestamp: new Date(),
                    };

                    setMessages([greetingMessage]);

                    // Mark greeting as sent
                    localStorage.setItem(greetingSentKey, 'true');
                } catch (error) {
                    console.error('[Chat] Failed to send greeting:', error);
                }
            };

            // Small delay to ensure everything is loaded
            const timer = setTimeout(sendGreeting, 1000);
            return () => clearTimeout(timer);
        }
    }, [messages.length, session, isLoading, todaySchedules]);

    // Save messages to localStorage whenever they change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(`chat_messages_${currentDate}`, JSON.stringify(messages));
            console.log('[Chat] Saved messages to localStorage:', messages.length);
        }
    }, [messages, currentDate]);

    // Check if date changed (5am cutoff detection)
    useEffect(() => {
        const checkDate = setInterval(() => {
            const today = getChatDate();
            if (today !== currentDate) {
                console.log('[Chat] Date changed (5am cutoff), starting new chat');
                setCurrentDate(today);
                setMessages([]);

                // Update chat history
                const allKeys = Object.keys(localStorage);
                const chatDates = allKeys
                    .filter(key => key.startsWith('chat_messages_'))
                    .map(key => key.replace('chat_messages_', ''))
                    .sort((a, b) => b.localeCompare(a));

                const history = chatDates
                    .filter(date => date !== today)
                    .map(date => {
                        const messages = localStorage.getItem(`chat_messages_${date}`);
                        let title = date;
                        try {
                            const parsed = JSON.parse(messages || '[]');
                            if (parsed.length > 0 && parsed[0].content) {
                                title = parsed[0].content.substring(0, 30) + (parsed[0].content.length > 30 ? '...' : '');
                            }
                        } catch (e) {
                            // ignore
                        }
                        return { date, title };
                    });

                setChatHistory(history);
            }
        }, 60000); // 1분마다 체크

        return () => clearInterval(checkDate);
    }, [currentDate]);

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

    // Fetch today's schedules
    useEffect(() => {
        if (!session?.user?.email) return;

        const fetchSchedules = async () => {
            try {
                const response = await fetch('/api/user/profile');
                if (response.ok) {
                    const data = await response.json();
                    const today = getChatDate(); // Use 5am cutoff
                    const now = new Date();
                    const currentDay = now.getDay();

                    console.log('[Chat] Fetching schedules for date:', today, 'day:', currentDay);
                    console.log('[Chat] Custom goals:', data.profile?.customGoals);

                    // Include both specific date schedules AND recurring schedules for today
                    const todayGoals = data.profile?.customGoals?.filter((g: any) => {
                        const isSpecificDate = g.specificDate === today;
                        const isRecurringToday = g.daysOfWeek?.includes(currentDay);
                        console.log(`[Chat] Checking goal "${g.text}": specificDate=${g.specificDate}, daysOfWeek=${g.daysOfWeek}, matches=${isSpecificDate || isRecurringToday}`);
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
                    console.log('[Chat] Loaded schedules:', schedulesWithStatus.length, schedulesWithStatus);
                }
            } catch (error) {
                console.error('[Chat] Failed to fetch schedules:', error);
            }
        };

        fetchSchedules();
    }, [session]);

    // Fetch AI recommendations (when idle)
    useEffect(() => {
        if (appState !== "idle" || !session?.user?.email) return;

        // Only fetch if we don't have recommendations yet
        if (recommendations.length > 0) return;

        const fetchRecommendations = async () => {
            try {
                const now = new Date();
                const currentHour = now.getHours();
                console.log('[Chat] Fetching AI recommendations for hour:', currentHour);

                const response = await fetch('/api/ai-suggest-schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requestCount: 3,
                        currentHour: currentHour
                    }),
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
                    }));
                    setRecommendations(cards);
                }
            } catch (error) {
                console.error('[Chat] Failed to fetch recommendations:', error);
            }
        };

        fetchRecommendations();
    }, [appState, session, recommendations.length]);

    // Helper to convert time string to minutes
    const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Find current/next schedule
    const getCurrentSchedule = () => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        console.log('[Chat] Current time:', `${now.getHours()}:${now.getMinutes()}`, 'Minutes:', currentMinutes);
        console.log('[Chat] Today schedules:', todaySchedules.map(s => ({
            text: s.text,
            startTime: s.startTime,
            startMinutes: timeToMinutes(s.startTime),
            completed: s.completed,
            skipped: s.skipped
        })));

        const currentSchedule = todaySchedules.find((s) => {
            const startMinutes = timeToMinutes(s.startTime);
            const endMinutes = s.endTime ? timeToMinutes(s.endTime) : startMinutes + 60;

            const isInProgress = startMinutes <= currentMinutes && endMinutes >= currentMinutes;
            console.log(`[Chat] Checking "${s.text}": start=${startMinutes}, end=${endMinutes}, current=${currentMinutes}, inProgress=${isInProgress}`);

            return isInProgress;
        });

        if (currentSchedule) {
            console.log('[Chat] Found current schedule:', currentSchedule.text);
            return { schedule: currentSchedule, status: 'in-progress' as const };
        }

        // Find next schedule that hasn't started yet
        const nextSchedule = todaySchedules
            .filter(s => !s.completed && !s.skipped)
            .find((s) => {
                const startMinutes = timeToMinutes(s.startTime);
                const isUpcoming = startMinutes > currentMinutes;
                console.log(`[Chat] Checking next "${s.text}": start=${startMinutes}, current=${currentMinutes}, upcoming=${isUpcoming}, completed=${s.completed}, skipped=${s.skipped}`);
                return isUpcoming;
            });

        if (nextSchedule) {
            console.log('[Chat] Found next schedule:', nextSchedule.text);
            return { schedule: nextSchedule, status: 'upcoming' as const };
        }

        console.log('[Chat] No current or upcoming schedule found');
        return null;
    };

    const currentScheduleInfo = getCurrentSchedule();

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
        setAppState("chatting");
        setShowRecommendations(false); // Hide recommendations when chatting

        try {
            const today = getChatDate();
            const now = new Date();

            console.log('[Chat] Sending message with context - today:', today, 'schedules:', todaySchedules.length);

            const res = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    context: {
                        currentDate: today,
                        currentTime: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
                        schedules: todaySchedules
                    }
                }),
            });

            if (!res.ok) throw new Error("Failed to get response");

            const data = await res.json();
            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: data.message,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // After response, go back to idle
            setTimeout(() => {
                setAppState("idle");
                // Do NOT show recommendations automatically - user must click button
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

    // Load chat from history
    const loadChatHistory = (date: string) => {
        const savedMessages = localStorage.getItem(`chat_messages_${date}`);
        if (savedMessages) {
            try {
                const parsed = JSON.parse(savedMessages);
                const messagesWithDates = parsed.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                setMessages(messagesWithDates);
                setCurrentDate(date);
                setShowSidebar(false);
                console.log('[Chat] Loaded chat from:', date);
            } catch (error) {
                console.error('[Chat] Failed to load chat history:', error);
            }
        }
    };

    // Format date for display
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}월 ${day}일`;
    };

    // Handle recommendation card click
    const handleAddRecommendation = async (card: RecommendationCard) => {
        try {
            const today = new Date().toISOString().split('T')[0];

            const res = await fetch("/api/user/schedule/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: card.title,
                    specificDate: today,
                    findAvailableSlot: true,
                    estimatedDuration: card.estimatedTime,
                    color: 'blue',
                }),
            });

            if (res.ok) {
                // Dispatch event for other components
                window.dispatchEvent(new CustomEvent('schedule-added'));

                // Get AI resource recommendations
                console.log('[Chat] Requesting AI resource recommendations for:', card.title, card.category);

                let aiMessage = `✅ "${card.title}" 일정이 추가되었습니다!`;

                try {
                    const resourceResponse = await fetch("/api/ai-resource-recommend", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            activity: card.title,
                            category: card.category,
                        }),
                    });

                    console.log('[Chat] Resource API response status:', resourceResponse.status);

                    if (resourceResponse.ok) {
                        const resourceData = await resourceResponse.json();
                        console.log('[Chat] Resource recommendation received:', resourceData);
                        aiMessage = `✅ "${card.title}" 일정이 추가되었습니다!\n\n${resourceData.recommendation}`;
                    } else {
                        console.error('[Chat] Resource API failed with status:', resourceResponse.status);
                        const errorData = await resourceResponse.text();
                        console.error('[Chat] Error details:', errorData);
                    }
                } catch (error) {
                    console.error('[Chat] Failed to fetch AI resource recommendations:', error);
                }

                setMessages((prev) => [
                    ...prev,
                    {
                        id: `assistant-${Date.now()}`,
                        role: "assistant",
                        content: aiMessage,
                        timestamp: new Date(),
                    },
                ]);

                // Refresh schedules
                const scheduleRes = await fetch('/api/user/schedule/get');
                if (scheduleRes.ok) {
                    const data = await scheduleRes.json();
                    const today = new Date().toISOString().split('T')[0];
                    const todayGoals = data.customGoals?.filter((g: any) => g.specificDate === today) || [];
                    setTodaySchedules(todayGoals.sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')));
                }

                // Remove the card
                setRecommendations((prev) => prev.filter((r) => r.id !== card.id));
            }
        } catch (error) {
            console.error('[Chat] Failed to add schedule:', error);
        }
    };

    if (status === "loading") {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-screen bg-background flex flex-col relative md:pl-20">
            {/* Sidebar Toggle Button */}
            <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-card border hover:bg-muted transition-colors"
            >
                {showSidebar ? <CloseIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Sidebar - Chat History */}
            <AnimatePresence>
                {showSidebar && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/20 z-40"
                            onClick={() => setShowSidebar(false)}
                        />

                        {/* Sidebar */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-screen w-80 bg-card border-l z-50 flex flex-col"
                        >
                            <div className="p-6 border-b">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5" />
                                    채팅 기록
                                </h2>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {/* Today */}
                                <button
                                    onClick={() => {
                                        const today = new Date().toISOString().split('T')[0];
                                        if (currentDate !== today) {
                                            loadChatHistory(today);
                                        } else {
                                            setShowSidebar(false);
                                        }
                                    }}
                                    className={cn(
                                        "w-full text-left p-3 rounded-lg hover:bg-muted transition-colors",
                                        currentDate === new Date().toISOString().split('T')[0] && "bg-primary/10 border border-primary/20"
                                    )}
                                >
                                    <div className="font-semibold text-sm mb-1">오늘</div>
                                    <div className="text-xs text-muted-foreground">
                                        {new Date().toLocaleDateString('ko-KR')}
                                    </div>
                                </button>

                                {/* History */}
                                {chatHistory.length > 0 ? (
                                    chatHistory.map((chat) => (
                                        <button
                                            key={chat.date}
                                            onClick={() => loadChatHistory(chat.date)}
                                            className={cn(
                                                "w-full text-left p-3 rounded-lg hover:bg-muted transition-colors",
                                                currentDate === chat.date && "bg-primary/10 border border-primary/20"
                                            )}
                                        >
                                            <div className="font-semibold text-sm mb-1">{formatDate(chat.date)}</div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {chat.title}
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        이전 채팅 기록이 없습니다
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* 1️⃣ TOP: Current Schedule Card */}
            <motion.div
                className="flex-shrink-0 pt-16 md:pt-0"
                initial={false}
                animate={{ height: scheduleExpanded ? "auto" : "auto" }}
            >
                <div className="border-b bg-card">
                    {/* Collapsed View */}
                    <button
                        onClick={() => setScheduleExpanded(!scheduleExpanded)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            {currentScheduleInfo ? (
                                <>
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center",
                                        currentScheduleInfo.status === 'in-progress' ? "bg-blue-100" : "bg-purple-100"
                                    )}>
                                        {currentScheduleInfo.status === 'in-progress' ? (
                                            <Clock className="w-6 h-6 text-blue-600" />
                                        ) : (
                                            <Calendar className="w-6 h-6 text-purple-600" />
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={cn(
                                                "text-xs font-medium px-2 py-0.5 rounded-full",
                                                currentScheduleInfo.status === 'in-progress'
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-purple-100 text-purple-700"
                                            )}>
                                                {currentScheduleInfo.status === 'in-progress' ? '집중 중' : '곧 시작'}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {currentScheduleInfo.schedule.startTime}
                                            </span>
                                        </div>
                                        <p className="font-semibold text-lg">{currentScheduleInfo.schedule.text}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                                        <Sparkles className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-lg">오늘 일정이 없습니다</p>
                                        <p className="text-sm text-muted-foreground">새로운 일정을 추가해보세요</p>
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
                                className="overflow-hidden"
                            >
                                <div className="px-6 pb-6 space-y-3 max-h-[300px] overflow-y-auto pl-8 relative">
                                    {todaySchedules.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-8">
                                            오늘 등록된 일정이 없습니다
                                        </p>
                                    ) : (
                                        <>
                                            {/* Vertical line */}
                                            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 via-primary/50 to-primary/30 rounded-full" />

                                            {todaySchedules.map((schedule, index) => {
                                                // Get color classes based on schedule color
                                                // NOTE: 'primary' is black in our theme, so we use 'purple' as default
                                                const getColorClasses = (color: string) => {
                                                    const normalizedColor = color === 'primary' || !color ? 'purple' : color;
                                                    const colorMap: Record<string, { bg: string; activeGradient: string; text: string; border: string; badgeBg: string }> = {
                                                        yellow: {
                                                            bg: 'bg-yellow-500/30',
                                                            activeGradient: 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
                                                            text: 'text-yellow-600',
                                                            border: 'border-yellow-500/30',
                                                            badgeBg: 'bg-yellow-500/20'
                                                        },
                                                        blue: {
                                                            bg: 'bg-blue-500/30',
                                                            activeGradient: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]',
                                                            text: 'text-blue-600',
                                                            border: 'border-blue-500/30',
                                                            badgeBg: 'bg-blue-500/20'
                                                        },
                                                        purple: {
                                                            bg: 'bg-purple-500/30',
                                                            activeGradient: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]',
                                                            text: 'text-purple-600',
                                                            border: 'border-purple-500/30',
                                                            badgeBg: 'bg-purple-500/20'
                                                        },
                                                        green: {
                                                            bg: 'bg-green-500/30',
                                                            activeGradient: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)]',
                                                            text: 'text-green-600',
                                                            border: 'border-green-500/30',
                                                            badgeBg: 'bg-green-500/20'
                                                        },
                                                        red: {
                                                            bg: 'bg-red-500/30',
                                                            activeGradient: 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]',
                                                            text: 'text-red-600',
                                                            border: 'border-red-500/30',
                                                            badgeBg: 'bg-red-500/20'
                                                        },
                                                        orange: {
                                                            bg: 'bg-orange-500/30',
                                                            activeGradient: 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
                                                            text: 'text-orange-600',
                                                            border: 'border-orange-500/30',
                                                            badgeBg: 'bg-orange-500/20'
                                                        },
                                                        pink: {
                                                            bg: 'bg-pink-500/30',
                                                            activeGradient: 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.15)]',
                                                            text: 'text-pink-600',
                                                            border: 'border-pink-500/30',
                                                            badgeBg: 'bg-pink-500/20'
                                                        },
                                                        amber: {
                                                            bg: 'bg-amber-500/30',
                                                            activeGradient: 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
                                                            text: 'text-amber-600',
                                                            border: 'border-amber-500/30',
                                                            badgeBg: 'bg-amber-500/20'
                                                        },
                                                        cyan: {
                                                            bg: 'bg-cyan-500/30',
                                                            activeGradient: 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
                                                            text: 'text-cyan-600',
                                                            border: 'border-cyan-500/30',
                                                            badgeBg: 'bg-cyan-500/20'
                                                        },
                                                        indigo: {
                                                            bg: 'bg-indigo-500/30',
                                                            activeGradient: 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]',
                                                            text: 'text-indigo-600',
                                                            border: 'border-indigo-500/30',
                                                            badgeBg: 'bg-indigo-500/20'
                                                        },
                                                    };
                                                    return colorMap[normalizedColor] || colorMap.purple;
                                                };

                                                const colors = getColorClasses(schedule.color || 'purple');

                                                return (
                                                    <motion.div
                                                        key={schedule.id}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        className="relative flex items-center gap-4 group"
                                                    >
                                                        {/* Timeline dot */}
                                                        <div className={cn(
                                                            "absolute -left-8 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center z-10 transition-all",
                                                            colors.bg
                                                        )}>
                                                            <div className="w-2 h-2 rounded-full bg-background/50" />
                                                        </div>

                                                        {/* Content card */}
                                                        <div className={cn(
                                                            "flex-1 rounded-xl p-4 border transition-all",
                                                            colors.activeGradient
                                                        )}>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                                    {/* Icon */}
                                                                    <div className={cn(
                                                                        "w-10 h-10 rounded-lg flex items-center justify-center",
                                                                        colors.bg
                                                                    )}>
                                                                        <Calendar className={cn("w-5 h-5", colors.text)} />
                                                                    </div>

                                                                    {/* Text content */}
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="font-semibold text-base truncate">
                                                                            {schedule.text}
                                                                        </h4>
                                                                        <p className="text-sm font-mono text-muted-foreground mt-0.5">
                                                                            {schedule.startTime}
                                                                            {schedule.endTime && ` - ${schedule.endTime}`}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Completion status */}
                                                                <motion.span
                                                                    initial={{ scale: 0 }}
                                                                    animate={{ scale: 1 }}
                                                                    className={cn(
                                                                        "text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 flex-shrink-0",
                                                                        schedule.completed
                                                                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                                                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                                                                    )}
                                                                >
                                                                    {schedule.completed ? (
                                                                        <>
                                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                                            완료
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Clock className="w-3.5 h-3.5" />
                                                                            미완료
                                                                        </>
                                                                    )}
                                                                </motion.span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* 2️⃣ MIDDLE: Chat History + Recommendation Cards */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Chat History (전체 메시지 표시) */}
                <div className="space-y-4">
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
                            <div
                                className={cn(
                                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                                    message.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-br-md"
                                        : message.role === "system"
                                            ? "bg-green-100 text-green-900 border border-green-200"
                                            : "bg-muted border border-border rounded-bl-md"
                                )}
                            >
                                <p className="whitespace-pre-wrap">{message.content}</p>
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

                {/* 3️⃣ Recommendation Cards - Show when: 1) Only greeting message (no user chat), or 2) showRecommendations is true */}
                {/* Button to show recommendations (shown when hidden but available) */}
                <AnimatePresence>
                    {appState === "idle" && recommendations.length > 0 && !showRecommendations && messages.filter(m => m.role === 'user').length > 0 && (
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            onClick={() => setShowRecommendations(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 text-sm text-primary font-medium transition-colors mx-auto mb-4"
                        >
                            <Sparkles className="w-4 h-4" />
                            추천 일정 보기
                        </motion.button>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {appState === "idle" && recommendations.length > 0 && (showRecommendations || messages.filter(m => m.role === 'user').length === 0) && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-3"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                    <p className="font-semibold text-sm">💡 지금 하기 좋은 제안</p>
                                </div>
                                {showRecommendations && messages.filter(m => m.role === 'user').length > 0 && (
                                    <button
                                        onClick={() => setShowRecommendations(false)}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <CloseIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="grid gap-3">
                                {recommendations.map((card) => (
                                    <motion.div
                                        key={card.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-center justify-between p-4 rounded-xl bg-card border hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="text-2xl flex-shrink-0">{card.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm mb-1">{card.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {card.description} · {card.estimatedTime}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => handleAddRecommendation(card)}
                                            className="flex-shrink-0 ml-3"
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            추가
                                        </Button>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 4️⃣ BOTTOM: Fixed Chat Input */}
            <div className="flex-shrink-0 border-t bg-card px-6 py-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3 bg-muted border border-border rounded-xl px-4 py-3">
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
                    </div>
                </div>
            </div>
        </div>
    );
}
