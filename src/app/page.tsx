"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
    Sparkles, Calendar, Brain, TrendingUp,
    BookOpen, Bell, Flame, ArrowRight,
    Check, ChevronRight, Zap, Shield, Clock,
    Target, BarChart3, Moon, Search, GraduationCap,
    MessageSquare,
} from "lucide-react";

// ============================================
// Fieri Logo
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
// Animation helpers
// ============================================

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number = 0) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const },
    }),
};

const stagger = {
    visible: { transition: { staggerChildren: 0.08 } },
};

// ============================================
// iPhone Mockup Component
// ============================================

function PhoneMockup({ feature }: { feature: (typeof FEATURE_DETAILS)[number] }) {
    const mc = feature.mockupContent;

    return (
        <div className="relative mx-auto w-[280px]">
            {/* iPhone 17 Pro — aluminum frame with ultra-thin bezels */}
            <div
                className="relative rounded-[3.2rem] bg-[#C0C0C8] p-[2px] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3),0_0_0_1px_rgba(0,0,0,0.08)]"
                style={{ background: "linear-gradient(145deg, #D4D4DC 0%, #A8A8B0 50%, #C0C0C8 100%)" }}
            >
                {/* Inner bezel — ultra-thin 3px */}
                <div className="rounded-[3.1rem] bg-black p-[3px]">
                    {/* Screen */}
                    <div className={`relative rounded-[2.9rem] overflow-hidden bg-gradient-to-b ${feature.gradient}`}>

                        {/* Dynamic Island — iPhone 17 Pro smaller pill (25% smaller) */}
                        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[90px] h-[25px] bg-black rounded-full z-20 flex items-center justify-center">
                            {/* Camera dot */}
                            <div className="w-[8px] h-[8px] rounded-full bg-[#1a1a2e] ring-1 ring-[#2a2a3e] ml-6" />
                        </div>

                        {/* Status bar */}
                        <div className="h-[52px] flex items-end justify-between px-7 pb-1 relative z-10">
                            <span className="text-[11px] font-semibold text-gray-800">9:41</span>
                            <div className="flex gap-[5px] items-center">
                                {/* Signal bars */}
                                <div className="flex gap-[1.5px] items-end h-[10px]">
                                    <div className="w-[3px] h-[4px] bg-gray-800 rounded-[0.5px]" />
                                    <div className="w-[3px] h-[6px] bg-gray-800 rounded-[0.5px]" />
                                    <div className="w-[3px] h-[8px] bg-gray-800 rounded-[0.5px]" />
                                    <div className="w-[3px] h-[10px] bg-gray-800 rounded-[0.5px]" />
                                </div>
                                {/* Wi-Fi */}
                                <svg className="w-[13px] h-[10px] text-gray-800" viewBox="0 0 16 12" fill="currentColor">
                                    <path d="M8 9.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM3.5 7.2a6.5 6.5 0 019 0l-1 1.1a5 5 0 00-7 0l-1-1.1zM1 4.5a10 10 0 0114 0l-1 1.1a8.5 8.5 0 00-12 0L1 4.5z" />
                                </svg>
                                {/* Battery */}
                                <div className="flex items-center gap-[2px]">
                                    <div className="w-[22px] h-[10px] border border-gray-800 rounded-[2.5px] p-[1.5px] relative">
                                        <div className="h-full w-[75%] bg-gray-800 rounded-[1px]" />
                                    </div>
                                    <div className="w-[1.5px] h-[4px] bg-gray-800 rounded-r-full" />
                                </div>
                            </div>
                        </div>

                        {/* App header */}
                        <div className="px-5 pt-1 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 ${feature.iconBg} rounded-xl flex items-center justify-center`}>
                                    <span className={`${feature.iconColor} scale-[0.45]`}>{feature.icon}</span>
                                </div>
                                <div>
                                    <span className="text-[13px] font-bold text-gray-900">{mc.title}</span>
                                    <p className="text-[9px] text-gray-400">Fi.eri</p>
                                </div>
                            </div>
                        </div>

                        {/* Content area */}
                        <div className="px-4 pb-10 min-h-[370px]">
                            {"messages" in mc && mc.messages && (
                                <div className="space-y-3">
                                    {mc.messages.map((msg, i) => (
                                        <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                                            {i % 2 !== 0 && (
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shrink-0 mr-2 mt-1">
                                                    <FieriLogo className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed ${
                                                i % 2 === 0
                                                    ? "bg-amber-500 text-white rounded-br-md shadow-sm shadow-amber-200/50"
                                                    : "bg-white/90 text-gray-700 rounded-bl-md shadow-sm backdrop-blur-sm"
                                            }`}>
                                                {msg}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {"schedules" in mc && mc.schedules && (
                                <div className="space-y-2">
                                    {mc.schedules.map((s, i) => (
                                        <div key={i} className="bg-white/90 backdrop-blur-sm rounded-2xl px-3.5 py-3 shadow-sm flex items-center gap-3">
                                            <div className={`w-1 h-8 rounded-full ${
                                                i === 0 ? "bg-amber-400" : i === 1 ? "bg-orange-400" : i === 2 ? "bg-rose-400" : "bg-purple-400"
                                            }`} />
                                            <span className="text-[11px] text-gray-700 font-medium">{s}</span>
                                        </div>
                                    ))}
                                    <div className="mt-3 bg-white/70 backdrop-blur-sm rounded-2xl px-3.5 py-3 text-center">
                                        <span className="text-[10px] text-gray-400">완료율</span>
                                        <div className="w-full h-2 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full" style={{ width: "75%" }} />
                                        </div>
                                        <span className="text-[11px] font-bold text-amber-600 mt-1 block">75%</span>
                                    </div>
                                </div>
                            )}

                            {"notifications" in mc && mc.notifications && (
                                <div className="space-y-2">
                                    {mc.notifications.map((n, i) => (
                                        <div key={i} className="bg-white/90 backdrop-blur-sm rounded-2xl px-3.5 py-3 shadow-sm">
                                            <p className="text-[11px] text-gray-700 leading-relaxed">{n}</p>
                                            <p className="text-[9px] text-gray-400 mt-1">{i === 0 ? "방금" : i === 1 ? "2분 전" : "35분 전"}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {"curriculum" in mc && mc.curriculum && (
                                <div className="space-y-2">
                                    {mc.curriculum.map((c, i) => (
                                        <div key={i} className="bg-white/90 backdrop-blur-sm rounded-2xl px-3.5 py-2.5 shadow-sm flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                                i < 2 ? "bg-emerald-100 text-emerald-600" : i === 2 ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400"
                                            }`}>
                                                {i < 2 ? "✓" : i + 1}
                                            </div>
                                            <span className={`text-[11px] ${i < 2 ? "text-gray-400 line-through" : "text-gray-700"} font-medium`}>{c}</span>
                                        </div>
                                    ))}
                                    <div className="mt-2 text-center">
                                        <span className="text-[10px] text-gray-400">진도율 40%</span>
                                        <div className="w-full h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" style={{ width: "40%" }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {"news" in mc && mc.news && (
                                <div className="space-y-2">
                                    {mc.news.map((n, i) => (
                                        <div key={i} className="bg-white/90 backdrop-blur-sm rounded-2xl px-3.5 py-3 shadow-sm">
                                            <p className="text-[11px] text-gray-700 font-medium leading-relaxed">{n}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <div className="w-4 h-4 rounded-md bg-gray-200" />
                                                <span className="text-[9px] text-gray-400">{["TechCrunch", "React Blog", "Apple"][i]} · {["3시간 전", "5시간 전", "8시간 전"][i]}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {"stats" in mc && mc.stats && (
                                <div>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        {mc.stats.map((s, i) => (
                                            <div key={i} className="bg-white/90 backdrop-blur-sm rounded-2xl py-3 px-2 text-center shadow-sm">
                                                <p className="text-lg font-black text-gray-800">{s.value}</p>
                                                <p className="text-[9px] text-gray-400 mt-0.5">{s.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3 shadow-sm">
                                        <p className="text-[10px] text-gray-400 mb-2">카테고리별 시간</p>
                                        <div className="space-y-2">
                                            {[{ label: "개발", w: "65%", color: "bg-sky-400" }, { label: "학습", w: "45%", color: "bg-indigo-400" }, { label: "미팅", w: "30%", color: "bg-amber-400" }].map((bar) => (
                                                <div key={bar.label}>
                                                    <div className="flex justify-between text-[9px] text-gray-500 mb-0.5">
                                                        <span>{bar.label}</span>
                                                        <span>{bar.w}</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${bar.color} rounded-full`} style={{ width: bar.w }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {"goals" in mc && mc.goals && (
                                <div className="space-y-2.5">
                                    {mc.goals.map((g, i) => (
                                        <div key={i} className="bg-white/90 backdrop-blur-sm rounded-2xl px-3.5 py-3 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[11px] text-gray-700 font-medium">{g.text}</span>
                                                <span className={`text-[11px] font-bold ${g.progress >= 100 ? "text-emerald-500" : "text-amber-600"}`}>{g.progress}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${g.progress >= 100 ? "bg-emerald-400" : "bg-gradient-to-r from-amber-400 to-orange-400"}`} style={{ width: `${g.progress}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {"streaks" in mc && mc.streaks && (
                                <div className="space-y-2.5">
                                    {mc.streaks.map((s, i) => (
                                        <div key={i} className="bg-white/90 backdrop-blur-sm rounded-2xl px-3.5 py-4 shadow-sm text-center">
                                            <p className="text-2xl font-black text-gray-800">{s.days}</p>
                                            <p className="text-[9px] text-gray-400 mt-1">연속 일수</p>
                                            <p className="text-[11px] text-gray-600 font-medium mt-1">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Home indicator */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                            <div className="w-[120px] h-[4px] bg-black/20 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Side buttons — Power (right) */}
            <div className="absolute right-[-2.5px] top-[120px] w-[3px] h-[50px] bg-gradient-to-b from-[#B8B8C0] via-[#D0D0D8] to-[#B8B8C0] rounded-r-sm" />
            {/* Volume buttons (left) */}
            <div className="absolute left-[-2.5px] top-[100px] w-[3px] h-[28px] bg-gradient-to-b from-[#B8B8C0] via-[#D0D0D8] to-[#B8B8C0] rounded-l-sm" />
            <div className="absolute left-[-2.5px] top-[140px] w-[3px] h-[28px] bg-gradient-to-b from-[#B8B8C0] via-[#D0D0D8] to-[#B8B8C0] rounded-l-sm" />
        </div>
    );
}

// ============================================
// Feature detail data
// ============================================

const FEATURE_DETAILS = [
    {
        icon: <Brain className="w-8 h-8" />,
        title: "AI 채팅 비서",
        subtitle: "말만 하면 AI가 실행합니다",
        description: "\"내일 오후 2시에 팀 미팅 잡아줘\", \"이번 주 목표 뭐였지?\" 처럼 자연어로 말하면 AI가 일정 추가, 수정, 삭제는 물론 목표 관리와 학습 추천까지 처리합니다. 매일 아침 맞춤 인사를 보내고, 저녁에는 하루를 정리해줍니다.",
        highlights: ["자연어 일정 관리 (추가/수정/삭제)", "매일 아침 맞춤 인사 & 저녁 체크인", "대화 맥락 기억 (Max 플랜: 장기 기억)", "웹 검색 연동으로 실시간 정보 제공"],
        iconBg: "bg-orange-100",
        iconColor: "text-orange-600",
        gradient: "from-amber-50 via-orange-50 to-rose-50",
        // screenshot: "/screenshots/chat.png",
        mockupContent: { title: "AI 채팅", messages: ["내일 오후 2시에 팀 미팅 잡아줘", "네, 내일 오후 2시에 '팀 미팅'을 추가했어요! 📅"] },
    },
    {
        icon: <Calendar className="w-8 h-8" />,
        title: "스마트 일정 관리",
        subtitle: "당신의 하루를 AI가 설계합니다",
        description: "단순한 캘린더가 아닙니다. AI가 일정 충돌을 자동 감지하고, 반복 일정을 관리하며, 시간대별 밀도를 분석합니다. 일정을 완료하면 실시간으로 완료율이 올라가고, 이 데이터가 주간 리포트로 이어집니다.",
        highlights: ["일정 충돌 자동 감지 & 대안 제안", "반복 일정 (매일/매주/매월) 지원", "시간대별 밀도 분석 (여유/보통/바쁨)", "일정 완료율 실시간 추적"],
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        gradient: "from-amber-50 via-yellow-50 to-orange-50",
        mockupContent: { title: "오늘의 일정", schedules: ["09:00 팀 스탠드업", "11:00 디자인 리뷰", "14:00 코드 리뷰", "16:00 1:1 미팅"] },
    },
    {
        icon: <Bell className="w-8 h-8" />,
        title: "프로액티브 알림",
        subtitle: "필요한 순간에, 먼저 다가갑니다",
        description: "일정 10분 전에 준비 알림을 보내고, 일정이 시작되면 응원 메시지를 보냅니다. 30분이 지나면 진행 상황을 물어보고, 일정 후에는 관련 리소스를 추천합니다. 오랜 시간 쉬고 있으면 할 만한 것도 제안합니다.",
        highlights: ["일정 10분 전 준비 팁 & 맥락 브리핑", "일정 시작 시 응원 메시지", "30분 후 진행 상황 체크", "유휴 감지 시 활동 추천"],
        iconBg: "bg-rose-100",
        iconColor: "text-rose-500",
        gradient: "from-rose-50 via-pink-50 to-red-50",
        mockupContent: { title: "알림", notifications: ["📋 10분 후 디자인 리뷰가 시작돼요", "💪 코드 리뷰 화이팅!", "⏰ 진행 중인 미팅, 잘 되고 있나요?"] },
    },
    {
        icon: <GraduationCap className="w-8 h-8" />,
        title: "AI 학습 커리큘럼",
        subtitle: "관심사를 말하면 커리큘럼이 생성됩니다",
        description: "\"React를 배우고 싶어\" 하면 AI가 5일 분량의 커리큘럼을 자동 생성합니다. 각 날짜별로 학습 슬라이드가 만들어지고, 진도율을 추적합니다. 학습이 끝나면 관련 유튜브 영상과 아티클도 추천합니다.",
        highlights: ["관심사 기반 5일 커리큘럼 자동 생성", "일별 학습 슬라이드 (마크다운 기반)", "학습 진도 추적 & 완료 기록", "관련 유튜브 & 아티클 추천"],
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        gradient: "from-emerald-50 via-teal-50 to-cyan-50",
        mockupContent: { title: "학습 커리큘럼", curriculum: ["Day 1: React 기초", "Day 2: 컴포넌트 & Props", "Day 3: State & Hooks", "Day 4: 라우팅 & API", "Day 5: 프로젝트 실습"] },
    },
    {
        icon: <Flame className="w-8 h-8" />,
        title: "트렌드 브리핑",
        subtitle: "매일 아침, 당신의 관심사 뉴스를 요약합니다",
        description: "프로필에 설정한 관심사(개발, 디자인, 마케팅, AI 등)에 맞춰 매일 최신 트렌드를 요약해드립니다. AI가 뉴스를 직접 읽고 핵심만 추출하므로, 바쁜 아침에도 업계 흐름을 놓치지 않습니다.",
        highlights: ["관심사별 맞춤 뉴스 요약", "AI가 핵심만 추출한 간결한 브리핑", "매일 자동 갱신 (데일리 브리핑)", "원문 링크로 바로 이동"],
        iconBg: "bg-purple-100",
        iconColor: "text-purple-600",
        gradient: "from-violet-50 via-purple-50 to-pink-50",
        mockupContent: { title: "트렌드 브리핑", news: ["🔥 GPT-5 출시 임박, 달라진 점은?", "⚛️ React 19 정식 릴리즈", "📱 Apple Vision Pro 한국 출시"] },
    },
    {
        icon: <BarChart3 className="w-8 h-8" />,
        title: "주간 성장 리포트",
        subtitle: "한 주의 성장을 카드 뉴스로 확인하세요",
        description: "매주 일요일, AI가 한 주간의 일정 완료율, 학습 진도, 카테고리별 시간 분배, 습관 스트릭을 분석합니다. 인스타 스토리 스타일의 카드 뉴스로 만들어져 SNS에 바로 공유할 수도 있습니다.",
        highlights: ["주간 일정 완료율 & 학습 진도 분석", "카테고리별 시간 분배 시각화", "습관 스트릭 추적 (연속 달성 일수)", "인스타 스토리 공유 기능"],
        iconBg: "bg-sky-100",
        iconColor: "text-sky-600",
        gradient: "from-sky-50 via-blue-50 to-indigo-50",
        mockupContent: { title: "주간 리포트", stats: [{ label: "완료율", value: "87%" }, { label: "학습", value: "12h" }, { label: "스트릭", value: "14일" }] },
    },
    {
        icon: <Target className="w-8 h-8" />,
        title: "목표 관리",
        subtitle: "주간/월간/연간 목표를 세우고 추적합니다",
        description: "AI와 대화하면서 목표를 세울 수 있습니다. \"이번 주 목표: 운동 3번\" 처럼 말하면 자동으로 등록되고, 진행률을 추적합니다. 목표 달성률이 떨어지면 AI가 리마인더를 보내고, 매주 자동으로 리셋됩니다.",
        highlights: ["주간/월간/연간 목표 설정", "AI 대화로 간편 목표 등록", "진행률 실시간 추적", "미달성 시 AI 리마인더"],
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
        gradient: "from-indigo-50 via-blue-50 to-violet-50",
        mockupContent: { title: "이번 주 목표", goals: [{ text: "운동 3회", progress: 66 }, { text: "독서 30분", progress: 100 }, { text: "사이드 프로젝트", progress: 40 }] },
    },
    {
        icon: <Moon className="w-8 h-8" />,
        title: "저녁 체크인",
        subtitle: "하루의 끝, AI가 정리해줍니다",
        description: "저녁 시간이 되면 AI가 오늘 완료한 일정을 정리하고, 못 다한 일정은 내일로 옮길지 물어봅니다. 하루의 성취를 인정해주고, 내일을 위한 간단한 제안도 해줍니다.",
        highlights: ["오늘의 일정 완료 요약", "미완료 일정 재배치 제안", "하루 성취 피드백", "내일 일정 미리보기"],
        iconBg: "bg-violet-100",
        iconColor: "text-violet-600",
        gradient: "from-violet-50 via-purple-50 to-fuchsia-50",
        mockupContent: { title: "저녁 체크인", messages: ["오늘 5개 중 4개를 완료했어요! 🎉", "'코드 리뷰'를 내일로 옮길까요?"] },
    },
    {
        icon: <Search className="w-8 h-8" />,
        title: "웹 검색 연동",
        subtitle: "AI가 직접 검색해서 답해줍니다",
        description: "\"요즘 React 19 뭐가 바뀌었어?\" 같은 질문에 AI가 실시간으로 웹을 검색하고, 결과를 요약해서 알려줍니다. 최신 정보가 필요한 질문에도 정확하게 대응합니다.",
        highlights: ["실시간 웹 검색 & 결과 요약", "출처 링크 제공", "최신 정보 기반 답변", "검색 + AI 분석 결합"],
        iconBg: "bg-teal-100",
        iconColor: "text-teal-600",
        gradient: "from-teal-50 via-emerald-50 to-green-50",
        mockupContent: { title: "웹 검색", messages: ["요즘 React 19 뭐가 바뀌었어?", "🔍 검색 중...\n\nReact 19의 주요 변경사항:\n• Actions API 도입\n• use() 훅 추가\n• 서버 컴포넌트 안정화"] },
    },
    {
        icon: <Flame className="w-8 h-8" />,
        title: "스트릭 & 습관 추적",
        subtitle: "꾸준함이 실력이 됩니다",
        description: "일정 완료, 학습 진행, 목표 달성을 매일 추적하여 연속 달성 일수를 기록합니다. 스트릭이 끊기지 않도록 AI가 응원하고, 최장 기록 달성 시 축하 메시지를 보냅니다.",
        highlights: ["일정 완료 스트릭", "학습 연속 일수 추적", "총 활동 일수 기록", "스트릭 유지 리마인더"],
        iconBg: "bg-orange-100",
        iconColor: "text-orange-500",
        gradient: "from-orange-50 via-amber-50 to-yellow-50",
        mockupContent: { title: "스트릭", streaks: [{ label: "🔥 일정 완료", days: 14 }, { label: "📚 학습", days: 7 }, { label: "🎯 총 활동", days: 23 }] },
    },
];

const PLANS = [
    {
        name: "Standard",
        nameKo: "스탠더드",
        price: "무료",
        period: "",
        description: "기본 AI 비서 기능",
        features: ["일일 AI 호출 50회", "AI 채팅 및 일정 관리", "아침 인사 & 학습 팁", "유튜브 리소스 추천", "선제적 알림"],
        highlight: false,
        badge: null,
    },
    {
        name: "Pro",
        nameKo: "프로",
        price: "₩9,900",
        period: "/월",
        description: "스마트 알림 & 브리핑",
        features: ["일일 AI 호출 100회", "Standard의 모든 기능", "리스크 알림 (충돌/마감 감지)", "스마트 뉴스 브리핑", "ReAct 에이전트 추론"],
        highlight: true,
        badge: "인기",
    },
    {
        name: "Max",
        nameKo: "맥스",
        price: "₩21,900",
        period: "/월",
        description: "AI가 당신을 기억합니다",
        features: ["무제한 AI 호출", "Pro의 모든 기능", "AI 장기 기억 (RAG)", "선제적 전략 제안", "자동 실행 모드"],
        highlight: false,
        badge: "최고",
    },
];

// ============================================
// Landing Page
// ============================================

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#FFFCF7] text-gray-900 overflow-x-hidden">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FFFCF7]/80 backdrop-blur-xl border-b border-amber-200/50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FieriLogo className="w-9 h-9" />
                        <span className="text-xl font-bold tracking-tight text-gray-900">Fi.eri</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href="#features" className="hidden sm:inline text-sm text-gray-500 hover:text-gray-800 transition px-3 py-2">기능</a>
                        <a href="#pricing" className="hidden sm:inline text-sm text-gray-500 hover:text-gray-800 transition px-3 py-2">요금제</a>
                        <a href="#download" className="hidden sm:inline text-sm text-gray-500 hover:text-gray-800 transition px-3 py-2">앱 다운로드</a>
                        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-800 transition px-4 py-2">로그인</Link>
                        <Link
                            href="/signup"
                            className="text-sm bg-gradient-to-r from-amber-400 to-orange-400 text-white font-semibold px-5 py-2 rounded-full hover:from-amber-500 hover:to-orange-500 transition shadow-md shadow-amber-200/50"
                        >
                            무료로 시작하기
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative pt-32 pb-24 px-6">
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-gradient-radial from-[#FDD7A7]/30 via-orange-200/10 to-transparent rounded-full blur-3xl pointer-events-none" />

                <motion.div
                    className="max-w-4xl mx-auto text-center relative"
                    initial="hidden"
                    animate="visible"
                    variants={stagger}
                >
                    <motion.div variants={fadeUp} custom={0} className="flex items-center justify-center gap-2 mb-8">
                        <FieriLogo className="w-20 h-20 drop-shadow-lg" />
                    </motion.div>

                    <motion.div variants={fadeUp} custom={0.5} className="flex items-center justify-center gap-2 mb-6">
                        <span className="text-sm bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-amber-700">
                            <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-amber-500" />
                            AI 기반 개인 성장 OS
                        </span>
                    </motion.div>

                    <motion.h1 variants={fadeUp} custom={1} className="text-5xl sm:text-7xl font-black leading-tight tracking-tight text-gray-900">
                        당신의 하루를
                        <br />
                        <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-400 bg-clip-text text-transparent">
                            AI가 설계합니다
                        </span>
                    </motion.h1>

                    <motion.p variants={fadeUp} custom={2} className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mt-8 leading-relaxed">
                        일정 관리, 학습 커리큘럼, 트렌드 브리핑, 주간 리포트까지.
                        <br />
                        Fi.eri가 매일 아침 당신을 맞이하고, 저녁에 하루를 정리해줍니다.
                    </motion.p>

                    <motion.div variants={fadeUp} custom={3} className="flex flex-col items-center gap-6 mt-12">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <a
                                href="#"
                                className="group flex items-center gap-3 bg-black text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-gray-800 transition shadow-lg"
                            >
                                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                                <div className="text-left">
                                    <p className="text-[10px] leading-tight opacity-80">Download on the</p>
                                    <p className="text-base font-bold leading-tight">App Store</p>
                                </div>
                            </a>
                            <a
                                href="#"
                                className="group flex items-center gap-3 bg-black text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-gray-800 transition shadow-lg"
                            >
                                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302c.659.439.659 1.282 0 1.722l-2.302 2.302L15.095 12l2.603-2.492zM3.864 1.667L14.801 7.99l-2.302 2.302L3.864 1.667z"/></svg>
                                <div className="text-left">
                                    <p className="text-[10px] leading-tight opacity-80">GET IT ON</p>
                                    <p className="text-base font-bold leading-tight">Google Play</p>
                                </div>
                            </a>
                        </div>
                        <Link
                            href="/signup"
                            className="text-sm text-amber-600 hover:text-amber-700 transition font-medium underline underline-offset-4"
                        >
                            또는 웹에서 가입하기
                        </Link>
                    </motion.div>

                    <motion.div variants={fadeUp} custom={4} className="flex items-center justify-center gap-6 mt-12 text-gray-400 text-sm">
                        <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-amber-400" /> 안전한 데이터</span>
                        <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-400" /> 즉시 사용 가능</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-400" /> 설정 1분</span>
                    </motion.div>
                </motion.div>
            </section>

            {/* Feature Details */}
            <section className="py-24 px-6" id="features">
                <div className="max-w-6xl mx-auto">
                    <motion.div
                        className="text-center mb-20"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-100px" }}
                        variants={stagger}
                    >
                        <motion.p variants={fadeUp} className="text-sm text-amber-600 font-semibold mb-3 tracking-wide">FEATURES</motion.p>
                        <motion.h2 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl font-black text-gray-900">
                            하나의 앱으로 충분합니다
                        </motion.h2>
                        <motion.p variants={fadeUp} custom={2} className="text-gray-500 mt-4 text-lg max-w-2xl mx-auto">
                            캘린더, 할일, 학습 앱을 따로 쓸 필요 없어요. Fi.eri 하나로 일정, 학습, 성장을 모두 관리하세요.
                        </motion.p>
                    </motion.div>

                    {/* Feature Detail Cards */}
                    <div className="space-y-24">
                        {FEATURE_DETAILS.map((feature, i) => (
                            <motion.div
                                key={feature.title}
                                className={`flex flex-col ${i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"} gap-12 lg:gap-16 items-center`}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true, margin: "-80px" }}
                                variants={stagger}
                            >
                                {/* Text */}
                                <motion.div variants={fadeUp} custom={0} className="flex-1 max-w-xl">
                                    <div className={`w-14 h-14 ${feature.iconBg} rounded-2xl flex items-center justify-center mb-5 ${feature.iconColor}`}>
                                        {feature.icon}
                                    </div>
                                    <p className="text-sm text-amber-600 font-semibold mb-1">{feature.subtitle}</p>
                                    <h3 className="text-3xl font-black mb-4 text-gray-900">{feature.title}</h3>
                                    <p className="text-gray-500 leading-relaxed mb-6">{feature.description}</p>
                                    <ul className="space-y-2.5">
                                        {feature.highlights.map((h) => (
                                            <li key={h} className="flex items-start gap-2.5 text-sm">
                                                <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                <span className="text-gray-600">{h}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>

                                {/* Visual - iPhone Mockup */}
                                <motion.div variants={fadeUp} custom={1} className="flex-1 max-w-sm w-full flex justify-center">
                                    <PhoneMockup feature={feature} />
                                </motion.div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-24 px-6 bg-gradient-to-b from-amber-50/50 via-orange-50/30 to-transparent">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        className="text-center mb-16"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={stagger}
                    >
                        <motion.p variants={fadeUp} className="text-sm text-orange-500 font-semibold mb-3 tracking-wide">HOW IT WORKS</motion.p>
                        <motion.h2 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl font-black text-gray-900">
                            시작은 간단합니다
                        </motion.h2>
                    </motion.div>

                    <motion.div
                        className="space-y-12"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={stagger}
                    >
                        {[
                            { step: "01", title: "가입하고 프로필 설정", desc: "앱을 다운로드하고 프로필을 설정하세요. 1분이면 충분합니다.", color: "text-amber-300" },
                            { step: "02", title: "AI가 하루를 설계", desc: "매일 아침 맞춤 인사와 일정을 받아보세요. 일정 충돌도 자동 감지합니다.", color: "text-orange-300" },
                            { step: "03", title: "실행하고 성장 확인", desc: "완료한 일정을 체크하면 주간 리포트로 성장 추이를 한눈에 봅니다.", color: "text-rose-300" },
                        ].map((item, i) => (
                            <motion.div key={item.step} variants={fadeUp} custom={i} className="flex gap-8 items-start">
                                <div className={`text-5xl font-black ${item.color} shrink-0 w-20`}>{item.step}</div>
                                <div>
                                    <h3 className="text-2xl font-bold mb-2 text-gray-900">{item.title}</h3>
                                    <p className="text-gray-500 text-lg">{item.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Pricing */}
            <section className="py-24 px-6" id="pricing">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        className="text-center mb-16"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={stagger}
                    >
                        <motion.p variants={fadeUp} className="text-sm text-amber-600 font-semibold mb-3 tracking-wide">PRICING</motion.p>
                        <motion.h2 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl font-black text-gray-900">
                            무료로 시작, 필요하면 업그레이드
                        </motion.h2>
                        <motion.p variants={fadeUp} custom={2} className="text-gray-500 mt-4 text-lg">
                            Standard 플랜은 영구 무료입니다
                        </motion.p>
                    </motion.div>

                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={stagger}
                    >
                        {PLANS.map((plan, i) => (
                            <motion.div
                                key={plan.name}
                                variants={fadeUp}
                                custom={i}
                                className={`relative bg-white border rounded-2xl p-8 ${
                                    plan.highlight
                                        ? "border-amber-400 ring-2 ring-amber-200 scale-[1.02] shadow-lg shadow-amber-100/50"
                                        : "border-amber-100 hover:border-amber-200"
                                } transition-all`}
                            >
                                {plan.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
                                        {plan.badge}
                                    </div>
                                )}
                                <p className="text-sm text-gray-400 mb-1">{plan.nameKo}</p>
                                <div className="flex items-baseline gap-1 mb-2">
                                    <span className="text-4xl font-black text-gray-900">{plan.price}</span>
                                    {plan.period && <span className="text-gray-400">{plan.period}</span>}
                                </div>
                                <p className="text-gray-500 text-sm mb-6">{plan.description}</p>
                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2 text-sm">
                                            <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <span className="text-gray-600">{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href="/signup"
                                    className={`block text-center py-3 rounded-xl font-semibold text-sm transition ${
                                        plan.highlight
                                            ? "bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-200/50"
                                            : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                                    }`}
                                >
                                    {plan.price === "무료" ? "무료로 시작" : "시작하기"}
                                    <ChevronRight className="w-4 h-4 inline ml-1" />
                                </Link>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-6" id="download">
                <motion.div
                    className="max-w-3xl mx-auto text-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-200/50 rounded-3xl p-16"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={stagger}
                >
                    <motion.div variants={fadeUp}>
                        <FieriLogo className="w-20 h-20 mx-auto mb-6 drop-shadow-lg" />
                    </motion.div>
                    <motion.h2 variants={fadeUp} custom={1} className="text-4xl font-black mb-4 text-gray-900">
                        오늘부터 시작하세요
                    </motion.h2>
                    <motion.p variants={fadeUp} custom={2} className="text-gray-500 text-lg mb-8">
                        AI가 당신의 성장을 함께합니다. 무료로 체험해보세요.
                    </motion.p>
                    <motion.div variants={fadeUp} custom={3} className="flex flex-col items-center gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <a
                                href="#"
                                className="group flex items-center gap-3 bg-black text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-gray-800 transition shadow-lg"
                            >
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                                <div className="text-left">
                                    <p className="text-[10px] leading-tight opacity-80">App Store</p>
                                    <p className="text-sm font-bold leading-tight">다운로드</p>
                                </div>
                            </a>
                            <a
                                href="#"
                                className="group flex items-center gap-3 bg-black text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-gray-800 transition shadow-lg"
                            >
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302c.659.439.659 1.282 0 1.722l-2.302 2.302L15.095 12l2.603-2.492zM3.864 1.667L14.801 7.99l-2.302 2.302L3.864 1.667z"/></svg>
                                <div className="text-left">
                                    <p className="text-[10px] leading-tight opacity-80">Google Play</p>
                                    <p className="text-sm font-bold leading-tight">다운로드</p>
                                </div>
                            </a>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* Footer */}
            <footer className="border-t border-amber-100 py-12 px-6 bg-amber-50/30">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <FieriLogo className="w-7 h-7" />
                        <span className="text-sm text-gray-400">Fi.eri - AI Personal Growth OS</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-400">
                        <Link href="/login" className="hover:text-gray-600 transition">로그인</Link>
                        <Link href="/signup" className="hover:text-gray-600 transition">가입하기</Link>
                        <a href="#pricing" className="hover:text-gray-600 transition">요금제</a>
                        <Link href="/privacy" className="hover:text-gray-600 transition">개인정보처리방침</Link>
                        <Link href="/terms" className="hover:text-gray-600 transition">이용약관</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
