import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { saveTrendsCache, saveDetailCache, generateTrendId, type CachedTrend } from "@/lib/newsCache";
import { fetchOgImage } from "@/lib/fetchOgImage";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET(request: Request) {
    try {
        // Verify the request is authorized (optional: add API key check)
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting daily news generation...');

        // Step 1: Fetch trending news
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            tools: [{ googleSearch: {} }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const today = new Date().toISOString().split('T')[0];
        const job = "Marketer"; // TODO: Make this configurable per user

        const trendsPrompt = `
      You are a trend analyst for a ${job}.
      Today's date is ${today}.

      Search the web and find 6 current, hot trending news items or topics that are highly relevant to a ${job} professional.
      Focus on recent news from the past 1-3 days.

      For each item, provide:
      - category: A short category name in English (e.g., "Marketing", "Tech", "AI", "Design", "Business").
      - title: A catchy headline in Korean that captures the essence of the news.
      - time: Relative time (e.g., "2시간 전", "1일 전", "3일 전").
      - imageColor: A Tailwind CSS background color class (e.g., "bg-blue-500/20", "bg-purple-500/20", "bg-green-500/20", "bg-pink-500/20", "bg-orange-500/20").
      - originalUrl: The actual URL to the original news source.
      - imageUrl: The URL of the main/thumbnail image from the article. Look for og:image meta tag or the first prominent image in the article. If no image found, leave empty string.
      - summary: A brief 1-2 sentence summary in Korean of what the news is about.

      Return the response ONLY as a valid JSON array of objects.
      Example:
      [
        { "category": "...", "title": "...", "time": "...", "imageColor": "...", "originalUrl": "...", "imageUrl": "...", "summary": "..." },
        ...
      ]
    `;

        const trendsResult = await model.generateContent(trendsPrompt);
        const trendsResponse = await trendsResult.response;
        const trendsText = trendsResponse.text();
        const cleanedTrendsText = trendsText.replace(/```json/g, "").replace(/```/g, "").trim();
        const trends = JSON.parse(cleanedTrendsText);

        // Add unique IDs to trends
        const trendsWithIds: CachedTrend[] = trends.map((trend: Omit<CachedTrend, 'id'>) => ({
            ...trend,
            id: generateTrendId(trend.title)
        }));

        // Fetch og:image for each trend from originalUrl
        console.log('[CRON] Fetching og:image for each trend...');
        for (const trend of trendsWithIds) {
            try {
                const ogImage = await fetchOgImage(trend.originalUrl);
                if (ogImage) {
                    trend.imageUrl = ogImage;
                    console.log(`[CRON] Found og:image for: ${trend.title}`);
                }
            } catch (error) {
                console.error(`[CRON] Error fetching og:image for "${trend.title}":`, error);
            }
        }

        // Save trends to cache
        await saveTrendsCache(trendsWithIds);
        console.log(`[CRON] Saved ${trendsWithIds.length} trends to cache`);

        // Step 2: Pre-generate detail pages for each news item
        const detailsGenerated: string[] = [];

        for (const trend of trendsWithIds) {
            try {
                const detailPrompt = `
          You are a mentor for an Intermediate ${job}.
          The user wants to understand the news titled: "${trend.title}".
          Brief summary: ${trend.summary}
          Original source: ${trend.originalUrl}

          Search the web if needed to get more context about this news.

          Reconstruct this news content to be:
          1. Easy to understand for an Intermediate level ${job}.
          2. Actionable (what should they do/learn from this?).
          3. In Korean language.
          4. Include practical implications for their career.
          5. 3-5 paragraphs with clear structure.

          Provide:
          - title: A refined, engaging title in Korean.
          - content: A detailed explanation in Korean (3-5 paragraphs). Use markdown formatting with ## for sections, **bold** for key points.
          - keyTakeaways: An array of 3-4 key takeaway bullet points in Korean.
          - actionItems: An array of 2-3 actionable items the user can do, in Korean.

          Return ONLY valid JSON.
          Example:
          {
            "title": "...",
            "content": "...",
            "keyTakeaways": ["...", "..."],
            "actionItems": ["...", "..."]
          }
        `;

                const detailResult = await model.generateContent(detailPrompt);
                const detailResponse = await detailResult.response;
                const detailText = detailResponse.text();
                const cleanedDetailText = detailText.replace(/```json/g, "").replace(/```/g, "").trim();
                const detail = JSON.parse(cleanedDetailText);

                await saveDetailCache(trend.id, {
                    ...detail,
                    originalUrl: trend.originalUrl
                });

                detailsGenerated.push(trend.title);
                console.log(`[CRON] Generated detail for: ${trend.title}`);

                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`[CRON] Error generating detail for "${trend.title}":`, error);
            }
        }

        console.log('[CRON] Daily news generation completed');

        return NextResponse.json({
            success: true,
            trendsCount: trendsWithIds.length,
            detailsGenerated: detailsGenerated.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[CRON] Error in daily news generation:', error);
        return NextResponse.json({
            error: 'Failed to generate daily news',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
