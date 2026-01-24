"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Calendar, BookOpen, Award, Flame, Target, Sparkles, TrendingUp, Clock, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Fieri Logo - Amber color (complete logo with all 4 paths)
const FieriLogo = ({ className = "" }: { className?: string }) => (
    <svg viewBox="0 0 1024 1024" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="#FDD7A7" d="M523.997498,653.945618 C528.388672,653.329346 532.779907,652.713013 537.750366,652.292419 C538.881531,652.271362 539.433472,652.054688 539.985413,651.838013 C540.406616,651.830505 540.827881,651.822998 541.912720,651.852661 C543.446411,651.342712 544.316467,650.795532 545.186462,650.248352 C555.374451,647.371582 565.861145,645.266846 575.690491,641.463196 C598.774475,632.530640 619.020569,618.929077 636.281677,601.162415 C648.263733,588.829346 658.432495,575.090271 666.007874,559.551270 C666.420288,558.705261 667.026672,557.953796 668.502197,557.285217 C668.502197,558.540161 668.714478,559.838135 668.470459,561.043701 C664.507629,580.623047 655.469055,597.935059 644.178284,614.125916 C618.600952,650.803650 584.596863,675.800232 541.063782,687.013367 C530.524475,689.728088 519.630188,691.064148 508.304321,692.805786 C507.138153,692.738220 506.566772,692.898987 505.995392,693.059753 C503.589661,693.317444 501.183929,693.575195 498.070679,693.587646 C491.912994,693.518860 486.462799,693.695251 481.012604,693.871704 C450.400208,692.652466 421.512512,684.577026 393.602448,672.289368 C359.801880,657.408508 331.161499,635.421631 306.879181,608.004089 C275.857605,572.977051 255.236130,532.357483 246.175018,486.287781 C243.917679,474.810760 243.133118,463.011169 242.221878,451.316925 C241.799973,445.902740 242.698868,440.385651 243.219055,434.309875 C243.292816,433.136383 243.146515,432.568176 243.000214,432.000000 C244.336960,426.729156 245.193604,421.269562 247.167740,416.249359 C248.652237,412.474243 251.968246,409.992279 256.573853,409.997620 C261.197296,410.002991 264.348541,412.579010 265.951782,416.322235 C268.358826,421.942230 270.401337,427.810394 271.782166,433.762543 C279.275421,466.062256 288.269745,497.875641 303.789429,527.361938 C317.585419,553.573425 334.553253,577.690186 356.950867,597.272278 C388.988617,625.282654 425.814819,643.978088 468.102478,651.100525 C474.099121,652.110535 480.107941,653.047974 486.791321,654.271362 C488.983215,654.385864 490.494934,654.248047 492.006622,654.110229 C501.718628,654.098572 511.430634,654.086914 521.731323,654.277344 C522.879150,654.301453 523.438354,654.123535 523.997498,653.945618z"/>
        <path fill="#FDD7A7" d="M782.758118,474.121368 C784.582764,481.800323 786.437134,489.472412 788.211365,497.162994 C788.652649,499.076141 788.834656,501.049072 789.122559,503.727844 C789.406982,504.974548 789.704712,505.487885 790.002441,506.001221 C790.635742,510.393921 791.269043,514.786621 791.671753,519.790771 C791.628723,521.268188 791.816223,522.134094 792.003784,523.000000 C793.606323,535.962463 793.561035,548.835327 790.069031,561.549683 C788.679443,566.609436 786.640503,571.077209 780.721069,571.898804 C775.705322,572.594849 770.815613,569.704895 768.474915,563.517639 C765.248474,554.989258 762.608826,546.213013 760.166565,537.418396 C751.915527,507.706421 742.018921,478.622437 727.229675,451.448639 C718.073364,434.624695 707.147766,419.039032 694.417236,404.612366 C676.013367,383.756470 654.501709,367.032318 629.817749,354.487183 C608.641113,343.724518 586.135559,336.934998 562.504211,333.883820 C541.093506,331.119354 519.861206,331.565582 498.587006,335.453522 C480.959686,338.674957 464.042633,343.985138 447.949829,351.652130 C433.811829,358.387848 420.933960,367.220917 408.930267,377.372040 C392.049286,391.647644 379.107971,408.977295 368.365997,428.113403 C368.068420,428.643524 367.636383,429.098175 366.545563,429.343018 C366.770355,428.204132 366.886780,427.030792 367.235901,425.931396 C374.671234,402.519043 386.250610,381.442291 401.913361,362.445129 C419.885590,340.646851 441.473236,323.734253 466.920563,311.545624 C484.311371,303.215881 502.559540,298.423126 521.651978,295.843658 C536.566345,293.828583 551.435486,294.325470 566.242798,295.131470 C601.077515,297.027557 633.074951,308.646942 663.270081,325.637634 C685.910583,338.377319 705.899780,354.498138 723.716309,373.350220 C744.136169,394.957001 760.113037,419.538025 772.155701,446.657990 C775.242798,453.609924 777.454163,460.950684 780.090454,468.857056 C780.994751,471.108002 781.876465,472.614685 782.758118,474.121368z"/>
        <path fill="#FDD6A7" d="M684.148560,490.912598 C678.114746,424.145813 645.535156,375.639038 584.250488,346.877502 C584.536438,346.439819 584.822388,346.002167 585.108337,345.564514 C594.010010,348.551239 603.222046,350.842499 611.757263,354.650635 C641.485962,367.914673 667.251709,386.471436 687.866211,412.078217 C701.956238,429.580444 712.849731,448.701813 718.660339,470.284546 C722.413208,484.224091 725.517517,498.356995 726.242188,513.068054 C728.058105,549.933655 719.173828,584.248169 702.839050,616.755493 C689.043091,644.210388 669.795288,667.561584 646.756592,688.008606 C628.576843,704.143311 608.635315,717.597412 587.134521,728.509949 C573.898560,735.227661 559.688965,740.274841 545.517517,744.830627 C531.854492,749.222839 517.844910,753.254578 503.680237,755.162231 C490.162659,756.982727 476.244476,756.114868 462.511353,755.887634 C457.950226,755.812073 454.280975,752.595581 453.232849,748.041443 C452.125763,743.231140 455.416687,740.098206 459.367462,738.267578 C465.375641,735.483643 471.460358,732.686035 477.780396,730.784241 C508.794739,721.451599 538.666809,709.312073 566.851562,693.430176 C586.698059,682.246704 605.062988,668.851746 621.745605,653.100403 C639.114929,636.700745 653.349243,618.064514 663.994812,596.828796 C673.789856,577.289673 681.021912,556.791565 683.054810,534.782043 C683.328003,531.824707 683.696167,528.876282 684.345642,525.413940 C684.790161,523.936096 684.909424,522.968079 685.028687,522.000000 C685.029480,512.978577 685.030212,503.957153 685.275024,494.265991 C685.062317,492.701691 684.605469,491.807129 684.148560,490.912598z"/>
        <path fill="#FDD7A7" d="M310.121490,441.009613 C310.386932,439.581207 310.652405,438.152802 311.217926,436.172638 C311.608612,435.023834 311.699249,434.426758 311.789886,433.829712 C311.831543,433.123596 311.873199,432.417511 312.156219,431.226044 C312.314209,430.164703 312.230804,429.588745 312.147400,429.012756 C312.161774,428.593536 312.176147,428.174316 312.522003,427.345032 C313.169891,426.235046 313.486298,425.535095 313.802673,424.835144 C313.904846,423.521576 314.007019,422.208008 314.491760,420.389954 C315.508728,417.863770 316.143066,415.842133 316.777405,413.820465 C316.899658,412.515717 317.021881,411.210968 317.493256,409.421387 C318.175964,408.244598 318.509521,407.552643 318.843079,406.860718 C318.843079,406.860718 318.886597,406.413330 319.148315,406.079681 C319.536560,405.449890 319.663025,405.153778 319.789520,404.857635 C323.867371,389.409454 331.401825,375.553680 339.697174,362.082886 C350.725739,344.173523 363.803253,327.800232 378.746185,313.063843 C400.262268,291.845215 424.097931,273.664673 450.938049,259.476959 C471.332855,248.696213 492.374176,239.805511 515.135132,235.631516 C521.775269,234.413803 528.654785,234.295547 535.435974,234.126282 C539.827271,234.016693 543.801880,235.805359 545.398804,240.245895 C547.029297,244.779800 544.886475,248.654785 541.236938,251.066208 C535.150269,255.087860 528.837891,258.837402 522.344238,262.161682 C490.892487,278.262726 460.461975,296.031097 433.165558,318.592682 C409.958618,337.774200 389.519562,359.660980 375.383728,386.496216 C368.543152,399.482330 363.635803,413.486786 357.498413,427.546356 C356.499054,429.745636 355.854492,431.428741 355.209930,433.111816 C354.748688,436.068390 354.287415,439.024994 353.528564,442.481812 C353.128296,443.656067 353.025696,444.330109 352.923096,445.004150 C351.964417,450.719116 351.005737,456.434113 349.795227,462.756256 C349.670349,464.243927 349.797333,465.124420 349.924286,466.004913 C349.680786,475.985291 349.437256,485.965698 349.171204,496.706177 C349.423889,497.978271 349.699127,498.490265 349.974335,499.002258 C351.764923,525.006165 360.344604,548.908875 373.514191,571.083862 C390.426575,599.560852 414.361755,620.639648 444.103729,635.159119 C445.235840,635.711853 446.267303,636.470703 447.345673,637.133423 C447.169952,637.563843 446.994263,637.994263 446.818542,638.424683 C437.836517,635.231079 428.593903,632.618164 419.924500,628.727905 C399.328156,619.485657 380.641876,607.317749 364.085052,591.738586 C334.632538,564.025208 315.440796,530.870056 310.196106,490.559692 C308.455658,477.182831 309.327271,463.466095 309.263550,449.260315 C309.613495,448.021942 309.704620,447.428040 309.795715,446.834137 C309.845306,445.812927 309.894867,444.791748 310.177917,443.250366 C310.314789,442.156677 310.218140,441.583160 310.121490,441.009613z"/>
    </svg>
);

