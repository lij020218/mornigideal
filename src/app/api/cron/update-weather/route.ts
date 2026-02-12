import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// OpenWeatherMap API (free, supports Korea)
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const DEFAULT_CITY = 'Seoul,KR';

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

// Cron job to pre-generate weather data every hour
export async function GET(request: Request) {
    try {
        // 인증 체크
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }


        if (!OPENWEATHER_API_KEY) {
            console.error('[Weather Cron] OPENWEATHER_API_KEY not set');
            throw new Error('API key not configured');
        }

        // Fetch current weather from OpenWeatherMap
        const weatherRes = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${DEFAULT_CITY}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=kr`
        );

        if (!weatherRes.ok) {
            const errorText = await weatherRes.text();
            console.error('[Weather Cron] API Error:', weatherRes.status, errorText);
            throw new Error(`Weather API failed: ${weatherRes.status}`);
        }

        const weatherData = await weatherRes.json();

        // Get rain probability from forecast
        let rainProbability = 0;
        try {
            const forecastRes = await fetch(
                `https://api.openweathermap.org/data/2.5/forecast?q=${DEFAULT_CITY}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=kr&cnt=4`
            );
            if (forecastRes.ok) {
                const forecastData = await forecastRes.json();
                rainProbability = Math.round(
                    forecastData.list.reduce((acc: number, item: any) => acc + (item.pop || 0), 0)
                    / forecastData.list.length * 100
                );
            }
        } catch (e) {
            console.error('[Weather Cron] Forecast error:', e);
        }

        // Determine condition category
        const weatherId = weatherData.weather[0].id;
        let condition: WeatherData['condition'] = 'clear';
        if (weatherId >= 200 && weatherId < 600) condition = 'rain';
        else if (weatherId >= 600 && weatherId < 700) condition = 'snow';
        else if (weatherId >= 700 && weatherId < 800) condition = 'extreme';
        else if (weatherId > 800) condition = 'clouds';

        const cachedWeather: WeatherData = {
            temp: Math.round(weatherData.main.temp),
            feels_like: Math.round(weatherData.main.feels_like),
            description: weatherData.weather[0].description,
            icon: weatherData.weather[0].icon,
            humidity: weatherData.main.humidity,
            wind_speed: Math.round(weatherData.wind.speed * 3.6), // m/s to km/h
            rain_probability: rainProbability,
            condition,
        };

        // Save to Supabase cache
        const { error } = await supabaseAdmin
            .from('weather_cache')
            .upsert({
                location: 'seoul',
                weather_data: cachedWeather,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'location'
            });

        if (error) {
            console.error('[Weather Cron] Cache save error:', error);
            throw error;
        }


        return NextResponse.json({
            success: true,
            weather: cachedWeather,
            message: 'Weather data cached successfully'
        });

    } catch (error) {
        console.error('[Weather Cron] Error:', error);

        const fallbackWeather = {
            temp: 5,
            feels_like: 2,
            description: '날씨 정보 업데이트 중',
            icon: 'clear',
            humidity: 50,
            wind_speed: 10,
            rain_probability: 0,
            condition: 'clear' as const,
        };

        return NextResponse.json({
            success: false,
            weather: fallbackWeather,
            message: 'Using fallback weather data',
        });
    }
}
