import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const DEFAULT_CITY = 'Seoul,KR';

interface WeatherResponse {
    temp: number;
    feels_like: number;
    description: string;
    icon: string;
    humidity: number;
    wind_speed: number;
    rain_probability: number;
    condition: 'clear' | 'clouds' | 'rain' | 'snow' | 'extreme';
}

export async function GET(request: Request) {
    try {
        // Get location from query params (supports lat/lon or city name)
        const { searchParams } = new URL(request.url);
        const lat = searchParams.get('lat');
        const lon = searchParams.get('lon');
        const locationParam = searchParams.get('location') || DEFAULT_CITY;

        // Build OpenWeather query and cache key
        let owQuery: string;
        let cacheKey: string;
        if (lat && lon) {
            owQuery = `lat=${lat}&lon=${lon}`;
            // 소수 2자리까지만 사용 (약 1km 정밀도, 캐시 히트율 향상)
            cacheKey = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
        } else {
            owQuery = `q=${locationParam}`;
            cacheKey = locationParam.toLowerCase().replace(',kr', '');
        }

        // Try to get from cache first (instant loading!)
        try {
            const { data: cached } = await supabaseAdmin
                .from('weather_cache')
                .select('weather_data, updated_at')
                .eq('location', cacheKey)
                .maybeSingle();

            if (cached?.weather_data) {
                const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
                const oneHour = 60 * 60 * 1000;

                // Return cache if less than 1 hour old
                if (cacheAge < oneHour) {
                    return NextResponse.json(cached.weather_data);
                }
            }
        } catch (cacheErr) {
            console.warn('[Weather API] Cache lookup failed, fetching fresh data:', cacheErr);
        }

        // Cache miss or expired - fetch fresh data

        if (!OPENWEATHER_API_KEY) {
            // Return fallback if no API key
            return NextResponse.json({
                temp: 5,
                feels_like: 2,
                description: '맑음',
                icon: '01d',
                humidity: 50,
                wind_speed: 10,
                rain_probability: 0,
                condition: 'clear' as const,
            });
        }

        const weatherRes = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?${owQuery}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=kr`
        );

        if (!weatherRes.ok) {
            console.error('[Weather API] OpenWeather API failed');
            return NextResponse.json({
                temp: 5,
                feels_like: 2,
                description: '날씨 정보 불러오는 중',
                icon: 'clear',
                humidity: 50,
                wind_speed: 10,
                rain_probability: 0,
                condition: 'clear' as const,
            });
        }

        const weatherData = await weatherRes.json();

        const weatherId = weatherData.weather[0].id;
        let condition: WeatherResponse['condition'] = 'clear';
        if (weatherId >= 200 && weatherId < 600) condition = 'rain';
        else if (weatherId >= 600 && weatherId < 700) condition = 'snow';
        else if (weatherId >= 700 && weatherId < 800) condition = 'extreme';
        else if (weatherId > 800) condition = 'clouds';

        const response: WeatherResponse = {
            temp: Math.round(weatherData.main.temp),
            feels_like: Math.round(weatherData.main.feels_like),
            description: weatherData.weather[0].description,
            icon: weatherData.weather[0].icon,
            humidity: weatherData.main.humidity,
            wind_speed: Math.round(weatherData.wind.speed * 3.6),
            rain_probability: 0,
            condition,
        };

        // Update cache in background
        Promise.resolve(
            supabaseAdmin
                .from('weather_cache')
                .upsert({
                    location: cacheKey,
                    weather_data: response,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'location' })
        ).catch(() => {});

        return NextResponse.json(response);

    } catch (error) {
        console.error('[Weather API] Error:', error);
        return NextResponse.json({
            temp: 5,
            feels_like: 2,
            description: '날씨 정보 불러오는 중',
            icon: 'clear',
            humidity: 50,
            wind_speed: 10,
            rain_probability: 0,
            condition: 'clear' as const,
        });
    }
}
