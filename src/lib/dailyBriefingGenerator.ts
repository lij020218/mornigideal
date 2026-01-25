import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "./supabase-admin";
import { getTrendsCache } from "./newsCache";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

interface DailyBriefingContent {
    greeting: string;
    yesterday_summary: string;
    yesterday_score: number;
    today_schedule_summary: string;
    trend_summary: string;
    cheering_message: string;
}

export async function generateDailyBriefings() {
    console.log('[DailyBriefing] Starting generation job...');

    // 1. Fetch all users
    const { data: users, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, name, profile, email');

    if (userError || !users) {
        console.error('[DailyBriefing] Failed to fetch users:', userError);
        return;
    }

    console.log(`[DailyBriefing] Found ${users.length} users.`);

    // 2. We'll fetch personalized trends for each user inside the loop

    // 3. Calculate Dates in KST
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // Today YYYY-MM-DD in KST

    // Calculate Yesterday Date (subtract 24 hours to be safe for timezone crossing, or simple setDate)
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // Yesterday YYYY-MM-DD in KST

    // 3. Process each user
    for (const user of users) {
        try {
            console.log(`[DailyBriefing] Processing user: ${user.name} (${user.id})`);

            const profile = user.profile || {};
            const job = profile.job || "전문가";
            const interests = profile.interests || [];
            const userSchedule = profile.schedule || {};
            const customGoals = profile.customGoals || [];

            // A. Fetch Yesterday's Activity
            const { data: yesterdayGoals } = await supabaseAdmin
                .from('daily_goals')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', yesterdayStr)
                .single();

            // Calculate Score
            // Total Goals = WakeUp + Learning(2) + Briefing(6) + CustomGoals(active)
            // This is complex to estimate perfectly without historical config, 
            // so we'll approximate based on what we have.
            // Let's assume:
            // - WakeUp: 10pts
            // - Learning: 20pts
            // - Briefing: 20pts
            // - Custom Goals: 50pts total distributed
            // Simply: use the completed_goals array count vs expected.

            // Or simpler: Let Gemini narrative it based on data.
            // We pass the raw data to Gemini.

            // Format Schedule for Today
            // Check customGoals for today
            const todayDay = now.getDay(); // 0=Sun
            const todayEvents = customGoals.filter((g: any) => {
                if (g.specificDate === dateStr) return true;
                if (g.daysOfWeek && g.daysOfWeek.includes(todayDay) && !g.specificDate) return true;
                return false;
            });

            // Fetch user-specific trends from trends_cache
            const { data: userTrendCache } = await supabaseAdmin
                .from('trends_cache')
                .select('trends')
                .eq('email', user.email)
                .eq('date', dateStr)
                .single();

            const userTrends = userTrendCache?.trends || [];

            // Take top 3 trends (already personalized for this user)
            const finalTrends = userTrends.slice(0, 3);

            // B. Generate Content with Gemini
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

            const prompt = `Create a morning briefing for ${user.name} (Job: ${job}).

            ⚠️ **CRITICAL: ALL OUTPUT MUST BE IN KOREAN (한국어). DO NOT USE ANY OTHER LANGUAGE.**

            CONTEXT:
            1. YESTERDAY'S ACTIVITY (${yesterdayStr}):
               - Data: ${JSON.stringify(yesterdayGoals || { completed_goals: [], read_trends: [] })}
               - Core Goals: WakeUp, Learning, TrendBriefing
               - Note: If data is empty, it means they didn't record activity.
            
            2. TODAY'S SCHEDULE (${dateStr}):
               ${todayEvents.length > 0 ? `- USER'S ACTUAL SCHEDULED EVENTS (MUST USE THESE):\n${todayEvents.map((e: any) => `  • ${e.startTime || '시간 미정'} ~ ${e.endTime || ''}: ${e.text}`).join('\n')}` : '- No specific events scheduled for today'}

            3. TRENDS FOR YOU (${finalTrends.length} personalized articles):
${finalTrends.map((t: any, idx: number) => `               Article ${idx + 1}:
               - Title: ${t.title}
               - Category: ${t.category || 'General'}
               - Summary: ${t.summary || ''}
               - Source: ${t.source || 'Unknown'}
               - Why relevant: ${t.relevance || 'Curated for you'}`).join('\n\n')}
            
            TASK: Generate a JSON response with the following fields.
            ⚠️ **모든 필드는 반드시 한국어로만 작성하세요. 러시아어, 영어, 중국어 등 다른 언어 절대 금지.**
            - greeting: Warm morning greeting emphasizing ${job} role.
            - yesterday_summary: 1 sentence summary of yesterday's performance (be encouraging if low).
            - yesterday_score: integer 0-100 (estimate based on activity).
            - today_schedule_summary: **CRITICAL - FOLLOW THESE EXACT RULES:**
              ${todayEvents.length > 0 ? `
              *** YOU MUST USE ONLY THE USER'S SCHEDULED EVENTS LISTED ABOVE ***
              * Events to mention: ${todayEvents.map((e: any) => `"${e.text}" (${e.startTime}~${e.endTime || ''})`).join(', ')}
              * Format each event naturally in Korean, e.g.: "오늘은 ${todayEvents[0]?.startTime || ''}에 ${todayEvents[0]?.text || ''} 일정이 있습니다."
              * List ALL events from the schedule
              * DO NOT mention wake up, work, or sleep times - ONLY mention the events listed above
              * DO NOT invent or assume any times not in the data
              ` : `
              * No custom events today
              * Say: "오늘은 특별히 예정된 일정이 없습니다. 여유롭게 하루를 계획해보세요!"
              `}
            - trend_summary: **ONLY list the article TITLES** from the ${finalTrends.length} trend articles provided above. ***CRITICAL REQUIREMENTS:***
              1. Use double line breaks (\\n\\n) to separate each article
              2. Start EACH article with a bullet point (•)
              3. For EACH article, ONLY include the title and category - NO descriptions, NO summaries, NO explanations
              4. Keep it SHORT and simple - title only
              5. Format: "• [Category] 제목"
            - cheering_message: A short energetic quote or message.

            OUTPUT JSON:
            {
               "greeting": "...",
               "yesterday_summary": "...",
               "yesterday_score": 80,
               "today_schedule_summary": "...",
               "trend_summary": "• [AI] 첫 번째 기사 제목\\n\\n• [Business] 두 번째 기사 제목\\n\\n• [Tech] 세 번째 기사 제목",
               "cheering_message": "..."
            }
            `;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            let content: DailyBriefingContent;
            try {
                // Sanitize json - remove markdown code blocks and control characters
                let jsonStr = responseText.replace(/```json|```/g, "").trim();
                // Remove control characters (0x00-0x1F except whitespace like \n, \r, \t)
                jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
                content = JSON.parse(jsonStr);
            } catch (e) {
                console.error("Failed to parse Gemini briefing", e);
                console.error("Response text:", responseText);
                // Fallback
                content = {
                    greeting: `좋은 아침입니다, ${user.name}님!`,
                    yesterday_summary: "어제도 수고 많으셨습니다.",
                    yesterday_score: 50,
                    today_schedule_summary: "오늘 하루도 화이팅하세요.",
                    trend_summary: "최신 트렌드를 확인해보세요.",
                    cheering_message: "오늘도 멋진 하루가 될 거예요!"
                };
            }

            // C. Save to DB
            console.log(`[DailyBriefing] Saving for user ${user.id}, Date: ${dateStr}`);
            const { error: insertError } = await supabaseAdmin
                .from('daily_briefings')
                .upsert({
                    user_id: user.id,
                    date: dateStr,
                    content,
                    is_read: false
                }, { onConflict: 'user_id, date' })
                .select(); // Add select to verify return if needed

            if (insertError) {
                console.error(`[DailyBriefing] Failed to save for ${user.name}:`, JSON.stringify(insertError));
            } else {
                console.log(`[DailyBriefing] Successfully saved for ${user.name}`);
            }

        } catch (err) {
            console.error(`[DailyBriefing] CRITICAL Error processing user ${user.id}:`, err);
        }
    }

    console.log('[DailyBriefing] Job complete.');
}
