"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Send, Sparkles, Clock, CheckCircle2, Calendar, Plus, Loader2, Menu, X as CloseIcon, MessageSquare, MapPin } from "lucide-react";

// Fieri Logo SVG Component - 소용돌이 로고
const FieriLogo = ({ className = "" }: { className?: string }) => (
    <svg
        viewBox="0 0 1024 1024"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path fill="#FDD7A7" d="M523.997498,653.945618 C528.388672,653.329346 532.779907,652.713013 537.750366,652.292419 C538.881531,652.271362 539.433472,652.054688 539.985413,651.838013 C540.406616,651.830505 540.827881,651.822998 541.912720,651.852661 C543.446411,651.342712 544.316467,650.795532 545.186462,650.248352 C555.374451,647.371582 565.861145,645.266846 575.690491,641.463196 C598.774475,632.530640 619.020569,618.929077 636.281677,601.162415 C648.263733,588.829346 658.432495,575.090271 666.007874,559.551270 C666.420288,558.705261 667.026672,557.953796 668.502197,557.285217 C668.502197,558.540161 668.714478,559.838135 668.470459,561.043701 C664.507629,580.623047 655.469055,597.935059 644.178284,614.125916 C618.600952,650.803650 584.596863,675.800232 541.063782,687.013367 C530.524475,689.728088 519.630188,691.064148 508.304321,692.805786 C507.138153,692.738220 506.566772,692.898987 505.995392,693.059753 C503.589661,693.317444 501.183929,693.575195 498.070679,693.587646 C491.912994,693.518860 486.462799,693.695251 481.012604,693.871704 C450.400208,692.652466 421.512512,684.577026 393.602448,672.289368 C359.801880,657.408508 331.161499,635.421631 306.879181,608.004089 C275.857605,572.977051 255.236130,532.357483 246.175018,486.287781 C243.917679,474.810760 243.133118,463.011169 242.221878,451.316925 C241.799973,445.902740 242.698868,440.385651 243.219055,434.309875 C243.292816,433.136383 243.146515,432.568176 243.000214,432.000000 C244.336960,426.729156 245.193604,421.269562 247.167740,416.249359 C248.652237,412.474243 251.968246,409.992279 256.573853,409.997620 C261.197296,410.002991 264.348541,412.579010 265.951782,416.322235 C268.358826,421.942230 270.401337,427.810394 271.782166,433.762543 C279.275421,466.062256 288.269745,497.875641 303.789429,527.361938 C317.585419,553.573425 334.553253,577.690186 356.950867,597.272278 C388.988617,625.282654 425.814819,643.978088 468.102478,651.100525 C474.099121,652.110535 480.107941,653.047974 486.791321,654.271362 C488.983215,654.385864 490.494934,654.248047 492.006622,654.110229 C501.718628,654.098572 511.430634,654.086914 521.731323,654.277344 C522.879150,654.301453 523.438354,654.123535 523.997498,653.945618z"/>
        <path fill="#FDD7A7" d="M782.758118,474.121368 C784.582764,481.800323 786.437134,489.472412 788.211365,497.162994 C788.652649,499.076141 788.834656,501.049072 789.122559,503.727844 C789.406982,504.974548 789.704712,505.487885 790.002441,506.001221 C790.635742,510.393921 791.269043,514.786621 791.671753,519.790771 C791.628723,521.268188 791.816223,522.134094 792.003784,523.000000 C793.606323,535.962463 793.561035,548.835327 790.069031,561.549683 C788.679443,566.609436 786.640503,571.077209 780.721069,571.898804 C775.705322,572.594849 770.815613,569.704895 768.474915,563.517639 C765.248474,554.989258 762.608826,546.213013 760.166565,537.418396 C751.915527,507.706421 742.018921,478.622437 727.229675,451.448639 C718.073364,434.624695 707.147766,419.039032 694.417236,404.612366 C676.013367,383.756470 654.501709,367.032318 629.817749,354.487183 C608.641113,343.724518 586.135559,336.934998 562.504211,333.883820 C541.093506,331.119354 519.861206,331.565582 498.587006,335.453522 C480.959686,338.674957 464.042633,343.985138 447.949829,351.652130 C433.811829,358.387848 420.933960,367.220917 408.930267,377.372040 C392.049286,391.647644 379.107971,408.977295 368.365997,428.113403 C368.068420,428.643524 367.636383,429.098175 366.545563,429.343018 C366.770355,428.204132 366.886780,427.030792 367.235901,425.931396 C374.671234,402.519043 386.250610,381.442291 401.913361,362.445129 C419.885590,340.646851 441.473236,323.734253 466.920563,311.545624 C484.311371,303.215881 502.559540,298.423126 521.651978,295.843658 C536.566345,293.828583 551.435486,294.325470 566.242798,295.131470 C601.077515,297.027557 633.074951,308.646942 663.270081,325.637634 C685.910583,338.377319 705.899780,354.498138 723.716309,373.350220 C744.136169,394.957001 760.113037,419.538025 772.155701,446.657990 C775.242798,453.609924 777.454163,460.950684 780.090454,468.857056 C780.994751,471.108002 781.876465,472.614685 782.758118,474.121368z"/>
        <path fill="#FDD6A7" d="M684.148560,490.912598 C678.114746,424.145813 645.535156,375.639038 584.250488,346.877502 C584.536438,346.439819 584.822388,346.002167 585.108337,345.564514 C594.010010,348.551239 603.222046,350.842499 611.757263,354.650635 C641.485962,367.914673 667.251709,386.471436 687.866211,412.078217 C701.956238,429.580444 712.849731,448.701813 718.660339,470.284546 C722.413208,484.224091 725.517517,498.356995 726.242188,513.068054 C728.058105,549.933655 719.173828,584.248169 702.839050,616.755493 C689.043091,644.210388 669.795288,667.561584 646.756592,688.008606 C628.576843,704.143311 608.635315,717.597412 587.134521,728.509949 C573.898560,735.227661 559.688965,740.274841 545.517517,744.830627 C531.854492,749.222839 517.844910,753.254578 503.680237,755.162231 C490.162659,756.982727 476.244476,756.114868 462.511353,755.887634 C457.950226,755.812073 454.280975,752.595581 453.232849,748.041443 C452.125763,743.231140 455.416687,740.098206 459.367462,738.267578 C465.375641,735.483643 471.460358,732.686035 477.780396,730.784241 C508.794739,721.451599 538.666809,709.312073 566.851562,693.430176 C586.698059,682.246704 605.062988,668.851746 621.745605,653.100403 C639.114929,636.700745 653.349243,618.064514 663.994812,596.828796 C673.789856,577.289673 681.021912,556.791565 683.054810,534.782043 C683.328003,531.824707 683.696167,528.876282 684.345642,525.413940 C684.790161,523.936096 684.909424,522.968079 685.028687,522.000000 C685.029480,512.978577 685.030212,503.957153 685.275024,494.265991 C685.062317,492.701691 684.605469,491.807129 684.148560,490.912598z"/>
        <path fill="#FDD7A7" d="M310.121490,441.009613 C310.386932,439.581207 310.652405,438.152802 311.217926,436.172638 C311.608612,435.023834 311.699249,434.426758 311.789886,433.829712 C311.831543,433.123596 311.873199,432.417511 312.156219,431.226044 C312.314209,430.164703 312.230804,429.588745 312.147400,429.012756 C312.161774,428.593536 312.176147,428.174316 312.522003,427.345032 C313.169891,426.235046 313.486298,425.535095 313.802673,424.835144 C313.904846,423.521576 314.007019,422.208008 314.491760,420.389954 C315.508728,417.863770 316.143066,415.842133 316.777405,413.820465 C316.899658,412.515717 317.021881,411.210968 317.493256,409.421387 C318.175964,408.244598 318.509521,407.552643 318.843079,406.860718 C318.843079,406.860718 318.886597,406.413330 319.148315,406.079681 C319.536560,405.449890 319.663025,405.153778 319.789520,404.857635 C323.867371,389.409454 331.401825,375.553680 339.697174,362.082886 C350.725739,344.173523 363.803253,327.800232 378.746185,313.063843 C400.262268,291.845215 424.097931,273.664673 450.938049,259.476959 C471.332855,248.696213 492.374176,239.805511 515.135132,235.631516 C521.775269,234.413803 528.654785,234.295547 535.435974,234.126282 C539.827271,234.016693 543.801880,235.805359 545.398804,240.245895 C547.029297,244.779800 544.886475,248.654785 541.236938,251.066208 C535.150269,255.087860 528.837891,258.837402 522.344238,262.161682 C490.892487,278.262726 460.461975,296.031097 433.165558,318.592682 C409.958618,337.774200 389.519562,359.660980 375.383728,386.496216 C368.543152,399.482330 363.635803,413.486786 357.498413,427.546356 C356.499054,429.745636 355.854492,431.428741 355.209930,433.111816 C354.748688,436.068390 354.287415,439.024994 353.528564,442.481812 C353.128296,443.656067 353.025696,444.330109 352.923096,445.004150 C351.964417,450.719116 351.005737,456.434113 349.795227,462.756256 C349.670349,464.243927 349.797333,465.124420 349.924286,466.004913 C349.680786,475.985291 349.437256,485.965698 349.171204,496.706177 C349.423889,497.978271 349.699127,498.490265 349.974335,499.002258 C351.764923,525.006165 360.344604,548.908875 373.514191,571.083862 C390.426575,599.560852 414.361755,620.639648 444.103729,635.159119 C445.235840,635.711853 446.267303,636.470703 447.345673,637.133423 C447.169952,637.563843 446.994263,637.994263 446.818542,638.424683 C437.836517,635.231079 428.593903,632.618164 419.924500,628.727905 C399.328156,619.485657 380.641876,607.317749 364.085052,591.738586 C334.632538,564.025208 315.440796,530.870056 310.196106,490.559692 C308.455658,477.182831 309.327271,463.466095 309.263550,449.260315 C309.613495,448.021942 309.704620,447.428040 309.795715,446.834137 C309.845306,445.812927 309.894867,444.791748 310.177917,443.250366 C310.314789,442.156677 310.218140,441.583160 310.121490,441.009613z"/>
    </svg>
);
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useFocusSleepMode } from "@/contexts/FocusSleepModeContext";

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

