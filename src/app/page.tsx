"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Send, Sparkles, CheckCircle2, Plus, Loader2, X, Moon, MapPin, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeColor, getIconBg, getCardBg, getCardBorder, getCardShadow, getBadgeStyle, getInProgressCardStyle, getUpcomingCardStyle, getIconStyle } from "@/lib/scheduleColors";
import { timeToMinutes, getChatDate, getDateFromTimestamp, getCurrentScheduleInfo } from "@/lib/scheduleUtils";
import { getScheduleIcon, getScheduleMessage } from "@/lib/scheduleIcons";
import { useUserLocation } from "@/hooks/useUserLocation";
import { usePlaceholderRotation } from "@/hooks/usePlaceholderRotation";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAutoMessages } from "@/hooks/useAutoMessages";
import type { Schedule, ChatAction, Message, RecommendationCard, AppState } from "@/types/dashboard";

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
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TrendBriefingDetail } from "@/components/features/dashboard/TrendBriefingDetail";
import { markScheduleCompletion } from "@/lib/scheduleNotifications";
import { useFocusSleepMode } from "@/contexts/FocusSleepModeContext";
import { SlideViewer } from "@/components/features/learning/SlideViewer";
import { FieriInterventionsContainer } from "@/components/features/fieri/FieriInterventionsContainer";

