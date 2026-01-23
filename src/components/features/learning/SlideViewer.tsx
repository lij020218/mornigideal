"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft, ChevronRight, X, Loader2, BookOpen,
    Maximize2, Minimize2, Check, FileText, Lightbulb
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Fieri Logo SVG Component - 앰버색 소용돌이 로고
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

interface Quiz {
    question: string;
    options: string[];
    answer: number; // 0-based index
    explanation: string;
}

interface Slide {
    slideNumber: number;
    title: string;
    type?: "quiz" | "content";
    content: string[];
    notes?: string;
    visualSuggestion?: string;
    quiz?: Quiz;
}

interface SlideViewerProps {
    curriculumId: string;
    dayNumber: number;
    dayTitle: string;
    dayDescription: string;
    objectives: string[];
    topic: string;
    currentLevel: string;
    targetLevel: string;
    onClose: () => void;
    onComplete: () => void;
}

export function SlideViewer({
    curriculumId,
    dayNumber,
    dayTitle,
    dayDescription,
    objectives,
    topic,
    currentLevel,
    targetLevel,
    onClose,
    onComplete,
}: SlideViewerProps) {
    const [slides, setSlides] = useState<Slide[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [error, setError] = useState<{ type: 'plan' | 'general'; message: string } | null>(null);

    // Quiz state
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showQuizResult, setShowQuizResult] = useState(false);
    const [quizResults, setQuizResults] = useState<Record<number, boolean>>({});

    useEffect(() => {
        fetchSlides();
    }, [curriculumId, dayNumber]);

    const fetchSlides = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log("[SlideViewer] Fetching slides for:", { curriculumId, dayNumber });

            // First try to get existing slides
            const getRes = await fetch(
                `/api/ai-learning-slides?curriculumId=${encodeURIComponent(curriculumId)}&dayNumber=${dayNumber}`
            );

            if (getRes.ok) {
                const data = await getRes.json();
                console.log("[SlideViewer] GET response:", {
                    curriculumId,
                    dayNumber,
                    hasSlides: !!data.slides,
                    slidesLength: data.slides?.length,
                    slidesData: data.slides ? 'exists' : 'null'
                });
                if (data.slides && Array.isArray(data.slides) && data.slides.length > 0) {
                    console.log("[SlideViewer] Using cached slides from DB");
                    setSlides(data.slides);
                    setIsLoading(false);
                    return;
                }
            } else {
                console.log("[SlideViewer] GET request failed:", getRes.status);
            }

            // If no existing slides, generate new ones
            const postRes = await fetch("/api/ai-learning-slides", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    curriculumId,
                    dayNumber,
                    dayTitle,
                    dayDescription,
                    objectives,
                    topic,
                    currentLevel,
                    targetLevel,
                }),
            });

            if (postRes.status === 403) {
                setError({
                    type: 'plan',
                    message: '슬라이드 생성은 Max 플랜 사용자만 이용할 수 있습니다.'
                });
                return;
            }

            if (postRes.ok) {
                const data = await postRes.json();
                setSlides(data.slides || []);
            } else {
                setError({
                    type: 'general',
                    message: '슬라이드를 생성하는 데 실패했습니다.'
                });
            }
        } catch (error) {
            console.error("[SlideViewer] Failed to fetch slides:", error);
            setError({
                type: 'general',
                message: '네트워크 오류가 발생했습니다.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = () => {
        if (currentSlide < slides.length - 1) {
            handleSlideChange(currentSlide + 1);
        }
    };

    const handlePrev = () => {
        if (currentSlide > 0) {
            handleSlideChange(currentSlide - 1);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight" || e.key === " ") {
            handleNext();
        } else if (e.key === "ArrowLeft") {
            handlePrev();
        } else if (e.key === "Escape") {
            if (isFullscreen) {
                setIsFullscreen(false);
            } else {
                onClose();
            }
        }
    };

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentSlide, slides.length, isFullscreen]);

    const isLastSlide = currentSlide === slides.length - 1;
    const progressPercent = slides.length > 0 ? ((currentSlide + 1) / slides.length) * 100 : 0;

    // 핵심 개념 하이라이트 렌더링 함수
    const renderContentWithHighlight = (text: string) => {
        // **핵심 개념** 용어: 정의 패턴 파싱 - 블록으로 분리
        const keyConceptPattern = /\*\*핵심 개념\*\*\s*([^:：]+)[:\s：]\s*([^。.]*[。.]?)/g;

        // 핵심 개념이 있는지 확인
        const conceptMatch = keyConceptPattern.exec(text);

        if (conceptMatch) {
            const term = conceptMatch[1].trim();
            const definition = conceptMatch[2].trim();
            const beforeText = text.slice(0, conceptMatch.index).trim();
            const afterText = text.slice(conceptMatch.index + conceptMatch[0].length).trim();

            return (
                <div className="space-y-3">
                    {/* 앞부분 텍스트 */}
                    {beforeText && (
                        <p>{renderBoldText(beforeText, 'before')}</p>
                    )}

                    {/* 핵심 개념 카드 */}
                    <div className="flex items-start gap-2 md:gap-3 p-3 md:p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 rounded-r-xl">
                        <div className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs md:text-sm">💡</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-bold text-purple-700 text-base md:text-lg">{term}</div>
                            {definition && (
                                <div className="text-gray-600 mt-1 text-sm md:text-base">{definition}</div>
                            )}
                        </div>
                    </div>

                    {/* 뒷부분 텍스트 */}
                    {afterText && (
                        <p>{renderBoldText(afterText, 'after')}</p>
                    )}
                </div>
            );
        }

        // 핵심 개념이 없으면 일반 bold 처리만
        return <p>{renderBoldText(text, 'full')}</p>;
    };

    // **bold** 텍스트 렌더링
    const renderBoldText = (text: string, keyPrefix: string): React.ReactElement => {
        const boldPattern = /\*\*([^*]+)\*\*/g;
        const parts: (string | React.ReactElement)[] = [];
        let lastIndex = 0;
        let match;

        while ((match = boldPattern.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }
            parts.push(
                <strong key={`${keyPrefix}-bold-${match.index}`} className="font-semibold text-purple-700">
                    {match[1]}
                </strong>
            );
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return <>{parts.length > 0 ? parts : text}</>;
    };

    // 퀴즈 답 선택 핸들러
    const handleQuizAnswer = (optionIndex: number) => {
        if (showQuizResult) return; // 이미 결과를 봤으면 변경 불가
        setSelectedAnswer(optionIndex);
    };

    // 퀴즈 제출 핸들러
    const handleQuizSubmit = () => {
        if (selectedAnswer === null) return;
        const slide = slides[currentSlide];
        if (!slide.quiz) return;

        const isCorrect = selectedAnswer === slide.quiz.answer;
        setQuizResults(prev => ({ ...prev, [currentSlide]: isCorrect }));
        setShowQuizResult(true);
    };

    // 슬라이드 변경 시 퀴즈 상태 초기화
    const handleSlideChange = (newSlide: number) => {
        setCurrentSlide(newSlide);
        setSelectedAnswer(null);
        setShowQuizResult(false);
    };

    // 퀴즈 슬라이드 렌더링
    const renderQuizSlide = (slide: Slide) => {
        if (!slide.quiz) return null;
        const { question, options, answer, explanation } = slide.quiz;
        const isCorrect = selectedAnswer === answer;

        return (
            <div className="space-y-4 md:space-y-6">
                {/* 퀴즈 질문 */}
                <div className="p-4 md:p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl md:rounded-2xl">
                    <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                        <span className="text-xl md:text-2xl">🤔</span>
                        <span className="font-bold text-purple-700 text-sm md:text-base">문제</span>
                    </div>
                    <p className="text-base md:text-lg text-gray-800 font-medium">{question}</p>
                </div>

                {/* 선택지 */}
                <div className="space-y-2 md:space-y-3">
                    {options.map((option, index) => {
                        const isSelected = selectedAnswer === index;
                        const isAnswer = index === answer;

                        let buttonStyle = "border-gray-200 hover:border-purple-300 hover:bg-purple-50";
                        if (showQuizResult) {
                            if (isAnswer) {
                                buttonStyle = "border-green-500 bg-green-50 text-green-700";
                            } else if (isSelected && !isAnswer) {
                                buttonStyle = "border-red-400 bg-red-50 text-red-600";
                            }
                        } else if (isSelected) {
                            buttonStyle = "border-purple-500 bg-purple-50 text-purple-700";
                        }

                        return (
                            <motion.button
                                key={index}
                                onClick={() => handleQuizAnswer(index)}
                                disabled={showQuizResult}
                                whileHover={!showQuizResult ? { scale: 1.01 } : {}}
                                whileTap={!showQuizResult ? { scale: 0.98 } : {}}
                                className={cn(
                                    "w-full p-3 md:p-4 rounded-lg md:rounded-xl border-2 text-left transition-all flex items-center gap-2 md:gap-3",
                                    buttonStyle
                                )}
                            >
                                <span className={cn(
                                    "w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0",
                                    showQuizResult && isAnswer ? "bg-green-500 text-white" :
                                        showQuizResult && isSelected && !isAnswer ? "bg-red-400 text-white" :
                                            isSelected ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-600"
                                )}>
                                    {showQuizResult && isAnswer ? "✓" : showQuizResult && isSelected && !isAnswer ? "✗" : index + 1}
                                </span>
                                <span className="flex-1 text-sm md:text-base">{option}</span>
                            </motion.button>
                        );
                    })}
                </div>

                {/* 제출 버튼 또는 결과 */}
                {!showQuizResult ? (
                    <motion.button
                        onClick={handleQuizSubmit}
                        disabled={selectedAnswer === null}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                            "w-full py-3 md:py-4 rounded-lg md:rounded-xl font-bold text-base md:text-lg transition-all",
                            selectedAnswer !== null
                                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        )}
                    >
                        정답 확인하기
                    </motion.button>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "p-4 md:p-5 rounded-lg md:rounded-xl",
                            isCorrect ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"
                        )}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg md:text-xl">{isCorrect ? "🎉" : "💡"}</span>
                            <span className={cn("font-bold text-sm md:text-base", isCorrect ? "text-green-600" : "text-amber-600")}>
                                {isCorrect ? "정답입니다!" : "아쉬워요!"}
                            </span>
                        </div>
                        <p className="text-gray-700 text-sm md:text-base">{explanation}</p>
                    </motion.div>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20 p-4"
            >
                <div className="text-center">
                    {/* Logo with spinning ring */}
                    <div className="relative mb-6 md:mb-8">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="w-24 h-24 md:w-32 md:h-32 mx-auto"
                        >
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 border-r-pink-500" />
                        </motion.div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <FieriLogo className="w-14 h-14 md:w-20 md:h-20" />
                        </div>
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2">학습 슬라이드 생성 중...</h3>
                    <p className="text-xs md:text-sm text-gray-500">
                        AI가 맞춤형 학습 콘텐츠를 만들고 있어요
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-1">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                            className="w-2 h-2 rounded-full bg-purple-400"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                            className="w-2 h-2 rounded-full bg-violet-400"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                            className="w-2 h-2 rounded-full bg-pink-400"
                        />
                    </div>
                </div>
            </motion.div>
        );
    }

    if (error) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20 p-4"
            >
                <div className="text-center bg-white/80 backdrop-blur-sm rounded-xl md:rounded-2xl p-5 md:p-8 shadow-xl border border-gray-100 max-w-md w-full">
                    {error.type === 'plan' ? (
                        <>
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4">
                                <span className="text-2xl md:text-3xl">✨</span>
                            </div>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 mb-2">Max 플랜 전용 기능</h3>
                            <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
                                {error.message}
                            </p>
                            <p className="text-xs text-gray-400 mb-4 md:mb-6">
                                Max 플랜에서는 AI가 맞춤형 학습 슬라이드를 생성해드려요!
                            </p>
                            <div className="flex gap-2 md:gap-3 justify-center">
                                <Button onClick={onClose} variant="outline" size="sm" className="border-gray-200 h-9 md:h-10">
                                    닫기
                                </Button>
                                <Button
                                    onClick={() => window.location.href = '/settings'}
                                    size="sm"
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white h-9 md:h-10"
                                >
                                    플랜 업그레이드
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <FileText className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 md:mb-4" />
                            <h3 className="text-base md:text-lg font-bold text-gray-800 mb-2">오류가 발생했습니다</h3>
                            <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
                                {error.message}
                            </p>
                            <div className="flex gap-2 md:gap-3 justify-center">
                                <Button onClick={onClose} variant="outline" size="sm" className="border-gray-200 h-9 md:h-10">
                                    닫기
                                </Button>
                                <Button onClick={fetchSlides} size="sm" className="bg-purple-500 hover:bg-purple-600 text-white h-9 md:h-10">
                                    다시 시도
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>
        );
    }

    if (slides.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20 p-4"
            >
                <div className="text-center bg-white/80 backdrop-blur-sm rounded-xl md:rounded-2xl p-5 md:p-8 shadow-xl border border-gray-100 max-w-md w-full">
                    <FileText className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 md:mb-4" />
                    <h3 className="text-base md:text-lg font-bold text-gray-800 mb-2">슬라이드를 불러올 수 없습니다</h3>
                    <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
                        다시 시도해주세요
                    </p>
                    <Button onClick={onClose} variant="outline" size="sm" className="border-gray-200 h-9 md:h-10">
                        닫기
                    </Button>
                </div>
            </motion.div>
        );
    }

    const slide = slides[currentSlide];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
                "fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20",
                isFullscreen ? "" : "pt-16 pb-4 px-3 md:pt-8 md:pb-8 md:px-8"
            )}
        >
            {/* Header */}
            {!isFullscreen && (
                <div className="flex items-center justify-between mb-3 md:mb-4 bg-white/90 backdrop-blur-sm rounded-xl md:rounded-2xl px-3 md:px-4 py-2.5 md:py-3 border border-gray-200/50 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                        <FieriLogo className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <h2 className="font-bold text-gray-800 text-sm md:text-base truncate">Day {dayNumber}: {dayTitle}</h2>
                            <p className="text-xs text-gray-600 truncate">{topic}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                        <Button
                            onClick={() => setShowNotes(!showNotes)}
                            variant="outline"
                            size="sm"
                            className={cn(
                                "gap-1 md:gap-2 border-gray-300 hover:bg-purple-50 h-8 md:h-9 px-2 md:px-3",
                                showNotes && "bg-purple-100 border-purple-300"
                            )}
                        >
                            <Lightbulb className={cn("w-4 h-4", showNotes ? "text-purple-600" : "text-gray-600")} />
                            <span className="hidden md:inline">노트</span>
                        </Button>
                        <Button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            variant="outline"
                            size="sm"
                            className="border-gray-300 hover:bg-purple-50 h-8 md:h-9 px-2 md:px-3 hidden md:flex"
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-4 h-4 text-gray-600" />
                            ) : (
                                <Maximize2 className="w-4 h-4 text-gray-600" />
                            )}
                        </Button>
                        <Button onClick={onClose} variant="ghost" size="sm" className="hover:bg-gray-100 h-8 md:h-9 px-2 md:px-3">
                            <X className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Slide Content */}
            <div className={cn(
                "flex-1 flex flex-col overflow-hidden min-h-0",
                isFullscreen ? "p-8" : ""
            )}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-10 flex flex-col shadow-lg border border-gray-200/50 overflow-y-auto min-h-0"
                    >
                        {/* Slide Number */}
                        <div className="flex items-center justify-between mb-2 md:mb-4 flex-shrink-0">
                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 md:px-3 py-1 rounded-full">
                                {slide.slideNumber} / {slides.length}
                            </span>
                            {slide.visualSuggestion && (
                                <span className="text-xs text-purple-600 flex items-center gap-1 bg-purple-100 px-2 md:px-3 py-1 rounded-full max-w-[50%] truncate">
                                    💡 {slide.visualSuggestion}
                                </span>
                            )}
                        </div>

                        {/* Title */}
                        <h1 className="text-lg md:text-4xl font-bold mb-3 md:mb-8 bg-gradient-to-r from-purple-600 via-violet-600 to-pink-600 bg-clip-text text-transparent flex-shrink-0 leading-tight">
                            {slide.title}
                        </h1>

                        {/* Content - 퀴즈 또는 일반 콘텐츠 */}
                        <div className="flex-1 overflow-y-auto pr-1 md:pr-2 min-h-0">
                            {slide.type === "quiz" && slide.quiz ? (
                                renderQuizSlide(slide)
                            ) : (
                                <div className="space-y-3 md:space-y-6">
                                    {slide.content.map((point, index) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="text-sm md:text-lg text-gray-800 leading-[1.7] md:leading-[1.8]"
                                        >
                                            {renderContentWithHighlight(point)}
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Notes Panel */}
                        <AnimatePresence>
                            {showNotes && slide.notes && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 md:mt-6 p-3 md:p-4 rounded-lg md:rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex-shrink-0"
                                >
                                    <div className="flex items-center gap-2 mb-1.5 md:mb-2">
                                        <Lightbulb className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500" />
                                        <span className="text-xs md:text-sm font-semibold text-amber-700">학습 노트</span>
                                    </div>
                                    <p className="text-xs md:text-sm text-amber-800">{slide.notes}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 md:h-2 bg-gray-200 rounded-full overflow-hidden mt-2 md:mt-4">
                <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 via-violet-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-2 md:mt-4 bg-white/90 backdrop-blur-sm rounded-xl md:rounded-2xl px-3 md:px-4 py-2.5 md:py-3 border border-gray-200/50 shadow-sm">
                <Button
                    onClick={handlePrev}
                    disabled={currentSlide === 0}
                    variant="outline"
                    size="sm"
                    className="gap-1 md:gap-2 border-gray-200 hover:bg-purple-50 disabled:opacity-50 h-8 md:h-9 px-2 md:px-3"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden md:inline">이전</span>
                </Button>

                <div className="flex items-center gap-1 md:gap-1.5 max-w-[50%] overflow-x-auto scrollbar-hide">
                    {slides.map((s, index) => (
                        <button
                            key={index}
                            onClick={() => handleSlideChange(index)}
                            className={cn(
                                "h-1.5 md:h-2 rounded-full transition-all duration-300 flex-shrink-0",
                                index === currentSlide
                                    ? "w-4 md:w-6 bg-gradient-to-r from-purple-500 to-pink-500"
                                    : s.type === "quiz"
                                        ? quizResults[index] !== undefined
                                            ? quizResults[index] ? "w-1.5 md:w-2 bg-green-400" : "w-1.5 md:w-2 bg-amber-400"
                                            : "w-1.5 md:w-2 bg-purple-300 hover:bg-purple-400"
                                        : "w-1.5 md:w-2 bg-gray-300 hover:bg-gray-400"
                            )}
                        />
                    ))}
                </div>

                {isLastSlide ? (
                    <Button
                        onClick={onComplete}
                        size="sm"
                        className="gap-1 md:gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md h-8 md:h-9 px-2 md:px-3"
                    >
                        <Check className="w-4 h-4" />
                        <span className="hidden md:inline">학습 완료</span>
                    </Button>
                ) : (
                    <Button
                        onClick={handleNext}
                        size="sm"
                        className="gap-1 md:gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-md h-8 md:h-9 px-2 md:px-3"
                    >
                        <span className="hidden md:inline">다음</span>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Keyboard Shortcuts Hint - Hidden on mobile */}
            <div className="hidden md:block text-center mt-3 text-xs text-gray-400">
                <kbd className="px-2 py-1 rounded bg-white/80 border border-gray-200 text-gray-500 shadow-sm">←</kbd>
                <span className="mx-1.5">이전</span>
                <kbd className="px-2 py-1 rounded bg-white/80 border border-gray-200 text-gray-500 shadow-sm">→</kbd>
                <span className="mx-1.5">다음</span>
                <kbd className="px-2 py-1 rounded bg-white/80 border border-gray-200 text-gray-500 shadow-sm">ESC</kbd>
                <span className="mx-1.5">닫기</span>
            </div>
        </motion.div>
    );
}
