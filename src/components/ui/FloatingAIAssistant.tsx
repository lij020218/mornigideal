"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Sparkles, Loader2, Minimize2, Calendar, Youtube, Newspaper, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendBriefingDetail } from "@/components/features/dashboard/TrendBriefingDetail";

interface ChatAction {
    type: "add_schedule" | "open_link" | "open_curriculum";
    label: string;
    data: Record<string, any>;
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    actions?: ChatAction[];
}

// TrendBriefing format matching TrendBriefingDetail props
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

interface RotatingCard {
    id: string;
    type: 'schedule' | 'briefing' | 'youtube' | 'news' | 'habit' | 'weather' | 'proactive';
    title: string;
    message: string;
    actionText: string;
    actionType: 'add_schedule' | 'open_briefing' | 'open_link';
    actionUrl?: string;
    color: string;
    icon: string;
    briefingData?: TrendBriefing;
    scheduleData?: {
        text: string;
        startTime: string;
        endTime?: string;
        specificDate?: string;
    };
}

// MediaItem interface matching RecommendedMedia
interface MediaItem {
    id: string;
    title: string;
    channel: string;
    type: 'youtube';
    tags: string[];
    duration: string;
    description: string;
}

interface FloatingAIAssistantProps {
    showSuggestions?: boolean;
    // Data from dashboard
    briefings?: TrendBriefing[];
    recommendations?: MediaItem[];
    userProfile?: {
        job?: string;
        goal?: string;
        customGoals?: any[];
    };
}

const CARD_ICONS: Record<string, React.ElementType> = {
    Calendar: Calendar,
    CalendarPlus: Calendar,
    Youtube: Youtube,
    Newspaper: Newspaper,
    Search: Search,
};

