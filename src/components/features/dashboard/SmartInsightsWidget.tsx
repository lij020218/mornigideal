"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Sun, CloudRain, Snowflake, Wind, Umbrella, TrendingUp, TrendingDown, Flame, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTodayCompletions, getTodayDateString } from "@/lib/scheduleNotifications";

interface WeatherData {
    temp: number;
    feels_like: number;
    description: string;
    icon: string;
    humidity: number;
    wind_speed: number;
    rain_probability: number;
    condition: 'clear' | 'clouds' | 'rain' | 'snow' | 'extreme';
}

interface InsightCard {
    id: string;
    type: 'weather' | 'habit' | 'proactive';
    icon: React.ReactNode;
    title: string;
    message: string;
    color: string;
}

interface SmartInsightsWidgetProps {
    customGoals?: any[];
    currentTime: Date | null;
    initialHabitInsights?: any;
}

const locationLabels: Record<string, string> = {
    'Seoul,KR': '서울',
    'Busan,KR': '부산',
    'Incheon,KR': '인천',
    'Daegu,KR': '대구',
    'Daejeon,KR': '대전',
    'Gwangju,KR': '광주',
    'Ulsan,KR': '울산',
    'Sejong,KR': '세종',
    'Suwon,KR': '수원',
    'Yongin,KR': '용인',
    'Goyang,KR': '고양',
    'Seongnam,KR': '성남',
    'Jeonju,KR': '전주',
    'Cheongju,KR': '청주',
    'Changwon,KR': '창원',
    'Jeju,KR': '제주',
};

