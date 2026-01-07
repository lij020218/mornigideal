"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Cloud, Sun, CloudRain, Snowflake, Wind, Droplets, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface WeatherDisplayProps {
    className?: string;
    compact?: boolean;
    inline?: boolean;
}

export function WeatherDisplay({ className, compact = false, inline = false }: WeatherDisplayProps) {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // Check localStorage cache first
                const cached = localStorage.getItem('weather_data');
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    const fiveMinutes = 5 * 60 * 1000;
                    if (Date.now() - timestamp < fiveMinutes) {
                        setWeather(data);
                        setLoading(false);
                        return;
                    }
                }

                const res = await fetch('/api/weather');
                if (res.ok) {
                    const data = await res.json();
                    setWeather(data);
                    localStorage.setItem('weather_data', JSON.stringify({
                        data,
                        timestamp: Date.now()
                    }));
                }
            } catch (error) {
                console.error('Failed to fetch weather:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
    }, []);

    const getWeatherIcon = (condition: WeatherData['condition']) => {
        switch (condition) {
            case 'clear':
                return <Sun className="w-5 h-5 text-amber-500" />;
            case 'clouds':
                return <Cloud className="w-5 h-5 text-gray-400" />;
            case 'rain':
                return <CloudRain className="w-5 h-5 text-blue-500" />;
            case 'snow':
                return <Snowflake className="w-5 h-5 text-sky-400" />;
            case 'extreme':
                return <Wind className="w-5 h-5 text-purple-500" />;
            default:
                return <Sun className="w-5 h-5 text-amber-500" />;
        }
    };

    const getWeatherMessage = (weather: WeatherData): string => {
        const { condition, temp, humidity, wind_speed } = weather;

        // Rain/Snow messages
        if (condition === 'rain') {
            return '비가 내리네요. 우산 꼭 챙기세요! ☔';
        }
        if (condition === 'snow') {
            return '눈이 내려요! 따뜻하게 입으세요 ❄️';
        }

        // Extreme weather
        if (condition === 'extreme' || wind_speed > 40) {
            return '바람이 강해요. 외출 시 주의하세요 💨';
        }

        // Temperature based messages
        if (temp <= -5) {
            return '많이 추워요! 핫팩 챙기세요 🥶';
        }
        if (temp <= 5) {
            return '쌀쌀하네요. 겉옷 필수! 🧥';
        }
        if (temp >= 30) {
            return '무더위 주의! 수분 섭취하세요 🌡️';
        }
        if (temp >= 25) {
            return '덥네요! 시원하게 다니세요 ☀️';
        }

        // Humidity based
        if (humidity > 80) {
            return '습도가 높아요. 끈적일 수 있어요 💧';
        }

        // Clear weather positive messages
        if (condition === 'clear') {
            if (temp >= 15 && temp <= 25) {
                return '완벽한 날씨! 산책 어때요? 🌤️';
            }
            return '맑은 하늘이에요! 좋은 하루 되세요 ✨';
        }

        // Cloudy
        if (condition === 'clouds') {
            return '구름이 많아요. 우산 챙겨두세요 ☁️';
        }

        return '오늘도 화이팅! 💪';
    };

    const getWeatherGradient = (condition: WeatherData['condition']) => {
        switch (condition) {
            case 'clear':
                return 'from-amber-100/80 to-orange-50/60';
            case 'clouds':
                return 'from-gray-100/80 to-slate-50/60';
            case 'rain':
                return 'from-blue-100/80 to-sky-50/60';
            case 'snow':
                return 'from-sky-100/80 to-blue-50/60';
            case 'extreme':
                return 'from-purple-100/80 to-violet-50/60';
            default:
                return 'from-gray-100/80 to-slate-50/60';
        }
    };

    if (loading) {
        return (
            <div className={cn(
                "flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/30 backdrop-blur-md border border-white/40 animate-pulse",
                className
            )}>
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="space-y-1.5">
                    <div className="h-4 w-12 bg-gray-200 rounded" />
                    <div className="h-3 w-16 bg-gray-100 rounded" />
                </div>
            </div>
        );
    }

    if (!weather) return null;

    // Inline mode - for displaying next to clock
    if (inline) {
        return (
            <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                    "flex flex-col items-end gap-1.5",
                    className
                )}
            >
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white/50 flex items-center justify-center shadow-sm border border-white/40">
                        {getWeatherIcon(weather.condition)}
                    </div>
                    <span className="text-2xl font-bold text-gray-600 tracking-tight">
                        {weather.temp}°
                    </span>
                </div>
                <p className="text-xs text-gray-500 font-medium text-right max-w-[180px] leading-tight">
                    {getWeatherMessage(weather)}
                </p>
            </motion.div>
        );
    }

    if (compact) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className={cn(
                    "flex-shrink-0 flex items-center gap-3 px-5 py-3 rounded-2xl",
                    "bg-gradient-to-br backdrop-blur-md border border-white/50",
                    "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_25px_-4px_rgba(0,0,0,0.08)]",
                    "transition-all duration-300 cursor-default",
                    getWeatherGradient(weather.condition),
                    className
                )}
            >
                <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center shadow-sm">
                    {getWeatherIcon(weather.condition)}
                </div>
                <div className="flex flex-col">
                    <span className="text-lg font-bold text-gray-800 tracking-tight leading-none">
                        {weather.temp}°C
                    </span>
                    <span className="text-xs text-gray-500 font-medium mt-0.5">
                        {weather.description}
                    </span>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
                "rounded-2xl p-4",
                "bg-gradient-to-br backdrop-blur-xl border border-white/50",
                "shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
                getWeatherGradient(weather.condition),
                className
            )}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/60 flex items-center justify-center shadow-sm">
                        {getWeatherIcon(weather.condition)}
                    </div>
                    <div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-gray-800 tracking-tight">
                                {weather.temp}°
                            </span>
                            <span className="text-sm text-gray-500 font-medium">
                                체감 {weather.feels_like}°
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 font-medium mt-0.5">
                            {weather.description}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5" />
                        <span>{weather.humidity}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Wind className="w-3.5 h-3.5" />
                        <span>{weather.wind_speed}km/h</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
