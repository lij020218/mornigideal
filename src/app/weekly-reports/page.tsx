"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Calendar, BookOpen, Award, TrendingUp, TrendingDown, Minus, ArrowRight, Loader2, RefreshCw, ChevronLeft, Clock, Crown, Moon, Zap, Flame, Layers } from "lucide-react";
import { WeeklyReportCards } from "@/components/features/dashboard/WeeklyReportCards";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// Donut Chart Component
function DonutChart({
    percentage,
    size = 120,
    strokeWidth = 12,
    color = "rgb(59, 130, 246)",
    label,
    sublabel
}: {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    label?: string;
    sublabel?: string;
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
                {label && <span className="text-xs text-muted-foreground">{label}</span>}
            </div>
        </div>
    );
}

// Bar Chart Component for daily data
function DailyBarChart({
    data,
    maxValue,
    color = "rgb(59, 130, 246)"
}: {
    data: { day: string; value: number; label?: string }[];
    maxValue: number;
    color?: string;
}) {
    return (
        <div className="flex items-end justify-between gap-1 h-32">
            {data.map((item, index) => {
                const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                return (
                    <div key={index} className="flex flex-col items-center gap-1 flex-1">
                        <span className="text-[10px] text-muted-foreground">{item.value}</span>
                        <motion.div
                            className="w-full rounded-t-sm min-h-[4px]"
                            style={{ backgroundColor: color }}
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(height, 4)}%` }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        />
                        <span className="text-[10px] font-medium text-muted-foreground">{item.day}</span>
                    </div>
                );
            })}
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

// Weekly Trend Mini Chart
function WeeklyTrendChart({
    data
}: {
    data: { week: string; value: number }[]
}) {
    if (data.length < 2) return null;

    const maxValue = Math.max(...data.map(d => d.value), 1);
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d.value - minValue) / range) * 80 - 10;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative h-16 w-full">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <motion.polyline
                    fill="none"
                    stroke="rgb(59, 130, 246)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5 }}
                />
                <motion.polygon
                    fill="url(#trendGradient)"
                    points={`0,100 ${points} 100,100`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 1 }}
                />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-muted-foreground">
                {data.map((d, i) => (
                    <span key={i}>{d.week}</span>
                ))}
            </div>
        </div>
    );
}

// Stat Card Component
function StatCard({
    icon,
    iconBg,
    iconColor,
    title,
    value,
    unit,
    change,
    changeLabel,
    children
}: {
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    title: string;
    value: string | number;
    unit?: string;
    change?: number;
    changeLabel?: string;
    children?: React.ReactNode;
}) {
    const getChangeIcon = (val: number) => {
        if (val > 0) return <TrendingUp className="w-3 h-3 text-green-500" />;
        if (val < 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
        return <Minus className="w-3 h-3 text-gray-400" />;
    };

    const getChangeColor = (val: number) => {
        if (val > 0) return 'text-green-500';
        if (val < 0) return 'text-red-500';
        return 'text-gray-400';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-colors"
        >
            <div className="flex items-start justify-between mb-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", iconBg)}>
                    {icon}
                </div>
                {change !== undefined && (
                    <div className={cn("flex items-center gap-1 text-sm", getChangeColor(change))}>
                        {getChangeIcon(change)}
                        <span>{Math.abs(change).toFixed(1)}{changeLabel || '%'}</span>
                    </div>
                )}
            </div>
            <h3 className="text-sm text-muted-foreground mb-1">{title}</h3>
            <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{value}</span>
                {unit && <span className="text-muted-foreground text-sm">{unit}</span>}
            </div>
            {children}
        </motion.div>
    );
}

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

interface ReportHistoryItem {
    id: string;
    date: string;
    weekNumber: number;
    completionRate: number;
    totalRead: number;
    narrative?: string;
    reportData?: WeeklyReportData;
}

const PLAN_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
    standard: { label: "Standard", color: "text-slate-400", bgColor: "bg-slate-500/20" },
    pro: { label: "Pro", color: "text-blue-400", bgColor: "bg-blue-500/20" },
    max: { label: "Max", color: "text-amber-400", bgColor: "bg-amber-500/20" },
};

const PLAN_LIMITS_TEXT: Record<string, string> = {
    standard: "최근 3개월",
    pro: "최근 6개월",
    max: "최근 1년",
};

export default function WeeklyReportsPage() {
    const [currentReport, setCurrentReport] = useState<WeeklyReportData | null>(null);
    const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
    const [selectedHistoryReport, setSelectedHistoryReport] = useState<ReportHistoryItem | null>(null);
    const [userPlan, setUserPlan] = useState<string>("standard");
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCards, setShowCards] = useState(false);

    useEffect(() => {
        fetchReport();
        fetchHistory();
    }, []);

    const fetchReport = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await fetch('/api/weekly-report');
            if (response.ok) {
                const data = await response.json();
                setCurrentReport(data.report);
            }
        } catch (error) {
            console.error('Failed to fetch weekly report:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const response = await fetch('/api/weekly-report/history');
            if (response.ok) {
                const data = await response.json();
                setReportHistory(data.reports || []);
                setUserPlan(data.plan || 'standard');
            }
        } catch (error) {
            console.error('Failed to fetch weekly report history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleSelectHistoryReport = (report: ReportHistoryItem) => {
        if (report.reportData) {
            setSelectedHistoryReport(report);
            setCurrentReport({
                ...report.reportData,
                narrative: report.narrative,
            });
        }
    };

    const handleBackToCurrent = async () => {
        setSelectedHistoryReport(null);
        await fetchReport();
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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">주간 리포트를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            {selectedHistoryReport ? (
                                <button
                                    onClick={handleBackToCurrent}
                                    className="flex items-center gap-1.5 text-blue-100 hover:text-white transition-colors mb-2"
                                >
                                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-xs sm:text-sm">현재 주로 돌아가기</span>
                                </button>
                            ) : null}
                            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                                <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" />
                                <h1 className="text-lg sm:text-2xl font-bold truncate">
                                    {selectedHistoryReport ? "과거 주간 리포트" : "주간 성장 리포트"}
                                </h1>
                            </div>
                            {currentReport && (
                                <p className="text-blue-100 text-xs sm:text-sm">
                                    {formatDate(currentReport.period.start)} - {formatDate(currentReport.period.end)} (Week {currentReport.period.weekNumber})
                                </p>
                            )}
                        </div>
                        {!selectedHistoryReport && (
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setShowCards(true)}
                                    className="bg-white/20 hover:bg-white/30 text-white border-0 flex-shrink-0 px-2 sm:px-3"
                                >
                                    <Layers className="w-4 h-4" />
                                    <span className="hidden sm:inline ml-2">카드뉴스</span>
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => fetchReport(true)}
                                    disabled={refreshing}
                                    className="bg-white/20 hover:bg-white/30 text-white border-0 flex-shrink-0 px-2 sm:px-3"
                                >
                                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                    <span className="hidden sm:inline ml-2">새로고침</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
                {currentReport ? (
                    <>
                        {/* AI Narrative */}
                        {currentReport.narrative && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-500/20"
                            >
                                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                                    <FieriLogo className="w-6 h-6 sm:w-7 sm:h-7" /> Fi.eri 주간 분석
                                </h2>
                                <div className="prose prose-sm prose-invert max-w-none text-sm sm:text-base">
                                    <ReactMarkdown>{currentReport.narrative}</ReactMarkdown>
                                </div>
                            </motion.div>
                        )}

                        {/* Key Metrics with Visual Charts */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            {/* Schedule Completion with Donut Chart */}
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
                                            {getChangeIcon(currentReport.comparisonWithLastWeek.completionRateChange)}
                                            <span className={`text-xs font-medium ${getChangeColor(currentReport.comparisonWithLastWeek.completionRateChange)}`}>
                                                {Math.abs(currentReport.comparisonWithLastWeek.completionRateChange).toFixed(1)}%p
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-center mb-3">
                                    <DonutChart
                                        percentage={currentReport.scheduleAnalysis.completionRate}
                                        size={100}
                                        strokeWidth={10}
                                        color="rgb(59, 130, 246)"
                                    />
                                </div>
                                <p className="text-xs sm:text-sm text-muted-foreground text-center">
                                    {currentReport.scheduleAnalysis.completedSchedules} / {currentReport.scheduleAnalysis.totalSchedules} 일정 완료
                                </p>
                            </motion.div>

                            {/* Reading with Fire Streak */}
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
                                            {getChangeIcon(currentReport.comparisonWithLastWeek.readingChange)}
                                            <span className={`text-xs font-medium ${getChangeColor(currentReport.comparisonWithLastWeek.readingChange)}`}>
                                                {Math.abs(currentReport.comparisonWithLastWeek.readingChange).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center gap-6 mb-3">
                                    <div className="text-center">
                                        <span className="text-4xl font-bold">{currentReport.trendBriefingAnalysis.totalRead}</span>
                                        <p className="text-xs text-muted-foreground">읽은 브리핑</p>
                                    </div>
                                    <div className="h-12 w-px bg-white/10" />
                                    <div className="text-center">
                                        <div className="flex items-center gap-1">
                                            <Flame className="w-5 h-5 text-orange-500" />
                                            <span className="text-2xl font-bold text-orange-500">
                                                {currentReport.trendBriefingAnalysis.readingStreak}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">연속 학습</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    하루 평균 {currentReport.trendBriefingAnalysis.avgReadPerDay.toFixed(1)}개 읽음
                                </p>
                            </motion.div>

                            {/* Consistency with Visual Score */}
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
                                        percentage={currentReport.growthMetrics.consistencyScore}
                                        size={100}
                                        strokeWidth={10}
                                        color={
                                            currentReport.growthMetrics.consistencyScore >= 70 ? "rgb(34, 197, 94)" :
                                            currentReport.growthMetrics.consistencyScore >= 40 ? "rgb(234, 179, 8)" :
                                            "rgb(239, 68, 68)"
                                        }
                                    />
                                </div>
                                <p className="text-xs sm:text-sm text-muted-foreground text-center">
                                    {currentReport.growthMetrics.consistencyScore >= 70 ? "훌륭해요! 꾸준히 성장하고 있어요" :
                                     currentReport.growthMetrics.consistencyScore >= 40 ? "조금 더 꾸준히 해보세요" :
                                     "규칙적인 습관을 만들어보세요"}
                                </p>
                            </motion.div>
                        </div>

                        {/* Category Breakdown - Visual Pie-style */}
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
                                {/* Visual Horizontal Bars */}
                                <div className="space-y-4">
                                    {Object.entries(currentReport.scheduleAnalysis.categoryBreakdown).map(([category, count]) => {
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
                                                maxValue={currentReport.scheduleAnalysis.totalSchedules}
                                                color={colorMap[category] || 'rgb(107, 114, 128)'}
                                                icon={iconMap[category]}
                                            />
                                        );
                                    })}
                                </div>

                                {/* Summary Stats */}
                                <div className="flex flex-col justify-center items-center gap-4 p-4 bg-white/5 rounded-xl">
                                    <div className="text-center">
                                        <p className="text-3xl font-bold">{currentReport.scheduleAnalysis.totalSchedules}</p>
                                        <p className="text-sm text-muted-foreground">총 일정</p>
                                    </div>
                                    <div className="w-full h-px bg-white/10" />
                                    <div className="text-center">
                                        <p className="text-xl font-semibold">{currentReport.scheduleAnalysis.avgSchedulesPerDay.toFixed(1)}</p>
                                        <p className="text-sm text-muted-foreground">일 평균 일정</p>
                                    </div>
                                    <div className="w-full h-px bg-white/10" />
                                    <div className="text-center">
                                        <p className="text-lg font-medium text-blue-400">
                                            {currentReport.scheduleAnalysis.mostProductiveDay || '-'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">가장 생산적인 날</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Focus & Sleep Analysis */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {/* Focus Mode Analysis */}
                            {currentReport.focusAnalysis && (
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
                                                {Math.floor(currentReport.focusAnalysis.totalFocusMinutes / 60)}시간 {currentReport.focusAnalysis.totalFocusMinutes % 60}분
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs sm:text-sm text-muted-foreground">집중 세션</span>
                                            <span className="text-sm sm:text-base font-semibold">{currentReport.focusAnalysis.focusSessions}회</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs sm:text-sm text-muted-foreground">평균 세션</span>
                                            <span className="text-sm sm:text-base font-semibold">{currentReport.focusAnalysis.avgSessionMinutes}분</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs sm:text-sm text-muted-foreground">이탈 횟수</span>
                                            <span className={cn(
                                                "text-sm sm:text-base font-semibold",
                                                currentReport.focusAnalysis.totalInterruptions > 5 ? "text-red-400" : "text-green-400"
                                            )}>
                                                {currentReport.focusAnalysis.totalInterruptions}회
                                            </span>
                                        </div>
                                        {currentReport.focusAnalysis.mostFocusedDay !== 'N/A' && (
                                            <div className="pt-2 border-t border-amber-500/20">
                                                <p className="text-xs text-muted-foreground">가장 집중한 날</p>
                                                <p className="text-sm font-medium">{currentReport.focusAnalysis.mostFocusedDay}</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* Sleep Analysis */}
                            {currentReport.sleepAnalysis && (
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
                                            <span className="text-sm sm:text-base font-semibold">{currentReport.sleepAnalysis.sleepSessions}회</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs sm:text-sm text-muted-foreground">평균 수면</span>
                                            <span className={cn(
                                                "text-sm sm:text-base font-semibold",
                                                currentReport.sleepAnalysis.avgSleepHours >= 7 ? "text-green-400" :
                                                currentReport.sleepAnalysis.avgSleepHours >= 6 ? "text-yellow-400" : "text-red-400"
                                            )}>
                                                {currentReport.sleepAnalysis.avgSleepHours.toFixed(1)}시간
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs sm:text-sm text-muted-foreground">취침 시간대</span>
                                            <span className="text-sm sm:text-base font-semibold">
                                                {currentReport.sleepAnalysis.earliestSleep !== 'N/A'
                                                    ? `${currentReport.sleepAnalysis.earliestSleep} ~ ${currentReport.sleepAnalysis.latestSleep}`
                                                    : '-'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs sm:text-sm text-muted-foreground">규칙성 점수</span>
                                            <span className={cn(
                                                "text-sm sm:text-base font-semibold",
                                                currentReport.sleepAnalysis.sleepConsistencyScore >= 70 ? "text-green-400" :
                                                currentReport.sleepAnalysis.sleepConsistencyScore >= 50 ? "text-yellow-400" : "text-red-400"
                                            )}>
                                                {currentReport.sleepAnalysis.sleepConsistencyScore.toFixed(0)}/100
                                            </span>
                                        </div>
                                        {/* Sleep consistency progress bar */}
                                        <div className="pt-2">
                                            <div className="w-full bg-white/10 rounded-full h-1.5 sm:h-2">
                                                <div
                                                    className={cn(
                                                        "h-1.5 sm:h-2 rounded-full transition-all",
                                                        currentReport.sleepAnalysis.sleepConsistencyScore >= 70 ? "bg-green-500" :
                                                        currentReport.sleepAnalysis.sleepConsistencyScore >= 50 ? "bg-yellow-500" : "bg-red-500"
                                                    )}
                                                    style={{ width: `${currentReport.sleepAnalysis.sleepConsistencyScore}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Insights Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {/* Achievements */}
                            {currentReport.insights.achievements?.length > 0 && (
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
                                        {currentReport.insights.achievements.map((achievement, index) => (
                                            <li key={index} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2">
                                                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 text-green-500 flex-shrink-0" />
                                                <span>{achievement}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            )}

                            {/* Recommendations */}
                            {currentReport.insights.recommendations?.length > 0 && (
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
                                        {currentReport.insights.recommendations.map((recommendation, index) => (
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
                                    <p className="text-2xl font-bold">{currentReport.scheduleAnalysis.completedSchedules}</p>
                                    <p className="text-xs text-muted-foreground">완료한 일정</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <BookOpen className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <p className="text-2xl font-bold">{currentReport.trendBriefingAnalysis.totalRead}</p>
                                    <p className="text-xs text-muted-foreground">읽은 브리핑</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Award className="w-5 h-5 text-green-400" />
                                    </div>
                                    <p className="text-2xl font-bold">{currentReport.growthMetrics.newHabitsFormed}</p>
                                    <p className="text-xs text-muted-foreground">새로운 습관</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Clock className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <p className="text-2xl font-bold">{Math.round(currentReport.growthMetrics.timeInvested / 60)}h</p>
                                    <p className="text-xs text-muted-foreground">투자 시간</p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Report History Section */}
                        {!selectedHistoryReport && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                                className="bg-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                                    <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                                        지난 리포트 히스토리
                                    </h3>
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium w-fit",
                                        PLAN_LABELS[userPlan]?.bgColor || PLAN_LABELS.standard.bgColor,
                                        PLAN_LABELS[userPlan]?.color || PLAN_LABELS.standard.color
                                    )}>
                                        <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                        {PLAN_LABELS[userPlan]?.label || "Standard"} · {PLAN_LIMITS_TEXT[userPlan] || "최근 3개월"}
                                    </div>
                                </div>

                                {historyLoading ? (
                                    <div className="flex items-center justify-center py-6 sm:py-8">
                                        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : reportHistory.length === 0 ? (
                                    <div className="text-center py-6 sm:py-8 text-muted-foreground">
                                        <Clock className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm sm:text-base">아직 저장된 주간 리포트가 없습니다</p>
                                        <p className="text-xs sm:text-sm mt-1">매주 일요일 저녁에 리포트가 자동 생성됩니다</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {reportHistory.map((report) => {
                                            const reportDate = new Date(report.date);
                                            const isCurrentWeek = report.reportData?.period.weekNumber === currentReport?.period.weekNumber;

                                            return (
                                                <button
                                                    key={report.id}
                                                    onClick={() => !isCurrentWeek && handleSelectHistoryReport(report)}
                                                    disabled={isCurrentWeek}
                                                    className={cn(
                                                        "w-full flex items-center justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all",
                                                        isCurrentWeek
                                                            ? "bg-primary/10 border border-primary/30 cursor-default"
                                                            : "bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 sm:gap-4">
                                                        <div className="text-left">
                                                            <p className="font-medium text-sm sm:text-base">
                                                                Week {report.weekNumber}
                                                                {isCurrentWeek && (
                                                                    <span className="ml-1.5 sm:ml-2 text-[10px] sm:text-xs text-primary">(현재)</span>
                                                                )}
                                                            </p>
                                                            <p className="text-xs sm:text-sm text-muted-foreground">
                                                                {reportDate.toLocaleDateString('ko-KR', {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 sm:gap-4">
                                                        <div className="text-right">
                                                            <p className="text-xs sm:text-sm">
                                                                <span className="text-muted-foreground hidden sm:inline">완료율</span>{" "}
                                                                <span className="font-medium">{report.completionRate?.toFixed(0) || 0}%</span>
                                                            </p>
                                                            <p className="text-xs sm:text-sm">
                                                                <span className="text-muted-foreground hidden sm:inline">읽은 브리핑</span>{" "}
                                                                <span className="font-medium">{report.totalRead || 0}개</span>
                                                            </p>
                                                        </div>
                                                        {!isCurrentWeek && (
                                                            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 sm:py-20 px-4">
                        <BarChart3 className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                        <h2 className="text-lg sm:text-xl font-semibold mb-2">리포트를 불러올 수 없습니다</h2>
                        <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                            잠시 후 다시 시도해주세요.
                        </p>
                        <Button onClick={() => fetchReport()} size="sm" className="sm:size-default">
                            다시 시도
                        </Button>
                    </div>
                )}
            </div>

            {/* Card News Modal */}
            <WeeklyReportCards
                isOpen={showCards}
                onClose={() => setShowCards(false)}
                reportData={currentReport}
            />
        </div>
    );
}
