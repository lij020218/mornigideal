import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Card types with their colors
// 1. schedule - 파란색 (blue/cyan)
// 2. briefing - 주황색 (orange/amber)
// 3. youtube - 빨간색 (red/rose)
// 4. news - 보라색 (purple/violet)

interface RotatingCard {
    id: string;
    type: 'schedule' | 'briefing' | 'youtube' | 'news';
    title: string;
    message: string;
    actionText: string;
    actionType: 'add_schedule' | 'open_briefing' | 'open_link';
    actionUrl?: string;
    color: string; // gradient color class
    icon: string;
    // For briefing type - matches TrendBriefing interface in TrendBriefingDetail
    briefingData?: {
        id: string;
        title: string;
        category: string;
        summary: string;
        time: string;
        imageColor: string;
        originalUrl: string;
        imageUrl?: string;
        source: string;
        relevance?: string;
    };
    // For schedule type
    scheduleData?: {
        text: string;
        startTime: string;
        endTime?: string;
        specificDate?: string;
    };
}

// Search YouTube content using Gemini
async function searchYouTubeContent(job: string, interests: string[]): Promise<{ title: string; url: string; channel: string } | null> {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `Find ONE highly relevant and recent YouTube video for a ${job} interested in: ${interests.join(', ')}.

Requirements:
- Educational or informative content
- From a reputable channel
- Relevant to professional growth
- In Korean if possible, otherwise English

OUTPUT JSON (ONE video only):
{
    "title": "video title in Korean",
    "url": "https://youtube.com/watch?v=...",
    "channel": "channel name"
}`;

        const result = await model.generateContent(prompt);
        const data = JSON.parse(result.response.text());
        return data;
    } catch (error) {
        logger.error('[SmartSuggestions] YouTube search error:', error);
        return null;
    }
}

