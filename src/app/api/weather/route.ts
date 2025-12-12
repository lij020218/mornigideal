import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
        // Get location from query params
        const { searchParams } = new URL(request.url);
        const locationParam = searchParams.get('location') || DEFAULT_CITY;
        const cacheKey = locationParam.toLowerCase().replace(',kr', '');

        // Try to get from cache first (instant loading!)
        const { data: cached } = await supabase
            .from('weather_cache')
            .select('weather_data, updated_at')
            .eq('location', cacheKey)
            .single();

        if (cached?.weather_data) {
            const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
            const oneHour = 60 * 60 * 1000;

            // Return cache if less than 1 hour old
            if (cacheAge < oneHour) {
                console.log(`[Weather API] Returning cached data for ${cacheKey}`);
                return NextResponse.json(cached.weather_data);
            }
        }

        // Cache miss or expired - fetch fresh data
        console.log('[Weather API] Cache miss, fetching fresh data...');

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
            `https://api.openweathermap.org/data/2.5/weather?q=${locationParam}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=kr`
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
        supabase
            .from('weather_cache')
            .upsert({
                location: cacheKey,
                weather_data: response,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'location' })
            .then(() => console.log(`[Weather API] Cache updated for ${cacheKey}`));

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
