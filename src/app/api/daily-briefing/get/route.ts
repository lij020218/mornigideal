import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

export async function GET() {
    try {
        // Authenticate user
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userEmail = session.user.email;
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        console.log(`[daily-briefing/get] Fetching briefing for ${userEmail} on ${today}`);

        // Fetch pre-generated briefing from Supabase
        const { data, error } = await supabase
            .from('daily_briefings')
            .select('briefing_data, created_at')
            .eq('email', userEmail)
            .eq('date', today)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('[daily-briefing/get] Error fetching briefing:', error);
            return NextResponse.json({ error: 'Failed to fetch briefing' }, { status: 500 });
        }

        // If briefing exists, return it immediately
        if (data) {
            console.log(`[daily-briefing/get] Found pre-generated briefing for ${userEmail}`);
            return NextResponse.json({
                briefing: data.briefing_data,
                generated_at: data.created_at
            });
        }

        // No pre-generated briefing found - generate on-demand
        console.log(`[daily-briefing/get] No pre-generated briefing, generating now...`);

        // Get user profile
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('profile')
            .eq('email', userEmail)
            .single();

        if (userError || !userData?.profile) {
            console.error('[daily-briefing/get] No user profile found');
            return NextResponse.json({ briefing: null });
        }

        const userProfile = userData.profile as any;

        // Get today's trends
        const { data: trendsData } = await supabase
            .from('trends_cache')
            .select('trends')
            .eq('email', userEmail)
            .eq('date', today)
            .single();

        const todayTrends = trendsData?.trends || [];

        // Default yesterday's goals
        const yesterdayGoals = {
            wakeUp: false,
            learning: 0,
            trendBriefing: 0,
            exercise: false,
            customGoals: {}
        };

        const todaySchedule = userProfile.schedule || {
            wakeUp: "07:00",
            workStart: "09:00",
            workEnd: "18:00",
            sleep: "23:00"
        };

        // Generate briefing using Gemini
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
You are an inspiring personal mentor for a ${userProfile.level || 'Intermediate'} ${userProfile.job || 'Professional'}.
The user has just woken up. Your goal is to review yesterday's performance, summarize key news from this morning's briefing, and motivate them for today.

**USER CONTEXT:**
- Job: ${userProfile.job || 'Professional'}
- Goal: ${userProfile.goal || 'Professional growth'}
- Yesterday's Goals: ${JSON.stringify(yesterdayGoals)}
- Today's Schedule: ${JSON.stringify(todaySchedule)}

**TODAY'S MORNING TRENDS (Latest news curated for them):**
${JSON.stringify(todayTrends?.slice(0, 6) || [])}

**YOUR MISSION:**
Generate a structured morning briefing in Korean.

**REQUIRED OUTPUT (JSON):**
{
  "greeting": "Warm, personalized morning greeting in Korean (e.g., '좋은 아침이에요! 오늘도 성장할 준비 되셨나요?')",
  "yesterdayReview": "1-2 sentences in Korean reviewing yesterday's goal completion. Be encouraging but honest. If they missed goals, suggest how to recover today.",
  "yesterdayStats": {
    "wakeUp": ${yesterdayGoals.wakeUp || false},
    "learning": ${yesterdayGoals.learning || 0},
    "trendBriefing": ${yesterdayGoals.trendBriefing || 0}
  },
  "trendSummary": [
    "Summary of Article 1 in Korean (1 sentence)",
    "Summary of Article 2 in Korean (1 sentence)",
    "Summary of Article 3 in Korean (1 sentence)",
    "Summary of Article 4 in Korean (1 sentence)",
    "Summary of Article 5 in Korean (1 sentence)",
    "Summary of Article 6 in Korean (1 sentence)"
  ],
  "todayFocus": "Advice for today's schedule in Korean. Highlight the most important task or mindset based on their schedule.",
  "importantSchedule": {
    "time": "${todaySchedule.workStart || '09:00'}",
    "title": "업무 시작",
    "type": "work"
  },
  "closing": "A short, punchy closing statement in Korean to start the day with energy (e.g., '오늘도 멋진 하루 만드세요!')"
}

**TONE:**
- Professional yet warm
- Motivating and actionable
- Korean language (natural and fluent)
- Ensure 'trendSummary' has EXACTLY 6 items corresponding to the input trends. If fewer trends available, create general motivational insights.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        let briefingData;
        try {
            briefingData = JSON.parse(text);
        } catch (parseError) {
            console.error(`[daily-briefing/get] Failed to parse briefing:`, parseError);
            return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
        }

        // Save to cache for next time
        await supabase
            .from('daily_briefings')
            .upsert({
                email: userEmail,
                date: today,
                briefing_data: briefingData,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'email,date'
            });

        console.log(`[daily-briefing/get] Generated and cached new briefing for ${userEmail}`);

        return NextResponse.json({
            briefing: briefingData,
            generated_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('[daily-briefing/get] Unexpected error:', error);
        return NextResponse.json({
            error: 'Failed to fetch briefing',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
