"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Flag, Calendar, CalendarDays, CalendarRange,
    Plus, Check, Trash2, ChevronDown, ChevronUp, Clock,
    TrendingUp, Loader2, Trophy, Flame, Star, Dumbbell,
    Briefcase, Heart, BookOpen, Coins, Users, Palette, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Fieri Logo SVG Component - 원래 색상 사용
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

interface LongTermGoal {
    id: string;
    type: "weekly" | "monthly" | "yearly";
    title: string;
    description?: string;
    category?: string;
    targetDate?: string;
    progress: number;
    milestones?: { id: string; title: string; completed: boolean }[];
    completed: boolean;
    createdAt: string;
    updatedAt: string;
}

interface LinkedSchedule {
    id: string;
    text: string;
    startTime: string;
    endTime?: string;
    specificDate?: string;
    daysOfWeek?: number[];
    completed?: boolean;
}

interface LongTermGoals {
    weekly: LongTermGoal[];
    monthly: LongTermGoal[];
    yearly: LongTermGoal[];
}

interface LongTermGoalsWidgetProps {
    onOpenGoalModal?: () => void;
    compact?: boolean;
}

const categoryConfig: Record<string, { icon: typeof Briefcase; gradient: string; bg: string; text: string }> = {
    career: { icon: Briefcase, gradient: "from-blue-500 to-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400" },
    health: { icon: Heart, gradient: "from-green-500 to-emerald-600", bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-600 dark:text-green-400" },
    exercise: { icon: Dumbbell, gradient: "from-red-500 to-orange-500", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400" },
    learning: { icon: BookOpen, gradient: "from-purple-500 to-violet-600", bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600 dark:text-purple-400" },
    finance: { icon: Coins, gradient: "from-amber-500 to-yellow-600", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400" },
    relationship: { icon: Users, gradient: "from-pink-500 to-rose-600", bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-600 dark:text-pink-400" },
    hobby: { icon: Palette, gradient: "from-orange-500 to-red-500", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400" },
    general: { icon: MoreHorizontal, gradient: "from-slate-500 to-slate-600", bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-600 dark:text-slate-400" },
};

const categoryLabels: Record<string, string> = {
    career: "커리어",
    health: "건강",
    exercise: "운동",
    learning: "학습",
    finance: "재정",
    relationship: "관계",
    hobby: "취미",
    general: "기타",
};

export function LongTermGoalsWidget({ onOpenGoalModal, compact = false }: LongTermGoalsWidgetProps) {
    const [goals, setGoals] = useState<LongTermGoals | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"weekly" | "monthly" | "yearly">("weekly");
    const [editingProgress, setEditingProgress] = useState<string | null>(null);
    const [hoveredGoal, setHoveredGoal] = useState<string | null>(null);
    const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
    const [linkedSchedules, setLinkedSchedules] = useState<Record<string, LinkedSchedule[]>>({});
    const [loadingSchedules, setLoadingSchedules] = useState<string | null>(null);

    useEffect(() => {
        fetchGoals();
    }, []);

    // 목표에 연결된 일정 가져오기
    const fetchLinkedSchedules = async (goalId: string) => {
        if (linkedSchedules[goalId]) {
            // 이미 로드된 경우 캐시 사용
            return;
        }

        setLoadingSchedules(goalId);
        try {
            const profileRes = await fetch('/api/user/profile');
            if (profileRes.ok) {
                const { profile } = await profileRes.json();
                const customGoals = profile?.customGoals || [];

                // 목표와 연결된 일정 필터링
                const linked = customGoals.filter((schedule: any) =>
                    schedule.linkedGoalId === goalId
                );

                // 완료 상태 확인
                const today = new Date();
                const kstDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
                const todayStr = `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, '0')}-${String(kstDate.getDate()).padStart(2, '0')}`;
                const completionsStr = localStorage.getItem(`schedule_completions_${todayStr}`);
                const completions = completionsStr ? JSON.parse(completionsStr) : {};

                const schedulesWithStatus = linked.map((s: any) => ({
                    ...s,
                    completed: completions[s.id]?.completed || false,
                }));

                setLinkedSchedules(prev => ({
                    ...prev,
                    [goalId]: schedulesWithStatus,
                }));
            }
        } catch (error) {
            console.error('[LongTermGoalsWidget] Failed to fetch linked schedules:', error);
        } finally {
            setLoadingSchedules(null);
        }
    };

    // 목표 확장/축소 토글
    const toggleExpanded = async (goalId: string) => {
        if (expandedGoal === goalId) {
            setExpandedGoal(null);
        } else {
            setExpandedGoal(goalId);
            await fetchLinkedSchedules(goalId);
        }
    };

    const fetchGoals = async () => {
        try {
            const response = await fetch("/api/user/long-term-goals");
            if (response.ok) {
                const data = await response.json();
                setGoals(data.goals);
            }
        } catch (error) {
            console.error("[LongTermGoalsWidget] Failed to fetch goals:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateProgress = async (goal: LongTermGoal, newProgress: number) => {
        try {
            const response = await fetch("/api/user/long-term-goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    goal: { ...goal, progress: newProgress },
                    action: "updateProgress",
                }),
            });
            if (response.ok) {
                const data = await response.json();
                setGoals(data.goals);
            }
        } catch (error) {
            console.error("[LongTermGoalsWidget] Failed to update progress:", error);
        }
        setEditingProgress(null);
    };

    const completeGoal = async (goal: LongTermGoal) => {
        try {
            const response = await fetch("/api/user/long-term-goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    goal,
                    action: "complete",
                }),
            });
            if (response.ok) {
                const data = await response.json();
                setGoals(data.goals);
            }
        } catch (error) {
            console.error("[LongTermGoalsWidget] Failed to complete goal:", error);
        }
    };

    const deleteGoal = async (goal: LongTermGoal) => {
        try {
            const response = await fetch("/api/user/long-term-goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    goal,
                    action: "delete",
                }),
            });
            if (response.ok) {
                const data = await response.json();
                setGoals(data.goals);
            }
        } catch (error) {
            console.error("[LongTermGoalsWidget] Failed to delete goal:", error);
        }
    };

    const tabs = [
        { key: "weekly" as const, label: "주간", icon: Calendar },
        { key: "monthly" as const, label: "월간", icon: CalendarDays },
        { key: "yearly" as const, label: "연간", icon: CalendarRange },
    ];

    const currentGoals = goals?.[activeTab] || [];
    const completedCount = currentGoals.filter(g => g.completed).length;
    const totalCount = currentGoals.length;
    const averageProgress = totalCount > 0
        ? Math.round(currentGoals.reduce((sum, g) => sum + g.progress, 0) / totalCount)
        : 0;

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-8 flex items-center justify-center min-h-[300px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">목표를 불러오는 중...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-card to-muted/10 rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="relative px-6 py-5 border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-purple-500/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                            <Flag className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">나의 목표</h3>
                            <p className="text-xs text-muted-foreground">
                                {totalCount > 0 ? `${completedCount}/${totalCount} 달성` : "목표를 설정해보세요"}
                            </p>
                        </div>
                    </div>
                    {onOpenGoalModal && (
                        <Button
                            onClick={onOpenGoalModal}
                            className="gap-2 rounded-xl shadow-md hover:shadow-lg transition-shadow"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">새 목표</span>
                        </Button>
                    )}
                </div>

                {/* Stats Bar */}
                {totalCount > 0 && (
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Trophy className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">완료</p>
                                <p className="font-bold text-sm">{completedCount}개</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">진행률</p>
                                <p className="font-bold text-sm">{averageProgress}%</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Star className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">진행 중</p>
                                <p className="font-bold text-sm">{totalCount - completedCount}개</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex p-2 gap-1 bg-muted/30">
                {tabs.map((tab) => {
                    const count = goals?.[tab.key]?.length || 0;
                    const isActive = activeTab === tab.key;
                    const TabIcon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-white dark:bg-card shadow-md text-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-card/50"
                            )}
                        >
                            <TabIcon className="w-4 h-4" />
                            <span>{tab.label}</span>
                            {count > 0 && (
                                <span className={cn(
                                    "ml-1 px-2 py-0.5 text-xs rounded-full font-bold",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "bg-muted text-muted-foreground"
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Goals List */}
            <div className={cn("p-4", compact ? "max-h-[350px]" : "max-h-[450px]", "overflow-y-auto")}>
                <AnimatePresence mode="wait">
                    {currentGoals.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="text-center py-12"
                        >
                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
                                <Flag className="w-10 h-10 text-primary/60" />
                            </div>
                            <h4 className="font-bold text-lg mb-2">
                                {activeTab === "weekly" && "이번 주 목표를 세워보세요"}
                                {activeTab === "monthly" && "이번 달 목표를 세워보세요"}
                                {activeTab === "yearly" && "올해의 목표를 세워보세요"}
                            </h4>
                            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                                목표를 설정하면 AI가 매일 달성을 도와드려요
                            </p>
                            {onOpenGoalModal && (
                                <Button
                                    onClick={onOpenGoalModal}
                                    className="gap-2 rounded-xl"
                                >
                                    <FieriLogo className="w-5 h-5" />
                                    첫 목표 만들기
                                </Button>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-3"
                        >
                            {currentGoals.map((goal, index) => {
                                const config = categoryConfig[goal.category || "general"];
                                const isHovered = hoveredGoal === goal.id;
                                const isExpanded = expandedGoal === goal.id;
                                const CategoryIcon = config.icon;
                                const schedules = linkedSchedules[goal.id] || [];
                                const isLoadingThisGoal = loadingSchedules === goal.id;

                                return (
                                    <motion.div
                                        key={goal.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        onMouseEnter={() => setHoveredGoal(goal.id)}
                                        onMouseLeave={() => setHoveredGoal(null)}
                                        className={cn(
                                            "group relative rounded-xl transition-all duration-200 cursor-pointer",
                                            goal.completed
                                                ? "bg-gradient-to-r from-green-50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/10 ring-1 ring-green-200 dark:ring-green-800"
                                                : "bg-white dark:bg-card/80 hover:shadow-md hover:ring-1 hover:ring-primary/20"
                                        )}
                                    >
                                        <div
                                            className="p-4"
                                            onClick={() => toggleExpanded(goal.id)}
                                        >
                                        <div className="flex items-start gap-4">
                                            {/* Category Icon */}
                                            <div className={cn(
                                                "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200",
                                                config.bg,
                                                isHovered && "scale-110"
                                            )}>
                                                {goal.completed ? (
                                                    <Check className={cn("w-6 h-6", config.text)} />
                                                ) : (
                                                    <CategoryIcon className={cn("w-6 h-6", config.text)} />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                {/* Title & Category */}
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className={cn(
                                                        "font-semibold text-base",
                                                        goal.completed && "line-through text-muted-foreground"
                                                    )}>
                                                        {goal.title}
                                                    </span>
                                                    <span className={cn(
                                                        "text-xs px-2 py-0.5 rounded-full font-medium",
                                                        config.bg, config.text
                                                    )}>
                                                        {categoryLabels[goal.category || "general"]}
                                                    </span>
                                                    {goal.completed && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-medium">
                                                            완료
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Description */}
                                                {goal.description && !compact && (
                                                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                                        {goal.description}
                                                    </p>
                                                )}

                                                {/* Progress Bar */}
                                                {!goal.completed && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                                                                <span className="text-xs text-muted-foreground">진행률</span>
                                                            </div>
                                                            {editingProgress === goal.id ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    defaultValue={goal.progress}
                                                                    className="w-16 px-2 py-1 text-xs border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                    onBlur={(e) => updateProgress(goal, parseInt(e.target.value) || 0)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") {
                                                                            updateProgress(goal, parseInt((e.target as HTMLInputElement).value) || 0);
                                                                        }
                                                                    }}
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <button
                                                                    onClick={() => setEditingProgress(goal.id)}
                                                                    className={cn(
                                                                        "text-sm font-bold px-2 py-0.5 rounded-lg transition-colors",
                                                                        goal.progress >= 75 ? "text-green-600 bg-green-50 dark:bg-green-900/30" :
                                                                            goal.progress >= 50 ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30" :
                                                                                goal.progress >= 25 ? "text-amber-600 bg-amber-50 dark:bg-amber-900/30" :
                                                                                    "text-muted-foreground bg-muted"
                                                                    )}
                                                                >
                                                                    {goal.progress}%
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${goal.progress}%` }}
                                                                transition={{ duration: 0.5, ease: "easeOut" }}
                                                                className={cn(
                                                                    "absolute inset-y-0 left-0 rounded-full",
                                                                    goal.progress >= 75 ? "bg-gradient-to-r from-green-500 to-emerald-500" :
                                                                        goal.progress >= 50 ? "bg-gradient-to-r from-blue-500 to-cyan-500" :
                                                                            goal.progress >= 25 ? "bg-gradient-to-r from-amber-500 to-yellow-500" :
                                                                                "bg-gradient-to-r from-slate-400 to-slate-500"
                                                                )}
                                                            />
                                                        </div>

                                                        {/* Quick Progress Buttons */}
                                                        <div className="flex gap-1">
                                                            {[25, 50, 75, 100].map((p) => (
                                                                <button
                                                                    key={p}
                                                                    onClick={() => updateProgress(goal, p)}
                                                                    className={cn(
                                                                        "flex-1 py-1.5 text-xs rounded-lg font-medium transition-all",
                                                                        goal.progress >= p
                                                                            ? "bg-primary/10 text-primary"
                                                                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                                                    )}
                                                                >
                                                                    {p}%
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Milestones */}
                                                {goal.milestones && goal.milestones.length > 0 && !compact && (
                                                    <div className="mt-3 pt-3 border-t border-border/50">
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                                                            <TrendingUp className="w-3 h-3" />
                                                            <span>마일스톤 {goal.milestones.filter(m => m.completed).length}/{goal.milestones.length}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {goal.milestones.map((m) => (
                                                                <span
                                                                    key={m.id}
                                                                    className={cn(
                                                                        "text-xs px-2 py-1 rounded-md",
                                                                        m.completed
                                                                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 line-through"
                                                                            : "bg-muted text-muted-foreground"
                                                                    )}
                                                                >
                                                                    {m.title}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions & Expand Button */}
                                            <div className="flex flex-col gap-1">
                                                {/* Expand/Collapse Indicator */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleExpanded(goal.id);
                                                    }}
                                                    className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                                        isExpanded
                                                            ? "bg-primary/10 text-primary"
                                                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                                    )}
                                                    title={isExpanded ? "접기" : "연결된 일정 보기"}
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <div className={cn(
                                                    "flex flex-col gap-1 transition-opacity duration-200",
                                                    isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                )}>
                                                    {!goal.completed && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                completeGoal(goal);
                                                            }}
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
                                                            title="완료"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteGoal(goal);
                                                        }}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                                                        title="삭제"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        </div>

                                        {/* Linked Schedules - Expanded Section */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-4 pb-4 pt-2 border-t border-border/50 mx-4">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <Calendar className="w-4 h-4 text-primary" />
                                                            <span className="text-sm font-medium">연결된 일정</span>
                                                            {schedules.length > 0 && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                                    {schedules.length}개
                                                                </span>
                                                            )}
                                                        </div>

                                                        {isLoadingThisGoal ? (
                                                            <div className="flex items-center justify-center py-4">
                                                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                                            </div>
                                                        ) : schedules.length === 0 ? (
                                                            <div className="text-center py-4 text-sm text-muted-foreground">
                                                                <p>연결된 일정이 없습니다</p>
                                                                <p className="text-xs mt-1">
                                                                    일정 추가 시 이 목표와 연결하면 진행률이 자동으로 계산됩니다
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {schedules.map((schedule) => {
                                                                    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
                                                                    const repeatDays = schedule.daysOfWeek?.map(d => dayLabels[d]).join(', ');

                                                                    return (
                                                                        <div
                                                                            key={schedule.id}
                                                                            className={cn(
                                                                                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                                                                                schedule.completed
                                                                                    ? "bg-green-50 dark:bg-green-950/20"
                                                                                    : "bg-muted/30 hover:bg-muted/50"
                                                                            )}
                                                                        >
                                                                            <div className={cn(
                                                                                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                                                                schedule.completed
                                                                                    ? "bg-green-100 dark:bg-green-900/30"
                                                                                    : "bg-white dark:bg-card"
                                                                            )}>
                                                                                {schedule.completed ? (
                                                                                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                                                ) : (
                                                                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                                                                )}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className={cn(
                                                                                    "text-sm font-medium truncate",
                                                                                    schedule.completed && "text-muted-foreground line-through"
                                                                                )}>
                                                                                    {schedule.text}
                                                                                </p>
                                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                                    <span>{schedule.startTime}{schedule.endTime && ` - ${schedule.endTime}`}</span>
                                                                                    {schedule.specificDate ? (
                                                                                        <span className="px-1.5 py-0.5 rounded bg-muted">
                                                                                            {schedule.specificDate}
                                                                                        </span>
                                                                                    ) : repeatDays && (
                                                                                        <span className="px-1.5 py-0.5 rounded bg-muted">
                                                                                            매주 {repeatDays}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            {schedule.completed && (
                                                                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                                                                    완료
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* AI Tip Footer */}
            {totalCount === 0 && (
                <div className="px-6 py-4 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 border-t border-border/50">
                    <div className="flex items-center gap-4">
                        <FieriLogo className="w-12 h-12 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium">AI가 목표 달성을 도와드려요</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                목표를 설정하면 매일 진행 상황을 체크하고 격려 메시지를 보내드려요
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
