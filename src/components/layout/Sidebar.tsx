"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, CalendarDays, Lightbulb, TrendingUp, User, Settings, Menu, X, Focus, ChevronDown, ChevronUp, History, BarChart3, Bell, Sparkles, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFocusSleepMode } from "@/contexts/FocusSleepModeContext";
import { NotificationDropdown } from "@/components/features/dashboard/NotificationDropdown";
import { signOut } from "next-auth/react";

interface ChatHistoryItem {
    date: string;
    title: string;
}

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

const NAV_ITEMS = [
    {
        label: "채팅",
        href: "/",
        icon: MessageSquare,
        description: "AI 채팅",
    },
    {
        label: "일정",
        href: "/dashboard",
        icon: CalendarDays,
        description: "일정 관리",
    },
    {
        label: "인사이트",
        href: "/insights",
        icon: Lightbulb,
        description: "트렌드 & 이메일",
    },
    {
        label: "성장",
        href: "/growth",
        icon: TrendingUp,
        description: "학습 & 분석",
    },
];

const BOTTOM_ITEMS = [
    {
        label: "마이페이지",
        href: "/mypage",
        icon: User,
    },
    {
        label: "설정",
        href: "/settings",
        icon: Settings,
    },
];

export function Sidebar() {
    const [isOpen, setIsOpen] = useState(true); // 기본값을 true로 (데스크톱에서 열림)
    const [isMobile, setIsMobile] = useState(false);
    const [showChatHistory, setShowChatHistory] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false); // 채팅 히스토리 확장 상태
    const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
    const pathname = usePathname();
    const router = useRouter();
    const { isFocusMode, startFocusMode, endFocusMode } = useFocusSleepMode();

    // Mobile header states for notification and profile
    const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [userProfile, setUserProfile] = useState<{ customGoals?: any[]; schedule?: any; job?: string } | null>(null);

    // Detect mobile/desktop and set initial state
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // 모바일이면 닫힌 상태로, 데스크톱이면 열린 상태로
            if (mobile && isOpen) {
                setIsOpen(false);
            } else if (!mobile && !isOpen) {
                setIsOpen(true);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Load chat history
    const loadChatHistory = async () => {
        try {
            // DB에서 채팅 목록 가져오기
            const response = await fetch('/api/user/chat-history?list=true');
            if (response.ok) {
                const data = await response.json();
                setChatHistory(data.chatList || []);
            } else {
                // DB 실패 시 localStorage에서 가져오기
                const allKeys = Object.keys(localStorage);
                const today = new Date().toISOString().split('T')[0];
                const chatDates = allKeys
                    .filter(key => key.startsWith('chat_messages_'))
                    .map(key => key.replace('chat_messages_', ''))
                    .filter(date => date !== today)
                    .sort((a, b) => b.localeCompare(a));

                const history = chatDates.map(date => {
                    const messages = localStorage.getItem(`chat_messages_${date}`);
                    let title = formatDate(date);
                    try {
                        const parsed = JSON.parse(messages || '[]');
                        const firstUserMsg = parsed.find((m: any) => m.role === 'user');
                        if (firstUserMsg?.content) {
                            title = firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
                        }
                    } catch (e) { }
                    return { date, title };
                });

                setChatHistory(history);
            }
        } catch (error) {
            console.error('[Sidebar] Failed to load chat history:', error);
        }
    };

    useEffect(() => {
        loadChatHistory();
    }, []);

    // Load user profile for mobile header
    useEffect(() => {
        const loadProfile = async () => {
            const savedProfile = localStorage.getItem("user_profile");
            if (savedProfile) {
                setUserProfile(JSON.parse(savedProfile));
            }

            try {
                const response = await fetch("/api/user/profile");
                if (response.ok) {
                    const data = await response.json();
                    if (data.profile) {
                        setUserProfile(data.profile);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch profile:", error);
            }
        };

        loadProfile();

        const handleProfileUpdate = () => {
            const savedProfile = localStorage.getItem("user_profile");
            if (savedProfile) {
                setUserProfile(JSON.parse(savedProfile));
            }
        };

        window.addEventListener('profile-updated', handleProfileUpdate);
        return () => {
            window.removeEventListener('profile-updated', handleProfileUpdate);
        };
    }, []);

    // Listen for date change event to refresh chat history
    useEffect(() => {
        const handleDateChange = (event: CustomEvent) => {
            // Reload chat history to include the newly saved chat
            loadChatHistory();
        };

        window.addEventListener('chat-date-changed', handleDateChange as EventListener);
        return () => {
            window.removeEventListener('chat-date-changed', handleDateChange as EventListener);
        };
    }, []);

    // Get today's date string (KST, actual date without cutoff for display)
    const getTodayDateString = () => {
        const now = new Date();
        const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        return `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, '0')}-${String(kstDate.getDate()).padStart(2, '0')}`;
    };

    // Format date for display - "오늘 - 1월 18일" or "1월 17일" format
    const formatDateForDisplay = (dateStr: string, isToday: boolean = false) => {
        const date = new Date(dateStr + 'T00:00:00');
        const month = date.getMonth() + 1;
        const day = date.getDate();

        if (isToday) {
            return `오늘 - ${month}월 ${day}일`;
        }
        return `${month}월 ${day}일`;
    };

    // Format date for display (short version for history list)
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        const todayStr = getTodayDateString();
        const yesterday = new Date(todayStr + 'T00:00:00');
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

        if (dateStr === todayStr) {
            return '오늘';
        } else if (dateStr === yesterdayStr) {
            return '어제';
        } else {
            return `${date.getMonth() + 1}/${date.getDate()}`;
        }
    };

    // Navigate to chat with date
    const handleChatHistoryClick = (date: string) => {
        // 해당 날짜 채팅으로 이동
        localStorage.setItem('selected_chat_date', date);
        window.dispatchEvent(new CustomEvent('load-chat-date', { detail: { date } }));
        router.push('/');
        if (isMobile) setIsOpen(false);
    };

    // Hide sidebar on certain pages
    const hiddenPages = ["/login", "/signup", "/onboarding", "/reset", "/landing", "/privacy", "/terms"];
    const isLearningPage = pathname?.includes("/learn/");

    if (hiddenPages.includes(pathname || "") || isLearningPage) {
        return null;
    }

    return (
        <>
            {/* Mobile Top Bar - Only on mobile */}
            {isMobile && (
                <div className="fixed top-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-sm border-b border-border z-[60] flex items-center justify-between px-4">
                    {/* Hamburger Menu */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsOpen(!isOpen)}
                        className="hover:bg-muted"
                    >
                        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>

                    {/* Fieri Logo */}
                    <Link href="/" className="absolute left-1/2 transform -translate-x-1/2">
                        <FieriLogo className="w-16 h-16" />
                    </Link>

                    {/* Notification and Profile */}
                    <div className="flex items-center gap-2">
                        {/* Notification Bell */}
                        <div className="relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full hover:bg-muted transition-colors relative"
                                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                            >
                                <Bell className="w-5 h-5" />
                                {(userProfile?.schedule || (userProfile?.customGoals && userProfile.customGoals.some(g =>
                                    g.daysOfWeek?.includes(new Date().getDay()) && g.notificationEnabled
                                ))) && (
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
                                )}
                            </Button>
                            {userProfile && (
                                <NotificationDropdown
                                    goals={userProfile.customGoals || []}
                                    isOpen={showNotificationDropdown}
                                    onClose={() => setShowNotificationDropdown(false)}
                                />
                            )}
                        </div>

                        {/* Profile Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                className="w-8 h-8 rounded-full bg-foreground cursor-pointer hover:ring-2 hover:ring-foreground/30 transition-all shadow-md"
                            />
                            <AnimatePresence>
                                {showProfileMenu && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setShowProfileMenu(false)}
                                        />
                                        <motion.div
                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                            className="absolute right-0 top-12 w-56 bg-white border border-border rounded-xl shadow-lg z-50 py-2"
                                        >
                                            <div className="px-4 py-3 border-b border-border mb-2">
                                                <p className="text-sm font-medium text-foreground">User</p>
                                                <p className="text-xs text-muted-foreground truncate">{userProfile?.job || "User"}</p>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    window.dispatchEvent(new CustomEvent('open-daily-briefing'));
                                                    setShowProfileMenu(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors text-foreground flex items-center gap-3"
                                            >
                                                <Sparkles className="w-4 h-4" />
                                                일일 브리핑
                                            </button>

                                            <Link
                                                href="/mypage"
                                                className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted transition-colors text-foreground"
                                                onClick={() => setShowProfileMenu(false)}
                                            >
                                                <User className="w-4 h-4" />
                                                마이페이지
                                            </Link>
                                            <Link
                                                href="/settings"
                                                className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted transition-colors text-foreground"
                                                onClick={() => setShowProfileMenu(false)}
                                            >
                                                <Settings className="w-4 h-4" />
                                                설정
                                            </Link>

                                            <div className="border-t border-border my-2" />

                                            <button
                                                onClick={async () => {
                                                    localStorage.clear();
                                                    await signOut({ callbackUrl: '/login' });
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors text-red-600 flex items-center gap-3"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                로그아웃
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            )}

            {/* Overlay - Mobile when open OR Desktop when expanded */}
            <AnimatePresence>
                {((isOpen && isMobile) || (isExpanded && !isMobile)) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isMobile ? 1 : 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                            "fixed inset-0 z-40",
                            isMobile ? "bg-black/50 backdrop-blur-sm" : "bg-transparent"
                        )}
                        onClick={() => {
                            if (isMobile) {
                                setIsOpen(false);
                            } else {
                                setIsExpanded(false);
                            }
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    x: isMobile && !isOpen ? "-100%" : 0,
                    width: !isMobile && isExpanded ? 280 : (isMobile ? 224 : 80),
                }}
                transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                }}
                className={cn(
                    "fixed left-0 h-screen bg-card border-r border-border flex flex-col z-50 overflow-x-hidden",
                    isMobile ? "top-16 py-4" : "top-0 py-6"
                )}
            >
                {/* Logo - Desktop only */}
                {!isMobile && (
                    <Link href="/" className="mb-8 mx-auto">
                        <FieriLogo className="w-16 h-16" />
                    </Link>
                )}

                {/* Main Navigation */}
                <nav className="flex-1 flex flex-col gap-2 w-full px-3 overflow-y-auto">
                    {NAV_ITEMS.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        const isChatItem = item.href === '/';

                        return (
                            <div key={item.href}>
                                {isChatItem ? (
                                    // 채팅 아이콘 - 클릭하면 확장
                                    <button
                                        onClick={() => {
                                            if (!isMobile) {
                                                setIsExpanded(!isExpanded);
                                            } else {
                                                router.push('/');
                                                setIsOpen(false);
                                            }
                                        }}
                                        className="relative group w-full"
                                    >
                                        <motion.div
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className={cn(
                                                "rounded-xl flex items-center transition-colors relative",
                                                isExpanded ? "w-full h-12 px-4 gap-3 justify-start" : "md:w-14 md:h-14 md:justify-center",
                                                "w-full h-12 px-4 gap-3",
                                                isActive
                                                    ? "bg-foreground text-white"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <Icon className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
                                            <span className={cn(
                                                "text-sm font-medium",
                                                !isMobile && !isExpanded && "hidden"
                                            )}>{item.label}</span>
                                            {!isMobile && chatHistory.length > 0 && (
                                                <ChevronDown className={cn(
                                                    "w-4 h-4 ml-auto transition-transform",
                                                    isExpanded && "rotate-180",
                                                    !isExpanded && "hidden"
                                                )} />
                                            )}
                                            {isActive && (
                                                <motion.div
                                                    layoutId="sidebar-indicator"
                                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-foreground rounded-r-full"
                                                    style={{ left: -12 }}
                                                    transition={{
                                                        type: "spring",
                                                        stiffness: 500,
                                                        damping: 30,
                                                    }}
                                                />
                                            )}
                                        </motion.div>

                                        {/* Tooltip - Desktop only (when not expanded) */}
                                        {!isExpanded && (
                                            <div className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                                <div className="bg-foreground text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg">
                                                    <p className="font-medium">{item.label}</p>
                                                    <p className="text-xs text-white/70">클릭하여 채팅 기록 보기</p>
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ) : (
                                    <Link
                                        href={item.href}
                                        className="relative group"
                                        onClick={() => {
                                            if (isMobile) setIsOpen(false);
                                            if (!isMobile && isExpanded) setIsExpanded(false);
                                        }}
                                    >
                                        <motion.div
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className={cn(
                                                "rounded-xl flex items-center transition-colors relative",
                                                isExpanded ? "w-full h-12 px-4 gap-3 justify-start" : "md:w-14 md:h-14 md:justify-center",
                                                "w-full h-12 px-4 gap-3",
                                                isActive
                                                    ? "bg-foreground text-white"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <Icon className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
                                            <span className={cn(
                                                "text-sm font-medium",
                                                !isMobile && !isExpanded && "hidden"
                                            )}>{item.label}</span>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="sidebar-indicator"
                                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-foreground rounded-r-full"
                                                    style={{ left: -12 }}
                                                    transition={{
                                                        type: "spring",
                                                        stiffness: 500,
                                                        damping: 30,
                                                    }}
                                                />
                                            )}
                                        </motion.div>

                                        {/* Tooltip - Desktop only (when not expanded) */}
                                        {!isExpanded && (
                                            <div className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                                <div className="bg-foreground text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg">
                                                    <p className="font-medium">{item.label}</p>
                                                    <p className="text-xs text-white/70">{item.description}</p>
                                                </div>
                                            </div>
                                        )}
                                    </Link>
                                )}

                                {/* Chat History - 채팅 아이콘 아래 (확장 시) */}
                                {isChatItem && (
                                    <>
                                        {/* Mobile: Expandable list */}
                                        {isMobile && chatHistory.length > 0 && (
                                            <div className="mt-1 ml-2">
                                                <button
                                                    onClick={() => setShowChatHistory(!showChatHistory)}
                                                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-2 py-1 w-full"
                                                >
                                                    <History className="w-3 h-3" />
                                                    <span>지난 대화</span>
                                                    {showChatHistory ? (
                                                        <ChevronUp className="w-3 h-3 ml-auto" />
                                                    ) : (
                                                        <ChevronDown className="w-3 h-3 ml-auto" />
                                                    )}
                                                </button>

                                                <AnimatePresence>
                                                    {showChatHistory && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="flex flex-col gap-1 py-1 max-h-60 overflow-y-auto">
                                                                {chatHistory.slice(0, 15).map((chat) => (
                                                                    <button
                                                                        key={chat.date}
                                                                        onClick={() => handleChatHistoryClick(chat.date)}
                                                                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-3 py-1.5 rounded-lg text-left"
                                                                    >
                                                                        <span className="text-[10px] text-muted-foreground/70 w-10 flex-shrink-0">
                                                                            {formatDate(chat.date)}
                                                                        </span>
                                                                        <span className="truncate">{chat.title}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}

                                        {/* Desktop: 확장 시 채팅 히스토리 목록 */}
                                        {!isMobile && isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="mt-2 space-y-1"
                                            >
                                                {/* 오늘 채팅 - "오늘 - 1월 18일" 형식 */}
                                                <button
                                                    onClick={() => {
                                                        router.push('/');
                                                        const today = getTodayDateString();
                                                        localStorage.setItem('selected_chat_date', today);
                                                        window.dispatchEvent(new CustomEvent('load-chat-date', { detail: { date: today } }));
                                                        setIsExpanded(false);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-foreground transition-colors"
                                                >
                                                    <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
                                                    <span className="text-sm font-medium">{formatDateForDisplay(getTodayDateString(), true)}</span>
                                                </button>

                                                {/* 이전 날짜별 채팅 목록 - "1월 17일", "1월 16일" 형식 */}
                                                {chatHistory.length > 0 && (
                                                    <div className="flex flex-col gap-0.5 max-h-[calc(100vh-400px)] overflow-y-auto">
                                                        {chatHistory
                                                            .filter(chat => chat.date !== getTodayDateString()) // 오늘 날짜 제외
                                                            .slice(0, 20)
                                                            .map((chat) => (
                                                                <button
                                                                    key={chat.date}
                                                                    onClick={() => handleChatHistoryClick(chat.date)}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted transition-colors group"
                                                                >
                                                                    <MessageSquare className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                                                                    <span className="text-sm text-foreground">{formatDateForDisplay(chat.date)}</span>
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}

                                                {chatHistory.filter(chat => chat.date !== getTodayDateString()).length === 0 && (
                                                    <p className="text-xs text-muted-foreground text-center py-4">
                                                        아직 이전 채팅 기록이 없습니다
                                                    </p>
                                                )}
                                            </motion.div>
                                        )}

                                        {/* Desktop: 축소 상태에서 채팅 개수 표시 */}
                                        {!isMobile && !isExpanded && chatHistory.length > 0 && (
                                            <div className="flex justify-center gap-0.5 mt-1">
                                                {chatHistory.slice(0, 3).map((_, i) => (
                                                    <div key={i} className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Focus Mode Button */}
                <div className="px-3 mb-4">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            if (isFocusMode) {
                                endFocusMode();
                            } else {
                                startFocusMode(25); // 25분 기본 집중 시간
                            }
                            if (isMobile) setIsOpen(false);
                        }}
                        className={cn(
                            "rounded-xl flex items-center transition-colors w-full",
                            isExpanded ? "h-12 px-4 gap-3 justify-start" : "md:w-14 md:h-14 md:justify-center",
                            "h-12 px-4 gap-3",
                            isFocusMode
                                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                                : "bg-gradient-to-r from-orange-400 to-amber-400 text-white hover:from-orange-500 hover:to-amber-500"
                        )}
                    >
                        <Focus className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
                        <span className={cn(
                            "text-sm font-medium",
                            !isMobile && !isExpanded && "hidden"
                        )}>
                            {isFocusMode ? "집중 종료" : "집중 모드"}
                        </span>
                    </motion.button>

                    {/* Tooltip - Desktop only (when not expanded) */}
                    {!isExpanded && (
                        <div className="hidden md:block relative group">
                            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity -mt-7">
                                <div className="bg-foreground text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg">
                                    <p className="font-medium">{isFocusMode ? "집중 종료" : "집중 모드"}</p>
                                    <p className="text-xs text-white/70">25분 집중 타이머</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Navigation */}
                <div className="flex flex-col gap-2 w-full px-3">
                    {BOTTOM_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="relative group"
                                onClick={() => {
                                    if (isMobile) setIsOpen(false);
                                    if (!isMobile && isExpanded) setIsExpanded(false);
                                }}
                            >
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={cn(
                                        "rounded-xl flex items-center transition-colors",
                                        isExpanded ? "w-full h-12 px-4 gap-3 justify-start" : "md:w-14 md:h-14 md:justify-center",
                                        "w-full h-12 px-4 gap-3",
                                        isActive
                                            ? "bg-foreground text-white"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className="w-5 h-5 flex-shrink-0" />
                                    <span className={cn(
                                        "text-sm font-medium",
                                        !isMobile && !isExpanded && "hidden"
                                    )}>{item.label}</span>
                                </motion.div>

                                {/* Tooltip - Desktop only (when not expanded) */}
                                {!isExpanded && (
                                    <div className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                        <div className="bg-foreground text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg">
                                            {item.label}
                                        </div>
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </motion.aside>
        </>
    );
}
