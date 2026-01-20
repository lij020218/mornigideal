"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Calendar, BookOpen, Award, TrendingUp, TrendingDown, Minus, ArrowRight, Loader2, RefreshCw, Clock, Zap, Flame, Moon, FileText, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { WeeklyReportCards } from "./WeeklyReportCards";

// Fieri Logo SVG Component
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

// Donut Chart Component
function DonutChart({
    percentage,
    size = 120,
    strokeWidth = 12,
    color = "rgb(59, 130, 246)",
}: {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={strokeWidth}
                />
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{percentage.toFixed(0)}%</span>
            </div>
        </div>
    );
}

// Horizontal Progress Bar
function HorizontalProgressBar({
    label,
    value,
    maxValue,
    color,
    icon
}: {
    label: string;
    value: number;
    maxValue: number;
    color: string;
    icon?: string;
}) {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                    {icon && <span>{icon}</span>}
                    {label}
                </span>
                <span className="font-semibold">{value}개</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </div>
        </div>
    );
}

interface WeeklyReportData {
    period: {
        start: string;
        end: string;
        weekNumber: number;
    };
    scheduleAnalysis: {
        totalSchedules: number;
        completedSchedules: number;
        completionRate: number;
        categoryBreakdown: {
            work: number;
            learning: number;
            exercise: number;
            wellness: number;
            other: number;
        };
        mostProductiveDay: string;
        avgSchedulesPerDay: number;
    };
    trendBriefingAnalysis: {
        totalRead: number;
        avgReadPerDay: number;
        topCategories: Array<{ category: string; count: number }>;
        readingStreak: number;
    };
    focusAnalysis?: {
        totalFocusMinutes: number;
        focusSessions: number;
        avgSessionMinutes: number;
        totalInterruptions: number;
        mostFocusedDay: string;
    };
    sleepAnalysis?: {
        totalSleepMinutes: number;
        sleepSessions: number;
        avgSleepHours: number;
        earliestSleep: string;
        latestSleep: string;
        sleepConsistencyScore: number;
    };
    growthMetrics: {
        newHabitsFormed: number;
        consistencyScore: number;
        focusAreas: string[];
        timeInvested: number;
    };
    insights: {
        achievements: string[];
        improvements: string[];
        recommendations: string[];
    };
    comparisonWithLastWeek: {
        scheduleChange: number;
        completionRateChange: number;
        readingChange: number;
    };
    narrative?: string;
}