// Search news/activities using Gemini
async function searchNews(job: string, interests: string[]): Promise<{ title: string; summary: string; url: string; source: string } | null> {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        });

        const today = new Date().toISOString().split('T')[0];
        const prompt = `Find ONE recent news article or industry update relevant to a ${job} with interests in: ${interests.join(', ')}.

Date: ${today}

Requirements:
- Recent news (within last week)
- Industry-relevant
- Professional development related
- In Korean if possible

OUTPUT JSON (ONE item only):
{
    "title": "news title in Korean",
    "summary": "2-3 sentence summary in Korean",
    "url": "article url",
    "source": "source name"
}`;

        const result = await model.generateContent(prompt);
        const data = JSON.parse(result.response.text());
        return data;
    } catch (error) {
        logger.error('[SmartSuggestions] News search error:', error);
        return null;
    }
}

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const userEmail = email;
    const { getUserByEmail } = await import("@/lib/users");
    const user = await getUserByEmail(userEmail);

    if (!user?.profile) {
        return NextResponse.json({ cards: getDefaultCards() });
    }

    const profile = user.profile;
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay();

    const cards: RotatingCard[] = [];

    // ============================================
    // CARD 1: Schedule Reminder (Blue)
    // ============================================
    const customGoals = profile.customGoals || [];
    const todayGoals = customGoals.filter((g: any) =>
        g.specificDate === today ||
        (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
    ).sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));

    // Find upcoming or current schedule
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const upcomingGoal = todayGoals.find((g: any) => g.startTime && g.startTime > currentTimeStr);

    if (upcomingGoal) {
        cards.push({
            id: 'schedule-reminder',
            type: 'schedule',
            title: `📅 ${upcomingGoal.startTime}에 일정이 있어요`,
            message: `"${upcomingGoal.text}" 일정을 잊지 마세요!`,
            actionText: '확인',
            actionType: 'open_link',
            color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
            icon: 'Calendar',
        });
    } else {
        // No upcoming schedule, suggest adding one
        const suggestedTime = currentHour < 12 ? '14:00' : currentHour < 17 ? '18:00' : '09:00';
        const suggestedDate = currentHour >= 17 ?
            new Date(now.getTime() + 86400000).toISOString().split('T')[0] : today;

        cards.push({
            id: 'schedule-suggest',
            type: 'schedule',
            title: '📅 빈 시간이네요!',
            message: '새로운 일정을 추가해보세요.',
            actionText: '일정 추가',
            actionType: 'add_schedule',
            scheduleData: {
                text: '새 일정',
                startTime: suggestedTime,
                specificDate: suggestedDate,
            },
            color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
            icon: 'CalendarPlus',
        });
    }

    // ============================================
    // CARD 2: Trend Briefing (Orange)
    // ============================================
    try {
        const { supabaseAdmin } = await import("@/lib/supabase-admin");
        const { data: briefingData } = await supabaseAdmin
            .from("trends_cache")
            .select("trends")
            .eq("email", userEmail)
            .eq("date", today)
            .maybeSingle();

        if (briefingData?.trends && briefingData.trends.length > 0) {
            // Pick a random briefing from today's cache
            const randomBriefing = briefingData.trends[Math.floor(Math.random() * briefingData.trends.length)];
            cards.push({
                id: 'briefing-card',
                type: 'briefing',
                title: `📰 ${randomBriefing.title?.substring(0, 25)}...`,
                message: '아직 이 트렌드 브리핑을 읽지 않으셨어요. 지금 확인해보세요!',
                actionText: '브리핑 보기',
                actionType: 'open_briefing',
                briefingData: {
                    id: randomBriefing.id || `briefing-${Date.now()}`,
                    title: randomBriefing.title,
                    category: randomBriefing.category,
                    summary: randomBriefing.summary,
                    time: randomBriefing.time || new Date().toISOString(),
                    imageColor: randomBriefing.imageColor || 'orange',
                    originalUrl: randomBriefing.originalUrl || '#',
                    imageUrl: randomBriefing.imageUrl,
                    source: randomBriefing.source,
                    relevance: randomBriefing.relevance,
                },
                color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
                icon: 'Newspaper',
            });
        }
    } catch (e) {
    }

    // Add default briefing card if none found
    if (!cards.find(c => c.type === 'briefing')) {
        cards.push({
            id: 'briefing-default',
            type: 'briefing',
            title: '📰 오늘의 트렌드 브리핑',
            message: '트렌드 브리핑을 확인하고 최신 정보를 얻어보세요.',
            actionText: '대시보드로 이동',
            actionType: 'open_link',
            actionUrl: '/dashboard#trend-briefing',
            color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
            icon: 'Newspaper',
        });
    }

    // ============================================
    // CARD 3: YouTube Content (Red)
    // ============================================
    const interests = profile.interests || [];
    const job = profile.job || '직장인';

    const youtubeResult = await searchYouTubeContent(job, interests);
    if (youtubeResult?.url) {
        cards.push({
            id: 'youtube-card',
            type: 'youtube',
            title: `🎬 ${youtubeResult.title?.substring(0, 30)}...`,
            message: `${youtubeResult.channel}의 추천 영상`,
            actionText: '보러가기',
            actionType: 'open_link',
            actionUrl: youtubeResult.url,
            color: 'from-red-500/20 to-rose-500/20 border-red-500/30',
            icon: 'Youtube',
        });
    } else {
        // Fallback YouTube card
        cards.push({
            id: 'youtube-fallback',
            type: 'youtube',
            title: '🎬 당신을 위한 추천 콘텐츠',
            message: '관심분야의 새로운 영상을 찾아보세요.',
            actionText: '유튜브 가기',
            actionType: 'open_link',
            actionUrl: `https://youtube.com/results?search_query=${encodeURIComponent(interests[0] || job)}`,
            color: 'from-red-500/20 to-rose-500/20 border-red-500/30',
            icon: 'Youtube',
        });
    }

    // ============================================
    // CARD 4: External News (Purple)
    // ============================================
    const newsResult = await searchNews(job, interests);
    if (newsResult?.url) {
        cards.push({
            id: 'news-card',
            type: 'news',
            title: `🔍 ${newsResult.title?.substring(0, 30)}...`,
            message: newsResult.summary?.substring(0, 50) + '...' || '관련 뉴스를 확인하세요.',
            actionText: '자세히',
            actionType: 'open_link',
            actionUrl: newsResult.url,
            color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30',
            icon: 'Search',
        });
    } else {
        // Fallback news card
        cards.push({
            id: 'news-fallback',
            type: 'news',
            title: '🔍 업계 동향',
            message: '관련 뉴스를 검색해보세요.',
            actionText: '검색하기',
            actionType: 'open_link',
            actionUrl: `https://news.google.com/search?q=${encodeURIComponent(job + ' ' + (interests[0] || ''))}`,
            color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30',
            icon: 'Search',
        });
    }

    return NextResponse.json({ cards });
});

// Fallback cards
function getDefaultCards(): RotatingCard[] {
    return [
        {
            id: 'default-schedule',
            type: 'schedule',
            title: '📅 오늘의 일정',
            message: '일정을 확인하고 하루를 계획해보세요.',
            actionText: '확인하기',
            actionType: 'open_link',
            color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
            icon: 'Calendar',
        },
        {
            id: 'default-briefing',
            type: 'briefing',
            title: '📰 트렌드 브리핑',
            message: '오늘의 트렌드를 확인하세요.',
            actionText: '읽기',
            actionType: 'open_link',
            color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
            icon: 'Newspaper',
        },
        {
            id: 'default-youtube',
            type: 'youtube',
            title: '🎬 추천 콘텐츠',
            message: '당신을 위한 영상을 추천해드려요.',
            actionText: '보러가기',
            actionType: 'open_link',
            actionUrl: 'https://youtube.com',
            color: 'from-red-500/20 to-rose-500/20 border-red-500/30',
            icon: 'Youtube',
        },
        {
            id: 'default-news',
            type: 'news',
            title: '🔍 업계 소식',
            message: '최신 뉴스를 확인하세요.',
            actionText: '자세히',
            actionType: 'open_link',
            actionUrl: 'https://news.google.com',
            color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30',
            icon: 'Search',
        },
    ];
}
