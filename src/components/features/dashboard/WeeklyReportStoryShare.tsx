"use client";

import { useState, useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, Download, Share2, ChevronLeft, ChevronRight,
    Calendar, BookOpen, Award, Flame, Target, TrendingUp, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================
// Fieri Logo (SVG inline for image capture)
// ============================================

const FieriLogo = ({ className = "" }: { className?: string }) => (
    <svg viewBox="0 0 1024 1024" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="#FDD7A7" d="M523.997498,653.945618 C528.388672,653.329346 532.779907,652.713013 537.750366,652.292419 C538.881531,652.271362 539.433472,652.054688 539.985413,651.838013 C540.406616,651.830505 540.827881,651.822998 541.912720,651.852661 C543.446411,651.342712 544.316467,650.795532 545.186462,650.248352 C555.374451,647.371582 565.861145,645.266846 575.690491,641.463196 C598.774475,632.530640 619.020569,618.929077 636.281677,601.162415 C648.263733,588.829346 658.432495,575.090271 666.007874,559.551270 C666.420288,558.705261 667.026672,557.953796 668.502197,557.285217 C668.502197,558.540161 668.714478,559.838135 668.470459,561.043701 C664.507629,580.623047 655.469055,597.935059 644.178284,614.125916 C618.600952,650.803650 584.596863,675.800232 541.063782,687.013367 C530.524475,689.728088 519.630188,691.064148 508.304321,692.805786 C507.138153,692.738220 506.566772,692.898987 505.995392,693.059753 C503.589661,693.317444 501.183929,693.575195 498.070679,693.587646 C491.912994,693.518860 486.462799,693.695251 481.012604,693.871704 C450.400208,692.652466 421.512512,684.577026 393.602448,672.289368 C359.801880,657.408508 331.161499,635.421631 306.879181,608.004089 C275.857605,572.977051 255.236130,532.357483 246.175018,486.287781 C243.917679,474.810760 243.133118,463.011169 242.221878,451.316925 C241.799973,445.902740 242.698868,440.385651 243.219055,434.309875 C243.292816,433.136383 243.146515,432.568176 243.000214,432.000000 C244.336960,426.729156 245.193604,421.269562 247.167740,416.249359 C248.652237,412.474243 251.968246,409.992279 256.573853,409.997620 C261.197296,410.002991 264.348541,412.579010 265.951782,416.322235 C268.358826,421.942230 270.401337,427.810394 271.782166,433.762543 C279.275421,466.062256 288.269745,497.875641 303.789429,527.361938 C317.585419,553.573425 334.553253,577.690186 356.950867,597.272278 C388.988617,625.282654 425.814819,643.978088 468.102478,651.100525 C474.099121,652.110535 480.107941,653.047974 486.791321,654.271362 C488.983215,654.385864 490.494934,654.248047 492.006622,654.110229 C501.718628,654.098572 511.430634,654.086914 521.731323,654.277344 C522.879150,654.301453 523.438354,654.123535 523.997498,653.945618z" />
        <path fill="#FDD7A7" d="M782.758118,474.121368 C784.582764,481.800323 786.437134,489.472412 788.211365,497.162994 C788.652649,499.076141 788.834656,501.049072 789.122559,503.727844 C789.406982,504.974548 789.704712,505.487885 790.002441,506.001221 C790.635742,510.393921 791.269043,514.786621 791.671753,519.790771 C791.628723,521.268188 791.816223,522.134094 792.003784,523.000000 C793.606323,535.962463 793.561035,548.835327 790.069031,561.549683 C788.679443,566.609436 786.640503,571.077209 780.721069,571.898804 C775.705322,572.594849 770.815613,569.704895 768.474915,563.517639 C765.248474,554.989258 762.608826,546.213013 760.166565,537.418396 C751.915527,507.706421 742.018921,478.622437 727.229675,451.448639 C718.073364,434.624695 707.147766,419.039032 694.417236,404.612366 C676.013367,383.756470 654.501709,367.032318 629.817749,354.487183 C608.641113,343.724518 586.135559,336.934998 562.504211,333.883820 C541.093506,331.119354 519.861206,331.565582 498.587006,335.453522 C480.959686,338.674957 464.042633,343.985138 447.949829,351.652130 C433.811829,358.387848 420.933960,367.220917 408.930267,377.372040 C392.049286,391.647644 379.107971,408.977295 368.365997,428.113403 C368.068420,428.643524 367.636383,429.098175 366.545563,429.343018 C366.770355,428.204132 366.886780,427.030792 367.235901,425.931396 C374.671234,402.519043 386.250610,381.442291 401.913361,362.445129 C419.885590,340.646851 441.473236,323.734253 466.920563,311.545624 C484.311371,303.215881 502.559540,298.423126 521.651978,295.843658 C536.566345,293.828583 551.435486,294.325470 566.242798,295.131470 C601.077515,297.027557 633.074951,308.646942 663.270081,325.637634 C685.910583,338.377319 705.899780,354.498138 723.716309,373.350220 C744.136169,394.957001 760.113037,419.538025 772.155701,446.657990 C775.242798,453.609924 777.454163,460.950684 780.090454,468.857056 C780.994751,471.108002 781.876465,472.614685 782.758118,474.121368z" />
        <path fill="#FDD6A7" d="M684.148560,490.912598 C678.114746,424.145813 645.535156,375.639038 584.250488,346.877502 C584.536438,346.439819 584.822388,346.002167 585.108337,345.564514 C594.010010,348.551239 603.222046,350.842499 611.757263,354.650635 C641.485962,367.914673 667.251709,386.471436 687.866211,412.078217 C701.956238,429.580444 712.849731,448.701813 718.660339,470.284546 C722.413208,484.224091 725.517517,498.356995 726.242188,513.068054 C728.058105,549.933655 719.173828,584.248169 702.839050,616.755493 C689.043091,644.210388 669.795288,667.561584 646.756592,688.008606 C628.576843,704.143311 608.635315,717.597412 587.134521,728.509949 C573.898560,735.227661 559.688965,740.274841 545.517517,744.830627 C531.854492,749.222839 517.844910,753.254578 503.680237,755.162231 C490.162659,756.982727 476.244476,756.114868 462.511353,755.887634 C457.950226,755.812073 454.280975,752.595581 453.232849,748.041443 C452.125763,743.231140 455.416687,740.098206 459.367462,738.267578 C465.375641,735.483643 471.460358,732.686035 477.780396,730.784241 C508.794739,721.451599 538.666809,709.312073 566.851562,693.430176 C586.698059,682.246704 605.062988,668.851746 621.745605,653.100403 C639.114929,636.700745 653.349243,618.064514 663.994812,596.828796 C673.789856,577.289673 681.021912,556.791565 683.054810,534.782043 C683.328003,531.824707 683.696167,528.876282 684.345642,525.413940 C684.790161,523.936096 684.909424,522.968079 685.028687,522.000000 C685.029480,512.978577 685.030212,503.957153 685.275024,494.265991 C685.062317,492.701691 684.605469,491.807129 684.148560,490.912598z" />
        <path fill="#FDD7A7" d="M310.121490,441.009613 C310.386932,439.581207 310.652405,438.152802 311.217926,436.172638 C311.608612,435.023834 311.699249,434.426758 311.789886,433.829712 C311.831543,433.123596 311.873199,432.417511 312.156219,431.226044 C312.314209,430.164703 312.230804,429.588745 312.147400,429.012756 C312.161774,428.593536 312.176147,428.174316 312.522003,427.345032 C313.169891,426.235046 313.486298,425.535095 313.802673,424.835144 C313.904846,423.521576 314.007019,422.208008 314.491760,420.389954 C315.508728,417.863770 316.143066,415.842133 316.777405,413.820465 C316.899658,412.515717 317.021881,411.210968 317.493256,409.421387 C318.175964,408.244598 318.509521,407.552643 318.843079,406.860718 C318.843079,406.860718 318.886597,406.413330 319.148315,406.079681 C319.536560,405.449890 319.663025,405.153778 319.789520,404.857635 C323.867371,389.409454 331.401825,375.553680 339.697174,362.082886 C350.725739,344.173523 363.803253,327.800232 378.746185,313.063843 C400.262268,291.845215 424.097931,273.664673 450.938049,259.476959 C471.332855,248.696213 492.374176,239.805511 515.135132,235.631516 C521.775269,234.413803 528.654785,234.295547 535.435974,234.126282 C539.827271,234.016693 543.801880,235.805359 545.398804,240.245895 C547.029297,244.779800 544.886475,248.654785 541.236938,251.066208 C535.150269,255.087860 528.837891,258.837402 522.344238,262.161682 C490.892487,278.262726 460.461975,296.031097 433.165558,318.592682 C409.958618,337.774200 389.519562,359.660980 375.383728,386.496216 C368.543152,399.482330 363.635803,413.486786 357.498413,427.546356 C356.499054,429.745636 355.854492,431.428741 355.209930,433.111816 C354.748688,436.068390 354.287415,439.024994 353.528564,442.481812 C353.128296,443.656067 353.025696,444.330109 352.923096,445.004150 C351.964417,450.719116 351.005737,456.434113 349.795227,462.756256 C349.670349,464.243927 349.797333,465.124420 349.924286,466.004913 C349.680786,475.985291 349.437256,485.965698 349.171204,496.706177 C349.423889,497.978271 349.699127,498.490265 349.974335,499.002258 C351.764923,525.006165 360.344604,548.908875 373.514191,571.083862 C390.426575,599.560852 414.361755,620.639648 444.103729,635.159119 C445.235840,635.711853 446.267303,636.470703 447.345673,637.133423 C447.169952,637.563843 446.994263,637.994263 446.818542,638.424683 C437.836517,635.231079 428.593903,632.618164 419.924500,628.727905 C399.328156,619.485657 380.641876,607.317749 364.085052,591.738586 C334.632538,564.025208 315.440796,530.870056 310.196106,490.559692 C308.455658,477.182831 309.327271,463.466095 309.263550,449.260315 C309.613495,448.021942 309.704620,447.428040 309.795715,446.834137 C309.845306,445.812927 309.894867,444.791748 310.177917,443.250366 C310.314789,442.156677 310.218140,441.583160 310.121490,441.009613z" />
    </svg>
);

// ============================================
// Static Donut (no animation — for image capture)
// ============================================

function StoryDonut({
    percentage,
    size = 160,
    strokeWidth = 14,
    color = "white",
    bgColor = "rgba(255,255,255,0.2)",
}: {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    bgColor?: string;
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
                <circle
                    cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold">{percentage.toFixed(0)}%</span>
            </div>
        </div>
    );
}

// ============================================
// Static Category Bar (no animation)
// ============================================

function StoryCategoryBar({
    label, icon, value, maxValue, color,
}: {
    label: string; icon: string; value: number; maxValue: number; color: string;
}) {
    const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 w-20 shrink-0">
                <span className="text-xl">{icon}</span>
                <span className="text-sm font-semibold">{label}</span>
            </div>
            <div className="flex-1">
                <div className="h-7 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full flex items-center justify-end pr-3"
                        style={{ backgroundColor: color, width: `${Math.max(pct, 15)}%` }}
                    >
                        <span className="text-white font-bold text-xs">{value}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================
// Types
// ============================================

interface WeeklyReportData {
    period: { start: string; end: string; weekNumber: number };
    scheduleAnalysis: {
        totalSchedules: number;
        completedSchedules: number;
        completionRate: number;
        categoryBreakdown: {
            work: number; learning: number; exercise: number; wellness: number; other: number;
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
}

interface WeeklyReportStoryShareProps {
    isOpen: boolean;
    onClose: () => void;
    reportData: WeeklyReportData | null;
}

// ============================================
// Story Templates (9:16 ratio)
// ============================================

type TemplateKey = "summary" | "completion" | "category" | "growth";

const TEMPLATES: { key: TemplateKey; label: string }[] = [
    { key: "summary", label: "종합 요약" },
    { key: "completion", label: "완료율" },
    { key: "category", label: "활동 분석" },
    { key: "growth", label: "성장 점수" },
];

function formatDateShort(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function getScoreEmoji(score: number): string {
    if (score >= 80) return "S";
    if (score >= 60) return "A";
    if (score >= 40) return "B";
    return "C";
}

function getScoreColor(score: number): string {
    if (score >= 70) return "rgb(34, 197, 94)";
    if (score >= 40) return "rgb(234, 179, 8)";
    return "rgb(239, 68, 68)";
}

// ============================================
// Main Component
// ============================================

export function WeeklyReportStoryShare({ isOpen, onClose, reportData }: WeeklyReportStoryShareProps) {
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>("summary");
    const [isGenerating, setIsGenerating] = useState(false);
    const storyRef = useRef<HTMLDivElement>(null);

    const handleDownload = useCallback(async () => {
        if (!storyRef.current) return;
        setIsGenerating(true);

        try {
            const dataUrl = await toPng(storyRef.current, {
                width: 1080,
                height: 1920,
                pixelRatio: 1,
                cacheBust: true,
                style: {
                    transform: "scale(1)",
                    transformOrigin: "top left",
                },
            });

            const link = document.createElement("a");
            link.download = `fieri-weekly-report-week${reportData?.period.weekNumber || ""}.png`;
            link.href = dataUrl;
            link.click();
            toast.success("이미지가 저장되었어요! 인스타 스토리에 올려보세요");
        } catch (err) {
            console.error("Story image generation failed:", err);
            toast.error("이미지 생성에 실패했어요");
        } finally {
            setIsGenerating(false);
        }
    }, [reportData]);

    const handleShare = useCallback(async () => {
        if (!storyRef.current) return;
        if (!navigator.share) {
            handleDownload();
            return;
        }
        setIsGenerating(true);

        try {
            const dataUrl = await toPng(storyRef.current, {
                width: 1080,
                height: 1920,
                pixelRatio: 1,
                cacheBust: true,
            });

            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], "fieri-weekly-report.png", { type: "image/png" });

            await navigator.share({
                files: [file],
                title: "Fi.eri 주간 리포트",
                text: `Week ${reportData?.period.weekNumber} 주간 리포트`,
            });
        } catch (err: any) {
            if (err?.name !== "AbortError") {
                console.error("Share failed:", err);
                handleDownload();
            }
        } finally {
            setIsGenerating(false);
        }
    }, [reportData, handleDownload]);

    if (!reportData) return null;

    const { scheduleAnalysis: sa, trendBriefingAnalysis: ta, growthMetrics: gm, comparisonWithLastWeek: cmp } = reportData;

    // ============================================
    // Template Renderers
    // ============================================

    const renderSummaryTemplate = () => (
        <div className="w-[1080px] h-[1920px] bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white flex flex-col relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-[-120px] right-[-80px] w-[400px] h-[400px] rounded-full bg-blue-500/10" />
            <div className="absolute bottom-[-100px] left-[-60px] w-[350px] h-[350px] rounded-full bg-purple-500/10" />

            {/* Header */}
            <div className="flex items-center gap-6 px-16 pt-20">
                <FieriLogo className="w-20 h-20" />
                <div>
                    <p className="text-3xl font-bold tracking-tight">Fi.eri</p>
                    <p className="text-lg text-white/60">AI Personal Growth OS</p>
                </div>
            </div>

            {/* Title */}
            <div className="px-16 mt-16">
                <p className="text-2xl text-blue-300 font-medium">Week {reportData.period.weekNumber}</p>
                <h1 className="text-6xl font-black mt-2">주간 리포트</h1>
                <p className="text-xl text-white/60 mt-3">
                    {formatDateShort(reportData.period.start)} ~ {formatDateShort(reportData.period.end)}
                </p>
            </div>

            {/* Main Stats */}
            <div className="px-16 mt-20 grid grid-cols-2 gap-8">
                {/* Completion Rate */}
                <div className="bg-white/5 backdrop-blur rounded-3xl p-10 border border-white/10 flex flex-col items-center">
                    <Calendar className="w-10 h-10 text-blue-400 mb-4" />
                    <p className="text-lg text-white/60 mb-2">일정 완료율</p>
                    <p className="text-7xl font-black text-blue-400">{sa.completionRate.toFixed(0)}%</p>
                    <p className="text-base text-white/40 mt-2">{sa.completedSchedules}/{sa.totalSchedules}개 완료</p>
                </div>

                {/* Consistency */}
                <div className="bg-white/5 backdrop-blur rounded-3xl p-10 border border-white/10 flex flex-col items-center">
                    <Award className="w-10 h-10 text-purple-400 mb-4" />
                    <p className="text-lg text-white/60 mb-2">일관성 점수</p>
                    <p className="text-7xl font-black" style={{ color: getScoreColor(gm.consistencyScore) }}>
                        {getScoreEmoji(gm.consistencyScore)}
                    </p>
                    <p className="text-base text-white/40 mt-2">{gm.consistencyScore.toFixed(0)}점</p>
                </div>
            </div>

            {/* Secondary Stats Row */}
            <div className="px-16 mt-8 grid grid-cols-3 gap-6">
                <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center">
                    <BookOpen className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                    <p className="text-4xl font-bold">{ta.totalRead}</p>
                    <p className="text-sm text-white/50 mt-1">브리핑 읽기</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center">
                    <Flame className="w-8 h-8 text-orange-400 mx-auto mb-3" />
                    <p className="text-4xl font-bold">{ta.readingStreak}일</p>
                    <p className="text-sm text-white/50 mt-1">연속 학습</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center">
                    <Clock className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                    <p className="text-4xl font-bold">{Math.round(gm.timeInvested / 60)}h</p>
                    <p className="text-sm text-white/50 mt-1">투자 시간</p>
                </div>
            </div>

            {/* Week-over-week changes */}
            <div className="px-16 mt-10 flex gap-6">
                {[
                    { label: "일정", value: cmp.scheduleChange },
                    { label: "완료율", value: cmp.completionRateChange },
                    { label: "읽기", value: cmp.readingChange },
                ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 bg-white/5 rounded-full px-6 py-3 border border-white/10">
                        <span className="text-sm text-white/60">{item.label}</span>
                        <span className={cn(
                            "text-lg font-bold",
                            item.value > 0 ? "text-emerald-400" : item.value < 0 ? "text-red-400" : "text-white/40"
                        )}>
                            {item.value > 0 ? "+" : ""}{item.value.toFixed(0)}%
                        </span>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="mt-auto px-16 pb-16 flex items-center justify-between">
                <p className="text-base text-white/30">fieri.app</p>
                <FieriLogo className="w-12 h-12 opacity-30" />
            </div>
        </div>
    );

    const renderCompletionTemplate = () => (
        <div className="w-[1080px] h-[1920px] bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 text-white flex flex-col items-center relative overflow-hidden">
            {/* Decorative */}
            <div className="absolute top-[200px] left-[-150px] w-[500px] h-[500px] rounded-full bg-white/5" />
            <div className="absolute bottom-[300px] right-[-100px] w-[400px] h-[400px] rounded-full bg-white/5" />

            {/* Header */}
            <div className="flex items-center gap-4 pt-20">
                <FieriLogo className="w-16 h-16" />
                <p className="text-2xl font-bold">Fi.eri</p>
            </div>

            <p className="text-xl text-white/70 mt-6">Week {reportData.period.weekNumber}</p>
            <h1 className="text-5xl font-black mt-4">일정 완료율</h1>

            {/* Big donut */}
            <div className="mt-20">
                <StoryDonut percentage={sa.completionRate} size={360} strokeWidth={28} />
            </div>

            {/* Stats */}
            <div className="mt-16 flex gap-16">
                <div className="text-center">
                    <p className="text-7xl font-black">{sa.completedSchedules}</p>
                    <p className="text-xl text-white/70">완료</p>
                </div>
                <div className="w-px h-24 bg-white/30 self-center" />
                <div className="text-center">
                    <p className="text-7xl font-black">{sa.totalSchedules}</p>
                    <p className="text-xl text-white/70">전체</p>
                </div>
            </div>

            {/* Change badge */}
            <div className="mt-16 bg-white/15 backdrop-blur rounded-full px-10 py-5 border border-white/20">
                <p className="text-2xl font-bold">
                    지난 주 대비{" "}
                    <span className={cmp.completionRateChange >= 0 ? "text-green-200" : "text-red-200"}>
                        {cmp.completionRateChange >= 0 ? "+" : ""}{cmp.completionRateChange.toFixed(0)}%p
                    </span>
                </p>
            </div>

            {/* Productive day */}
            {sa.mostProductiveDay && sa.mostProductiveDay !== "N/A" && (
                <div className="mt-10 text-center">
                    <p className="text-lg text-white/50">가장 생산적인 날</p>
                    <p className="text-2xl font-bold mt-1">
                        {new Date(sa.mostProductiveDay).toLocaleDateString("ko-KR", { weekday: "long" })}
                    </p>
                </div>
            )}

            {/* Footer */}
            <div className="mt-auto pb-16 flex flex-col items-center">
                <FieriLogo className="w-14 h-14 opacity-30" />
                <p className="text-base text-white/30 mt-3">fieri.app</p>
            </div>
        </div>
    );

    const renderCategoryTemplate = () => {
        const maxCat = Math.max(sa.categoryBreakdown.work, sa.categoryBreakdown.learning, sa.categoryBreakdown.exercise, sa.categoryBreakdown.wellness, sa.categoryBreakdown.other, 1);
        return (
            <div className="w-[1080px] h-[1920px] bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-500 text-white flex flex-col relative overflow-hidden">
                <div className="absolute top-[-80px] right-[-60px] w-[350px] h-[350px] rounded-full bg-white/5" />

                {/* Header */}
                <div className="flex items-center gap-4 px-16 pt-20">
                    <FieriLogo className="w-16 h-16" />
                    <p className="text-2xl font-bold">Fi.eri</p>
                </div>

                <div className="px-16 mt-12">
                    <p className="text-xl text-white/70">Week {reportData.period.weekNumber}</p>
                    <h1 className="text-5xl font-black mt-3">활동 분석</h1>
                    <p className="text-xl text-white/60 mt-2">
                        {formatDateShort(reportData.period.start)} ~ {formatDateShort(reportData.period.end)}
                    </p>
                </div>

                {/* Category Bars */}
                <div className="px-16 mt-20 space-y-8">
                    {[
                        { label: "업무", icon: "💼", value: sa.categoryBreakdown.work, color: "rgba(59, 130, 246, 0.9)" },
                        { label: "학습", icon: "📚", value: sa.categoryBreakdown.learning, color: "rgba(168, 85, 247, 0.9)" },
                        { label: "운동", icon: "💪", value: sa.categoryBreakdown.exercise, color: "rgba(239, 68, 68, 0.9)" },
                        { label: "웰빙", icon: "🧘", value: sa.categoryBreakdown.wellness, color: "rgba(34, 197, 94, 0.9)" },
                        { label: "기타", icon: "🎯", value: sa.categoryBreakdown.other, color: "rgba(107, 114, 128, 0.9)" },
                    ].filter(c => c.value > 0).map((cat) => (
                        <div key={cat.label} className="flex items-center gap-5">
                            <div className="flex items-center gap-3 w-28 shrink-0">
                                <span className="text-3xl">{cat.icon}</span>
                                <span className="text-xl font-semibold">{cat.label}</span>
                            </div>
                            <div className="flex-1">
                                <div className="h-14 bg-white/15 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full flex items-center justify-end pr-6"
                                        style={{ backgroundColor: cat.color, width: `${Math.max((cat.value / maxCat) * 100, 18)}%` }}
                                    >
                                        <span className="text-white font-black text-xl">{cat.value}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total & Avg */}
                <div className="px-16 mt-20 grid grid-cols-2 gap-8">
                    <div className="bg-white/10 rounded-3xl p-10 border border-white/15 text-center">
                        <p className="text-6xl font-black">{sa.totalSchedules}</p>
                        <p className="text-lg text-white/60 mt-2">총 일정</p>
                    </div>
                    <div className="bg-white/10 rounded-3xl p-10 border border-white/15 text-center">
                        <p className="text-6xl font-black">{sa.avgSchedulesPerDay.toFixed(1)}</p>
                        <p className="text-lg text-white/60 mt-2">일 평균</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-auto px-16 pb-16 flex items-center justify-between">
                    <p className="text-base text-white/30">fieri.app</p>
                    <FieriLogo className="w-12 h-12 opacity-30" />
                </div>
            </div>
        );
    };

    const renderGrowthTemplate = () => (
        <div className="w-[1080px] h-[1920px] bg-gradient-to-br from-indigo-700 via-purple-600 to-pink-500 text-white flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-[400px] left-[-120px] w-[450px] h-[450px] rounded-full bg-white/5" />
            <div className="absolute bottom-[200px] right-[-80px] w-[350px] h-[350px] rounded-full bg-white/5" />

            {/* Header */}
            <div className="flex items-center gap-4 pt-20">
                <FieriLogo className="w-16 h-16" />
                <p className="text-2xl font-bold">Fi.eri</p>
            </div>

            <p className="text-xl text-white/70 mt-6">Week {reportData.period.weekNumber}</p>
            <h1 className="text-5xl font-black mt-4">성장 점수</h1>

            {/* Score */}
            <div className="mt-20">
                <StoryDonut
                    percentage={gm.consistencyScore}
                    size={320}
                    strokeWidth={24}
                    color={getScoreColor(gm.consistencyScore)}
                    bgColor="rgba(255,255,255,0.15)"
                />
            </div>

            {/* Grade */}
            <div className="mt-12 bg-white/10 rounded-2xl px-12 py-6 border border-white/15">
                <p className="text-3xl font-bold text-center">
                    등급{" "}
                    <span className="text-5xl font-black" style={{ color: getScoreColor(gm.consistencyScore) }}>
                        {getScoreEmoji(gm.consistencyScore)}
                    </span>
                </p>
            </div>

            {/* Breakdown */}
            <div className="mt-16 grid grid-cols-2 gap-8 px-16 w-full">
                <div className="bg-white/10 rounded-2xl p-8 border border-white/10 text-center">
                    <Calendar className="w-8 h-8 text-blue-300 mx-auto mb-3" />
                    <p className="text-3xl font-bold">{sa.completionRate.toFixed(0)}%</p>
                    <p className="text-sm text-white/50 mt-1">일정 완료</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-8 border border-white/10 text-center">
                    <Flame className="w-8 h-8 text-orange-300 mx-auto mb-3" />
                    <p className="text-3xl font-bold">{ta.readingStreak}일</p>
                    <p className="text-sm text-white/50 mt-1">연속 학습</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-8 border border-white/10 text-center">
                    <TrendingUp className="w-8 h-8 text-emerald-300 mx-auto mb-3" />
                    <p className="text-3xl font-bold">{gm.newHabitsFormed}</p>
                    <p className="text-sm text-white/50 mt-1">새 습관</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-8 border border-white/10 text-center">
                    <Clock className="w-8 h-8 text-pink-300 mx-auto mb-3" />
                    <p className="text-3xl font-bold">{Math.round(gm.timeInvested / 60)}h</p>
                    <p className="text-sm text-white/50 mt-1">투자 시간</p>
                </div>
            </div>

            {/* Message */}
            <p className="mt-12 text-2xl text-center max-w-lg px-8 text-white/80">
                {gm.consistencyScore >= 70
                    ? "꾸준히 성장하고 있어요! 이 페이스를 유지하세요"
                    : gm.consistencyScore >= 40
                        ? "좋은 출발이에요! 조금만 더 힘내봐요"
                        : "작은 습관부터 시작해봐요. 할 수 있어요!"}
            </p>

            {/* Footer */}
            <div className="mt-auto pb-16 flex flex-col items-center">
                <FieriLogo className="w-14 h-14 opacity-30" />
                <p className="text-base text-white/30 mt-3">fieri.app</p>
            </div>
        </div>
    );

    const templateRenderers: Record<TemplateKey, () => React.ReactNode> = {
        summary: renderSummaryTemplate,
        completion: renderCompletionTemplate,
        category: renderCategoryTemplate,
        growth: renderGrowthTemplate,
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 z-[60]"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        className="fixed inset-4 z-[60] flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Top Bar */}
                        <div className="w-full max-w-md flex items-center justify-between mb-4">
                            <h2 className="text-white text-lg font-bold">스토리 공유</h2>
                            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Template Tabs */}
                        <div className="flex gap-2 mb-4">
                            {TEMPLATES.map((t) => (
                                <button
                                    key={t.key}
                                    onClick={() => setSelectedTemplate(t.key)}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-sm font-medium transition-all",
                                        selectedTemplate === t.key
                                            ? "bg-white text-black"
                                            : "bg-white/10 text-white/70 hover:bg-white/20"
                                    )}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Preview (scaled down) */}
                        <div className="flex-1 overflow-hidden flex items-center justify-center min-h-0">
                            <div
                                className="origin-top"
                                style={{
                                    transform: "scale(0.28)",
                                    width: 1080,
                                    height: 1920,
                                    marginBottom: `-${1920 * 0.72}px`,
                                }}
                            >
                                <div ref={storyRef}>
                                    {templateRenderers[selectedTemplate]()}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-4 mb-2 w-full max-w-md">
                            <Button
                                onClick={handleDownload}
                                disabled={isGenerating}
                                className="flex-1 h-12 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl"
                            >
                                <Download className="w-5 h-5 mr-2" />
                                {isGenerating ? "생성 중..." : "이미지 저장"}
                            </Button>
                            <Button
                                onClick={handleShare}
                                disabled={isGenerating}
                                className="flex-1 h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl"
                            >
                                <Share2 className="w-5 h-5 mr-2" />
                                {isGenerating ? "생성 중..." : "공유하기"}
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
