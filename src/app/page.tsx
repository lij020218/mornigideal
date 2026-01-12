"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Send, Sparkles, Clock, CheckCircle2, Calendar, Plus, Loader2, Target, X, Coffee, Utensils, Moon, Dumbbell, BookOpen, Briefcase, Home, Sun, Heart, Gamepad2, MapPin } from "lucide-react";
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
    location?: string;
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
    const [showRecommendations, setShowRecommendations] = useState(() => {
        // Check localStorage on initial load (client-side only)
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('showRecommendations');
            return saved === null ? true : saved === 'true';
        }
        return true;
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isFetchingRecommendations = useRef(false);
    const hasFetchedRecommendations = useRef(false);

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

    // Load messages from localStorage on mount
    useEffect(() => {
        const today = getChatDate();
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
            const today = getChatDate();
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

    // Auto-send schedule-based messages
    useEffect(() => {
        if (!session?.user) {
            console.log('[AutoMessage] Skipping - no session');
            return;
        }

        const checkAndSendScheduleMessages = () => {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const today = now.toISOString().split('T')[0];
            const hour = now.getHours();

            console.log('[AutoMessage] Checking schedules:', {
                currentTime: `${now.getHours()}:${now.getMinutes()}`,
                currentMinutes,
                today,
                schedulesCount: todaySchedules.length
            });

            // 0. 아침 인사 메시지 (5-12시 사이 한 번만) - AI 기반
            const morningGreetingKey = `morning_greeting_${today}`;
            const alreadySentMorning = localStorage.getItem(morningGreetingKey);
            console.log('[AutoMessage] Morning greeting check:', {
                hour,
                inTimeRange: hour >= 5 && hour < 12,
                alreadySent: !!alreadySentMorning,
                key: morningGreetingKey
            });

            if (hour >= 5 && hour < 12 && !alreadySentMorning) {
                localStorage.setItem(morningGreetingKey, 'true');
                console.log('[AutoMessage] ✅ Sending AI morning greeting');

                // AI에게 아침 인사 + 일정 추천 요청
                fetch('/api/ai-morning-greeting', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        todaySchedules: todaySchedules.map(s => ({
                            text: s.text,
                            startTime: s.startTime,
                            endTime: s.endTime,
                        })),
                        userProfile: userProfile,
                    }),
                })
                    .then(res => res.json())
                    .then(data => {
                        console.log('[AutoMessage] Received AI morning greeting:', data);
                        const message: Message = {
                            id: `auto-morning-${Date.now()}`,
                            role: 'assistant',
                            content: data.greeting || '좋은 아침이에요! ☀️',
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    })
                    .catch(err => {
                        console.error('[AutoMessage] Failed to fetch AI morning greeting:', err);
                        // Fallback
                        const message: Message = {
                            id: `auto-morning-${Date.now()}`,
                            role: 'assistant',
                            content: '좋은 아침이에요! ☀️\n\n활기찬 하루 보내세요! 💪',
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    });
            }

            // 일정이 없으면 여기서 종료
            if (todaySchedules.length === 0) {
                return;
            }

            todaySchedules.forEach(schedule => {
                const startMinutes = timeToMinutes(schedule.startTime);
                const endMinutes = schedule.endTime ? timeToMinutes(schedule.endTime) : startMinutes + 60;

                console.log('[AutoMessage] Checking schedule:', {
                    text: schedule.text,
                    startTime: schedule.startTime,
                    startMinutes,
                    currentMinutes,
                    diff: startMinutes - currentMinutes
                });

                // 1. 일정 시작 10분 전 메시지
                const tenMinutesBefore = startMinutes - 10;
                const sentBeforeKey = `schedule_before_${schedule.id}_${today}`;
                const alreadySentBefore = !!localStorage.getItem(sentBeforeKey);

                console.log('[AutoMessage] 10분 전 체크:', {
                    tenMinutesBefore,
                    currentMinutes,
                    inRange: currentMinutes >= tenMinutesBefore && currentMinutes < startMinutes,
                    alreadySent: alreadySentBefore,
                    key: sentBeforeKey
                });

                if (currentMinutes >= tenMinutesBefore && currentMinutes < startMinutes && !alreadySentBefore) {
                    console.log('[AutoMessage] ✅ Sending 10-15분 전 preparation message for:', schedule.text);
                    localStorage.setItem(sentBeforeKey, 'true');

                    // AI 준비 조언 요청 (10-15분 전) - gpt-5.2 사용
                    const timeUntilStart = startMinutes - currentMinutes;
                    fetch('/api/ai-schedule-prep', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            schedule: {
                                text: schedule.text,
                                startTime: schedule.startTime
                            },
                            userProfile: userProfile,
                            timeUntil: timeUntilStart
                        }),
                    }).then(res => res.json()).then(data => {
                        console.log('[AutoMessage] Received AI schedule prep advice:', data);
                        const advice = data.advice || `${timeUntilStart}분 후 "${schedule.text}" 일정이 시작됩니다! 준비하세요 🕐`;
                        const message: Message = {
                            id: `auto-before-${Date.now()}`,
                            role: 'assistant',
                            content: advice,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    }).catch(err => {
                        console.error('[AutoMessage] Failed to fetch AI schedule prep:', err);
                        // Fallback
                        const message: Message = {
                            id: `auto-before-${Date.now()}`,
                            role: 'assistant',
                            content: `곧 "${schedule.text}" 일정이 ${schedule.startTime}에 시작됩니다.\n\n준비하실 것이 있나요? 필요하신 정보를 찾아드릴까요?`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    });
                }

                // 2. 일정 시작 시 메시지
                const sentStartKey = `schedule_start_${schedule.id}_${today}`;
                const alreadySentStart = !!localStorage.getItem(sentStartKey);

                console.log('[AutoMessage] 시작 시 체크:', {
                    startMinutes,
                    currentMinutes,
                    inRange: currentMinutes >= startMinutes && currentMinutes < startMinutes + 5,
                    alreadySent: alreadySentStart,
                    key: sentStartKey
                });

                if (currentMinutes >= startMinutes && currentMinutes < startMinutes + 5 && !alreadySentStart) {
                    console.log('[AutoMessage] ✅ Sending 시작 message for:', schedule.text);
                    localStorage.setItem(sentStartKey, 'true');

                    // AI 리소스 추천 요청
                    fetch('/api/ai-resource-recommend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            activityName: schedule.text,
                            context: 'schedule_start',
                            userProfile: userProfile
                        }),
                    }).then(res => res.json()).then(data => {
                        console.log('[AutoMessage] Received AI resource:', data);
                        const recommendation = data.recommendation || "일정을 시작해볼까요? 화이팅!";
                        const message: Message = {
                            id: `auto-start-${Date.now()}`,
                            role: 'assistant',
                            content: `"${schedule.text}" 시간이네요!\n\n${recommendation}`,
                            timestamp: new Date(),
                        };
                        setMessages(prev => [...prev, message]);
                    }).catch(err => {
                        console.error('[AutoMessage] Failed to fetch AI resource:', err);
                    });
                }

                // 3. 일정 종료 후 메시지
                const sentAfterKey = `schedule_after_${schedule.id}_${today}`;
                if (currentMinutes >= endMinutes && currentMinutes < endMinutes + 10 && !localStorage.getItem(sentAfterKey)) {
                    localStorage.setItem(sentAfterKey, 'true');

                    // AI 맞춤형 피드백 요청
                    fetch('/api/ai-resource-recommend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            activityName: schedule.text,
                            context: 'schedule_completed',
                            userProfile: userProfile
                        }),
                    }).then(res => res.json()).then(data => {
                        console.log('[AutoMessage] Received AI feedback prompt:', data);
                        const recommendation = data.recommendation || "어떠셨나요?\n• 간단히 기록하실 내용이 있나요?\n• 다음 액션 아이템을 정리해드릴까요?";
                        const message: Message = {
                            id: `auto-after-${Date.now()}`,
                            role: 'assistant',
                            content: `"${schedule.text}" 일정이 끝났습니다.\n\n${recommendation}`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    }).catch(err => {
                        console.error('[AutoMessage] Failed to fetch AI feedback:', err);
                        // Fallback to basic message
                        const message: Message = {
                            id: `auto-after-${Date.now()}`,
                            role: 'assistant',
                            content: `"${schedule.text}" 일정이 끝났습니다.\n\n어떠셨나요?\n• 간단히 기록하실 내용이 있나요?\n• 다음 액션 아이템을 정리해드릴까요?\n• 추가 일정이 필요하신가요?`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    });
                }
            });

            // 4. 빈 시간 감지 (다음 일정까지 30분 이상 남았을 때)
            const nextSchedule = todaySchedules
                .filter(s => !s.completed && !s.skipped)
                .find(s => timeToMinutes(s.startTime) > currentMinutes);

            if (nextSchedule) {
                const timeUntilNext = timeToMinutes(nextSchedule.startTime) - currentMinutes;
                const sentGapKey = `schedule_gap_${nextSchedule.id}_${today}`;

                if (timeUntilNext >= 30 && timeUntilNext <= 40 && !localStorage.getItem(sentGapKey)) {
                    localStorage.setItem(sentGapKey, 'true');

                    // AI 추천 요청 with 다음 일정 정보
                    fetch('/api/ai-resource-recommend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            activityName: nextSchedule.text,
                            context: 'upcoming_schedule',
                            timeUntil: timeUntilNext,
                            userProfile: userProfile
                        }),
                    }).then(res => res.json()).then(data => {
                        console.log('[AutoMessage] Received AI resource for upcoming schedule:', data);
                        const recommendation = data.recommendation || "준비할 시간이 충분하네요. 다음 일정을 위해 가볍게 준비해볼까요?";
                        const message: Message = {
                            id: `auto-gap-${Date.now()}`,
                            role: 'assistant',
                            content: `다음 일정 "${nextSchedule.text}"까지 ${timeUntilNext}분 남았어요.\n\n${recommendation}\n\n이 시간에 할 수 있는 것:\n• 메일 확인 및 처리\n• 트렌드 브리핑 읽기\n• 짧은 학습 세션\n\n무엇을 하시겠어요?`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    }).catch(err => {
                        console.error('[AutoMessage] Failed to fetch AI resource for gap:', err);
                        // Fallback to basic message
                        const message: Message = {
                            id: `auto-gap-${Date.now()}`,
                            role: 'assistant',
                            content: `다음 일정 "${nextSchedule.text}"까지 ${timeUntilNext}분 남았어요.\n\n이 시간에 할 수 있는 것:\n• 메일 확인 및 처리\n• 트렌드 브리핑 읽기\n• 짧은 학습 세션\n\n무엇을 하시겠어요?`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    });
                }
            }

            // 5. 하루 마무리 (마지막 일정 종료 후) - AI 피드백
            const lastSchedule = todaySchedules
                .filter(s => s.endTime)
                .sort((a, b) => timeToMinutes(b.endTime!) - timeToMinutes(a.endTime!))[0];

            if (lastSchedule) {
                const lastEndMinutes = timeToMinutes(lastSchedule.endTime!);
                const sentDayEndKey = `day_end_${today}`;

                if (currentMinutes >= lastEndMinutes + 10 && currentMinutes < lastEndMinutes + 30 && !localStorage.getItem(sentDayEndKey)) {
                    localStorage.setItem(sentDayEndKey, 'true');

                    const completed = todaySchedules.filter(s => s.completed).length;
                    const total = todaySchedules.length;

                    console.log('[AutoMessage] ✅ Sending AI day summary');

                    // AI 하루 마무리 요청 - gpt-5.2 사용
                    fetch('/api/ai-day-summary', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            todaySchedules: todaySchedules.map(s => ({
                                text: s.text,
                                startTime: s.startTime,
                                endTime: s.endTime,
                                completed: s.completed
                            })),
                            completedCount: completed,
                            totalCount: total,
                            userProfile: userProfile
                        }),
                    }).then(res => res.json()).then(data => {
                        console.log('[AutoMessage] Received AI day summary:', data);
                        const summary = data.summary || `오늘 하루 고생 많으셨어요! 🌙\n\n오늘의 성과: ${completed}/${total}개 완료\n\n충분한 휴식 취하시고, 내일 또 만나요!`;
                        const message: Message = {
                            id: `auto-dayend-${Date.now()}`,
                            role: 'assistant',
                            content: summary,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    }).catch(err => {
                        console.error('[AutoMessage] Failed to fetch AI day summary:', err);
                        // Fallback
                        const message: Message = {
                            id: `auto-dayend-${Date.now()}`,
                            role: 'assistant',
                            content: `오늘 일정이 모두 끝났어요! 🎉\n\n오늘의 성과:\n✅ 완료: ${completed}/${total}개\n\n내일을 위한 제안이 필요하신가요?`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    });
                }
            }

            // 6. 트렌드 브리핑 읽기 알림 (10시, 15시, 20시에 한 번씩)
            const briefingReminderHours = [10, 15, 20];
            if (briefingReminderHours.includes(hour)) {
                const briefingReminderKey = `briefing_reminder_${today}_${hour}`;
                if (!localStorage.getItem(briefingReminderKey)) {
                    // Check if there are unread briefings
                    const readBriefings = JSON.parse(localStorage.getItem(`read_briefings_${today}`) || '[]');
                    const unreadCount = trendBriefings.filter(b => !readBriefings.includes(b.id)).length;

                    if (unreadCount > 0) {
                        localStorage.setItem(briefingReminderKey, 'true');
                        console.log('[AutoMessage] ✅ Sending briefing reminder:', unreadCount);

                        const message: Message = {
                            id: `auto-briefing-reminder-${Date.now()}`,
                            role: 'assistant',
                            content: `아직 안 읽은 트렌드 브리핑이 ${unreadCount}개 있어요 📰\n\n잠깐 시간 내서 확인해보실래요? 최신 트렌드 놓치기 아까울 것 같아요! 🚀`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    }
                }
            }

            // 7. 빈 시간대 일정 추천 (12시, 16시, 19시에 일정이 없으면) - AI 기반
            const idleCheckHours = [12, 16, 19];
            if (idleCheckHours.includes(hour)) {
                const idleCheckKey = `idle_check_${today}_${hour}`;
                if (!localStorage.getItem(idleCheckKey)) {
                    // Check if there's no schedule in the next 2 hours
                    const twoHoursLater = currentMinutes + 120;
                    const hasUpcomingSchedule = todaySchedules.some(s => {
                        const sMinutes = timeToMinutes(s.startTime);
                        return sMinutes >= currentMinutes && sMinutes <= twoHoursLater;
                    });

                    if (!hasUpcomingSchedule) {
                        localStorage.setItem(idleCheckKey, 'true');
                        console.log('[AutoMessage] ✅ Fetching smart schedule recommendations');

                        // Fetch AI-powered recommendations based on user patterns
                        fetch('/api/ai-schedule-recommendations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: today,
                                currentSchedules: todaySchedules.map(s => ({
                                    text: s.text,
                                    startTime: s.startTime,
                                    endTime: s.endTime,
                                    start_time: `${today}T${s.startTime}:00`,
                                    end_time: `${today}T${s.endTime}:00`,
                                })),
                            }),
                        }).then(res => res.json()).then(data => {
                            const recommendations = data.recommendations || [];
                            console.log('[AutoMessage] Received AI recommendations:', recommendations);

                            if (recommendations.length > 0) {
                                // Pick top priority recommendation
                                const topRec = recommendations.sort((a: any, b: any) => {
                                    const priority = { high: 3, medium: 2, low: 1 };
                                    return (priority[b.priority as keyof typeof priority] || 0) - (priority[a.priority as keyof typeof priority] || 0);
                                })[0];

                                const timeContext = hour === 12 ? '점심' : hour === 16 ? '오후' : '저녁';
                                const message: Message = {
                                    id: `auto-idle-${Date.now()}`,
                                    role: 'assistant',
                                    content: `${timeContext} 시간에 등록된 일정이 없네요!\n\n💡 추천: **${topRec.scheduleText}** (${topRec.suggestedDuration}분)\n시작 시간: ${topRec.suggestedStartTime}\n\n${topRec.reason}\n\n일정 추가하실래요?`,
                                    timestamp: now,
                                    actions: [{
                                        type: 'add_schedule',
                                        label: `${topRec.scheduleText} 추가하기`,
                                        data: {
                                            text: topRec.scheduleText,
                                            startTime: topRec.suggestedStartTime,
                                            duration: topRec.suggestedDuration,
                                        }
                                    }]
                                };
                                setMessages(prev => [...prev, message]);
                            } else {
                                // Fallback to generic message
                                const timeContext = hour === 12 ? '점심' : hour === 16 ? '오후' : '저녁';
                                const activities = hour === 12
                                    ? '산책하거나, 맛있는 점심 먹거나, 잠깐 휴식하는 건 어때요? ☕'
                                    : hour === 16
                                    ? '가볍게 스트레칭하거나, 책 읽거나, 목표 관련 작업하기 좋은 시간이에요 📚'
                                    : '하루 마무리하면서 독서하거나, 내일 계획 세우거나, 편하게 쉬어도 좋아요 🌙';
                                const message: Message = {
                                    id: `auto-idle-${Date.now()}`,
                                    role: 'assistant',
                                    content: `${timeContext} 시간에 등록된 일정이 없네요!\n\n${activities}\n\n일정 추가하실래요?`,
                                    timestamp: now,
                                };
                                setMessages(prev => [...prev, message]);
                            }
                        }).catch(err => {
                            console.error('[AutoMessage] Failed to fetch recommendations:', err);
                            // Fallback to generic message
                            const timeContext = hour === 12 ? '점심' : hour === 16 ? '오후' : '저녁';
                            const activities = hour === 12
                                ? '산책하거나, 맛있는 점심 먹거나, 잠깐 휴식하는 건 어때요? ☕'
                                : hour === 16
                                ? '가볍게 스트레칭하거나, 책 읽거나, 목표 관련 작업하기 좋은 시간이에요 📚'
                                : '하루 마무리하면서 독서하거나, 내일 계획 세우거나, 편하게 쉬어도 좋아요 🌙';
                            const message: Message = {
                                id: `auto-idle-${Date.now()}`,
                                role: 'assistant',
                                content: `${timeContext} 시간에 등록된 일정이 없네요!\n\n${activities}\n\n일정 추가하실래요?`,
                                timestamp: now,
                            };
                            setMessages(prev => [...prev, message]);
                        });
                    }
                }
            }
        };

        // 1분마다 체크
        const interval = setInterval(checkAndSendScheduleMessages, 60000);
        // 초기 실행
        checkAndSendScheduleMessages();

        return () => clearInterval(interval);
    }, [session, todaySchedules, userProfile, trendBriefings]);

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
                const now = new Date();
                const currentHour = now.getHours();
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

    // Helper to convert time string to minutes
    const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Find current/next schedule
    const getCurrentSchedule = () => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        console.log('[Home] Current time:', `${now.getHours()}:${now.getMinutes()}`, 'Minutes:', currentMinutes);
        console.log('[Home] Today schedules:', todaySchedules.map(s => ({
            text: s.text,
            startTime: s.startTime,
            startMinutes: timeToMinutes(s.startTime)
        })));

        const currentSchedule = todaySchedules.find((s) => {
            const startMinutes = timeToMinutes(s.startTime);
            const endMinutes = s.endTime ? timeToMinutes(s.endTime) : startMinutes + 60; // 기본 1시간

            const isInProgress = startMinutes <= currentMinutes && currentMinutes < endMinutes;
            console.log(`[Home] Checking "${s.text}": start=${startMinutes}, end=${endMinutes}, current=${currentMinutes}, inProgress=${isInProgress}`);

            return isInProgress;
        });

        if (currentSchedule) {
            console.log('[Home] Found current schedule:', currentSchedule.text);
            return { schedule: currentSchedule, status: 'in-progress' as const };
        }

        // Find next schedule that hasn't started yet
        const nextSchedule = todaySchedules
            .filter(s => !s.completed && !s.skipped) // 완료/놓친 일정 제외
            .find((s) => {
                const startMinutes = timeToMinutes(s.startTime);
                const isUpcoming = startMinutes > currentMinutes;
                console.log(`[Home] Checking next "${s.text}": start=${startMinutes}, current=${currentMinutes}, upcoming=${isUpcoming}`);
                return isUpcoming;
            });

        if (nextSchedule) {
            console.log('[Home] Found next schedule:', nextSchedule.text);
            return { schedule: nextSchedule, status: 'upcoming' as const };
        }

        console.log('[Home] No current or upcoming schedule found');
        return null;
    };

    const currentScheduleInfo = getCurrentSchedule();

    // Debug: log schedule color
    if (currentScheduleInfo) {
        console.log('[Home] Current schedule color:', currentScheduleInfo.schedule.color);
    }

    // Map activity labels to icons - EXACTLY matching dashboard DailyRhythmTimeline
    const activityIcons: Record<string, any> = {
        '기상': Sun,
        '업무 시작': Briefcase,
        '업무/수업 시작': Briefcase,
        '업무 종료': Briefcase,
        '업무/수업 종료': Briefcase,
        '취침': Moon,
        '아침 식사': Coffee,
        '점심 식사': Coffee,
        '저녁 식사': Coffee,
        '운동': Dumbbell,
        '독서': BookOpen,
        '자기계발': Target,
        '병원': Heart,
        '휴식/여가': Gamepad2,
    };

    // Get icon for schedule - first try exact match, then keyword fallback
    const getScheduleIcon = (text: string) => {
        // 1. Try exact match first (like dashboard)
        if (activityIcons[text]) {
            return activityIcons[text];
        }

        // 2. Fallback to keyword matching for custom schedules
        const lowerText = text.toLowerCase();

        // 식사
        if (lowerText.includes('아침') || lowerText.includes('breakfast')) return Coffee;
        if (lowerText.includes('점심') || lowerText.includes('lunch')) return Coffee;
        if (lowerText.includes('저녁') || lowerText.includes('dinner') || lowerText.includes('식사')) return Coffee;

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

        // 기상
        if (lowerText.includes('기상') || lowerText.includes('wake')) return Sun;

        // 휴식/여가
        if (lowerText.includes('휴식') || lowerText.includes('여가') || lowerText.includes('게임')) return Gamepad2;

        // 병원
        if (lowerText.includes('병원') || lowerText.includes('진료')) return Heart;

        // 기본값
        return Target;
    };

    // Get personalized message for schedule
    const getScheduleMessage = (text: string, status: 'in-progress' | 'upcoming') => {
        const lowerText = text.toLowerCase();

        if (status === 'in-progress') {
            // 집중 중일 때
            // 종료/마무리 관련 키워드 먼저 체크
            if (lowerText.includes('종료') || lowerText.includes('마침') || lowerText.includes('끝')) {
                if (lowerText.includes('업무') || lowerText.includes('작업')) return '업무 마무리 시간이에요! 정리해볼까요? ✅';
                if (lowerText.includes('회의') || lowerText.includes('미팅')) return '회의 마무리 시간! 결론 정리하세요 📝';
                return '마무리 시간이에요! 정리해볼까요? ✅';
            }

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
            // 종료/마무리 관련 키워드 먼저 체크
            if (lowerText.includes('종료') || lowerText.includes('마침') || lowerText.includes('끝')) {
                if (lowerText.includes('업무') || lowerText.includes('작업')) return '곧 업무 마무리 시간! 정리 준비하세요';
                if (lowerText.includes('회의') || lowerText.includes('미팅')) return '곧 회의 마무리! 요약 준비하세요';
                return '곧 마무리 시간! 정리 준비하세요';
            }

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
                        currentDate: getChatDate(),
                        currentTime: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    },
                }),
            });

            if (!res.ok) throw new Error("Failed to get response");

            const data = await res.json();

            // Add assistant message
            setMessages((prev) => [
                ...prev,
                {
                    id: `assistant-${Date.now()}`,
                    role: "assistant",
                    content: data.message,
                    timestamp: new Date(),
                    actions: data.actions || [],
                },
            ]);

            // Handle actions (if any)
            if (data.actions && data.actions.length > 0) {
                handleMessageActions(data.actions);
            }

        } catch (error) {
            console.error("Error sending message:", error);
            // Show error message
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.",
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsLoading(false);
            // After response, go back to idle to show recommendations
            setTimeout(() => setAppState("idle"), 500);
        }
    };

    // Handle message actions separately
    const handleMessageActions = async (actions: any[]) => {
        for (const action of actions) {
            if (action.type === 'add_schedule' && action.data) {
                try {
                    // Add schedule via API
                    const scheduleRes = await fetch("/api/user/schedule/add", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(action.data),
                    });

                    if (scheduleRes.ok) {
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
                    }
                } catch (error) {
                    console.error('[Home] Failed to add schedule from AI:', error);
                }
            }
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
                className="flex-shrink-0 px-4 sm:px-6 pt-16 sm:pt-20 md:pt-6"
                initial={false}
                animate={{ height: scheduleExpanded ? "auto" : "auto" }}
            >
                <div className={cn(
                    "rounded-2xl transition-all",
                    (() => {
                        if (!currentScheduleInfo) {
                            return "bg-gradient-to-br from-gray-500/10 to-gray-600/10 border border-gray-500/30";
                        }

                        const color = currentScheduleInfo.schedule.color || 'primary';
                        console.log('[Home] Card color:', color, 'status:', currentScheduleInfo.status);

                        // In-progress: use schedule's color with ring effect (matching dashboard DailyRhythmTimeline)
                        if (currentScheduleInfo.status === 'in-progress') {
                            const inProgressMap: Record<string, string> = {
                                yellow: "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)] ring-1 ring-yellow-500/50",
                                purple: "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/50",
                                green: "bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)] ring-1 ring-green-500/50",
                                blue: "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/50",
                                red: "bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/50",
                                orange: "bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/50",
                                pink: "bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.15)] ring-1 ring-pink-500/50",
                                // Additional colors from SchedulePopup PRESET_ACTIVITIES
                                amber: "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/50",
                                indigo: "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/50",
                                cyan: "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/50",
                                teal: "bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)] ring-1 ring-teal-500/50",
                                emerald: "bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50",
                                violet: "bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/50",
                                rose: "bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/50",
                                sky: "bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.15)] ring-1 ring-sky-500/50",
                                primary: "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/50"
                            };
                            return inProgressMap[color] || inProgressMap.primary;
                        }

                        // Upcoming: use schedule's color with softer ring (matching dashboard)
                        const colorMap: Record<string, string> = {
                            yellow: "bg-gradient-to-br from-yellow-500/15 to-orange-500/15 border border-yellow-500/40 shadow-[0_0_10px_rgba(234,179,8,0.1)]",
                            purple: "bg-gradient-to-br from-purple-500/15 to-pink-500/15 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.1)]",
                            green: "bg-gradient-to-br from-green-500/15 to-emerald-500/15 border border-green-500/40 shadow-[0_0_10px_rgba(34,197,94,0.1)]",
                            blue: "bg-gradient-to-br from-blue-500/15 to-cyan-500/15 border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.1)]",
                            red: "bg-gradient-to-br from-red-500/15 to-orange-500/15 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.1)]",
                            orange: "bg-gradient-to-br from-orange-500/15 to-amber-500/15 border border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.1)]",
                            pink: "bg-gradient-to-br from-pink-500/15 to-purple-500/15 border border-pink-500/40 shadow-[0_0_10px_rgba(236,72,153,0.1)]",
                            // Additional colors from SchedulePopup PRESET_ACTIVITIES
                            amber: "bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
                            indigo: "bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.1)]",
                            cyan: "bg-gradient-to-br from-cyan-500/15 to-blue-500/15 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.1)]",
                            teal: "bg-gradient-to-br from-teal-500/15 to-cyan-500/15 border border-teal-500/40 shadow-[0_0_10px_rgba(20,184,166,0.1)]",
                            emerald: "bg-gradient-to-br from-emerald-500/15 to-green-500/15 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
                            violet: "bg-gradient-to-br from-violet-500/15 to-purple-500/15 border border-violet-500/40 shadow-[0_0_10px_rgba(139,92,246,0.1)]",
                            rose: "bg-gradient-to-br from-rose-500/15 to-pink-500/15 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.1)]",
                            sky: "bg-gradient-to-br from-sky-500/15 to-blue-500/15 border border-sky-500/40 shadow-[0_0_10px_rgba(14,165,233,0.1)]",
                            primary: "bg-gradient-to-br from-purple-500/15 to-pink-500/15 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
                        };

                        const result = colorMap[color] || colorMap.primary;
                        console.log('[Home] Applied card style:', result);
                        return result;
                    })()
                )}>
                    {/* Collapsed View */}
                    <button
                        onClick={() => setScheduleExpanded(!scheduleExpanded)}
                        className="w-full px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between hover:bg-white/5 rounded-2xl transition-colors"
                    >
                        <div className="flex items-center gap-3 sm:gap-4 flex-1">
                            {currentScheduleInfo ? (
                                <>
                                    <div className={cn(
                                        "w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300",
                                        (() => {
                                            const color = currentScheduleInfo.schedule.color || 'primary';
                                            // Match dashboard DailyRhythmTimeline icon styling with ring effect
                                            const colorMap: Record<string, string> = {
                                                yellow: "bg-gradient-to-br from-yellow-500 to-orange-500 shadow-yellow-500/30 ring-2 ring-white/20",
                                                purple: "bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/30 ring-2 ring-white/20",
                                                green: "bg-gradient-to-br from-green-500 to-emerald-500 shadow-green-500/30 ring-2 ring-white/20",
                                                blue: "bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-500/30 ring-2 ring-white/20",
                                                red: "bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/30 ring-2 ring-white/20",
                                                orange: "bg-gradient-to-br from-orange-500 to-amber-500 shadow-orange-500/30 ring-2 ring-white/20",
                                                pink: "bg-gradient-to-br from-pink-500 to-purple-500 shadow-pink-500/30 ring-2 ring-white/20",
                                                // Additional colors
                                                amber: "bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/30 ring-2 ring-white/20",
                                                indigo: "bg-gradient-to-br from-indigo-500 to-purple-500 shadow-indigo-500/30 ring-2 ring-white/20",
                                                cyan: "bg-gradient-to-br from-cyan-500 to-blue-500 shadow-cyan-500/30 ring-2 ring-white/20",
                                                teal: "bg-gradient-to-br from-teal-500 to-cyan-500 shadow-teal-500/30 ring-2 ring-white/20",
                                                emerald: "bg-gradient-to-br from-emerald-500 to-green-500 shadow-emerald-500/30 ring-2 ring-white/20",
                                                violet: "bg-gradient-to-br from-violet-500 to-purple-500 shadow-violet-500/30 ring-2 ring-white/20",
                                                rose: "bg-gradient-to-br from-rose-500 to-pink-500 shadow-rose-500/30 ring-2 ring-white/20",
                                                sky: "bg-gradient-to-br from-sky-500 to-blue-500 shadow-sky-500/30 ring-2 ring-white/20",
                                                primary: "bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/30 ring-2 ring-white/20"
                                            };

                                            return colorMap[color] || colorMap.primary;
                                        })()
                                    )}>
                                        {(() => {
                                            const ScheduleIcon = getScheduleIcon(currentScheduleInfo.schedule.text);
                                            return <ScheduleIcon className="w-7 h-7 text-white" />;
                                        })()}
                                    </div>
                                    <div className="text-left flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={cn(
                                                "text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border",
                                                (() => {
                                                    const color = currentScheduleInfo.schedule.color || 'primary';
                                                    // Match dashboard DailyRhythmTimeline badge styling
                                                    if (currentScheduleInfo.status === 'in-progress') {
                                                        const inProgressMap: Record<string, string> = {
                                                            yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                                                            purple: "bg-purple-500/20 text-purple-300 border-purple-500/30",
                                                            green: "bg-green-500/20 text-green-300 border-green-500/30",
                                                            blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
                                                            red: "bg-red-500/20 text-red-300 border-red-500/30",
                                                            orange: "bg-orange-500/20 text-orange-300 border-orange-500/30",
                                                            pink: "bg-pink-500/20 text-pink-300 border-pink-500/30",
                                                            // Additional colors
                                                            amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
                                                            indigo: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
                                                            cyan: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                                                            teal: "bg-teal-500/20 text-teal-300 border-teal-500/30",
                                                            emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                                                            violet: "bg-violet-500/20 text-violet-300 border-violet-500/30",
                                                            rose: "bg-rose-500/20 text-rose-300 border-rose-500/30",
                                                            sky: "bg-sky-500/20 text-sky-300 border-sky-500/30",
                                                            primary: "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                                        };
                                                        return inProgressMap[color] || inProgressMap.primary;
                                                    }

                                                    const colorMap: Record<string, string> = {
                                                        yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
                                                        purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                                                        green: "bg-green-500/10 text-green-400 border-green-500/20",
                                                        blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                                                        red: "bg-red-500/10 text-red-400 border-red-500/20",
                                                        orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
                                                        pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
                                                        // Additional colors
                                                        amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                                                        indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                                                        cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                                                        teal: "bg-teal-500/10 text-teal-400 border-teal-500/20",
                                                        emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                                        violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
                                                        rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                                                        sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
                                                        primary: "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                                    };

                                                    return colorMap[color] || colorMap.primary;
                                                })()
                                            )}>
                                                {currentScheduleInfo.status === 'in-progress' ? '현재 진행 중' : '예정됨'}
                                            </span>
                                            <span className="text-sm font-mono text-muted-foreground">
                                                {currentScheduleInfo.schedule.startTime}
                                            </span>
                                        </div>
                                        <p className="font-bold text-base sm:text-lg mb-0.5 sm:mb-1 line-clamp-1">{currentScheduleInfo.schedule.text}</p>
                                        <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                                            {getScheduleMessage(currentScheduleInfo.schedule.text, currentScheduleInfo.status)}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-lg">
                                        <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-bold text-base sm:text-lg mb-0.5 sm:mb-1">오늘 일정이 없습니다</p>
                                        <p className="text-xs text-muted-foreground hidden sm:block">AI가 추천하는 일정을 추가해보세요</p>
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

                                            // NOTE: 'primary' is black in our theme, so we normalize to 'purple'
                                            const normalizedColor = (schedule.color === 'primary' || !schedule.color) ? 'purple' : schedule.color;

                                            // Color maps matching dashboard DailyRhythmTimeline dual-color gradients
                                            const iconBgMap: Record<string, string> = {
                                                yellow: "bg-gradient-to-br from-yellow-500 to-orange-500",
                                                purple: "bg-gradient-to-br from-purple-500 to-pink-500",
                                                green: "bg-gradient-to-br from-green-500 to-emerald-500",
                                                blue: "bg-gradient-to-br from-blue-500 to-cyan-500",
                                                red: "bg-gradient-to-br from-red-500 to-orange-500",
                                                orange: "bg-gradient-to-br from-orange-500 to-amber-500",
                                                pink: "bg-gradient-to-br from-pink-500 to-purple-500",
                                                amber: "bg-gradient-to-br from-amber-500 to-orange-500",
                                                indigo: "bg-gradient-to-br from-indigo-500 to-purple-500",
                                                cyan: "bg-gradient-to-br from-cyan-500 to-blue-500",
                                                teal: "bg-gradient-to-br from-teal-500 to-cyan-500",
                                                emerald: "bg-gradient-to-br from-emerald-500 to-green-500",
                                                violet: "bg-gradient-to-br from-violet-500 to-purple-500",
                                                rose: "bg-gradient-to-br from-rose-500 to-pink-500",
                                                sky: "bg-gradient-to-br from-sky-500 to-blue-500",
                                            };
                                            const cardBgMap: Record<string, string> = {
                                                yellow: "bg-gradient-to-br from-yellow-500/20 to-orange-500/20",
                                                purple: "bg-gradient-to-br from-purple-500/20 to-pink-500/20",
                                                green: "bg-gradient-to-br from-green-500/20 to-emerald-500/20",
                                                blue: "bg-gradient-to-br from-blue-500/20 to-cyan-500/20",
                                                red: "bg-gradient-to-br from-red-500/20 to-orange-500/20",
                                                orange: "bg-gradient-to-br from-orange-500/20 to-amber-500/20",
                                                pink: "bg-gradient-to-br from-pink-500/20 to-purple-500/20",
                                                amber: "bg-gradient-to-br from-amber-500/20 to-orange-500/20",
                                                indigo: "bg-gradient-to-br from-indigo-500/20 to-purple-500/20",
                                                cyan: "bg-gradient-to-br from-cyan-500/20 to-blue-500/20",
                                                teal: "bg-gradient-to-br from-teal-500/20 to-cyan-500/20",
                                                emerald: "bg-gradient-to-br from-emerald-500/20 to-green-500/20",
                                                violet: "bg-gradient-to-br from-violet-500/20 to-purple-500/20",
                                                rose: "bg-gradient-to-br from-rose-500/20 to-pink-500/20",
                                                sky: "bg-gradient-to-br from-sky-500/20 to-blue-500/20",
                                            };
                                            const cardBorderMap: Record<string, string> = {
                                                yellow: "border-yellow-500/50",
                                                purple: "border-purple-500/50",
                                                green: "border-green-500/50",
                                                blue: "border-blue-500/50",
                                                red: "border-red-500/50",
                                                orange: "border-orange-500/50",
                                                pink: "border-pink-500/50",
                                                amber: "border-amber-500/50",
                                                indigo: "border-indigo-500/50",
                                                cyan: "border-cyan-500/50",
                                                teal: "border-teal-500/50",
                                                emerald: "border-emerald-500/50",
                                                violet: "border-violet-500/50",
                                                rose: "border-rose-500/50",
                                                sky: "border-sky-500/50",
                                            };
                                            const cardShadowMap: Record<string, string> = {
                                                yellow: "shadow-[0_0_15px_rgba(234,179,8,0.15)]",
                                                purple: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
                                                green: "shadow-[0_0_15px_rgba(34,197,94,0.15)]",
                                                blue: "shadow-[0_0_15px_rgba(59,130,246,0.15)]",
                                                red: "shadow-[0_0_15px_rgba(239,68,68,0.15)]",
                                                orange: "shadow-[0_0_15px_rgba(249,115,22,0.15)]",
                                                pink: "shadow-[0_0_15px_rgba(236,72,153,0.15)]",
                                                amber: "shadow-[0_0_15px_rgba(245,158,11,0.15)]",
                                                indigo: "shadow-[0_0_15px_rgba(99,102,241,0.15)]",
                                                cyan: "shadow-[0_0_15px_rgba(6,182,212,0.15)]",
                                                teal: "shadow-[0_0_15px_rgba(20,184,166,0.15)]",
                                                emerald: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
                                                violet: "shadow-[0_0_15px_rgba(139,92,246,0.15)]",
                                                rose: "shadow-[0_0_15px_rgba(244,63,94,0.15)]",
                                                sky: "shadow-[0_0_15px_rgba(14,165,233,0.15)]",
                                            };

                                            const iconBg = iconBgMap[normalizedColor] || iconBgMap.purple;
                                            const cardBg = cardBgMap[normalizedColor] || cardBgMap.purple;
                                            const cardBorder = cardBorderMap[normalizedColor] || cardBorderMap.purple;
                                            const cardShadow = cardShadowMap[normalizedColor] || cardShadowMap.purple;

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
                                                            ) : (() => {
                                                                const ScheduleIcon = getScheduleIcon(schedule.text);
                                                                return <ScheduleIcon className="w-6 h-6" />;
                                                            })()}
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
                                                            {schedule.location && (
                                                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {schedule.location}
                                                                </p>
                                                            )}
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
                                                    {!isCompleted && !isSkipped && (() => {
                                                        const now = new Date();
                                                        const currentMinutes = now.getHours() * 60 + now.getMinutes();
                                                        const scheduleStartMinutes = timeToMinutes(schedule.startTime);
                                                        const canComplete = currentMinutes >= scheduleStartMinutes;

                                                        return (
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    disabled={!canComplete}
                                                                    onClick={async () => {
                                                                        // Mark as completed
                                                                        setTodaySchedules(prev => prev.map(s =>
                                                                            s.id === schedule.id ? { ...s, completed: true, skipped: false } : s
                                                                        ));
                                                                        // Save to localStorage
                                                                        const today = new Date().toISOString().split('T')[0];
                                                                        const completions = JSON.parse(localStorage.getItem(`schedule_completions_${today}`) || '{}');
                                                                        completions[schedule.id] = { completed: true, skipped: false };
                                                                        localStorage.setItem(`schedule_completions_${today}`, JSON.stringify(completions));

                                                                        // Save to server
                                                                        try {
                                                                            await fetch('/api/user/schedule/update', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({
                                                                                    scheduleId: schedule.id,
                                                                                    completed: true,
                                                                                    skipped: false
                                                                                })
                                                                            });
                                                                            console.log('[Home] Schedule marked as completed on server');
                                                                        } catch (error) {
                                                                            console.error('[Home] Failed to save completion to server:', error);
                                                                        }
                                                                    }}
                                                                    className={`flex-1 h-9 border border-white/10 ${canComplete ? 'bg-white/10 hover:bg-white/20 text-foreground' : 'bg-white/5 text-muted-foreground/50 cursor-not-allowed'}`}
                                                                >
                                                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                                                    완료
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    disabled={!canComplete}
                                                                    onClick={async () => {
                                                                        // Mark as skipped
                                                                        setTodaySchedules(prev => prev.map(s =>
                                                                            s.id === schedule.id ? { ...s, skipped: true, completed: false } : s
                                                                        ));
                                                                        // Save to localStorage
                                                                        const today = new Date().toISOString().split('T')[0];
                                                                        const completions = JSON.parse(localStorage.getItem(`schedule_completions_${today}`) || '{}');
                                                                        completions[schedule.id] = { completed: false, skipped: true };
                                                                        localStorage.setItem(`schedule_completions_${today}`, JSON.stringify(completions));

                                                                        // Save to server
                                                                        try {
                                                                            await fetch('/api/user/schedule/update', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({
                                                                                    scheduleId: schedule.id,
                                                                                    completed: false,
                                                                                    skipped: true
                                                                                })
                                                                            });
                                                                            console.log('[Home] Schedule marked as skipped on server');
                                                                        } catch (error) {
                                                                            console.error('[Home] Failed to save skip to server:', error);
                                                                        }
                                                                    }}
                                                                    className={`flex-1 h-9 ${canComplete ? 'hover:bg-white/10 text-muted-foreground' : 'text-muted-foreground/50 cursor-not-allowed'}`}
                                                                >
                                                                    <X className="w-4 h-4 mr-1.5" />
                                                                    놓침
                                                                </Button>
                                                            </div>
                                                        );
                                                    })()}
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
                            className="flex flex-col items-center w-full"
                        >
                            <div className="w-full max-w-3xl px-4">
                                {message.role === "user" ? (
                                    // User message - compact pill style
                                    <div className="flex justify-end mb-6">
                                        <div className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm max-w-[70%]">
                                            <p className="whitespace-pre-wrap">{message.content}</p>
                                        </div>
                                    </div>
                                ) : (
                                    // Assistant message - center-aligned, no bubble
                                    <div className="mb-8">
                                        <div className="text-sm text-foreground leading-relaxed">
                                            <p className="whitespace-pre-wrap">{message.content}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons - only show non-schedule actions */}
                                {message.actions && message.actions.length > 0 && message.role === "assistant" && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {message.actions
                                            .filter((action) => action.type !== 'add_schedule')
                                            .map((action, idx) => (
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
                                                    className="text-xs h-8 rounded-full"
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
                        <div className="flex flex-col items-center w-full">
                            <div className="w-full max-w-3xl px-4">
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        <span>생각 중...</span>
                                    </div>
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
                                    onClick={() => {
                                        setShowRecommendations(false);
                                        localStorage.setItem('showRecommendations', 'false');
                                    }}
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
                                onClick={() => {
                                    setShowRecommendations(true);
                                    localStorage.setItem('showRecommendations', 'true');
                                }}
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
                onClose={() => {
                    // Mark briefing as read when closing + log activity for personalization
                    if (selectedBriefing?.id) {
                        const today = getChatDate();
                        const readBriefings = JSON.parse(localStorage.getItem(`read_briefings_${today}`) || '[]');
                        if (!readBriefings.includes(selectedBriefing.id)) {
                            readBriefings.push(selectedBriefing.id);
                            localStorage.setItem(`read_briefings_${today}`, JSON.stringify(readBriefings));
                            console.log('[Home] Marked briefing as read:', selectedBriefing.id);

                            // Log activity for personalization
                            fetch('/api/user/activity-log', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    activityType: 'briefing_read',
                                    metadata: {
                                        briefingId: selectedBriefing.id,
                                        title: selectedBriefing.title,
                                        category: selectedBriefing.category || 'uncategorized',
                                        keywords: selectedBriefing.keywords || [],
                                    },
                                }),
                            }).catch(err => console.error('[Home] Failed to log activity:', err));
                        }
                    }
                    setSelectedBriefing(null);
                }}
                userLevel={userProfile?.level || 'intermediate'}
                userJob={userProfile?.job || ''}
            />
        </div>
    );
}
