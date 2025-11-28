import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { saveDailyBriefingCache } from "@/lib/newsCache";
import { supabase } from "@/lib/supabase";
import { getDailyGoals } from "@/lib/dailyGoals";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

export async function GET(request: Request) {
    try {
        // Verify the request is authorized
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting daily briefing generation at 5:00 AM...');

        // Step 1: Get all users with profiles
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('email, profile')
            .not('profile', 'is', null);

        if (usersError) {
            console.error('[CRON] Error fetching users:', usersError);
            return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
        }

        if (!users || users.length === 0) {
            console.log('[CRON] No users found with profiles');
            return NextResponse.json({ success: true, message: 'No users to process' });
        }

        console.log(`[CRON] Found ${users.length} users to generate briefings for`);

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        });

        const results = [];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate = yesterday.toISOString().split('T')[0];

        // Step 2: Generate briefing for each user
        for (const user of users) {
            try {
                const userEmail = user.email;
                const userProfile = user.profile as any;

                console.log(`[CRON] Generating briefing for: ${userEmail}`);

                // Get yesterday's goals for this user
                // Note: We can't use getDailyGoals here as it's localStorage-based
                // For now, we'll use default values and enhance this later
                const yesterdayGoals = {
                    wakeUp: false,
                    learning: 0,
                    trendBriefing: 0,
                    exercise: false,
                    customGoals: {}
                };

                // Get yesterday's trends for this user
                const { data: trendsData, error: trendsError } = await supabase
                    .from('trends_cache')
                    .select('trends')
                    .eq('email', userEmail)
                    .eq('date', yesterdayDate)
                    .single();

                const yesterdayTrends = trendsData?.trends || [];

                // Get today's schedule
                const todaySchedule = userProfile.schedule || {
                    wakeUp: "07:00",
                    workStart: "09:00",
                    workEnd: "18:00",
                    sleep: "23:00"
                };

                // Generate briefing using Gemini
                const prompt = `
You are an inspiring personal mentor for a ${userProfile.level || 'Intermediate'} ${userProfile.job || 'Professional'}.
The user has just woken up. Your goal is to review yesterday's performance, summarize key news they missed while sleeping (or from yesterday), and motivate them for today.

**USER CONTEXT:**
- Job: ${userProfile.job || 'Professional'}
- Goal: ${userProfile.goal || 'Professional growth'}
- Yesterday's Goals: ${JSON.stringify(yesterdayGoals)}
- Today's Schedule: ${JSON.stringify(todaySchedule)}

**YESTERDAY'S TRENDS (News from the last 24h):**
${JSON.stringify(yesterdayTrends?.slice(0, 6) || [])}

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
                    console.error(`[CRON] Failed to parse briefing for ${userEmail}:`, parseError);
                    continue; // Skip this user
                }

                // Save to cache using the user's email context
                // We need to save directly to Supabase since saveDailyBriefingCache uses auth session
                const today = new Date().toISOString().split('T')[0];

                const { error: saveError } = await supabase
                    .from('daily_briefings')
                    .upsert({
                        email: userEmail,
                        date: today,
                        briefing_data: briefingData,
                        created_at: new Date().toISOString()
                    }, {
                        onConflict: 'email,date'
                    });

                if (saveError) {
                    console.error(`[CRON] Error saving briefing for ${userEmail}:`, saveError);
                } else {
                    console.log(`[CRON] Successfully generated and cached briefing for ${userEmail}`);
                    results.push({ email: userEmail, status: 'success' });
                }

                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`[CRON] Error processing user ${user.email}:`, error);
                results.push({ email: user.email, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            }
        }

        console.log('[CRON] Daily briefing generation completed');

        return NextResponse.json({
            success: true,
            processed: users.length,
            successful: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'error').length,
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[CRON] Error in daily briefing generation:', error);
        return NextResponse.json({
            error: 'Failed to generate daily briefings',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