export function FloatingAIAssistant({
    showSuggestions = false,
    briefings: propsBriefings = [],
    recommendations = [],
    userProfile
}: FloatingAIAssistantProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [cards, setCards] = useState<RotatingCard[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [selectedBriefing, setSelectedBriefing] = useState<TrendBriefing | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);
    const [fetchedBriefings, setFetchedBriefings] = useState<TrendBriefing[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch briefings directly if props are empty
    useEffect(() => {
        if (!showSuggestions) return;

        // If props have briefings, use them
        if (propsBriefings.length > 0) {
            setFetchedBriefings(propsBriefings);
            return;
        }

        // Otherwise fetch from API
        const fetchBriefings = async () => {
            try {
                const response = await fetch('/api/trend-briefing/get');
                if (response.ok) {
                    const data = await response.json();
                    if (data.trends && data.trends.length > 0) {
                        console.log('[FloatingAI] Fetched briefings from API:', data.trends.length);
                        setFetchedBriefings(data.trends);
                    }
                }
            } catch (e) {
                console.error('[FloatingAI] Failed to fetch briefings:', e);
            }
        };

        fetchBriefings();
    }, [showSuggestions, propsBriefings]);

    // Use fetched briefings (either from props or API)
    const briefings = fetchedBriefings.length > 0 ? fetchedBriefings : propsBriefings;

    // Generate cards from props data
    useEffect(() => {
        if (!showSuggestions) return;

        console.log('[FloatingAI] Received briefings:', briefings?.length, briefings);
        console.log('[FloatingAI] Received recommendations:', recommendations?.length);
        console.log('[FloatingAI] UserProfile:', userProfile);

        const generatedCards: RotatingCard[] = [];
        const now = new Date();
        const currentHour = now.getHours();
        const today = now.toISOString().split('T')[0];
        const dayOfWeek = now.getDay();

        // CARD 1: Schedule (Blue)
        const customGoals = userProfile?.customGoals || [];
        const todayGoals = customGoals.filter((g: any) =>
            g.specificDate === today ||
            (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
        ).sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));

        const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const upcomingGoal = todayGoals.find((g: any) => g.startTime && g.startTime > currentTimeStr);

        // Check if upcoming goal is within 30 minutes
        const isWithin30Min = upcomingGoal && (() => {
            const [goalHour, goalMin] = upcomingGoal.startTime.split(':').map(Number);
            const goalTime = goalHour * 60 + goalMin;
            const currentTime = currentHour * 60 + now.getMinutes();
            return goalTime - currentTime <= 30 && goalTime - currentTime > 0;
        })();

        // Late night (midnight to 6 AM) - suggest sleep
        if (currentHour >= 0 && currentHour < 6) {
            generatedCards.push({
                id: 'schedule-sleep',
                type: 'schedule',
                title: '🌙 취침을 권해드립니다',
                message: '충분한 수면은 내일의 성과를 좌우합니다. 편안한 밤 되세요!',
                actionText: '수면 모드',
                actionType: 'open_link',
                color: 'bg-indigo-50 border-indigo-200',
                icon: 'Moon',
            });
        } else if (isWithin30Min && upcomingGoal) {
            // Within 30 minutes - show reminder
            generatedCards.push({
                id: 'schedule-reminder',
                type: 'schedule',
                title: `📅 ${upcomingGoal.startTime}에 일정이 있어요`,
                message: `"${upcomingGoal.text}" 일정을 잊지 마세요!`,
                actionText: '확인',
                actionType: 'open_link',
                color: 'bg-blue-50 border-blue-200',
                icon: 'Calendar',
            });
        } else if (upcomingGoal) {
            // Free time until next schedule - suggest personalized activity
            const job = userProfile?.job || '';
            const goal = userProfile?.goal || '';

            // Morning/Afternoon self-development suggestions (personalized by job)
            const getSelfDevelopmentSuggestions = () => {
                const baseSuggestions = [
                    { text: '📚 「부의 추월차선」 30분 독서로 성장하세요!', action: '책 읽기', icon: 'Sparkles' },
                    { text: '🎯 오늘의 목표를 향해 한 걸음 더 나아가세요', action: '목표 실행', icon: 'Sparkles' },
                    { text: '💪 20분 운동으로 에너지를 충전하세요!', action: '운동하기', icon: 'Sparkles' },
                    { text: '🚀 새로운 스킬을 배우는 시간을 가져보세요', action: '학습하기', icon: 'Sparkles' },
                    { text: '✍️ 오늘 배운 것을 정리하며 내것으로 만드세요', action: '정리하기', icon: 'Sparkles' },
                ];

                // Job-specific suggestions
                if (job.includes('마케터') || job.includes('마케팅')) {
                    baseSuggestions.push(
                        { text: '📊 트렌드 리포트를 작성하며 인사이트를 쌓으세요', action: '트렌드 분석', icon: 'Sparkles' },
                        { text: '💡 혁신적인 캠페인 아이디어를 구상해보세요', action: '아이디어 구상', icon: 'Sparkles' },
                        { text: '📈 경쟁사 전략을 분석하고 차별화 포인트를 찾으세요', action: '전략 분석', icon: 'Sparkles' }
                    );
                } else if (job.includes('개발') || job.includes('엔지니어')) {
                    baseSuggestions.push(
                        { text: '💻 사이드 프로젝트로 실력을 키워보세요!', action: '코딩하기', icon: 'Sparkles' },
                        { text: '🔧 새로운 기술 스택을 배우고 적용해보세요', action: '기술 학습', icon: 'Sparkles' },
                        { text: '🐛 코드 리팩토링으로 더 나은 개발자가 되세요', action: '코드 개선', icon: 'Sparkles' }
                    );
                } else if (job.includes('디자인')) {
                    baseSuggestions.push(
                        { text: '🎨 새로운 디자인 트렌드를 연구하고 실험해보세요', action: '디자인 연구', icon: 'Sparkles' },
                        { text: '✨ 포트폴리오 프로젝트를 시작해보세요!', action: '포트폴리오 작업', icon: 'Sparkles' },
                        { text: '🖌️ 매일 스케치로 감각을 유지하세요', action: '스케치 연습', icon: 'Sparkles' }
                    );
                } else if (job.includes('학생') || job.includes('취준생')) {
                    baseSuggestions.push(
                        { text: '📝 자기소개서 한 문단 더 다듬어보세요', action: '자소서 작성', icon: 'Sparkles' },
                        { text: '🎯 면접 예상 질문에 답변을 준비해보세요', action: '면접 준비', icon: 'Sparkles' },
                        { text: '💼 관심 기업 리서치로 경쟁력을 높이세요', action: '기업 분석', icon: 'Sparkles' }
                    );
                }

                return baseSuggestions;
            };

            // Evening productive relaxation suggestions
            const eveningProductiveSuggestions = [
                { text: '📖 저녁 독서로 하루를 의미있게 마무리하세요', action: '독서하기', icon: 'Sparkles' },
                { text: '✍️ 하루를 돌아보며 성장 일기를 작성해보세요', action: '일기 쓰기', icon: 'Sparkles' },
                { text: '🎯 내일의 목표를 구체적으로 계획해보세요', action: '계획 세우기', icon: 'Sparkles' },
                { text: '💭 오늘 배운 교훈을 정리하고 내재화하세요', action: '복습하기', icon: 'Sparkles' },
                { text: '🎓 온라인 강의로 새로운 지식을 습득하세요', action: '강의 듣기', icon: 'Sparkles' },
                { text: '🌟 성공한 사람들의 인터뷰를 보며 영감을 얻으세요', action: '영감 얻기', icon: 'Sparkles' },
                { text: '📝 미뤄둔 과제나 프로젝트를 진행해보세요', action: '과제 진행', icon: 'Sparkles' },
                { text: '🧠 명상으로 마음을 정리하고 집중력을 회복하세요', action: '명상하기', icon: 'Sparkles' },
            ];

            // Weekend productive suggestions
            const weekendSuggestions = [
                { text: '📚 주말 프로젝트로 새로운 것에 도전해보세요!', action: '프로젝트 시작', icon: 'Sparkles' },
                { text: '🎯 이번 주 목표를 리뷰하고 다음 주를 준비하세요', action: '주간 리뷰', icon: 'Sparkles' },
                { text: '💡 평소 관심있던 분야를 깊이 탐구해보세요', action: '심화 학습', icon: 'Sparkles' },
                { text: '🤝 네트워킹 이벤트나 스터디 모임에 참여해보세요', action: '네트워킹', icon: 'Sparkles' },
                { text: '✨ 포트폴리오나 이력서를 업데이트하세요', action: '커리어 관리', icon: 'Sparkles' },
                { text: '🎨 취미 활동으로 창의력을 발휘해보세요', action: '취미 개발', icon: 'Sparkles' },
            ];

            let suggestions;
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            if (isWeekend && currentHour >= 10 && currentHour <= 18) {
                suggestions = weekendSuggestions;
            } else if (currentHour < 19) {
                suggestions = getSelfDevelopmentSuggestions();
            } else {
                suggestions = eveningProductiveSuggestions;
            }

            const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

            generatedCards.push({
                id: 'schedule-suggest',
                type: 'schedule',
                title: `💪 ${upcomingGoal.startTime}까지 성장할 시간!`,
                message: randomSuggestion.text,
                actionText: randomSuggestion.action,
                actionType: 'open_link',
                actionUrl: '#', // Could link to relevant app/website
                color: 'bg-blue-50 border-blue-200',
                icon: 'Sparkles',
            });
        } else {
            // No more schedules today - continue productive evening activities
            const eveningGrowthSuggestions = [
                { text: '📖 저녁 독서로 하루를 의미있게 마무리하세요', action: '독서하기' },
                { text: '✍️ 하루를 돌아보며 성장 일기를 작성해보세요', action: '일기 쓰기' },
                { text: '🎯 내일의 목표를 구체적으로 계획해보세요', action: '계획 세우기' },
                { text: '💭 오늘 배운 교훈을 정리하고 내재화하세요', action: '복습하기' },
                { text: '🎓 온라인 강의로 새로운 지식을 습득하세요', action: '강의 듣기' },
                { text: '📝 미뤄둔 과제나 프로젝트를 진행해보세요', action: '과제 진행' },
            ];

            const randomSuggestion = eveningGrowthSuggestions[Math.floor(Math.random() * eveningGrowthSuggestions.length)];

            generatedCards.push({
                id: 'schedule-evening',
                type: 'schedule',
                title: '🚀 지금도 성장할 수 있습니다!',
                message: randomSuggestion.text,
                actionText: randomSuggestion.action,
                actionType: 'open_link',
                color: 'bg-indigo-50 border-indigo-200',
                icon: 'Sparkles',
            });
        }

        // CARD 2: Trend Briefing from props (Orange)
        if (briefings.length > 0) {
            const randomBriefing = briefings[Math.floor(Math.random() * briefings.length)];
            generatedCards.push({
                id: 'briefing-card',
                type: 'briefing',
                title: `📰 ${randomBriefing.title?.substring(0, 25)}...`,
                message: '아직 이 트렌드 브리핑을 읽지 않으셨어요. 지금 확인해보세요!',
                actionText: '브리핑 보기',
                actionType: 'open_briefing',
                briefingData: randomBriefing,
                color: 'bg-orange-50 border-orange-200',
                icon: 'Newspaper',
            });
        }

        // CARD 3: YouTube from localStorage (Red)
        // RecommendedMedia stores in localStorage: daily_rec_${job}_${goal}
        let youtubeRecs = recommendations;
        if (youtubeRecs.length === 0 && typeof window !== 'undefined') {
            try {
                const cacheKey = `daily_rec_${userProfile?.job || ''}_${userProfile?.goal || ''}`;
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { items } = JSON.parse(cached);
                    youtubeRecs = items || [];
                }
            } catch (e) {
                console.log('[FloatingAI] localStorage read failed');
            }
        }

        if (youtubeRecs.length > 0) {
            const randomRec = youtubeRecs[Math.floor(Math.random() * youtubeRecs.length)];
            generatedCards.push({
                id: 'youtube-card',
                type: 'youtube',
                title: `🎬 ${randomRec.title?.substring(0, 25)}...`,
                message: `${randomRec.channel}의 추천 영상`,
                actionText: '보러가기',
                actionType: 'open_link',
                actionUrl: `https://www.youtube.com/watch?v=${randomRec.id}`,
                color: 'bg-red-50 border-red-200',
                icon: 'Youtube',
            });
        }

        // CARD 4: Personalized Industry Info (Purple)
        const getIndustryInfo = () => {
            const job = userProfile?.job || '';

            // Student-focused suggestions
            if (job.includes('학생') || job.includes('대학생') || job.includes('취준생')) {
                const studentInfo = [
                    { title: '🏆 공모전 정보', message: '이번 주 마감되는 공모전을 확인하세요', url: 'https://www.thinkcontest.com', action: '공모전 보기' },
                    { title: '💼 인턴십 채용', message: '대기업/스타트업 인턴 채용 공고', url: 'https://www.wanted.co.kr/wdlist/518', action: '채용공고 보기' },
                    { title: '📚 장학금 정보', message: '신청 가능한 장학금을 확인하세요', url: 'https://www.kosaf.go.kr', action: '장학금 보기' },
                    { title: '✍️ 자소서 팁', message: '합격 자소서 작성법을 알아보세요', url: 'https://www.jobplanet.co.kr', action: '취업 팁 보기' },
                ];
                return studentInfo[Math.floor(Math.random() * studentInfo.length)];
            }

            // Marketer suggestions
            if (job.includes('마케터') || job.includes('마케팅')) {
                const marketerInfo = [
                    { title: '📊 마케팅 트렌드', message: '2024 디지털 마케팅 트렌드 리포트', url: 'https://www.thinkwithgoogle.com', action: '리포트 보기' },
                    { title: '🏅 광고 어워드', message: '수상작에서 영감을 얻어보세요', url: 'https://www.adic.or.kr', action: '수상작 보기' },
                    { title: '📈 SNS 인사이트', message: '인스타그램/틱톡 알고리즘 분석', url: 'https://business.instagram.com/blog', action: '인사이트 보기' },
                ];
                return marketerInfo[Math.floor(Math.random() * marketerInfo.length)];
            }

            // Developer suggestions
            if (job.includes('개발') || job.includes('엔지니어') || job.includes('프로그래머')) {
                const devInfo = [
                    { title: '💻 기술 블로그', message: '이번 주 인기 기술 아티클', url: 'https://velog.io', action: '아티클 보기' },
                    { title: '🚀 해커톤 정보', message: '참가 가능한 해커톤을 확인하세요', url: 'https://devpost.com/hackathons', action: '해커톤 보기' },
                    { title: '📦 오픈소스', message: '주목받는 GitHub 프로젝트', url: 'https://github.com/trending', action: '트렌딩 보기' },
                    { title: '💡 개발자 컨퍼런스', message: '놓치면 안 될 개발 컨퍼런스', url: 'https://festa.io/categories/28', action: '컨퍼런스 보기' },
                ];
                return devInfo[Math.floor(Math.random() * devInfo.length)];
            }

            // Designer suggestions
            if (job.includes('디자인') || job.includes('디자이너')) {
                const designerInfo = [
                    { title: '🎨 디자인 트렌드', message: '2024 UI/UX 디자인 트렌드', url: 'https://www.awwwards.com', action: '트렌드 보기' },
                    { title: '🏆 디자인 어워드', message: 'Red Dot/IF 수상작 살펴보기', url: 'https://www.red-dot.org', action: '수상작 보기' },
                    { title: '✨ 영감 갤러리', message: 'Behance에서 영감 얻기', url: 'https://www.behance.net', action: '갤러리 보기' },
                ];
                return designerInfo[Math.floor(Math.random() * designerInfo.length)];
            }

            // General professional suggestions
            const generalInfo = [
                { title: '📈 커리어 성장', message: `${job || '직장인'}을 위한 역량 향상 팁`, url: 'https://www.linkedin.com/learning', action: '학습하기' },
                { title: '💡 업계 뉴스', message: `${job || '업계'} 최신 동향 확인`, url: `https://news.google.com/search?q=${encodeURIComponent((job || '') + ' 트렌드')}`, action: '뉴스 보기' },
                { title: '🎯 자기계발', message: '성과를 높이는 업무 스킬', url: 'https://www.coursera.org', action: '코스 보기' },
            ];
            return generalInfo[Math.floor(Math.random() * generalInfo.length)];
        };

        const industryInfo = getIndustryInfo();
        generatedCards.push({
            id: 'news-card',
            type: 'news',
            title: industryInfo.title,
            message: industryInfo.message,
            actionText: industryInfo.action,
            actionType: 'open_link',
            actionUrl: industryInfo.url,
            color: 'bg-purple-50 border-purple-200',
            icon: 'Search',
        });

        setCards(generatedCards);
    }, [showSuggestions, briefings, recommendations, userProfile]);

    // 20-second rotation timer
    useEffect(() => {
        if (!showSuggestions || cards.length === 0 || isOpen) return;

        const timer = setInterval(() => {
            setCurrentCardIndex((prev) => (prev + 1) % cards.length);
        }, 20000); // 20 seconds

        return () => clearInterval(timer);
    }, [showSuggestions, cards.length, isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: input.trim(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!res.ok) throw new Error("Failed to get response");

            const data = await res.json();
            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: data.message,
                actions: data.actions || [],
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: "죄송합니다. 응답을 가져오는데 실패했습니다.",
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

    // Handle action button clicks in chat
    const handleChatAction = async (action: ChatAction, messageId: string) => {
        if (action.type === "add_schedule") {
            try {
                const res = await fetch("/api/user/schedule/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(action.data),
                });

                if (!res.ok) throw new Error("Failed to add schedule");
                const result = await res.json();

                setMessages((prev) => [
                    ...prev,
                    {
                        id: `system-${Date.now()}`,
                        role: "assistant",
                        content: `✅ ${result.message || "일정이 추가되었습니다!"}`,
                    },
                ]);

                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === messageId
                            ? { ...m, actions: m.actions?.filter((a) => a !== action) }
                            : m
                    )
                );
            } catch (error) {
                setMessages((prev) => [
                    ...prev,
                    { id: `error-${Date.now()}`, role: "assistant", content: "❌ 일정 추가에 실패했습니다." },
                ]);
            }
        } else if (action.type === "open_link" && action.data.url) {
            window.open(action.data.url, "_blank");
        }
    };

    // Handle card action clicks
    const handleCardAction = async (card: RotatingCard) => {
        if (card.actionType === 'open_briefing' && card.briefingData) {
            setSelectedBriefing(card.briefingData);
        } else if (card.actionType === 'add_schedule' && card.scheduleData) {
            try {
                const res = await fetch("/api/user/schedule/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(card.scheduleData),
                });
                if (res.ok) {
                    setIsOpen(true);
                    setMessages((prev) => [
                        ...prev,
                        { id: `system-${Date.now()}`, role: "assistant", content: "✅ 일정이 추가되었습니다! 대시보드를 새로고침해주세요." },
                    ]);
                }
            } catch (e) {
                console.error("Schedule add error:", e);
            }
        } else if (card.actionType === 'open_link' && card.actionUrl) {
            window.open(card.actionUrl, "_blank");
        }

        // Move to next card after action
        setCurrentCardIndex((prev) => (prev + 1) % cards.length);
    };

    const currentCard = cards[currentCardIndex];
    const CardIcon = currentCard ? CARD_ICONS[currentCard.icon] || Sparkles : Sparkles;

    // Handle swipe navigation
    const handleSwipe = (direction: 'left' | 'right') => {
        if (direction === 'left') {
            setCurrentCardIndex((prev) => (prev + 1) % cards.length);
        } else {
            setCurrentCardIndex((prev) => (prev - 1 + cards.length) % cards.length);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {/* Single Rotating Card with Swipe */}
            <AnimatePresence mode="wait">
                {showSuggestions && !isOpen && !isDismissed && currentCard && (
                    <motion.div
                        key={currentCard.id}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(e, { offset, velocity }) => {
                            const swipe = offset.x * velocity.x;
                            if (swipe < -5000) {
                                handleSwipe('left');
                            } else if (swipe > 5000) {
                                handleSwipe('right');
                            }
                        }}
                        className={cn(
                            "relative w-96 backdrop-blur-xl rounded-2xl p-6 shadow-xl cursor-grab active:cursor-grabbing",
                            "border bg-white",
                            currentCard.color
                        )}
                    >
                        {/* Dismiss button */}
                        <button
                            onClick={() => setIsDismissed(true)}
                            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
                        >
                            <X className="w-4 h-4 text-foreground/70" />
                        </button>

                        {/* Card indicator dots - clickable */}
                        <div className="absolute top-3 left-4 flex gap-1.5">
                            {cards.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentCardIndex(idx)}
                                    className={cn(
                                        "w-2.5 h-2.5 rounded-full transition-all hover:scale-125",
                                        idx === currentCardIndex ? "bg-black" : "bg-black/20 hover:bg-black/40"
                                    )}
                                />
                            ))}
                        </div>

                        <div className="pt-5 pr-8">
                            <div className="flex items-center gap-3 mb-3">
                                <CardIcon className="w-6 h-6 text-foreground" />
                                <p className="font-bold text-lg text-foreground">
                                    {currentCard.title}
                                </p>
                            </div>
                            <p className="text-base text-muted-foreground mb-5 line-clamp-2 leading-relaxed">
                                {currentCard.message}
                            </p>
                            <Button
                                size="default"
                                variant="ghost"
                                onClick={() => handleCardAction(currentCard)}
                                className="h-10 px-5 text-base font-semibold bg-white hover:bg-black/5 text-foreground border border-black/10 rounded-full shadow-sm"
                            >
                                {currentCard.actionText}
                            </Button>
                        </div>

                        {/* Progress bar for 20s timer */}
                        <motion.div
                            className="absolute bottom-0 left-0 h-1 bg-black/10 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 20, ease: "linear" }}
                            key={`progress-${currentCardIndex}`}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="w-[380px] h-[500px] bg-white border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border bg-muted">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">AI 어시스턴트</h3>
                                    <p className="text-[10px] text-muted-foreground">무엇이든 물어보세요</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsOpen(false)}
                                className="h-8 w-8 rounded-lg hover:bg-black/5"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                                        <Bot className="w-8 h-8 text-foreground" />
                                    </div>
                                    <p className="text-sm font-medium mb-1">안녕하세요!</p>
                                    <p className="text-xs max-w-[200px]">
                                        학습, 일정, 목표에 대해 무엇이든 물어보세요.
                                    </p>
                                </div>
                            )}
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "flex",
                                        message.role === "user" ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                                            message.role === "user"
                                                ? "bg-primary text-white rounded-br-md"
                                                : "bg-muted border border-border rounded-bl-md"
                                        )}
                                    >
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                        {message.actions && message.actions.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {message.actions.map((action, idx) => (
                                                    <Button
                                                        key={idx}
                                                        size="sm"
                                                        onClick={() => handleChatAction(action, message.id)}
                                                        className="h-8 px-3 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg"
                                                    >
                                                        {action.type === "add_schedule" && <Calendar className="w-3 h-3 mr-1.5" />}
                                                        {action.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
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

                        {/* Input */}
                        <div className="p-4 border-t border-border">
                            <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-4 py-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="메시지를 입력하세요..."
                                    className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                                    disabled={isLoading}
                                />
                                <Button
                                    size="icon"
                                    onClick={handleSend}
                                    disabled={!input.trim() || isLoading}
                                    className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50"
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                    setIsOpen(!isOpen);
                }}
                className={cn(
                    "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all",
                    isOpen
                        ? "bg-muted border border-border"
                        : "bg-foreground"
                )}
            >
                {isOpen ? (
                    <X className="w-6 h-6 text-foreground" />
                ) : (
                    <Bot className="w-6 h-6 text-white" />
                )}
            </motion.button>

            {/* Trend Briefing Detail Modal - Same as Dashboard */}
            <TrendBriefingDetail
                briefing={selectedBriefing}
                isOpen={!!selectedBriefing}
                onClose={() => setSelectedBriefing(null)}
                userLevel=""
                userJob=""
            />
        </div>
    );
}
