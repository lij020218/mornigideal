import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateDetailedBriefing(trend: any, job: string) {
    const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Create a briefing for Intermediate ${job}.

ARTICLE:
- Title: "${trend.title}"
- Summary: ${trend.summary}
- URL: ${trend.originalUrl}

SECTIONS NEEDED:
1. 핵심 내용: What happened and why it matters
2. Intermediate ${job}인 당신에게: Impact on ${job} professionals
3. 주요 인사이트: 3-4 key takeaways
4. 실행 아이템: 3 actionable steps for Intermediate ${job}

OUTPUT JSON:
{
  "title": "Korean title",
  "content": "### 핵심 내용\\n\\n[content]\\n\\n### Intermediate ${job}인 당신에게\\n\\n[analysis]\\n\\n### 주요 인사이트\\n\\n- **Point 1**\\n- **Point 2**\\n- **Point 3**",
  "keyTakeaways": ["Insight 1", "Insight 2", "Insight 3"],
  "actionItems": ["Action 1", "Action 2", "Action 3"],
  "originalUrl": "${trend.originalUrl}"
}

Write in Korean. Be practical and specific for Intermediate ${job}.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return JSON.parse(text);
}

async function saveDetailCache(trendId: string, detail: any) {
    const { error } = await supabase
        .from('trend_details_cache')
        .upsert({
            trend_id: trendId,
            detail_data: detail,
            created_at: new Date().toISOString()
        }, {
            onConflict: 'trend_id'
        });

    if (error) {
        console.error('Error saving detail cache:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('[SCRIPT] Fetching current trends from cache...');

        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        // Get all users' trends for today
        const { data: trendsCache, error } = await supabase
            .from('trends_cache')
            .select('email, trends')
            .eq('date', today);

        if (error || !trendsCache || trendsCache.length === 0) {
            console.log('[SCRIPT] No trends found for today');
            return;
        }

        console.log(`[SCRIPT] Found ${trendsCache.length} users with trends`);

        for (const cache of trendsCache) {
            const userEmail = cache.email;
            const trends = cache.trends as any[];

            console.log(`\n[SCRIPT] Processing ${trends.length} trends for ${userEmail}...`);

            // Get user profile for job
            const { data: userData } = await supabase
                .from('users')
                .select('profile')
                .eq('email', userEmail)
                .single();

            const job = (userData?.profile as any)?.job || 'Professional';

            // Generate details for all trends in parallel
            const promises = trends.map(async (trend: any, index: number) => {
                try {
                    // Stagger requests slightly
                    await new Promise(resolve => setTimeout(resolve, index * 200));

                    console.log(`[${index + 1}/${trends.length}] Generating detail for: ${trend.title}`);

                    const detail = await generateDetailedBriefing(trend, job);
                    await saveDetailCache(trend.id, detail);

                    console.log(`[${index + 1}/${trends.length}] ✓ Cached detail for: ${trend.title}`);

                    return { success: true, title: trend.title };
                } catch (error) {
                    console.error(`[${index + 1}/${trends.length}] ✗ Error for ${trend.title}:`, error);
                    return { success: false, title: trend.title, error };
                }
            });

            const results = await Promise.all(promises);
            const successful = results.filter(r => r.success).length;

            console.log(`\n[SCRIPT] Completed for ${userEmail}: ${successful}/${trends.length} successful`);
        }

        console.log('\n[SCRIPT] All trend details generated successfully!');
    } catch (error) {
        console.error('[SCRIPT] Fatal error:', error);
        process.exit(1);
    }
}

main();