// Large Donut Chart for cards
function LargeDonutChart({
    percentage,
    size = 180,
    strokeWidth = 16,
    color = "rgb(59, 130, 246)",
    bgColor = "rgba(255,255,255,0.2)"
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
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={bgColor}
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
                    transition={{ duration: 1.2, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                    className="text-5xl font-bold"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                >
                    {percentage.toFixed(0)}%
                </motion.span>
            </div>
        </div>
    );
}

// Horizontal Bar for category
function CategoryBar({
    label,
    icon,
    value,
    maxValue,
    color,
    delay = 0
}: {
    label: string;
    icon: string;
    value: number;
    maxValue: number;
    color: string;
    delay?: number;
}) {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 w-20">
                <span className="text-xl">{icon}</span>
                <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="flex-1">
                <div className="h-8 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full rounded-full flex items-center justify-end pr-3"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(percentage, 15)}%` }}
                        transition={{ duration: 0.8, delay, ease: "easeOut" }}
                    >
                        <span className="text-white font-bold text-sm">{value}</span>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

// Stat Circle
function StatCircle({
    value,
    label,
    icon: Icon,
    color,
    delay = 0
}: {
    value: string | number;
    label: string;
    icon: React.ElementType;
    color: string;
    delay?: number;
}) {
    return (
        <motion.div
            className="flex flex-col items-center"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay, type: "spring", stiffness: 200 }}
        >
            <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mb-2", color)}>
                <Icon className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl font-bold">{value}</span>
            <span className="text-sm opacity-80">{label}</span>
        </motion.div>
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

interface WeeklyReportCardsProps {
    isOpen: boolean;
    onClose: () => void;
    reportData: WeeklyReportData | null;
}

export function WeeklyReportCards({ isOpen, onClose, reportData }: WeeklyReportCardsProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    if (!reportData) return null;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    };

    const totalSlides = 6;

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 50;
        if (info.offset.x < -threshold && currentSlide < totalSlides - 1) {
            setCurrentSlide(prev => prev + 1);
        } else if (info.offset.x > threshold && currentSlide > 0) {
            setCurrentSlide(prev => prev - 1);
        }
    };

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    const slides = [
        // Slide 1: Title Card
        <div key="title" className="h-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
            >
                <FieriLogo className="w-24 h-24 mb-6" />
            </motion.div>
            <motion.h1
                className="text-4xl font-bold mb-2 text-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                주간 리포트
            </motion.h1>
            <motion.p
                className="text-xl opacity-90 mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                Week {reportData.period.weekNumber}
            </motion.p>
            <motion.div
                className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-3"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
                <p className="text-lg font-medium">
                    {formatDate(reportData.period.start)} ~ {formatDate(reportData.period.end)}
                </p>
            </motion.div>
        </div>,

        // Slide 2: Completion Rate
        <div key="completion" className="h-full bg-gradient-to-br from-blue-500 to-cyan-400 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                className="mb-4"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <Calendar className="w-12 h-12" />
            </motion.div>
            <motion.h2
                className="text-2xl font-bold mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                일정 완료율
            </motion.h2>
            <LargeDonutChart
                percentage={reportData.scheduleAnalysis.completionRate}
                color="white"
                bgColor="rgba(255,255,255,0.3)"
            />
            <motion.div
                className="mt-8 flex gap-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
            >
                <div className="text-center">
                    <p className="text-4xl font-bold">{reportData.scheduleAnalysis.completedSchedules}</p>
                    <p className="text-sm opacity-80">완료</p>
                </div>
                <div className="w-px bg-white/30" />
                <div className="text-center">
                    <p className="text-4xl font-bold">{reportData.scheduleAnalysis.totalSchedules}</p>
                    <p className="text-sm opacity-80">전체</p>
                </div>
            </motion.div>
        </div>,

        // Slide 3: Reading & Streak
        <div key="reading" className="h-full bg-gradient-to-br from-purple-500 to-pink-500 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                className="mb-4"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <BookOpen className="w-12 h-12" />
            </motion.div>
            <motion.h2
                className="text-2xl font-bold mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                브리핑 읽기
            </motion.h2>
            <motion.div
                className="text-center mb-8"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
            >
                <p className="text-8xl font-bold">{reportData.trendBriefingAnalysis.totalRead}</p>
                <p className="text-xl opacity-80">읽은 브리핑</p>
            </motion.div>
            <motion.div
                className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
                <Flame className="w-10 h-10 text-orange-300" />
                <div>
                    <p className="text-3xl font-bold">{reportData.trendBriefingAnalysis.readingStreak}일</p>
                    <p className="text-sm opacity-80">연속 학습</p>
                </div>
            </motion.div>
        </div>,

        // Slide 4: Category Breakdown
        <div key="category" className="h-full bg-gradient-to-br from-emerald-500 to-teal-400 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                className="mb-4"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <Target className="w-12 h-12" />
            </motion.div>
            <motion.h2
                className="text-2xl font-bold mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                활동 분석
            </motion.h2>
            <div className="w-full max-w-xs space-y-4">
                <CategoryBar label="업무" icon="💼" value={reportData.scheduleAnalysis.categoryBreakdown.work} maxValue={reportData.scheduleAnalysis.totalSchedules} color="rgba(59, 130, 246, 0.9)" delay={0.2} />
                <CategoryBar label="학습" icon="📚" value={reportData.scheduleAnalysis.categoryBreakdown.learning} maxValue={reportData.scheduleAnalysis.totalSchedules} color="rgba(168, 85, 247, 0.9)" delay={0.3} />
                <CategoryBar label="운동" icon="💪" value={reportData.scheduleAnalysis.categoryBreakdown.exercise} maxValue={reportData.scheduleAnalysis.totalSchedules} color="rgba(239, 68, 68, 0.9)" delay={0.4} />
                <CategoryBar label="웰빙" icon="🧘" value={reportData.scheduleAnalysis.categoryBreakdown.wellness} maxValue={reportData.scheduleAnalysis.totalSchedules} color="rgba(34, 197, 94, 0.9)" delay={0.5} />
                <CategoryBar label="기타" icon="🎯" value={reportData.scheduleAnalysis.categoryBreakdown.other} maxValue={reportData.scheduleAnalysis.totalSchedules} color="rgba(107, 114, 128, 0.9)" delay={0.6} />
            </div>
        </div>,

        // Slide 5: Stats Overview
        <div key="stats" className="h-full bg-gradient-to-br from-amber-500 to-orange-500 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                className="mb-4"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <TrendingUp className="w-12 h-12" />
            </motion.div>
            <motion.h2
                className="text-2xl font-bold mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                이번 주 요약
            </motion.h2>
            <div className="grid grid-cols-2 gap-8">
                <StatCircle value={reportData.scheduleAnalysis.completedSchedules} label="완료 일정" icon={Calendar} color="bg-blue-500" delay={0.2} />
                <StatCircle value={reportData.trendBriefingAnalysis.totalRead} label="읽은 브리핑" icon={BookOpen} color="bg-purple-500" delay={0.3} />
                <StatCircle value={reportData.growthMetrics.newHabitsFormed} label="새 습관" icon={Award} color="bg-green-500" delay={0.4} />
                <StatCircle value={`${Math.round(reportData.growthMetrics.timeInvested / 60)}h`} label="투자 시간" icon={Clock} color="bg-pink-500" delay={0.5} />
            </div>
        </div>,

        // Slide 6: Consistency & End
        <div key="end" className="h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-8 text-white">
            <motion.div
                className="mb-4"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <Award className="w-12 h-12" />
            </motion.div>
            <motion.h2
                className="text-2xl font-bold mb-6"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                일관성 점수
            </motion.h2>
            <LargeDonutChart
                percentage={reportData.growthMetrics.consistencyScore}
                size={160}
                color={
                    reportData.growthMetrics.consistencyScore >= 70 ? "rgb(34, 197, 94)" :
                    reportData.growthMetrics.consistencyScore >= 40 ? "rgb(234, 179, 8)" :
                    "rgb(239, 68, 68)"
                }
                bgColor="rgba(255,255,255,0.2)"
            />
            <motion.p
                className="text-lg mt-6 text-center max-w-xs opacity-90"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
            >
                {reportData.growthMetrics.consistencyScore >= 70
                    ? "🎉 훌륭해요! 꾸준히 성장하고 있어요"
                    : reportData.growthMetrics.consistencyScore >= 40
                    ? "💪 조금만 더 힘내세요!"
                    : "🌱 규칙적인 습관을 만들어봐요"}
            </motion.p>
            <motion.div
                className="mt-8"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7, type: "spring" }}
            >
                <FieriLogo className="w-16 h-16 opacity-50" />
            </motion.div>
        </div>
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50"
                        onClick={onClose}
                    />

                    {/* Card Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed top-20 left-4 right-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[380px] sm:h-[680px] z-50 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button - inside card on mobile, outside on desktop */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="absolute top-3 right-3 sm:-top-2 sm:-right-12 text-white hover:bg-white/20 z-20"
                        >
                            <X className="w-6 h-6" />
                        </Button>

                        {/* Slides Container */}
                        <div
                            ref={containerRef}
                            className="flex-1 relative overflow-hidden rounded-3xl shadow-2xl"
                        >
                            <motion.div
                                drag="x"
                                dragConstraints={{ left: 0, right: 0 }}
                                dragElastic={0.2}
                                onDragEnd={handleDragEnd}
                                className="absolute inset-0"
                            >
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentSlide}
                                        initial={{ opacity: 0, x: 100 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -100 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        className="absolute inset-0"
                                    >
                                        {slides[currentSlide]}
                                    </motion.div>
                                </AnimatePresence>
                            </motion.div>

                            {/* Navigation Arrows */}
                            {currentSlide > 0 && (
                                <button
                                    onClick={() => setCurrentSlide(prev => prev - 1)}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors"
                                >
                                    <ChevronLeft className="w-6 h-6 text-white" />
                                </button>
                            )}
                            {currentSlide < totalSlides - 1 && (
                                <button
                                    onClick={() => setCurrentSlide(prev => prev + 1)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors"
                                >
                                    <ChevronRight className="w-6 h-6 text-white" />
                                </button>
                            )}
                        </div>

                        {/* Dots Indicator */}
                        <div className="flex justify-center gap-2 mt-4">
                            {slides.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => goToSlide(index)}
                                    className={cn(
                                        "w-2 h-2 rounded-full transition-all",
                                        index === currentSlide
                                            ? "bg-white w-6"
                                            : "bg-white/40 hover:bg-white/60"
                                    )}
                                />
                            ))}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