// Types imported from @/types/dashboard

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
    const { isSleepMode, startSleepMode } = useFocusSleepMode();

    // Redirect if not authenticated
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/landing");
        }
    }, [status, router]);

    // State
    const [appState, setAppState] = useState<AppState>("idle");
    const [scheduleExpanded, setScheduleExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
    const [selectedBriefing, setSelectedBriefing] = useState<any>(null);
    const [showRecommendations, setShowRecommendations] = useState(() => {
        // Check localStorage on initial load (client-side only)
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('showRecommendations');
            return saved === null ? true : saved === 'true';
        }
        return true;
    });
    // 슬라이드 뷰어 상태
    const [slideViewerData, setSlideViewerData] = useState<{
        isOpen: boolean;
        curriculumId: string;
        dayNumber: number;
        dayTitle: string;
        dayDescription: string;
        objectives: string[];
        topic: string;
        currentLevel: string;
        targetLevel: string;
        scheduleId?: string;
        linkedGoalId?: string;
        linkedGoalType?: "weekly" | "monthly" | "yearly";
    } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isFetchingRecommendations = useRef(false);
    const hasFetchedRecommendations = useRef(false);

    // Custom hooks
    const userLocation = useUserLocation();
    const placeholder = usePlaceholderRotation(PLACEHOLDER_ROTATION, 4000);
    const {
        todaySchedules, setTodaySchedules,
        userProfile, setUserProfile,
        trendBriefings, setTrendBriefings,
        streakData,
        refreshSchedules,
    } = useDashboardData(session);
    useAutoMessages({
        session, todaySchedules, userProfile, trendBriefings,
        userLocation, setMessages, messages,
    });

    // Load messages from server on mount
    useEffect(() => {
        if (!session?.user?.email) return;

        const loadMessages = async () => {
            const today = getChatDate();
            try {
                // 서버에서 채팅 기록 불러오기
                const res = await fetch(`/api/user/chat-history?date=${today}`);
                let allMessages: any[] = [];

                if (res.ok) {
                    const data = await res.json();
                    if (data.chat?.messages && data.chat.messages.length > 0) {
                        allMessages = data.chat.messages.map((m: any) => ({
                            ...m,
                            timestamp: new Date(m.timestamp)
                        }));
                    }
                }

                // 서버에 없으면 localStorage fallback
                if (allMessages.length === 0) {
                    const savedMessages = localStorage.getItem(`chat_messages_${today}`);
                    if (savedMessages) {
                        const parsed = JSON.parse(savedMessages);
                        allMessages = parsed.map((m: any) => ({
                            ...m,
                            timestamp: new Date(m.timestamp)
                        }));
                    }
                }

                if (allMessages.length === 0) {
                    console.log('[Home] No messages found');
                    return;
                }

                // Separate messages by their actual date (based on timestamp)
                const messagesByDate: Record<string, any[]> = {};
                allMessages.forEach(msg => {
                    const msgDate = getDateFromTimestamp(msg.timestamp);
                    if (!messagesByDate[msgDate]) {
                        messagesByDate[msgDate] = [];
                    }
                    messagesByDate[msgDate].push(msg);
                });

                const dates = Object.keys(messagesByDate).sort();
                console.log('[Home] Messages grouped by date:', dates);

                // If there are messages from previous dates, save them separately
                const previousDates = dates.filter(d => d < today);
                if (previousDates.length > 0) {
                    console.log('[Home] Found messages from previous dates:', previousDates);

                    for (const prevDate of previousDates) {
                        const prevMessages = messagesByDate[prevDate];
                        console.log(`[Home] Saving ${prevMessages.length} messages to ${prevDate}`);

                        try {
                            await fetch('/api/user/chat-history', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    date: prevDate,
                                    messages: prevMessages.map(m => ({
                                        ...m,
                                        timestamp: m.timestamp.toISOString()
                                    }))
                                })
                            });
                            // Also save to localStorage
                            localStorage.setItem(`chat_messages_${prevDate}`, JSON.stringify(prevMessages));
                        } catch (error) {
                            console.error(`[Home] Failed to save messages for ${prevDate}:`, error);
                            localStorage.setItem(`chat_messages_${prevDate}`, JSON.stringify(prevMessages));
                        }
                    }

                    // Notify sidebar to refresh chat history
                    window.dispatchEvent(new CustomEvent('chat-date-changed', {
                        detail: { oldDate: previousDates[0], newDate: today }
                    }));
                }

                // Only load today's messages into the chat
                const todayMessages = messagesByDate[today] || [];
                setMessages(todayMessages);
                console.log('[Home] Loaded today messages:', todayMessages.length);

                // If we separated messages, save only today's messages back
                if (previousDates.length > 0) {
                    try {
                        await fetch('/api/user/chat-history', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: today,
                                messages: todayMessages.map(m => ({
                                    ...m,
                                    timestamp: m.timestamp.toISOString()
                                }))
                            })
                        });
                        localStorage.setItem(`chat_messages_${today}`, JSON.stringify(todayMessages));
                    } catch (error) {
                        console.error('[Home] Failed to save today messages:', error);
                    }
                }

            } catch (error) {
                console.error('[Home] Failed to load messages:', error);
            }
        };

        loadMessages();
    }, [session]);

    // Save messages to server whenever they change
    useEffect(() => {
        if (!session?.user?.email || messages.length === 0) return;

        const saveMessages = async () => {
            const today = getChatDate();
            try {
                // 서버에 채팅 기록 저장
                await fetch('/api/user/chat-history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: today,
                        messages: messages.map(m => ({
                            ...m,
                            timestamp: m.timestamp.toISOString()
                        }))
                    })
                });
                console.log('[Home] Saved messages to server:', messages.length);

                // localStorage도 백업으로 저장
                localStorage.setItem(`chat_messages_${today}`, JSON.stringify(messages));
            } catch (error) {
                console.error('[Home] Failed to save messages to server:', error);
                // 서버 실패시 localStorage에라도 저장
                localStorage.setItem(`chat_messages_${today}`, JSON.stringify(messages));
            }
        };

        // Debounce: 500ms 후에 저장 (빠른 연속 저장 방지)
        const timeoutId = setTimeout(saveMessages, 500);
        return () => clearTimeout(timeoutId);
    }, [messages, session]);

    // Track current chat date for date change detection
    const currentChatDateRef = useRef<string>(getChatDate());

    // Detect date change and create new chat room
    useEffect(() => {
        if (!session?.user?.email) return;

        const checkDateChange = () => {
            const newDate = getChatDate();
            const oldDate = currentChatDateRef.current;

            if (newDate !== oldDate && messages.length > 0) {
                console.log('[Home] Date changed from', oldDate, 'to', newDate);

                // Save the previous date's messages before switching
                const saveOldMessages = async () => {
                    try {
                        await fetch('/api/user/chat-history', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: oldDate,
                                messages: messages.map(m => ({
                                    ...m,
                                    timestamp: m.timestamp.toISOString()
                                }))
                            })
                        });
                        console.log('[Home] Saved previous date messages:', oldDate);

                        // Also save to localStorage as backup
                        localStorage.setItem(`chat_messages_${oldDate}`, JSON.stringify(messages));
                    } catch (error) {
                        console.error('[Home] Failed to save previous messages:', error);
                        // At least save to localStorage
                        localStorage.setItem(`chat_messages_${oldDate}`, JSON.stringify(messages));
                    }
                };

                saveOldMessages().then(() => {
                    // Update current date reference
                    currentChatDateRef.current = newDate;

                    // Clear messages for new chat room
                    setMessages([]);

                    // Dispatch event to update sidebar chat history
                    window.dispatchEvent(new CustomEvent('chat-date-changed', {
                        detail: { oldDate, newDate }
                    }));

                    console.log('[Home] Started new chat room for:', newDate);
                });
            } else if (newDate !== oldDate) {
                // Date changed but no messages to save
                currentChatDateRef.current = newDate;
            }
        };

        // Check every minute for date change
        const interval = setInterval(checkDateChange, 60000);

        // Also check on visibility change (when user returns to tab)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkDateChange();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [session, messages]);

    // Handle load-chat-date event from sidebar (start new chat or load old chat)
    useEffect(() => {
        if (!session?.user?.email) return;

        const handleLoadChatDate = async (event: CustomEvent) => {
            const { date } = event.detail;
            const currentDate = getChatDate();

            console.log('[Home] Load chat date event:', date, 'current:', currentDate);

            // If requesting today's date and we have messages, save current and start fresh
            if (date === currentDate && messages.length > 0) {
                // Save current messages with a timestamp suffix to create a new "session"
                const timestamp = Date.now();
                const sessionDate = `${currentDate}_${timestamp}`;

                try {
                    await fetch('/api/user/chat-history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            date: sessionDate,
                            messages: messages.map(m => ({
                                ...m,
                                timestamp: m.timestamp.toISOString()
                            }))
                        })
                    });
                    console.log('[Home] Saved current chat as new session:', sessionDate);

                    // Also backup to localStorage
                    localStorage.setItem(`chat_messages_${sessionDate}`, JSON.stringify(messages));
                } catch (error) {
                    console.error('[Home] Failed to save current chat:', error);
                    localStorage.setItem(`chat_messages_${sessionDate}`, JSON.stringify(messages));
                }

                // Clear messages for new chat
                setMessages([]);

                // Update ref
                currentChatDateRef.current = currentDate;

                // Notify sidebar to refresh
                window.dispatchEvent(new CustomEvent('chat-date-changed', {
                    detail: { oldDate: sessionDate, newDate: currentDate }
                }));

                console.log('[Home] Started new chat session');
            } else if (date !== currentDate) {
                // Loading a different date's chat
                try {
                    const res = await fetch(`/api/user/chat-history?date=${date}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.chat?.messages && data.chat.messages.length > 0) {
                            const messagesWithDates = data.chat.messages.map((m: any) => ({
                                ...m,
                                timestamp: new Date(m.timestamp)
                            }));
                            setMessages(messagesWithDates);
                            console.log('[Home] Loaded messages for date:', date);
                        }
                    } else {
                        // Try localStorage
                        const saved = localStorage.getItem(`chat_messages_${date}`);
                        if (saved) {
                            const parsed = JSON.parse(saved);
                            const messagesWithDates = parsed.map((m: any) => ({
                                ...m,
                                timestamp: new Date(m.timestamp)
                            }));
                            setMessages(messagesWithDates);
                        }
                    }
                } catch (error) {
                    console.error('[Home] Failed to load chat for date:', date, error);
                }

                // Update the current chat date ref to prevent overwriting
                currentChatDateRef.current = date;
            }
        };

        window.addEventListener('load-chat-date', handleLoadChatDate as unknown as EventListener);
        return () => {
            window.removeEventListener('load-chat-date', handleLoadChatDate as unknown as EventListener);
        };
    }, [session, messages]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto-send schedule-based messages (extracted to useAutoMessages hook)
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

    const currentScheduleInfo = getCurrentScheduleInfo(todaySchedules);

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

            // Auto-execute add_schedule and add_weekly_goal actions immediately
            // Other actions (like open_briefing) will still show as buttons
            if (data.actions && data.actions.length > 0) {
                const autoExecuteActions = data.actions.filter((a: any) =>
                    a.type === 'add_schedule' || a.type === 'add_weekly_goal'
                );
                if (autoExecuteActions.length > 0) {
                    await handleMessageActions(autoExecuteActions);
                }
            }

        } catch (error) {
            console.error("Error sending message:", error);
            toast.error('메시지 전송에 실패했어요');
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

                        // 일정 추가 시 리소스 추천
                        const scheduleName = action.data.text || action.data.title || '';
                        if (scheduleName) {
                            fetch('/api/ai-resource-recommend', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    activityName: scheduleName,
                                    category: action.data.category,
                                    userProfile: userProfile,
                                    location: userLocation,
                                }),
                            }).then(res => res.json()).then(data => {
                                if (data.recommendation) {
                                    const resourceMessage: Message = {
                                        id: `resource-${Date.now()}`,
                                        role: 'assistant',
                                        content: data.recommendation,
                                        timestamp: new Date(),
                                        actions: data.actions || [],
                                    };
                                    setMessages(prev => [...prev, resourceMessage]);
                                }
                            }).catch(err => {
                                console.error('[Home] Resource recommend failed:', err);
                            });
                        }

                        // Refetch schedules
                        await refreshSchedules();
                    }
                } catch (error) {
                    console.error('[Home] Failed to add schedule from AI:', error);
                    toast.error('일정 추가에 실패했어요');
                }
            }
            // Handle add_weekly_goal action
            if (action.type === 'add_weekly_goal' && action.data) {
                try {
                    const goalRes = await fetch("/api/user/long-term-goals", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "add",
                            goal: {
                                type: "weekly",
                                title: action.data.title,
                                category: action.data.category || "other",
                            },
                        }),
                    });

                    if (goalRes.ok) {
                        console.log('[Home] Weekly goal added successfully:', action.data.title);
                        // Trigger goal update event
                        window.dispatchEvent(new CustomEvent('goals-updated', { detail: { source: 'ai-chat' } }));
                    }
                } catch (error) {
                    console.error('[Home] Failed to add weekly goal from AI:', error);
                    toast.error('목표 추가에 실패했어요');
                }
            }

            // Handle delete_schedule action
            if (action.type === 'delete_schedule' && action.data) {
                try {
                    const res = await fetch("/api/user/schedule/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(action.data),
                    });
                    if (res.ok) {
                        setMessages(prev => [...prev, {
                            id: `system-${Date.now()}`, role: 'assistant',
                            content: '✅ 일정이 삭제되었습니다!', timestamp: new Date(),
                        }]);
                        window.dispatchEvent(new CustomEvent('schedule-added', { detail: { source: 'ai-chat' } }));
                    }
                } catch (error) {
                    console.error('[Home] Failed to delete schedule:', error);
                    toast.error('일정 삭제에 실패했어요');
                }
            }

            // Handle update_schedule action
            if (action.type === 'update_schedule' && action.data) {
                try {
                    const res = await fetch("/api/user/schedule/modify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(action.data),
                    });
                    if (res.ok) {
                        setMessages(prev => [...prev, {
                            id: `system-${Date.now()}`, role: 'assistant',
                            content: '✅ 일정이 수정되었습니다!', timestamp: new Date(),
                        }]);
                        window.dispatchEvent(new CustomEvent('schedule-added', { detail: { source: 'ai-chat' } }));
                    }
                } catch (error) {
                    console.error('[Home] Failed to update schedule:', error);
                    toast.error('일정 수정에 실패했어요');
                }
            }

            // Handle web_search action
            if (action.type === 'web_search' && action.data?.query) {
                const searchQuery = action.data.query;
                setMessages(prev => [...prev, {
                    id: `search-${Date.now()}`, role: 'assistant',
                    content: `🔍 "${searchQuery}" 검색 중...`, timestamp: new Date(),
                }]);
                try {
                    const res = await fetch("/api/ai-web-search", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query: searchQuery, activity: action.data.activity }),
                    });
                    const data = await res.json();
                    setMessages(prev => {
                        const updated = [...prev];
                        const searchIdx = updated.findIndex(m => m.id.startsWith('search-') && m.content.includes(searchQuery));
                        if (searchIdx !== -1) {
                            updated[searchIdx] = { ...updated[searchIdx], content: data.result || '검색 결과를 찾지 못했습니다.' };
                        }
                        return updated;
                    });
                } catch {
                    console.error('[Home] Web search failed for:', searchQuery);
                }
            }

            // Handle save_learning action
            if (action.type === 'save_learning' && action.data) {
                try {
                    const res = await fetch("/api/user/learning/save", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(action.data),
                    });
                    if (res.ok) {
                        setMessages(prev => [...prev, {
                            id: `system-${Date.now()}`, role: 'assistant',
                            content: '📝 성장 기록이 저장되었습니다!', timestamp: new Date(),
                        }]);
                    }
                } catch (error) {
                    console.error('[Home] Failed to save learning:', error);
                    toast.error('학습 저장에 실패했어요');
                }
            }

            // Handle open_link action
            if (action.type === 'open_link' && action.data?.url) {
                window.open(action.data.url, "_blank");
            }

            // Handle show_goals / show_habits / show_analysis actions
            if (action.type === 'show_goals') {
                window.dispatchEvent(new CustomEvent('show-goals-panel', { detail: action.data }));
            }
            if (action.type === 'show_habits') {
                window.dispatchEvent(new CustomEvent('show-habits-panel', { detail: action.data }));
            }
            if (action.type === 'show_analysis') {
                window.dispatchEvent(new CustomEvent('show-analysis-panel', { detail: action.data }));
            }

            // Handle resolve_conflict action
            if (action.type === 'resolve_conflict') {
                window.dispatchEvent(new CustomEvent('show-conflict-resolution', { detail: action.data }));
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

                        if (currentScheduleInfo.status === 'in-progress') {
                            return getInProgressCardStyle(color);
                        }
                        return getUpcomingCardStyle(color);
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
                                        getIconStyle(currentScheduleInfo.schedule.color)
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
                                                getBadgeStyle(currentScheduleInfo.schedule.color, currentScheduleInfo.status === 'in-progress')
                                            )}>
                                                {currentScheduleInfo.status === 'in-progress' ? '현재 진행 중' : '예정됨'}
                                            </span>
                                            <span className="text-sm font-mono text-muted-foreground">
                                                {currentScheduleInfo.schedule.startTime}
                                            </span>
                                            {streakData && streakData.schedule.current >= 3 && (
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                                                    🔥 {streakData.schedule.current}일
                                                </span>
                                            )}
                                        </div>
                                        <p className="font-bold text-base sm:text-lg mb-0.5 sm:mb-1 line-clamp-1">{currentScheduleInfo.schedule.text}</p>
                                        <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                                            {getScheduleMessage(currentScheduleInfo.schedule.text, currentScheduleInfo.status)}
                                        </p>
                                        {/* Sleep Mode Button for sleep schedules */}
                                        {(() => {
                                            const text = currentScheduleInfo.schedule.text;
                                            const isSleepSchedule = text.includes('취침') ||
                                                text.toLowerCase().includes('sleep') ||
                                                text.includes('잠') ||
                                                text.includes('수면');

                                            if (isSleepSchedule && !isSleepMode) {
                                                return (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            startSleepMode();
                                                        }}
                                                        className="mt-2 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs sm:text-sm font-medium rounded-lg border border-indigo-500/30 transition-colors flex items-center gap-1.5"
                                                    >
                                                        <Moon className="w-3.5 h-3.5" />
                                                        취침 모드 켜기
                                                    </button>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <FieriLogo className="w-16 h-16 sm:w-20 sm:h-20" />
                                    <div className="text-left flex-1">
                                        <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                                            <p className="font-bold text-base sm:text-lg">오늘 일정이 없습니다</p>
                                            {streakData && streakData.schedule.current >= 3 && (
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                                    🔥 {streakData.schedule.current}일
                                                </span>
                                            )}
                                        </div>
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

                                            const nc = normalizeColor(schedule.color);
                                            const iconBg = getIconBg(nc);
                                            const cardBg = getCardBg(nc);
                                            const cardBorder = getCardBorder(nc);
                                            const cardShadow = getCardShadow(nc);

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
                                                                {schedule.startTime?.includes('T') ? schedule.startTime.split('T')[1]?.slice(0, 5) : schedule.startTime}
                                                                {schedule.endTime && ` - ${schedule.endTime?.includes('T') ? schedule.endTime.split('T')[1]?.slice(0, 5) : schedule.endTime}`}
                                                            </p>
                                                            {schedule.location && (
                                                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {schedule.location}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {/* 세부사항 표시 (오른쪽) */}
                                                        {schedule.memo && !isCompleted && !isSkipped && (
                                                            <div className="shrink-0 max-w-[120px] text-right">
                                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                                    {schedule.memo}
                                                                </p>
                                                            </div>
                                                        )}
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
                                                        const scheduleWithLearning = schedule as any;
                                                        const isLearningSchedule = scheduleWithLearning.isLearning && scheduleWithLearning.learningData;

                                                        return (
                                                            <div className="flex gap-2">
                                                                {/* 학습 일정인 경우 슬라이드 보기 버튼 추가 */}
                                                                {isLearningSchedule && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            const ld = scheduleWithLearning.learningData;
                                                                            setSlideViewerData({
                                                                                isOpen: true,
                                                                                curriculumId: ld.curriculumId,
                                                                                dayNumber: ld.dayNumber,
                                                                                dayTitle: ld.dayTitle || '',
                                                                                dayDescription: ld.description || '',
                                                                                objectives: ld.objectives || [],
                                                                                topic: ld.curriculumTopic || '',
                                                                                currentLevel: 'intermediate',
                                                                                targetLevel: 'advanced',
                                                                                scheduleId: schedule.id,
                                                                                linkedGoalId: schedule.linkedGoalId,
                                                                                linkedGoalType: schedule.linkedGoalType,
                                                                            });
                                                                        }}
                                                                        className="h-9 border border-purple-500 bg-purple-500/20 hover:bg-purple-500/30 text-purple-700 font-medium"
                                                                    >
                                                                        <FileText className="w-4 h-4 mr-1.5" />
                                                                        슬라이드
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    disabled={!canComplete}
                                                                    onClick={async () => {
                                                                        // Mark as completed
                                                                        setTodaySchedules(prev => prev.map(s =>
                                                                            s.id === schedule.id ? { ...s, completed: true, skipped: false } : s
                                                                        ));
                                                                        // Save to localStorage and update linked goal progress
                                                                        markScheduleCompletion(
                                                                            schedule.id,
                                                                            true,
                                                                            schedule.linkedGoalId,
                                                                            schedule.linkedGoalType
                                                                        );

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

                                                                            // 학습 일정인 경우 커리큘럼 진도 업데이트
                                                                            const scheduleWithLearning = schedule as any;
                                                                            if (scheduleWithLearning.isLearning && scheduleWithLearning.learningData) {
                                                                                const { curriculumId, dayNumber } = scheduleWithLearning.learningData;
                                                                                if (curriculumId && dayNumber) {
                                                                                    await fetch('/api/user/learning-progress', {
                                                                                        method: 'POST',
                                                                                        headers: { 'Content-Type': 'application/json' },
                                                                                        body: JSON.stringify({
                                                                                            curriculumId,
                                                                                            completedDay: dayNumber
                                                                                        })
                                                                                    });
                                                                                    console.log('[Home] Learning progress updated for day:', dayNumber);
                                                                                }
                                                                            }
                                                                        } catch (error) {
                                                                            console.error('[Home] Failed to save completion to server:', error);
                                                                            toast.error('완료 상태 저장에 실패했어요');
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
                                                                        // Save to localStorage (skipped schedules don't count as completed)
                                                                        markScheduleCompletion(
                                                                            schedule.id,
                                                                            false,
                                                                            schedule.linkedGoalId,
                                                                            schedule.linkedGoalType
                                                                        );

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
                                                                            toast.error('건너뛰기 저장에 실패했어요');
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
                {/* Fi.eri Auto-Interventions */}
                <FieriInterventionsContainer className="mb-6 max-w-4xl mx-auto" />

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
                                    // Assistant message - with logo
                                    <div className="mb-8 flex gap-3">
                                        <FieriLogo className="w-12 h-12 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1 text-sm text-foreground leading-relaxed">
                                            <p className="whitespace-pre-wrap">{message.content}</p>
                                            {/* Action buttons - inside assistant message for proper layout */}
                                            {message.actions && message.actions.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-4 relative z-10">
                                                    {message.actions
                                                        .filter((action) => action.type !== 'add_schedule')
                                                        .map((action, idx) => (
                                                            <Button
                                                                key={idx}
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    console.log('[Home] Action clicked:', action);

                                                                    if (action.type === 'open_link' && action.data?.url) {
                                                                        window.open(action.data.url, '_blank', 'noopener,noreferrer');
                                                                    } else if (action.type === 'open_briefing') {
                                                                        const briefingId = action.data?.briefingId || action.data?.id;
                                                                        const briefingTitle = action.data?.title;

                                                                        const fullBriefing = trendBriefings.find(
                                                                            (b: any) => b.id === briefingId || b.id === String(briefingId) || (briefingTitle && b.title === briefingTitle)
                                                                        );
                                                                        if (fullBriefing) {
                                                                            setSelectedBriefing(fullBriefing);
                                                                        } else {
                                                                            // ID 매칭 실패 시 인사이트 페이지로 이동
                                                                            window.location.href = '/insights';
                                                                        }
                                                                    } else {
                                                                        // Delegate to handleMessageActions for all other types
                                                                        handleMessageActions([action]);
                                                                    }
                                                                }}
                                                                className="text-xs h-9 px-4 rounded-full touch-manipulation"
                                                            >
                                                                {action.label}
                                                            </Button>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
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
                            placeholder={placeholder}
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

            {/* Slide Viewer for Learning Schedules */}
            {slideViewerData?.isOpen && (
                <SlideViewer
                    curriculumId={slideViewerData.curriculumId}
                    dayNumber={slideViewerData.dayNumber}
                    dayTitle={slideViewerData.dayTitle}
                    dayDescription={slideViewerData.dayDescription}
                    objectives={slideViewerData.objectives}
                    topic={slideViewerData.topic}
                    currentLevel={slideViewerData.currentLevel}
                    targetLevel={slideViewerData.targetLevel}
                    onClose={() => setSlideViewerData(null)}
                    onComplete={async () => {
                        // 슬라이드 완료 시 처리
                        console.log('[Home] Slide viewing completed');

                        if (slideViewerData) {
                            // 1. 일정 완료 처리
                            if (slideViewerData.scheduleId) {
                                // UI 상태 업데이트
                                setTodaySchedules(prev => prev.map(s =>
                                    s.id === slideViewerData.scheduleId ? { ...s, completed: true, skipped: false } : s
                                ));

                                // localStorage 및 연결된 목표 업데이트
                                markScheduleCompletion(
                                    slideViewerData.scheduleId,
                                    true,
                                    slideViewerData.linkedGoalId,
                                    slideViewerData.linkedGoalType
                                );
                            }

                            // 2. 학습 진행 상태 업데이트 (DB에 저장)
                            try {
                                // 현재 진행 상태 가져오기
                                const progressRes = await fetch(`/api/user/learning-progress?curriculumId=${slideViewerData.curriculumId}`);
                                let completedDays: number[] = [];
                                let currentDay = 1;

                                if (progressRes.ok) {
                                    const progressData = await progressRes.json();
                                    completedDays = progressData.completedDays || [];
                                    currentDay = progressData.currentDay || 1;
                                }

                                // 완료한 날 추가
                                if (!completedDays.includes(slideViewerData.dayNumber)) {
                                    const newCompletedDays = [...completedDays, slideViewerData.dayNumber];
                                    const newCurrentDay = Math.max(...newCompletedDays) + 1;

                                    await fetch('/api/user/learning-progress', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            curriculumId: slideViewerData.curriculumId,
                                            completedDays: newCompletedDays,
                                            currentDay: newCurrentDay,
                                        }),
                                    });
                                    console.log('[Home] Learning progress updated:', { curriculumId: slideViewerData.curriculumId, dayNumber: slideViewerData.dayNumber });
                                }
                            } catch (error) {
                                console.error('[Home] Failed to update learning progress:', error);
                            }
                        }

                        setSlideViewerData(null);
                    }}
                />
            )}
        </div>
    );
}