interface TrendBriefing {
    id: string;
    title: string;
    category: string;
    summary: string;
    time: string;
    source: string;
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
    const { setShowFocusPrompt, setShowSleepPrompt, isFocusMode, isSleepMode } = useFocusSleepMode();

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
    const [todayTrends, setTodayTrends] = useState<TrendBriefing[]>([]);
    const [readTrendIds, setReadTrendIds] = useState<string[]>([]);
    const [learningTips, setLearningTips] = useState<{
        greeting: string;
        tips: { emoji: string; title: string; content: string }[];
        encouragement: string;
        scheduleId: string;
    } | null>(null);
    const [isLoadingLearningTips, setIsLoadingLearningTips] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Helper function to get chat date (5am cutoff, KST timezone)
    const getChatDate = () => {
        const now = new Date();
        // Convert to KST (UTC+9) for consistent date handling
        const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const hour = kstDate.getHours();

        // If before 5am KST, use previous day
        if (hour < 5) {
            kstDate.setDate(kstDate.getDate() - 1);
        }

        // Return YYYY-MM-DD format in KST
        return `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, '0')}-${String(kstDate.getDate()).padStart(2, '0')}`;
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

        // 30일 지난 채팅 삭제 (localStorage)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

        chatDates.forEach(date => {
            if (date < cutoffDate) {
                localStorage.removeItem(`chat_messages_${date}`);
                localStorage.removeItem(`greeting_sent_${date}`);
                console.log('[Chat] Deleted old chat:', date);
            }
        });

        // DB에서도 30일 지난 채팅 삭제
        fetch('/api/user/chat-history?cleanup=true', { method: 'DELETE' })
            .catch(err => console.error('[Chat] Failed to cleanup old chats in DB:', err));

        // Check for pending learning tip (from Learning page)
        const pendingTip = localStorage.getItem('pending_learning_tip');
        if (pendingTip) {
            try {
                const tipData = JSON.parse(pendingTip);
                console.log('[Chat] Found pending learning tip:', tipData);

                // 학습 팁을 채팅 메시지로 추가
                const tipMessage: Message = {
                    id: `learning-tip-${Date.now()}`,
                    role: 'assistant',
                    content: `📚 **${tipData.topic}: ${tipData.dayTitle}** 학습이 일정에 추가되었어요!\n\n${tipData.greeting}\n\n${tipData.tips?.map((t: any) => `${t.emoji} **${t.title}**\n${t.content}`).join('\n\n') || ''}\n\n💪 ${tipData.encouragement || '오늘도 화이팅!'}`,
                    timestamp: new Date(),
                };

                setMessages(prev => [...prev, tipMessage]);

                // 사용 후 삭제
                localStorage.removeItem('pending_learning_tip');
            } catch (error) {
                console.error('[Chat] Failed to parse pending learning tip:', error);
                localStorage.removeItem('pending_learning_tip');
            }
        }
    }, []);

    // Listen for load-chat-date event from Sidebar
    useEffect(() => {
        const handleLoadChatDate = async (event: CustomEvent<{ date: string }>) => {
            const { date } = event.detail;
            console.log('[Chat] Loading chat for date:', date);
            setCurrentDate(date);

            // localStorage에서 먼저 시도
            const savedMessages = localStorage.getItem(`chat_messages_${date}`);
            if (savedMessages) {
                try {
                    const parsed = JSON.parse(savedMessages);
                    const messagesWithDates = parsed.map((m: any) => ({
                        ...m,
                        timestamp: new Date(m.timestamp)
                    }));
                    setMessages(messagesWithDates);
                    console.log('[Chat] Loaded from localStorage:', messagesWithDates.length);
                    return;
                } catch (error) {
                    console.error('[Chat] Failed to parse saved messages:', error);
                }
            }

            // DB에서 시도
            try {
                const response = await fetch(`/api/user/chat-history?date=${date}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.chat?.messages) {
                        const messagesWithDates = data.chat.messages.map((m: any) => ({
                            ...m,
                            timestamp: new Date(m.timestamp)
                        }));
                        setMessages(messagesWithDates);
                        // localStorage에도 저장
                        localStorage.setItem(`chat_messages_${date}`, JSON.stringify(data.chat.messages));
                        console.log('[Chat] Loaded from DB:', messagesWithDates.length);
                    } else {
                        setMessages([]);
                    }
                }
            } catch (error) {
                console.error('[Chat] Failed to load from DB:', error);
                setMessages([]);
            }
        };

        window.addEventListener('load-chat-date', handleLoadChatDate as EventListener);
        return () => window.removeEventListener('load-chat-date', handleLoadChatDate as EventListener);
    }, []);

    // Send initial greeting message with AI recommendations if no messages exist
    // Or upgrade to rich greeting in morning hours
    useEffect(() => {
        const now = new Date();
        const hour = now.getHours();
        const today = getChatDate();
        const isMorning = hour >= 5 && hour < 12;
        const richGreetingKey = `rich_greeting_sent_${today}`;
        const hasRichGreeting = localStorage.getItem(richGreetingKey);

        // Allow greeting if:
        // 1. No messages in the current chat, OR
        // 2. Morning hours AND rich greeting not sent yet (to upgrade basic greeting)
        const shouldAttemptGreeting = messages.length === 0 || (isMorning && !hasRichGreeting && messages.length <= 1);

        if (shouldAttemptGreeting && session?.user && !isLoading && todaySchedules.length >= 0) {
            const sendGreeting = async () => {
                try {
                    const now = new Date();
                    const hour = now.getHours();
                    const today = getChatDate();

                    // Check if we already sent RICH greeting today
                    // We use a separate key for rich vs basic greetings
                    const richGreetingKey = `rich_greeting_sent_${today}`;
                    const basicGreetingKey = `basic_greeting_sent_${today}`;
                    const oldGreetingKey = `greeting_sent_${today}`; // legacy key for migration

                    // If rich greeting was already sent, don't resend
                    if (localStorage.getItem(richGreetingKey)) {
                        console.log('[Chat] Rich greeting already sent today');
                        return;
                    }

                    // 아침 시간대에는 basic greeting이 보내졌어도 rich greeting 시도
                    // 아침이 아닌 시간대에는 basic greeting이 있으면 skip
                    const hasBasicGreeting = localStorage.getItem(basicGreetingKey) || localStorage.getItem(oldGreetingKey);
                    if (hasBasicGreeting && !(hour >= 5 && hour < 12)) {
                        console.log('[Chat] Basic greeting already sent (non-morning hours)');
                        return;
                    }

                    console.log('[Chat] Sending initial greeting message with recommendations (hasBasic:', !!hasBasicGreeting, ')');

                    // 아침 시간대 (5am - 12pm)에는 Morning Briefing API 호출
                    if (hour >= 5 && hour < 12) {
                        try {
                            console.log('[Chat] Fetching morning briefing...');
                            const briefingRes = await fetch('/api/morning-briefing', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                            });

                            if (briefingRes.ok) {
                                const briefingData = await briefingRes.json();
                                if (briefingData.success) {
                                    // 풍부한 아침 인사 메시지 생성
                                    let richGreeting = `좋은 아침이에요! ☀️\n\n`;

                                    // 날씨 정보
                                    if (briefingData.weather) {
                                        richGreeting += `**오늘의 날씨**: ${briefingData.weather.description}, ${briefingData.weather.temp}°C\n\n`;
                                    }

                                    // 오늘의 목표
                                    if (briefingData.todayGoal) {
                                        richGreeting += `🎯 **오늘의 목표**\n${briefingData.todayGoal.text}\n_${briefingData.todayGoal.motivation}_\n\n`;
                                    }

                                    // 추천 활동 5가지
                                    if (briefingData.suggestions && briefingData.suggestions.length > 0) {
                                        richGreeting += `📋 **오늘 추천 활동** (5개 달성시 성취도 100%!)\n`;
                                        briefingData.suggestions.forEach((s: any, i: number) => {
                                            richGreeting += `${i + 1}. ${s.icon} ${s.title} (${s.estimatedTime})\n`;
                                        });
                                        richGreeting += `\n`;
                                    }

                                    // 책 추천
                                    if (briefingData.bookRecommendation) {
                                        richGreeting += `📚 **오늘의 책**: "${briefingData.bookRecommendation.title}" - ${briefingData.bookRecommendation.author}\n`;
                                        richGreeting += `> "${briefingData.bookRecommendation.quote}"\n\n`;
                                    }

                                    // 노래 추천
                                    if (briefingData.songRecommendation) {
                                        richGreeting += `🎵 **오늘의 노래**: "${briefingData.songRecommendation.title}" - ${briefingData.songRecommendation.artist}\n\n`;
                                    }

                                    richGreeting += `오늘도 멋진 하루 보내세요! 💪`;

                                    const greetingMessage: Message = {
                                        id: `assistant-greeting-${Date.now()}`,
                                        role: 'assistant',
                                        content: richGreeting,
                                        timestamp: new Date(),
                                    };

                                    setMessages([greetingMessage]);
                                    localStorage.setItem(richGreetingKey, 'true');
                                    console.log('[Chat] Rich morning greeting sent successfully');
                                    return;
                                }
                            }
                        } catch (briefingError) {
                            console.error('[Chat] Morning briefing failed, using fallback:', briefingError);
                        }
                    }

                    // Fallback: 기본 인사 (아침 API 실패시 또는 아침이 아닐 때)
                    let greeting = '';
                    let callToAction = '';

                    if (hour >= 5 && hour < 12) {
                        // 아침 (5am - 12pm) - fallback
                        greeting = '좋은 아침이에요! ☀️';
                        callToAction = '\n\n오늘 하루를 어떻게 보내실 건가요? 일정을 추가하거나 오늘의 목표를 세워보세요!';
                    } else if (hour >= 12 && hour < 18) {
                        // 오후 (12pm - 6pm)
                        greeting = '좋은 오후에요! 🌤️';
                        callToAction = '\n\n오후 일정은 어떻게 되시나요? 남은 시간을 계획해볼까요?';
                    } else if (hour >= 18 && hour < 22) {
                        // 저녁 (6pm - 10pm)
                        greeting = '좋은 저녁이에요! 🌙';
                        callToAction = '\n\n오늘 하루 수고하셨어요. 내일 일정을 미리 계획해볼까요?';
                    } else {
                        // 심야 (10pm - 5am)
                        greeting = '아직 깨어 계시네요! 🌃';
                        callToAction = '\n\n늦은 시간이에요. 푹 쉬시고 내일 일정이 궁금하시면 말씀해주세요.';
                    }

                    // 오늘 일정 요약
                    let schedulesSummary = '';
                    if (todaySchedules.length > 0) {
                        const pendingSchedules = todaySchedules.filter((s: Schedule) => !s.completed && !s.skipped);
                        if (pendingSchedules.length > 0) {
                            schedulesSummary = `\n\n📋 **오늘 일정 (${pendingSchedules.length}개)**\n`;
                            pendingSchedules.slice(0, 3).forEach((s: Schedule) => {
                                schedulesSummary += `• ${s.startTime} - ${s.text}\n`;
                            });
                            if (pendingSchedules.length > 3) {
                                schedulesSummary += `...외 ${pendingSchedules.length - 3}개`;
                            }
                        }
                    } else if (hour >= 5 && hour < 18) {
                        schedulesSummary = '\n\n아직 오늘 일정이 없네요. "오후 3시에 회의 추가해줘" 처럼 말씀해주시면 바로 추가해드릴게요!';
                    }

                    const greetingMessage: Message = {
                        id: `assistant-greeting-${Date.now()}`,
                        role: 'assistant',
                        content: `${greeting}${schedulesSummary}${callToAction}`,
                        timestamp: new Date(),
                    };

                    setMessages([greetingMessage]);

                    // Mark basic greeting as sent (but rich greeting can still be sent later if user refreshes during morning)
                    localStorage.setItem(basicGreetingKey, 'true');
                    console.log('[Chat] Basic greeting sent (fallback)');
                } catch (error) {
                    console.error('[Chat] Failed to send greeting:', error);
                }
            };

            // Small delay to ensure everything is loaded
            const timer = setTimeout(sendGreeting, 1000);
            return () => clearTimeout(timer);
        }
    }, [messages.length, session, isLoading, todaySchedules, currentDate]);

    // Save messages to localStorage and DB whenever they change
    useEffect(() => {
        if (messages.length > 0) {
            // localStorage 저장 (빠른 접근용)
            localStorage.setItem(`chat_messages_${currentDate}`, JSON.stringify(messages));
            console.log('[Chat] Saved messages to localStorage:', messages.length);

            // DB 저장 (지속성 및 동기화)
            const saveToDb = async () => {
                try {
                    await fetch('/api/user/chat-history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            date: currentDate,
                            messages: messages.map(m => ({
                                ...m,
                                timestamp: m.timestamp.toISOString()
                            }))
                        })
                    });
                } catch (error) {
                    console.error('[Chat] Failed to save to DB:', error);
                }
            };

            // 디바운스: 마지막 메시지 이후 2초 뒤에 저장
            const timer = setTimeout(saveToDb, 2000);
            return () => clearTimeout(timer);
        }
    }, [messages, currentDate]);

    // Check if date changed (5am cutoff detection)
    useEffect(() => {
        const handleDateChange = () => {
            const today = getChatDate();
            if (today !== currentDate) {
                console.log('[Chat] Date changed (5am cutoff), starting new chat for:', today);
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
        };

        // 즉시 체크 (페이지 로드 시)
        handleDateChange();

        // 10초마다 체크 (자정/5am 감지용)
        const checkDate = setInterval(handleDateChange, 10000);

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
                    // IMPORTANT: Always use getChatDate() for fresh date calculation
                    // This ensures we always get today's date, not a stale currentDate state
                    const today = getChatDate();
                    // Calculate day of week from the date string to ensure consistency
                    const todayDateObj = new Date(today + 'T12:00:00'); // Use noon to avoid timezone issues
                    const currentDay = todayDateObj.getDay();

                    console.log('[Chat] Current date state:', currentDate, 'Fresh getChatDate():', today);

                    console.log('[Chat] Fetching schedules for date:', today, 'day:', currentDay);
                    console.log('[Chat] All custom goals count:', data.profile?.customGoals?.length);

                    // Include both specific date schedules AND recurring schedules for today - 중복 제거
                    const allGoals = data.profile?.customGoals || [];

                    // 특정 날짜 일정 (우선순위 높음)
                    const specificDateGoals = allGoals.filter((g: any) => g.specificDate === today);
                    console.log('[Chat] Specific date goals for', today, ':', specificDateGoals.map((g: any) => ({ text: g.text, specificDate: g.specificDate })));

                    // 반복 일정 (중복 제거) - specificDate가 있는 일정은 제외!
                    const recurringGoals = allGoals.filter((g: any) => {
                        // specificDate가 있으면 반복 일정이 아님 - 무조건 제외
                        if (g.specificDate) {
                            console.log('[Chat] Excluding goal with specificDate:', g.text, g.specificDate, '(not matching today:', today, ')');
                            return false;
                        }
                        if (!g.daysOfWeek?.includes(currentDay)) return false;
                        // 같은 이름 + 같은 시간의 특정 날짜 일정이 있으면 제외
                        const hasDuplicate = specificDateGoals.some((sg: any) =>
                            sg.text === g.text && sg.startTime === g.startTime
                        );
                        return !hasDuplicate;
                    });
                    console.log('[Chat] Recurring goals for day', currentDay, ':', recurringGoals.map((g: any) => ({ text: g.text, daysOfWeek: g.daysOfWeek })));

                    const todayGoals = [...specificDateGoals, ...recurringGoals];
                    console.log(`[Chat] Total ${todayGoals.length} goals for today (specific: ${specificDateGoals.length}, recurring: ${recurringGoals.length})`);

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
    }, [session, currentDate]);

    // Fetch today's trend briefings
    useEffect(() => {
        if (!session?.user?.email) return;

        const fetchTrends = async () => {
            try {
                // Fetch trend briefings
                const trendsResponse = await fetch('/api/trend-briefing/get');
                if (trendsResponse.ok) {
                    const trendsData = await trendsResponse.json();
                    if (trendsData.trends && trendsData.trends.length > 0) {
                        setTodayTrends(trendsData.trends);
                        console.log('[Chat] Loaded trends:', trendsData.trends.length);
                    }
                }

                // Fetch read trend IDs from user_events
                const today = getChatDate();
                const eventsResponse = await fetch(`/api/user/events?type=trend_briefing_read&startDate=${today}&endDate=${today}`);
                if (eventsResponse.ok) {
                    const eventsData = await eventsResponse.json();
                    const readIds = eventsData.events?.map((e: any) => e.metadata?.trend_id).filter(Boolean) || [];
                    setReadTrendIds(readIds);
                    console.log('[Chat] Read trend IDs:', readIds);
                }
            } catch (error) {
                console.error('[Chat] Failed to fetch trends:', error);
            }
        };

        fetchTrends();
    }, [session]);

    // Fetch learning tips when there's a learning schedule
    useEffect(() => {
        if (!session?.user?.email || todaySchedules.length === 0) return;

        const fetchLearningTips = async () => {
            // 학습 일정 찾기 (isLearning: true 또는 learningData가 있는 일정)
            const learningSchedule = todaySchedules.find(
                (s: any) => s.isLearning && s.learningData && !s.completed && !s.skipped
            );

            if (!learningSchedule || learningTips?.scheduleId === learningSchedule.id) {
                return;
            }

            const learningData = (learningSchedule as any).learningData;
            if (!learningData) return;

            setIsLoadingLearningTips(true);
            try {
                const res = await fetch('/api/ai-learning-tip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        learningData,
                        userLevel: 'intermediate',
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    setLearningTips({
                        ...data,
                        scheduleId: learningSchedule.id,
                    });
                    console.log('[Chat] Loaded learning tips for:', learningData.dayTitle);
                }
            } catch (error) {
                console.error('[Chat] Failed to fetch learning tips:', error);
            } finally {
                setIsLoadingLearningTips(false);
            }
        };

        fetchLearningTips();
    }, [session, todaySchedules, learningTips?.scheduleId]);

    // Auto-send schedule-based messages
    useEffect(() => {
        if (!session?.user || todaySchedules.length === 0) {
            console.log('[AutoMessage] Skipping - session or schedules missing:', { hasSession: !!session?.user, schedulesCount: todaySchedules.length });
            return;
        }

        const checkAndSendScheduleMessages = () => {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const today = getChatDate();

            console.log('[AutoMessage] Checking schedules:', {
                currentTime: `${now.getHours()}:${now.getMinutes()}`,
                currentMinutes,
                today,
                schedulesCount: todaySchedules.length
            });

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
                    console.log('[AutoMessage] ✅ Sending 10분 전 message for:', schedule.text);
                    localStorage.setItem(sentBeforeKey, 'true');

                    // AI 사전 알림 요청
                    fetch('/api/ai-resource-recommend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            activityName: schedule.text,
                            context: 'schedule_pre_reminder'
                        }),
                    }).then(res => res.json()).then(data => {
                        console.log('[AutoMessage] Received AI pre-reminder:', data);
                        const recommendation = data.recommendation || "곧 일정이 시작됩니다. 준비하실 것이 있나요?";
                        const message: Message = {
                            id: `auto-before-${Date.now()}`,
                            role: 'assistant',
                            content: `곧 "${schedule.text}" 일정이 ${schedule.startTime}에 시작됩니다.\n\n${recommendation}`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    }).catch(err => {
                        console.error('[AutoMessage] Failed to fetch AI pre-reminder:', err);
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

                    // Check if this is a sleep schedule (취침)
                    const isSleepSchedule = schedule.text.includes('취침') ||
                        schedule.text.toLowerCase().includes('sleep') ||
                        schedule.text.includes('잠') ||
                        schedule.text.includes('수면');

                    if (isSleepSchedule && !isSleepMode) {
                        // Check if user dismissed the prompt today
                        const dismissed = localStorage.getItem(`sleep_prompt_dismissed_${today}`);
                        if (!dismissed) {
                            setShowSleepPrompt(true);
                        }
                    }

                    // Check if this is a work/focus schedule (업무, 공부, 작업, 집중 등)
                    const isWorkSchedule = schedule.text.includes('업무') ||
                        schedule.text.includes('공부') ||
                        schedule.text.includes('작업') ||
                        schedule.text.includes('집중') ||
                        schedule.text.includes('일') ||
                        schedule.text.includes('미팅') ||
                        schedule.text.includes('회의') ||
                        schedule.text.toLowerCase().includes('work') ||
                        schedule.text.toLowerCase().includes('study') ||
                        schedule.text.toLowerCase().includes('focus') ||
                        schedule.text.toLowerCase().includes('meeting');

                    if (isWorkSchedule && !isFocusMode && !isSleepMode) {
                        // Check if user dismissed the focus prompt today
                        const dismissed = localStorage.getItem(`focus_prompt_dismissed_${today}`);
                        if (!dismissed) {
                            setShowFocusPrompt(true);
                        }
                    }

                    // 일정 특성에 맞는 시작 메시지 생성
                    const getScheduleStartMessage = (scheduleName: string) => {
                        const name = scheduleName.toLowerCase();

                        // 식사
                        if (/식사|점심|저녁|아침|밥|브런치|런치|디너|야식|간식/.test(name)) {
                            const mealEmojis: Record<string, string> = {
                                '아침': '🍳', '점심': '🍚', '저녁': '🍽️', '야식': '🌙', '브런치': '🥐', '간식': '🍪'
                            };
                            let emoji = '🍽️';
                            for (const [key, val] of Object.entries(mealEmojis)) {
                                if (name.includes(key)) { emoji = val; break; }
                            }
                            const msgs = ['맛있게 드세요!', '든든하게 드세요!', '맛있는 식사 되세요!'];
                            return { emoji, msg: msgs[Math.floor(Math.random() * msgs.length)], needsAI: false };
                        }

                        // 휴식/취침
                        if (/휴식|쉬는|낮잠|수면|취침|잠|기상|일어나/.test(name)) {
                            const restMsgs: Record<string, { emoji: string; msg: string }> = {
                                '취침': { emoji: '🌙', msg: '좋은 꿈 꾸세요!' },
                                '잠': { emoji: '😴', msg: '푹 주무세요!' },
                                '기상': { emoji: '☀️', msg: '상쾌한 아침 되세요!' },
                                '일어나': { emoji: '🌅', msg: '좋은 아침이에요!' },
                                '휴식': { emoji: '☕', msg: '편하게 쉬세요!' },
                                '낮잠': { emoji: '😌', msg: '달콤한 낮잠 되세요!' },
                            };
                            for (const [key, val] of Object.entries(restMsgs)) {
                                if (name.includes(key)) return { ...val, needsAI: false };
                            }
                            return { emoji: '☕', msg: '편하게 쉬세요!', needsAI: false };
                        }

                        // 여가
                        if (/게임|영화|드라마|유튜브|넷플릭스|독서|음악|산책/.test(name)) {
                            const leisureMsgs: Record<string, { emoji: string; msg: string }> = {
                                '게임': { emoji: '🎮', msg: '즐거운 시간 보내세요!' },
                                '영화': { emoji: '🎬', msg: '재미있게 보세요!' },
                                '드라마': { emoji: '📺', msg: '재미있게 보세요!' },
                                '유튜브': { emoji: '📱', msg: '즐거운 시청 되세요!' },
                                '넷플릭스': { emoji: '🍿', msg: '재미있게 보세요!' },
                                '독서': { emoji: '📚', msg: '즐거운 독서 시간 되세요!' },
                                '음악': { emoji: '🎵', msg: '좋은 음악과 함께하세요!' },
                                '산책': { emoji: '🚶', msg: '상쾌한 산책 되세요!' },
                            };
                            for (const [key, val] of Object.entries(leisureMsgs)) {
                                if (name.includes(key)) return { ...val, needsAI: false };
                            }
                            return { emoji: '🎉', msg: '즐거운 시간 보내세요!', needsAI: false };
                        }

                        // 운동
                        if (/운동|헬스|요가|필라테스|러닝|조깅|수영|등산/.test(name)) {
                            return { emoji: '💪', msg: '오늘도 화이팅!', needsAI: false };
                        }

                        // 업무/회의/공부 - AI 추천 사용
                        if (/업무|출근|회의|미팅|프레젠테이션|발표|면접/.test(name)) {
                            return { emoji: '💼', msg: '', needsAI: true };
                        }

                        if (/공부|학습|강의|수업|시험|과제/.test(name)) {
                            return { emoji: '📖', msg: '', needsAI: true };
                        }

                        // 기본
                        return { emoji: '🕐', msg: '화이팅!', needsAI: false };
                    };

                    const { emoji, msg, needsAI } = getScheduleStartMessage(schedule.text);

                    if (needsAI) {
                        // 업무/공부 일정만 AI 리소스 추천 요청
                        fetch('/api/ai-resource-recommend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                activityName: schedule.text,
                                context: 'schedule_start'
                            }),
                        }).then(res => res.json()).then(data => {
                            console.log('[AutoMessage] Received AI resource:', data);
                            const recommendation = data.recommendation || "화이팅!";
                            const message: Message = {
                                id: `auto-start-${Date.now()}`,
                                role: 'assistant',
                                content: `"${schedule.text}" 시간이에요 ${emoji}\n\n${recommendation}`,
                                timestamp: new Date(),
                            };
                            setMessages(prev => [...prev, message]);
                        }).catch(err => {
                            console.error('[AutoMessage] Failed to fetch AI resource:', err);
                            // 실패 시 기본 메시지
                            const message: Message = {
                                id: `auto-start-${Date.now()}`,
                                role: 'assistant',
                                content: `"${schedule.text}" 시간이에요 ${emoji}\n\n화이팅!`,
                                timestamp: new Date(),
                            };
                            setMessages(prev => [...prev, message]);
                        });
                    } else {
                        // 간단한 메시지 바로 표시
                        const message: Message = {
                            id: `auto-start-${Date.now()}`,
                            role: 'assistant',
                            content: `"${schedule.text}" 시간이에요 ${emoji}\n\n${msg}`,
                            timestamp: new Date(),
                        };
                        setMessages(prev => [...prev, message]);
                    }
                }

                // 3. 업무/공부 시작 30분 후 체크인 메시지
                const isWorkOrStudySchedule = schedule.text.includes('업무') ||
                    schedule.text.includes('공부') ||
                    schedule.text.includes('작업') ||
                    schedule.text.includes('집중') ||
                    schedule.text.includes('미팅') ||
                    schedule.text.includes('회의') ||
                    schedule.text.toLowerCase().includes('work') ||
                    schedule.text.toLowerCase().includes('study') ||
                    schedule.text.toLowerCase().includes('focus') ||
                    schedule.text.toLowerCase().includes('meeting');

                if (isWorkOrStudySchedule) {
                    const checkInMinutes = startMinutes + 30; // 시작 30분 후
                    const sentCheckInKey = `schedule_checkin_${schedule.id}_${today}`;
                    const alreadySentCheckIn = !!localStorage.getItem(sentCheckInKey);

                    // 30분 후 ~ 35분 후 사이에 체크인 (일정이 아직 진행 중일 때만)
                    if (currentMinutes >= checkInMinutes && currentMinutes < checkInMinutes + 5 && !alreadySentCheckIn && currentMinutes < endMinutes) {
                        console.log('[AutoMessage] ✅ Sending 30분 체크인 for:', schedule.text);
                        localStorage.setItem(sentCheckInKey, 'true');

                        // AI에게 진행 중 체크인 메시지 요청
                        fetch('/api/ai-resource-recommend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                activityName: schedule.text,
                                context: 'in_progress'
                            }),
                        }).then(res => res.json()).then(data => {
                            console.log('[AutoMessage] Received AI check-in:', data);
                            const checkInMessage = data.recommendation || `${schedule.text} 30분째 진행 중이시네요! 잘 되어가고 있나요? 필요한 자료가 있으면 말씀해주세요 💪`;
                            const message: Message = {
                                id: `auto-checkin-${Date.now()}`,
                                role: 'assistant',
                                content: checkInMessage,
                                timestamp: new Date(),
                            };
                            setMessages(prev => [...prev, message]);
                        }).catch(err => {
                            console.error('[AutoMessage] Failed to fetch AI check-in:', err);
                            // Fallback
                            const message: Message = {
                                id: `auto-checkin-${Date.now()}`,
                                role: 'assistant',
                                content: `${schedule.text} 30분째 진행 중이시네요! 잘 되어가고 있나요? 필요한 자료가 있으면 말씀해주세요 💪`,
                                timestamp: new Date(),
                            };
                            setMessages(prev => [...prev, message]);
                        });
                    }
                }

                // 4. 일정 종료 후 메시지
                const sentAfterKey = `schedule_after_${schedule.id}_${today}`;
                if (currentMinutes >= endMinutes && currentMinutes < endMinutes + 10 && !localStorage.getItem(sentAfterKey)) {
                    localStorage.setItem(sentAfterKey, 'true');

                    // AI에게 일정 종료 후 맞춤형 피드백 요청
                    fetch('/api/ai-resource-recommend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            activityName: schedule.text,
                            context: 'schedule_completed'
                        }),
                    }).then(res => res.json()).then(data => {
                        console.log('[AutoMessage] Received AI completion feedback:', data);
                        const feedback = data.recommendation || `"${schedule.text}" 일정이 끝났습니다.\n\n어떠셨나요?`;
                        const message: Message = {
                            id: `auto-after-${Date.now()}`,
                            role: 'assistant',
                            content: feedback,
                            timestamp: new Date(),
                        };
                        setMessages(prev => [...prev, message]);
                    }).catch(err => {
                        console.error('[AutoMessage] Failed to fetch AI completion feedback:', err);
                        // Fallback
                        const message: Message = {
                            id: `auto-after-${Date.now()}`,
                            role: 'assistant',
                            content: `"${schedule.text}" 일정이 끝났습니다.\n\n어떠셨나요?`,
                            timestamp: new Date(),
                        };
                        setMessages(prev => [...prev, message]);
                    });
                }
            });

            // 4. 빈 시간 감지 (다음 일정까지 30분 이상 남았을 때) - 유튜브 영상 추천
            const nextSchedule = todaySchedules
                .filter(s => !s.completed && !s.skipped)
                .find(s => timeToMinutes(s.startTime) > currentMinutes);

            // 현재 진행 중인 일정이 있는지 확인
            const currentlyInProgress = todaySchedules.some(s => {
                const start = timeToMinutes(s.startTime);
                const end = s.endTime ? timeToMinutes(s.endTime) : start + 60;
                return currentMinutes >= start && currentMinutes < end && !s.completed && !s.skipped;
            });

            if (nextSchedule && !currentlyInProgress) {
                const timeUntilNext = timeToMinutes(nextSchedule.startTime) - currentMinutes;
                const sentGapKey = `schedule_gap_${nextSchedule.id}_${today}`;

                if (timeUntilNext >= 20 && timeUntilNext <= 30 && !localStorage.getItem(sentGapKey)) {
                    localStorage.setItem(sentGapKey, 'true');

                    // 유튜브 추천 영상 가져오기
                    fetch('/api/recommendations/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                    }).then(res => res.json()).then(data => {
                        const videos = data.recommendations || [];
                        let videoRecommendation = '';

                        if (videos.length > 0) {
                            const video = videos[0]; // 첫 번째 추천 영상
                            videoRecommendation = `\n\n📺 **추천 영상**\n[${video.title}](https://youtube.com/watch?v=${video.id})\n${video.channel} · ${video.duration}`;
                        }

                        const message: Message = {
                            id: `auto-gap-${Date.now()}`,
                            role: 'assistant',
                            content: `다음 일정 "${nextSchedule.text}"까지 ${timeUntilNext}분 남았어요.\n\n이 시간에 할 수 있는 것:\n• 메일 확인 및 처리\n• 트렌드 브리핑 읽기\n• 짧은 학습 영상 보기${videoRecommendation}\n\n무엇을 하시겠어요?`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    }).catch(err => {
                        console.error('[AutoMessage] Failed to fetch YouTube recommendations:', err);
                        // Fallback without video
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

            // 5. 일정이 전혀 없을 때 (또는 모든 일정 완료 후) 여유 시간 추천
            const hasNoUpcomingSchedules = !todaySchedules.some(s => {
                const start = timeToMinutes(s.startTime);
                return start > currentMinutes && !s.completed && !s.skipped;
            });

            const allCompleted = todaySchedules.length > 0 && todaySchedules.every(s => s.completed || s.skipped);
            const sentFreeTimeKey = `free_time_recommendation_${today}_${Math.floor(currentMinutes / 60)}`; // 매 시간마다 한 번씩

            if ((hasNoUpcomingSchedules || allCompleted) && !currentlyInProgress && !localStorage.getItem(sentFreeTimeKey)) {
                // 오전 9시 ~ 오후 10시 사이에만 추천
                const currentHour = Math.floor(currentMinutes / 60);
                if (currentHour >= 9 && currentHour <= 22) {
                    localStorage.setItem(sentFreeTimeKey, 'true');

                    // 유튜브 추천 영상 가져오기
                    fetch('/api/recommendations/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                    }).then(res => res.json()).then(data => {
                        const videos = data.recommendations || [];

                        if (videos.length > 0) {
                            const video = videos[0];
                            const message: Message = {
                                id: `auto-freetime-${Date.now()}`,
                                role: 'assistant',
                                content: `지금 여유 시간이신 것 같아요! 📺\n\n당신을 위한 추천 영상이에요:\n\n**${video.title}**\n${video.channel} · ${video.duration}\n\n👉 [영상 보기](https://youtube.com/watch?v=${video.id})\n\n다른 추천이 필요하시면 말씀해주세요!`,
                                timestamp: now,
                            };
                            setMessages(prev => [...prev, message]);
                        }
                    }).catch(err => {
                        console.error('[AutoMessage] Failed to fetch free time recommendations:', err);
                    });
                }
            }

            // 6. 하루 마무리 (마지막 일정 종료 후)
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

                    const message: Message = {
                        id: `auto-dayend-${Date.now()}`,
                        role: 'assistant',
                        content: `오늘 일정이 모두 끝났어요! 🎉\n\n오늘의 성과:\n✅ 완료: ${completed}/${total}개\n\n내일을 위한 제안이 필요하신가요?`,
                        timestamp: now,
                    };
                    setMessages(prev => [...prev, message]);
                }
            }

            // 7. 4시간마다 뉴스 알림 (9시, 13시, 17시, 21시)
            const currentHour = Math.floor(currentMinutes / 60);
            const newsAlertHours = [9, 13, 17, 21]; // 4시간 간격

            if (newsAlertHours.includes(currentHour)) {
                const newsAlertKey = `news_alert_${today}_${currentHour}`;

                if (!localStorage.getItem(newsAlertKey)) {
                    // 해당 시간대의 처음 5분 동안만 알림 (예: 9:00~9:04)
                    const minutesInHour = currentMinutes % 60;

                    if (minutesInHour < 5) {
                        localStorage.setItem(newsAlertKey, 'true');

                        // AI 뉴스 알림 API 호출
                        fetch('/api/ai-news-alert', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                        }).then(res => res.json()).then(data => {
                            if (data.hasNews) {
                                const message: Message = {
                                    id: `auto-news-${Date.now()}`,
                                    role: 'assistant',
                                    content: `📰 **${data.headline}**\n\n${data.content}\n\n_출처: ${data.source}_\n\n💡 ${data.relevance}`,
                                    timestamp: now,
                                };
                                setMessages(prev => [...prev, message]);
                                console.log('[AutoMessage] ✅ News alert sent:', data.headline);
                            } else {
                                console.log('[AutoMessage] No relevant news found at this time');
                            }
                        }).catch(err => {
                            console.error('[AutoMessage] Failed to fetch news alert:', err);
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
    }, [session, todaySchedules]);

    // Auto-send unread trend briefing reminder
    useEffect(() => {
        if (!session?.user || todayTrends.length === 0) return;

        const checkAndSendTrendReminder = () => {
            const today = getChatDate();
            const sentTrendReminderKey = `trend_reminder_${today}`;

            // 이미 알림을 보냈으면 스킵
            if (localStorage.getItem(sentTrendReminderKey)) return;

            // 읽지 않은 브리핑 찾기
            const unreadTrends = todayTrends.filter(trend => !readTrendIds.includes(trend.id));

            if (unreadTrends.length > 0) {
                localStorage.setItem(sentTrendReminderKey, 'true');

                const trendList = unreadTrends.slice(0, 3).map((trend, idx) =>
                    `${idx + 1}. ${trend.title} (${trend.category})`
                ).join('\n');

                const message: Message = {
                    id: `auto-trend-${Date.now()}`,
                    role: 'assistant',
                    content: `📰 오늘의 트렌드 브리핑이 도착했어요!\n\n아직 읽지 않으신 ${unreadTrends.length}개의 브리핑이 있습니다:\n\n${trendList}\n\n대시보드나 인사이트 페이지에서 확인해보세요!`,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, message]);
            }
        };

        // 1분 후에 체크 (페이지 로드 직후 바로 보내지 않도록)
        const timeout = setTimeout(checkAndSendTrendReminder, 60000);

        return () => clearTimeout(timeout);
    }, [session, todayTrends, readTrendIds]);

    // 목표 관련 동기부여 메시지 (하루 2번: 오전 10시, 오후 3시)
    useEffect(() => {
        if (!session?.user) return;

        const checkAndSendGoalReminder = async () => {
            const now = new Date();
            const currentHour = now.getHours();
            const today = getChatDate();

            // 오전 10시 또는 오후 3시에만 알림
            const reminderHours = [10, 15];
            if (!reminderHours.includes(currentHour)) return;

            const goalReminderKey = `goal_reminder_${today}_${currentHour}`;
            if (localStorage.getItem(goalReminderKey)) return;

            // 시간대 처음 5분에만 알림
            const currentMinutes = now.getMinutes();
            if (currentMinutes >= 5) return;

            try {
                const res = await fetch('/api/user/long-term-goals');
                if (!res.ok) return;

                const data = await res.json();
                const goals = data.goals;

                // 활성 목표 찾기
                const activeGoals = [
                    ...((goals.weekly || []).filter((g: any) => !g.completed)),
                    ...((goals.monthly || []).filter((g: any) => !g.completed)),
                    ...((goals.yearly || []).filter((g: any) => !g.completed)),
                ];

                if (activeGoals.length === 0) return;

                localStorage.setItem(goalReminderKey, 'true');

                // 랜덤하게 하나 선택
                const randomGoal = activeGoals[Math.floor(Math.random() * activeGoals.length)];
                const goalType = randomGoal.type === 'weekly' ? '주간' : randomGoal.type === 'monthly' ? '월간' : '연간';

                // 진행률에 따른 메시지 생성
                let motivationalMessage = '';
                if (randomGoal.progress === 0) {
                    motivationalMessage = `아직 시작하지 않으셨네요! 오늘 작은 첫 걸음을 내딛어보는 건 어떨까요?`;
                } else if (randomGoal.progress < 30) {
                    motivationalMessage = `시작이 반이에요! 조금씩 진행하고 계시네요. 오늘도 한 발짝 나아가볼까요?`;
                } else if (randomGoal.progress < 70) {
                    motivationalMessage = `절반 이상 달성하셨어요! 이대로만 하시면 곧 목표를 이루실 수 있어요 💪`;
                } else {
                    motivationalMessage = `거의 다 왔어요! 조금만 더 힘내시면 목표 달성이에요! 🎉`;
                }

                const message: Message = {
                    id: `auto-goal-${Date.now()}`,
                    role: 'assistant',
                    content: `🎯 **${goalType} 목표 리마인더**\n\n"${randomGoal.title}"\n\n📊 현재 진행률: ${randomGoal.progress}%\n\n${motivationalMessage}\n\n목표 달성을 위해 도움이 필요하시면 언제든 말씀해주세요!`,
                    timestamp: now,
                };
                setMessages(prev => [...prev, message]);
                console.log('[AutoMessage] ✅ Goal reminder sent:', randomGoal.title);
            } catch (error) {
                console.error('[AutoMessage] Failed to fetch goals for reminder:', error);
            }
        };

        // 1분마다 체크
        const interval = setInterval(checkAndSendGoalReminder, 60000);
        // 초기 실행
        checkAndSendGoalReminder();

        return () => clearInterval(interval);
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

            // 읽지 않은 트렌드 브리핑 정보 준비
            const unreadTrends = todayTrends.filter(trend => !readTrendIds.includes(trend.id));
            const trendBriefingInfo = unreadTrends.length > 0 ? {
                total: todayTrends.length,
                unread: unreadTrends.length,
                unreadTitles: unreadTrends.map(t => ({ title: t.title, category: t.category }))
            } : null;

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
                        schedules: todaySchedules,
                        trendBriefings: trendBriefingInfo
                    }
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error('[Chat] API error response:', errorData);
                throw new Error(errorData.message || errorData.error || `API 오류 (${res.status})`);
            }

            const data = await res.json();
            console.log('[Chat] API response:', data);

            if (data.error) {
                throw new Error(data.message || data.error);
            }

            let finalMessage = data.message;

            // Process AI actions (add_schedule, web_search, etc.)
            if (data.actions && Array.isArray(data.actions)) {
                for (const action of data.actions) {
                    if (action.type === 'add_schedule' && action.data) {
                        console.log('[Chat] Processing add_schedule action:', action.data);
                        try {
                            // Add the schedule
                            const scheduleRes = await fetch("/api/user/schedule/add", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    text: action.data.text,
                                    startTime: action.data.startTime,
                                    endTime: action.data.endTime,
                                    specificDate: action.data.specificDate,
                                    daysOfWeek: action.data.daysOfWeek,
                                    color: action.data.color || 'primary',
                                    location: action.data.location || '',
                                    memo: action.data.memo || '',
                                }),
                            });

                            if (scheduleRes.ok) {
                                console.log('[Chat] Schedule added successfully');
                                // Dispatch event for other components
                                window.dispatchEvent(new CustomEvent('schedule-added'));

                                // Add follow-up question for productive activities (like a real assistant)
                                const activityText = action.data.text.toLowerCase();
                                const productiveActivities = ['업무', '공부', '학습', '회의', '프로젝트', '과제', '발표', '준비'];
                                const isProductiveActivity = productiveActivities.some(
                                    activity => activityText.includes(activity)
                                );

                                if (isProductiveActivity) {
                                    finalMessage += `\n\n이 일정을 위해 준비할 자료나 필요한 것이 있으시면 말씀해주세요! 📋`;
                                }

                                // Refresh schedules
                                const refreshRes = await fetch('/api/user/profile');
                                if (refreshRes.ok) {
                                    const refreshData = await refreshRes.json();
                                    const today = getChatDate();
                                    const currentDay = new Date().getDay();
                                    const allGoals = refreshData.profile?.customGoals || [];

                                    // 중복 제거: 특정 날짜 일정 우선
                                    const specificDateGoals = allGoals.filter((g: any) => g.specificDate === today);
                                    const recurringGoals = allGoals.filter((g: any) => {
                                        if (g.specificDate) return false;
                                        if (!g.daysOfWeek?.includes(currentDay)) return false;
                                        const hasDuplicate = specificDateGoals.some((sg: any) =>
                                            sg.text === g.text && sg.startTime === g.startTime
                                        );
                                        return !hasDuplicate;
                                    });
                                    const todayGoals = [...specificDateGoals, ...recurringGoals];

                                    // Load completion status
                                    const completions = JSON.parse(localStorage.getItem(`schedule_completions_${today}`) || '{}');
                                    const schedulesWithStatus = todayGoals.map((g: any) => ({
                                        ...g,
                                        completed: completions[g.id]?.completed || false,
                                        skipped: completions[g.id]?.skipped || false
                                    }));

                                    setTodaySchedules(schedulesWithStatus.sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')));
                                    console.log('[Chat] Schedules refreshed:', schedulesWithStatus.length);
                                }
                            } else {
                                console.error('[Chat] Failed to add schedule:', await scheduleRes.text());
                            }
                        } catch (scheduleError) {
                            console.error('[Chat] Error adding schedule:', scheduleError);
                        }
                    } else if (action.type === 'web_search' && action.data) {
                        // Handle web search using Gemini
                        console.log('[Chat] Processing web_search action:', action.data);
                        try {
                            const searchRes = await fetch("/api/ai-web-search", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    query: action.data.query,
                                    activity: action.data.activity,
                                    context: 'schedule_material',
                                }),
                            });

                            if (searchRes.ok) {
                                const searchData = await searchRes.json();
                                console.log('[Chat] Web search result:', searchData);
                                if (searchData.result) {
                                    finalMessage += `\n\n🔍 **검색 결과:**\n${searchData.result}`;
                                }
                            } else {
                                console.error('[Chat] Web search failed:', await searchRes.text());
                                finalMessage += `\n\n검색 중 문제가 발생했습니다. 다시 시도해주세요.`;
                            }
                        } catch (searchError) {
                            console.error('[Chat] Error in web search:', searchError);
                            finalMessage += `\n\n검색 중 오류가 발생했습니다.`;
                        }
                    }
                }
            }

            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: finalMessage,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // After response, go back to idle
            setTimeout(() => {
                setAppState("idle");
                // Do NOT show recommendations automatically - user must click button
            }, 1000);

        } catch (error: any) {
            console.error("Chat error:", error);
            const errorMessage = error?.message || "알 수 없는 오류";
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: `죄송합니다. 응답을 가져오는데 실패했습니다. (${errorMessage})\n\n다시 시도해주세요.`,
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
                    const currentDay = new Date().getDay();
                    const allGoals = data.customGoals || [];

                    // 중복 제거: 특정 날짜 일정 우선
                    const specificDateGoals = allGoals.filter((g: any) => g.specificDate === today);
                    const recurringGoals = allGoals.filter((g: any) => {
                        if (g.specificDate) return false;
                        if (!g.daysOfWeek?.includes(currentDay)) return false;
                        const hasDuplicate = specificDateGoals.some((sg: any) =>
                            sg.text === g.text && sg.startTime === g.startTime
                        );
                        return !hasDuplicate;
                    });
                    const todayGoals = [...specificDateGoals, ...recurringGoals];

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
                                        {currentScheduleInfo.schedule.location && (
                                            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                                <MapPin className="w-3.5 h-3.5" />
                                                <span>{currentScheduleInfo.schedule.location}</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                                        <FieriLogo className="w-8 h-8" />
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
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
                                <FieriLogo className="w-10 h-10" />
                            </div>
                            <p className="text-sm font-medium mb-1">AI 비서와 대화해보세요</p>
                            <p className="text-xs text-muted-foreground">
                                일정, 학습, 목표에 대해 무엇이든 물어보세요
                            </p>
                        </div>
                    )}

                    {/* Learning Tips Card - 학습 일정이 있을 때 표시 */}
                    <AnimatePresence>
                        {learningTips && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="relative bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-2xl p-5 border border-blue-200/50 dark:border-blue-800/30 mb-4"
                            >
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-xl">📚</span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-1">오늘의 학습 꿀팁</h3>
                                        <p className="text-sm text-blue-700 dark:text-blue-300">{learningTips.greeting}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {learningTips.tips.map((tip, index) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="flex items-start gap-3 bg-white/60 dark:bg-white/5 rounded-xl p-3"
                                        >
                                            <span className="text-lg flex-shrink-0">{tip.emoji}</span>
                                            <div>
                                                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{tip.title}</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{tip.content}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-3 border-t border-blue-200/30 dark:border-blue-800/30">
                                    <p className="text-xs text-center text-blue-600 dark:text-blue-400 font-medium">
                                        {learningTips.encouragement}
                                    </p>
                                </div>

                                <button
                                    onClick={() => setLearningTips(null)}
                                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                >
                                    <CloseIcon className="w-4 h-4" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Loading Learning Tips */}
                    {isLoadingLearningTips && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-5 border border-blue-200/50 dark:border-blue-800/30 mb-4 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                            <span className="text-sm text-blue-600 dark:text-blue-400">학습 팁을 준비하고 있어요...</span>
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
                    {appState === "idle" && recommendations.length > 0 && !showRecommendations && messages.length > 0 && (
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
                    {appState === "idle" && recommendations.length > 0 && (showRecommendations || messages.length === 0) && (
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
                                {showRecommendations && messages.length > 0 && (
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
