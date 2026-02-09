import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";

export const maxDuration = 300; // 5 minutes

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const youtube = google.youtube({
    version: "v3",
    auth: process.env.GEMINI_API_KEY
});

interface MediaItem {
    id: string;
    title: string;
    channel: string;
    type: 'youtube';
    tags: string[];
    duration: string;
    description: string;
}

async function generateRecommendationsForUser(email: string, job: string, goal: string, interests: string[]) {
    try {
        console.log(`[CRON] Generating recommendations for ${email}...`);

        // 1. Generate Search Queries using Gemini
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        });

        const interestList = interests.join(", ");
        const prompt = `Generate 3 YouTube search queries for a ${job} who wants to ${goal}.
Interests: ${interestList || "General professional development"}

Return JSON:
{
  "queries": ["query1", "query2", "query3"]
}

Make queries:
1. Specific and actionable
2. Mix of tutorials, insights, and industry trends
3. Relevant to ${job} and goal: ${goal}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const data = JSON.parse(response.text());
        const queries = data.queries || [];

        if (queries.length === 0) {
            console.error(`[CRON] No queries generated for ${email}`);
            return null;
        }

        // 2. Search YouTube for each query
        const allVideos: MediaItem[] = [];

        for (const query of queries) {
            try {
                const searchResponse = await youtube.search.list({
                    part: ["snippet"],
                    q: query,
                    type: ["video"],
                    maxResults: 2,
                    relevanceLanguage: "en",
                    videoDuration: "medium"
                });

                const videoIds = searchResponse.data.items
                    ?.map(item => item.id?.videoId)
                    .filter(Boolean) || [];

                if (videoIds.length === 0) continue;

                // Get video details
                const detailsResponse = await youtube.videos.list({
                    part: ["snippet", "contentDetails"],
                    id: videoIds as string[]
                });

                const videos = detailsResponse.data.items || [];
                for (const video of videos) {
                    allVideos.push({
                        id: video.id || "",
                        title: video.snippet?.title || "",
                        channel: video.snippet?.channelTitle || "",
                        type: "youtube",
                        tags: video.snippet?.tags?.slice(0, 3) || [],
                        duration: formatDuration(video.contentDetails?.duration || ""),
                        description: video.snippet?.description?.slice(0, 150) || ""
                    });
                }
            } catch (err) {
                console.error(`[CRON] Error searching YouTube for query "${query}":`, err);
            }
        }

        // Select top 3 videos
        const recommendations = allVideos.slice(0, 3);

        console.log(`[CRON] Generated ${recommendations.length} recommendations for ${email}`);
        return recommendations;

    } catch (error) {
        console.error(`[CRON] Error generating recommendations for ${email}:`, error);
        return null;
    }
}

function formatDuration(isoDuration: string): string {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return "0:00";

    const hours = match[1] || "";
    const minutes = (match[2] || "").padStart(2, "0");
    const seconds = (match[3] || "").padStart(2, "0");

    let result = "";
    if (hours) result += `${hours}:`;
    result += `${minutes}:${seconds}`;

    return result.replace(/^0+:/, "");
}

export async function GET(request: Request) {
    try {
        // Verify authorization
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting recommendations generation at 4:45 AM KST...');

        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        // Get users with profiles (paginated)
        const BATCH_SIZE = 50;
        let offset = 0;
        let allUsers: { email: string; profile: any }[] = [];

        while (true) {
            const { data: batch, error: usersError } = await supabase
                .from('users')
                .select('email, profile')
                .not('profile', 'is', null)
                .range(offset, offset + BATCH_SIZE - 1);

            if (usersError) {
                console.error('[CRON] Error fetching users:', usersError);
                break;
            }
            if (!batch || batch.length === 0) break;
            allUsers = allUsers.concat(batch);
            if (batch.length < BATCH_SIZE) break;
            offset += BATCH_SIZE;
        }

        if (allUsers.length === 0) {
            return NextResponse.json({ success: true, message: 'No users to process' });
        }

        console.log(`[CRON] Found ${allUsers.length} users to generate recommendations for`);

        const results: any[] = [];

        // Process users in parallel batches of 3 (YouTube API rate limits)
        const CONCURRENCY = 3;
        for (let i = 0; i < allUsers.length; i += CONCURRENCY) {
            const batch = allUsers.slice(i, i + CONCURRENCY);
            const batchResults = await Promise.allSettled(
                batch.map(async (user) => {
                    const userProfile = user.profile as any;
                    const job = userProfile.job || 'Professional';
                    const goal = userProfile.goal || 'Growth';
                    const interests = userProfile.interests || [];

                    const recommendations = await generateRecommendationsForUser(user.email, job, goal, interests);

                    if (!recommendations || recommendations.length === 0) {
                        return { email: user.email, status: 'no_recommendations' };
                    }

                    const { error: saveError } = await supabase
                        .from('recommendations_cache')
                        .upsert({
                            email: user.email,
                            date: today,
                            recommendations,
                            created_at: new Date().toISOString()
                        }, { onConflict: 'email,date' });

                    if (saveError) {
                        return { email: user.email, status: 'error', error: saveError.message };
                    }
                    return { email: user.email, status: 'success', count: recommendations.length };
                })
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    const email = batch[batchResults.indexOf(result)]?.email || 'unknown';
                    results.push({ email, status: 'error', error: result.reason?.message });
                }
            }

            // Rate limiting between batches
            if (i + CONCURRENCY < allUsers.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log('[CRON] Recommendations generation completed');

        return NextResponse.json({
            success: true,
            processed: allUsers.length,
            successful: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'error').length,
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[CRON] Error in recommendations generation:', error);
        return NextResponse.json({
            error: 'Failed to generate recommendations',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