export function SmartInsightsWidget({ customGoals = [], currentTime, initialHabitInsights }: SmartInsightsWidgetProps) {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [location, setLocation] = useState<string>('Seoul,KR');
    const [habitAnalysis, setHabitAnalysis] = useState<{
        insight: string;
        suggestion: string;
        emoji: string;
        category: string;
    } | null>(initialHabitInsights || null);
    const [insights, setInsights] = useState<InsightCard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [, setCompletionTrigger] = useState(0);

    // Listen for completion changes
    useEffect(() => {
        const handleCompletionChange = () => {
            setCompletionTrigger(prev => prev + 1);
        };
        window.addEventListener("schedule-completion-changed", handleCompletionChange);
        return () => window.removeEventListener("schedule-completion-changed", handleCompletionChange);
    }, []);

    // Load location from settings
    useEffect(() => {
        const savedSettings = localStorage.getItem('user_settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (settings.location) {
                    setLocation(settings.location);
                }
            } catch (e) {
                console.error('Failed to parse settings:', e);
            }
        }
    }, []);

    // Fetch weather data
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const res = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
                if (res.ok) {
                    const data = await res.json();
                    setWeather(data);
                }
            } catch (e) {
                console.error('Failed to fetch weather:', e);
            }
        };
        fetchWeather();
    }, [location]);

    // Fetch AI habit analysis (only if not provided via props)
    useEffect(() => {
        // Skip fetching if we already have initial data
        if (initialHabitInsights) return;

        const fetchHabitAnalysis = async () => {
            try {
                const res = await fetch('/api/habit-analysis');
                if (res.ok) {
                    const data = await res.json();
                    setHabitAnalysis(data);
                }
            } catch (e) {
                console.error('Failed to fetch habit analysis:', e);
            }
        };
        fetchHabitAnalysis();
    }, [initialHabitInsights]);

    // Generate insights
    useEffect(() => {
        if (!currentTime) return;

        const cards: InsightCard[] = [];
        const hour = currentTime.getHours();

        // 1. Weather Card
        if (weather) {
            const getWeatherIcon = () => {
                switch (weather.condition) {
                    case 'rain': return <CloudRain className="w-5 h-5" />;
                    case 'snow': return <Snowflake className="w-5 h-5" />;
                    case 'clouds': return <Cloud className="w-5 h-5" />;
                    default: return <Sun className="w-5 h-5" />;
                }
            };

            let weatherMessage = `${weather.temp}°C, ${weather.description}`;
            const locationName = locationLabels[location] || '서울';
            let weatherTitle = `${locationName} 날씨`;

            if (weather.rain_probability > 50) {
                weatherMessage = `☔ 오늘 비 올 확률 ${weather.rain_probability}%! 우산 챙기세요`;
                weatherTitle = '비 예보';
            } else if (weather.temp < 5) {
                weatherMessage = `🧥 체감온도 ${weather.feels_like}°C. 따뜻하게 입으세요!`;
                weatherTitle = '추운 날씨';
            } else if (weather.temp > 28) {
                weatherMessage = `🥵 체감온도 ${weather.feels_like}°C. 수분 보충 필수!`;
                weatherTitle = '더운 날씨';
            }

            cards.push({
                id: 'weather',
                type: 'weather',
                icon: getWeatherIcon(),
                title: weatherTitle,
                message: weatherMessage,
                color: weather.condition === 'rain' ? 'bg-blue-50 border-blue-200' :
                    weather.condition === 'snow' ? 'bg-slate-50 border-slate-200' :
                        'bg-orange-50 border-orange-200',
            });
        }

        // 2. AI-Powered Habit Analysis Card
        const today = getTodayDateString();
        const todayGoals = customGoals.filter(g => g.specificDate === today);

        if (habitAnalysis) {
            const categoryColors: Record<string, string> = {
                exercise: 'bg-green-50 border-green-200',
                productivity: 'bg-blue-50 border-blue-200',
                balance: 'bg-purple-50 border-purple-200',
                consistency: 'bg-orange-50 border-orange-200',
            };

            cards.push({
                id: 'habit',
                type: 'habit',
                icon: <TrendingUp className="w-5 h-5" />,
                title: `${habitAnalysis.emoji} ${habitAnalysis.insight}`,
                message: habitAnalysis.suggestion,
                color: categoryColors[habitAnalysis.category] || 'bg-green-50 border-green-200',
            });
        }

        // 3. Proactive Card based on time
        let proactiveCard: InsightCard | null = null;

        if (hour >= 6 && hour < 9) {
            proactiveCard = {
                id: 'proactive-morning',
                type: 'proactive',
                icon: <Sun className="w-5 h-5" />,
                title: '☀️ 좋은 아침!',
                message: `오늘 예정된 일정 ${todayGoals.length}개. 힘찬 하루 되세요!`,
                color: 'bg-yellow-50 border-yellow-200',
            };
        } else if (hour >= 9 && hour < 11) {
            proactiveCard = {
                id: 'proactive-am',
                type: 'proactive',
                icon: <TrendingUp className="w-5 h-5" />,
                title: '📋 오전 업무 시간',
                message: `오늘 일정 ${todayGoals.length}개. 집중해서 진행해보세요!`,
                color: 'bg-blue-50 border-blue-200',
            };
        } else if (hour >= 11 && hour < 13) {
            proactiveCard = {
                id: 'proactive-lunch',
                type: 'proactive',
                icon: <Calendar className="w-5 h-5" />,
                title: '🍽️ 점심 시간',
                message: '에너지 충전하고 오후도 화이팅!',
                color: 'bg-green-50 border-green-200',
            };
        } else if (hour >= 13 && hour < 17) {
            proactiveCard = {
                id: 'proactive-pm',
                type: 'proactive',
                icon: <TrendingUp className="w-5 h-5" />,
                title: '⚡ 오후 집중 시간',
                message: '오후도 순조롭게 진행 중이시네요!',
                color: 'bg-orange-50 border-orange-200',
            };
        } else if (hour >= 17 && hour < 19) {
            const completions = getTodayCompletions();
            const completedCount = Object.values(completions).filter((c: any) => c.completed).length;
            proactiveCard = {
                id: 'proactive-evening',
                type: 'proactive',
                icon: <Flame className="w-5 h-5" />,
                title: '🌆 하루 마무리',
                message: `오늘 ${completedCount}개 완료! 수고하셨어요 👏`,
                color: 'bg-purple-50 border-purple-200',
            };
        } else if (hour >= 19 && hour < 21) {
            proactiveCard = {
                id: 'proactive-evening2',
                type: 'proactive',
                icon: <Calendar className="w-5 h-5" />,
                title: '🌃 저녁 시간',
                message: '오늘 하루도 수고 많으셨습니다!',
                color: 'bg-indigo-50 border-indigo-200',
            };
        } else if (hour >= 21 || hour < 6) {
            proactiveCard = {
                id: 'proactive-night',
                type: 'proactive',
                icon: <Wind className="w-5 h-5" />,
                title: '🌙 편안한 밤',
                message: '내일을 위해 푹 쉬세요. 좋은 꿈 꾸세요!',
                color: 'bg-indigo-50 border-indigo-200',
            };
        }

        if (proactiveCard) {
            cards.push(proactiveCard);
        }

        setInsights(cards);
    }, [weather, habitAnalysis, customGoals, currentTime, location]);

    // Auto rotate cards
    useEffect(() => {
        if (insights.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % insights.length);
        }, 8000);

        return () => clearInterval(timer);
    }, [insights.length]);

    if (insights.length === 0) return null;

    const currentCard = insights[currentIndex];

    return (
        <div className="flex items-center gap-2 sm:gap-4 w-full">
            {/* Navigation dots */}
            {insights.length > 1 && (
                <div className="flex flex-col gap-1.5 sm:gap-2">
                    {insights.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={cn(
                                "w-2 sm:w-3 rounded-full transition-all",
                                idx === currentIndex
                                    ? "h-4 sm:h-6 bg-gradient-to-b from-amber-500 to-orange-500 shadow-md shadow-amber-500/20"
                                    : "h-2 sm:h-3 bg-gray-200 hover:bg-gray-300"
                            )}
                        />
                    ))}
                </div>
            )}

            {/* Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentCard.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                        "flex items-center gap-3 sm:gap-5 px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl sm:rounded-2xl flex-1",
                        "glass-card glass-card-hover"
                    )}
                >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-amber-500/20">
                        <span className="scale-100 sm:scale-125 md:scale-150">{currentCard.icon}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                        <span className="text-sm sm:text-base md:text-lg font-bold text-foreground truncate">{currentCard.title}</span>
                        <span className="text-sm sm:text-base md:text-xl text-muted-foreground font-medium line-clamp-2">{currentCard.message}</span>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