export function WeeklyReportContent() {
    const [lastWeekReport, setLastWeekReport] = useState<WeeklyReportData | null>(null); // 완료된 지난 주
    const [currentWeekStats, setCurrentWeekStats] = useState<any>(null); // 진행 중인 현재 주
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showPastReports, setShowPastReports] = useState(false);
    const [showCardsPopup, setShowCardsPopup] = useState(false);

    useEffect(() => {
        fetchReports();

        // 6시간마다 현재 주 통계 업데이트
        const interval = setInterval(() => {
            fetchCurrentWeekStats();
        }, 6 * 60 * 60 * 1000); // 6시간

        return () => clearInterval(interval);
    }, []);

    const getCurrentWeekNumber = () => {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + startOfYear.getDay() + 1) / 7);
    };

    const getCurrentWeekRange = () => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const monday = new Date(now);
        monday.setDate(now.getDate() - daysToSubtract);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return { start: monday, end: sunday };
    };

    const fetchCurrentWeekStats = async () => {
        const currentWeek = getCurrentWeekRange();
        const currentWeekNum = getCurrentWeekNumber();

        try {
            // 사용자 프로필에서 일정 가져오기
            const profileRes = await fetch('/api/user/profile');
            if (!profileRes.ok) {
                throw new Error('Failed to fetch profile');
            }
            const profileData = await profileRes.json();
            const customGoals = profileData.profile?.customGoals || [];

            // 현재 주 일정 필터링
            const currentWeekSchedules = customGoals.filter((goal: any) => {
                if (!goal.schedules || goal.schedules.length === 0) return false;
                return goal.schedules.some((schedule: any) => {
                    const scheduleDate = new Date(schedule.date);
                    return scheduleDate >= currentWeek.start && scheduleDate <= currentWeek.end;
                });
            });

            const totalSchedules = currentWeekSchedules.reduce((sum: number, goal: any) => {
                return sum + goal.schedules.filter((s: any) => {
                    const scheduleDate = new Date(s.date);
                    return scheduleDate >= currentWeek.start && scheduleDate <= currentWeek.end;
                }).length;
            }, 0);

            const completedSchedules = currentWeekSchedules.reduce((sum: number, goal: any) => {
                return sum + goal.schedules.filter((s: any) => {
                    const scheduleDate = new Date(s.date);
                    return scheduleDate >= currentWeek.start && scheduleDate <= currentWeek.end && s.completed;
                }).length;
            }, 0);

            const completionRate = totalSchedules > 0 ? (completedSchedules / totalSchedules) * 100 : 0;

            // 트렌드 브리핑 읽기 통계
            const briefingsRes = await fetch('/api/trend-briefing');
            const briefingsData = await briefingsRes.ok ? await briefingsRes.json() : { briefings: [] };
            const readBriefings = briefingsData.briefings?.filter((b: any) => {
                const createdAt = new Date(b.created_at);
                return createdAt >= currentWeek.start && createdAt <= currentWeek.end && b.read;
            }) || [];

            setCurrentWeekStats({
                weekNumber: currentWeekNum,
                start: currentWeek.start.toISOString(),
                end: currentWeek.end.toISOString(),
                totalSchedules,
                completedSchedules,
                completionRate,
                totalRead: readBriefings.length,
                lastUpdated: new Date().toISOString(),
            });

        } catch (error) {
            console.error('Failed to fetch current week stats:', error);
            setCurrentWeekStats({
                weekNumber: currentWeekNum,
                start: currentWeek.start.toISOString(),
                end: currentWeek.end.toISOString(),
            });
        }
    };

    const fetchReports = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            // 지난 완료된 주 리포트 (카드 뉴스용)
            const response = await fetch('/api/weekly-report');
            if (response.ok) {
                const data = await response.json();
                setLastWeekReport(data.report);
            }

            // 현재 진행 중인 주 실시간 통계
            await fetchCurrentWeekStats();

        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    };

    const getChangeIcon = (value: number) => {
        if (value > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
        if (value < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
        return <Minus className="w-4 h-4 text-gray-400" />;
    };

    const getChangeColor = (value: number) => {
        if (value > 0) return 'text-green-500';
        if (value < 0) return 'text-red-500';
        return 'text-gray-400';
    };

    const categoryLabels: Record<string, string> = {
        work: '업무',
        learning: '학습',
        exercise: '운동',
        wellness: '웰빙',
        other: '기타',
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!lastWeekReport && !currentWeekStats) {
        return (
            <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">리포트를 불러올 수 없습니다</h3>
                <p className="text-muted-foreground mb-4">잠시 후 다시 시도해주세요.</p>
                <Button onClick={() => fetchReports()}>다시 시도</Button>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Card News Popup - 지난 주 완료된 리포트 */}
            {lastWeekReport && (
                <WeeklyReportCards
                    isOpen={showCardsPopup}
                    onClose={() => setShowCardsPopup(false)}
                    reportData={lastWeekReport}
                />
            )}

            {/* Current Week Summary - Always visible */}
            {!showPastReports && currentWeekStats && (
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold">이번 주 현황</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                {formatDate(currentWeekStats.start)} - {formatDate(currentWeekStats.end)} (Week {currentWeekStats.weekNumber}) - 진행 중
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchReports(true)}
                            disabled={refreshing}
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    {/* Big Card News Button - 지난 주 카드 뉴스 */}
                    {lastWeekReport && (
                        <motion.button
                            onClick={() => setShowCardsPopup(true)}
                            className="w-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-white/20 hover:scale-[1.02] transition-transform shadow-xl"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="flex items-center justify-between text-white">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                        <Layout className="w-6 h-6 sm:w-8 sm:h-8" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-lg sm:text-2xl font-bold mb-1">지난 주 Week {lastWeekReport.period.weekNumber} 카드 뉴스</h3>
                                        <p className="text-sm sm:text-base opacity-90">{formatDate(lastWeekReport.period.start)} - {formatDate(lastWeekReport.period.end)}</p>
                                    </div>
                                </div>
                                <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                        </motion.button>
                    )}

                    {/* Quick Summary - 현재 진행 중인 주 */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-green-500/20"
                    >
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                                <FieriLogo className="w-6 h-6 sm:w-7 sm:h-7" /> 현재 진행 중 (Week {currentWeekStats.weekNumber})
                            </h3>
                            {currentWeekStats.lastUpdated && (
                                <span className="text-xs text-muted-foreground">
                                    업데이트: {new Date(currentWeekStats.lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>

                        {currentWeekStats.totalSchedules !== undefined ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Calendar className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <p className="text-2xl font-bold">{currentWeekStats.completionRate?.toFixed(0) || 0}%</p>
                                    <p className="text-xs text-muted-foreground">일정 완료</p>
                                    <p className="text-xs text-muted-foreground mt-1">{currentWeekStats.completedSchedules || 0} / {currentWeekStats.totalSchedules || 0}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <BookOpen className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <p className="text-2xl font-bold">{currentWeekStats.totalRead || 0}</p>
                                    <p className="text-xs text-muted-foreground">읽은 브리핑</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 text-center col-span-2 sm:col-span-1">
                                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Clock className="w-5 h-5 text-green-400" />
                                    </div>
                                    <p className="text-2xl font-bold">{7 - new Date().getDay()}</p>
                                    <p className="text-xs text-muted-foreground">남은 일수</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-green-500 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">통계를 불러오는 중...</p>
                            </div>
                        )}

                        <div className="mt-4 text-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowPastReports(true)}
                                className="text-blue-400 hover:text-blue-300"
                            >
                                지난 주간 리포트 보기 <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}

            {/* Past Weekly Reports - Detailed View */}
            {showPastReports && lastWeekReport && (
                <>
                    {/* Back Button */}
                    <div className="flex items-center justify-between mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPastReports(false)}
                            className="gap-2"
                        >
                            <ArrowRight className="w-4 h-4 rotate-180" />
                            이번 주 현황으로 돌아가기
                        </Button>
                    </div>

                    {/* Week Selector */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4">
                        <h3 className="text-lg font-semibold mb-2">주간 리포트 선택</h3>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-blue-500/20 border-blue-500/50"
                            >
                                Week {lastWeekReport.period.weekNumber} (지난 주)
                            </Button>
                            <span className="text-sm text-muted-foreground">이전 주차는 곧 추가됩니다</span>
                        </div>
                    </div>

                    {/* AI Narrative */}
                    {lastWeekReport.narrative && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-500/20"
                        >
                            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                                <FieriLogo className="w-6 h-6 sm:w-7 sm:h-7" /> Fi.eri 주간 분석
                            </h3>
                            <div className="prose prose-sm prose-invert max-w-none text-sm sm:text-base">
                                <ReactMarkdown>{lastWeekReport.narrative}</ReactMarkdown>
                            </div>
                        </motion.div>
                    )}

                    {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* Schedule Completion */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/10"
                >
                    <div className="flex items-center gap-2 sm:gap-3 mb-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm sm:text-base">일정 완료율</h3>
                            <div className="flex items-center gap-1">
                                {getChangeIcon(lastWeekReport.comparisonWithLastWeek.completionRateChange)}
                                <span className={`text-xs font-medium ${getChangeColor(lastWeekReport.comparisonWithLastWeek.completionRateChange)}`}>
                                    {Math.abs(lastWeekReport.comparisonWithLastWeek.completionRateChange).toFixed(1)}%p
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-center mb-3">
                        <DonutChart
                            percentage={lastWeekReport.scheduleAnalysis.completionRate}
                            size={100}
                            strokeWidth={10}
                            color="rgb(59, 130, 246)"
                        />
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground text-center">
                        {lastWeekReport.scheduleAnalysis.completedSchedules} / {lastWeekReport.scheduleAnalysis.totalSchedules} 일정 완료
                    </p>
                </motion.div>

                {/* Reading */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/10"
                >
                    <div className="flex items-center gap-2 sm:gap-3 mb-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm sm:text-base">브리핑 읽기</h3>
                            <div className="flex items-center gap-1">
                                {getChangeIcon(lastWeekReport.comparisonWithLastWeek.readingChange)}
                                <span className={`text-xs font-medium ${getChangeColor(lastWeekReport.comparisonWithLastWeek.readingChange)}`}>
                                    {Math.abs(lastWeekReport.comparisonWithLastWeek.readingChange).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-6 mb-3">
                        <div className="text-center">
                            <span className="text-4xl font-bold">{lastWeekReport.trendBriefingAnalysis.totalRead}</span>
                            <p className="text-xs text-muted-foreground">읽은 브리핑</p>
                        </div>
                        <div className="h-12 w-px bg-white/10" />
                        <div className="text-center">
                            <div className="flex items-center gap-1">
                                <Flame className="w-5 h-5 text-orange-500" />
                                <span className="text-2xl font-bold text-orange-500">
                                    {lastWeekReport.trendBriefingAnalysis.readingStreak}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">연속 학습</p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                        하루 평균 {lastWeekReport.trendBriefingAnalysis.avgReadPerDay.toFixed(1)}개 읽음
                    </p>
                </motion.div>

                {/* Consistency */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/10"
                >
                    <div className="flex items-center gap-2 sm:gap-3 mb-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base">일관성 점수</h3>
                    </div>
                    <div className="flex justify-center mb-3">
                        <DonutChart
                            percentage={lastWeekReport.growthMetrics.consistencyScore}
                            size={100}
                            strokeWidth={10}
                            color={
                                lastWeekReport.growthMetrics.consistencyScore >= 70 ? "rgb(34, 197, 94)" :
                                lastWeekReport.growthMetrics.consistencyScore >= 40 ? "rgb(234, 179, 8)" :
                                "rgb(239, 68, 68)"
                            }
                        />
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground text-center">
                        {lastWeekReport.growthMetrics.consistencyScore >= 70 ? "훌륭해요! 꾸준히 성장하고 있어요" :
                         lastWeekReport.growthMetrics.consistencyScore >= 40 ? "조금 더 꾸준히 해보세요" :
                         "규칙적인 습관을 만들어보세요"}
                    </p>
                </motion.div>
            </div>

            {/* Category Breakdown */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10"
            >
                <h3 className="font-semibold mb-4 sm:mb-6 flex items-center gap-2 text-sm sm:text-base">
                    <span className="text-lg sm:text-xl">📊</span> 활동 카테고리 분석
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        {Object.entries(lastWeekReport.scheduleAnalysis.categoryBreakdown).map(([category, count]) => {
                            const colorMap: Record<string, string> = {
                                work: 'rgb(59, 130, 246)',
                                learning: 'rgb(168, 85, 247)',
                                exercise: 'rgb(239, 68, 68)',
                                wellness: 'rgb(34, 197, 94)',
                                other: 'rgb(107, 114, 128)',
                            };
                            const iconMap: Record<string, string> = {
                                work: '💼',
                                learning: '📚',
                                exercise: '💪',
                                wellness: '🧘',
                                other: '🎯',
                            };
                            return (
                                <HorizontalProgressBar
                                    key={category}
                                    label={categoryLabels[category] || category}
                                    value={count}
                                    maxValue={lastWeekReport.scheduleAnalysis.totalSchedules}
                                    color={colorMap[category] || 'rgb(107, 114, 128)'}
                                    icon={iconMap[category]}
                                />
                            );
                        })}
                    </div>

                    <div className="flex flex-col justify-center items-center gap-4 p-4 bg-white/5 rounded-xl">
                        <div className="text-center">
                            <p className="text-3xl font-bold">{lastWeekReport.scheduleAnalysis.totalSchedules}</p>
                            <p className="text-sm text-muted-foreground">총 일정</p>
                        </div>
                        <div className="w-full h-px bg-white/10" />
                        <div className="text-center">
                            <p className="text-xl font-semibold">{lastWeekReport.scheduleAnalysis.avgSchedulesPerDay.toFixed(1)}</p>
                            <p className="text-sm text-muted-foreground">일 평균 일정</p>
                        </div>
                        <div className="w-full h-px bg-white/10" />
                        <div className="text-center">
                            <p className="text-lg font-medium text-blue-400">
                                {lastWeekReport.scheduleAnalysis.mostProductiveDay || '-'}
                            </p>
                            <p className="text-xs text-muted-foreground">가장 생산적인 날</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Focus & Sleep Analysis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {lastWeekReport.focusAnalysis && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                        className="bg-amber-500/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-amber-500/20"
                    >
                        <h3 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-amber-400 text-sm sm:text-base">
                            <Zap className="w-4 h-4 sm:w-5 sm:h-5" /> 집중 모드
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">총 집중 시간</span>
                                <span className="text-sm sm:text-base font-semibold">
                                    {Math.floor(lastWeekReport.focusAnalysis.totalFocusMinutes / 60)}시간 {lastWeekReport.focusAnalysis.totalFocusMinutes % 60}분
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">집중 세션</span>
                                <span className="text-sm sm:text-base font-semibold">{lastWeekReport.focusAnalysis.focusSessions}회</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">평균 세션</span>
                                <span className="text-sm sm:text-base font-semibold">{lastWeekReport.focusAnalysis.avgSessionMinutes}분</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">이탈 횟수</span>
                                <span className={cn(
                                    "text-sm sm:text-base font-semibold",
                                    lastWeekReport.focusAnalysis.totalInterruptions > 5 ? "text-red-400" : "text-green-400"
                                )}>
                                    {lastWeekReport.focusAnalysis.totalInterruptions}회
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {lastWeekReport.sleepAnalysis && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-indigo-500/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-indigo-500/20"
                    >
                        <h3 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-indigo-400 text-sm sm:text-base">
                            <Moon className="w-4 h-4 sm:w-5 sm:h-5" /> 수면 패턴
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">수면 기록</span>
                                <span className="text-sm sm:text-base font-semibold">{lastWeekReport.sleepAnalysis.sleepSessions}회</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">평균 수면</span>
                                <span className={cn(
                                    "text-sm sm:text-base font-semibold",
                                    lastWeekReport.sleepAnalysis.avgSleepHours >= 7 ? "text-green-400" :
                                    lastWeekReport.sleepAnalysis.avgSleepHours >= 6 ? "text-yellow-400" : "text-red-400"
                                )}>
                                    {lastWeekReport.sleepAnalysis.avgSleepHours.toFixed(1)}시간
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">규칙성 점수</span>
                                <span className={cn(
                                    "text-sm sm:text-base font-semibold",
                                    lastWeekReport.sleepAnalysis.sleepConsistencyScore >= 70 ? "text-green-400" :
                                    lastWeekReport.sleepAnalysis.sleepConsistencyScore >= 50 ? "text-yellow-400" : "text-red-400"
                                )}>
                                    {lastWeekReport.sleepAnalysis.sleepConsistencyScore.toFixed(0)}/100
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Insights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {lastWeekReport.insights.achievements?.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-green-500/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-green-500/20"
                    >
                        <h3 className="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-green-400 text-sm sm:text-base">
                            <span>✨</span> 이번 주 성취
                        </h3>
                        <ul className="space-y-1.5 sm:space-y-2">
                            {lastWeekReport.insights.achievements.map((achievement, index) => (
                                <li key={index} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2">
                                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 text-green-500 flex-shrink-0" />
                                    <span>{achievement}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                )}

                {lastWeekReport.insights.recommendations?.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="bg-blue-500/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-blue-500/20"
                    >
                        <h3 className="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-blue-400 text-sm sm:text-base">
                            <span>💡</span> 다음 주 추천
                        </h3>
                        <ul className="space-y-1.5 sm:space-y-2">
                            {lastWeekReport.insights.recommendations.map((recommendation, index) => (
                                <li key={index} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2">
                                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                                    <span>{recommendation}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                )}
            </div>

                    {/* Weekly Activity Overview */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-500/20"
                    >
                        <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
                            <span className="text-lg">📅</span> 이번 주 활동 요약
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white/5 rounded-xl p-4 text-center">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Calendar className="w-5 h-5 text-blue-400" />
                                </div>
                                <p className="text-2xl font-bold">{lastWeekReport.scheduleAnalysis.completedSchedules}</p>
                                <p className="text-xs text-muted-foreground">완료한 일정</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4 text-center">
                                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <BookOpen className="w-5 h-5 text-purple-400" />
                                </div>
                                <p className="text-2xl font-bold">{lastWeekReport.trendBriefingAnalysis.totalRead}</p>
                                <p className="text-xs text-muted-foreground">읽은 브리핑</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4 text-center">
                                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Award className="w-5 h-5 text-green-400" />
                                </div>
                                <p className="text-2xl font-bold">{lastWeekReport.growthMetrics.newHabitsFormed}</p>
                                <p className="text-xs text-muted-foreground">새로운 습관</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4 text-center">
                                <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Clock className="w-5 h-5 text-amber-400" />
                                </div>
                                <p className="text-2xl font-bold">{Math.round(lastWeekReport.growthMetrics.timeInvested / 60)}h</p>
                                <p className="text-xs text-muted-foreground">투자 시간</p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );
}
