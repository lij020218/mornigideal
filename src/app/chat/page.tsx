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

                    // AI 리소스 추천 요청
                    fetch('/api/ai-resource-recommend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            activityName: schedule.text,
                            context: 'schedule_start'
                        }),
                    }).then(res => res.json()).then(data => {
                        console.log('[AutoMessage] Received AI resource:', data);
                        const recommendation = data.recommendation || "활기차게 시작해볼까요? 화이팅!";
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

                    const message: Message = {
                        id: `auto-after-${Date.now()}`,
                        role: 'assistant',
                        content: `"${schedule.text}" 일정이 끝났습니다.\n\n어떠셨나요?\n• 간단히 기록하실 내용이 있나요?\n• 다음 액션 아이템을 정리해드릴까요?\n• 추가 일정이 필요하신가요?`,
                        timestamp: now,
                    };
                    setMessages(prev => [...prev, message]);
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

                    const message: Message = {
                        id: `auto-gap-${Date.now()}`,
                        role: 'assistant',
                        content: `다음 일정 "${nextSchedule.text}"까지 ${timeUntilNext}분 남았어요.\n\n이 시간에 할 수 있는 것:\n• 메일 확인 및 처리\n• 트렌드 브리핑 읽기\n• 짧은 학습 세션\n\n무엇을 하시겠어요?`,
                        timestamp: now,
                    };
                    setMessages(prev => [...prev, message]);
                }
            }

            // 5. 하루 마무리 (마지막 일정 종료 후)
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
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
                                <FieriLogo className="w-10 h-10" />
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
