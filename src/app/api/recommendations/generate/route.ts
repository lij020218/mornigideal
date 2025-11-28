import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { google } from "googleapis";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");
const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { job, goal, interests, exclude = [] } = await request.json();

    // 1. Generate Search Queries using Gemini
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
    You are a helpful content curator for a ${job} whose goal is "${goal}".
    The user is interested in: ${interests.join(", ")}.

    Generate 3 broad, searchable YouTube queries in ENGLISH to find popular videos about their interests.

    **CRITICAL INSTRUCTIONS:**
    1. Use SIMPLE, BROAD ENGLISH keywords that are commonly used in popular videos
    2. DO NOT combine too many concepts - keep each query to 1-2 words maximum
    3. ALWAYS translate Korean terms to English (e.g. "엔비디아" → "nvidia", "인공지능" → "AI", "파이썬" → "python")
    4. Use industry-standard English terms (e.g. "React", "TypeScript", "Machine Learning")
    5. Think about what casual viewers would search for, not academic terms
    6. ALL queries must be in ENGLISH only

    **EXAMPLES:**
    ❌ BAD: "엔비디아 경영 전략" (Korean, too specific)
    ✅ GOOD: "nvidia" (English, broad)

    ❌ BAD: "React 19 새로운 기능" (Korean, too specific)
    ✅ GOOD: "React tutorial" (English, broad)

    ❌ BAD: "인공지능 딥러닝 설명" (Korean, too long)
    ✅ GOOD: "AI tutorial" (English, simple)

    **REQUIRED OUTPUT (JSON):**
    {
      "queries": ["query 1", "query 2", "query 3"]
    }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();

    let queries: string[] = [];
    try {
      const parsed = JSON.parse(cleanText);
      queries = parsed.queries || [];
    } catch (e) {
      console.error("Failed to parse queries:", text);
      // Fallback queries if parsing fails
      queries = [`${job} ${goal} tips`, `${interests[0]} tutorial`, "self improvement for developers"];
    }

    // 2. Search YouTube for each query with view count filtering
    const videoPromises = queries.slice(0, 3).map(async (q) => {
      try {
        // Calculate date 6 months ago for recency boost
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const publishedAfter = sixMonthsAgo.toISOString();

        // Get more results to filter by view count
        const searchRes = await youtube.search.list({
          part: ["snippet"],
          q: q,
          maxResults: 15, // Get 15 results to have more options after filtering
          type: ["video"],
          videoDuration: "medium", // Avoid shorts
          publishedAfter: publishedAfter, // Only get videos from last 6 months
          order: "viewCount" // Sort by view count to get popular videos
        });

        if (!searchRes.data.items || searchRes.data.items.length === 0) return null;

        // Get video details including statistics for all results
        const videoIds = searchRes.data.items
          .filter(item => item.id?.videoId)
          .map(item => item.id!.videoId!);

        const videoRes = await youtube.videos.list({
          part: ["contentDetails", "snippet", "statistics"],
          id: videoIds
        });

        if (!videoRes.data.items || videoRes.data.items.length === 0) return null;

        // Filter videos with at least 100,000 views
        const MIN_VIEW_COUNT = 100000;
        const qualityVideos = videoRes.data.items.filter(video => {
          const viewCount = parseInt(video.statistics?.viewCount || "0");
          const title = video.snippet?.title || "";

          // Filter out videos we've already shown (from exclude list)
          const alreadyShown = exclude.some((excludedTitle: string) =>
            title.toLowerCase().includes(excludedTitle.toLowerCase()) ||
            excludedTitle.toLowerCase().includes(title.toLowerCase())
          );

          return viewCount >= MIN_VIEW_COUNT && !alreadyShown;
        });

        // Sort by recency-weighted popularity score
        const scoredVideos = qualityVideos.map(video => {
          const viewCount = parseInt(video.statistics?.viewCount || "0");
          const publishedAt = new Date(video.snippet?.publishedAt || "");
          const daysOld = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);

          // Newer videos get a boost (exponential decay over 180 days)
          const recencyBoost = Math.exp(-daysOld / 180);
          const score = viewCount * (1 + recencyBoost * 2); // Up to 3x boost for newest content

          return { video, score };
        });

        // Pick the highest scoring video
        const topVideo = scoredVideos.sort((a, b) => b.score - a.score)[0]?.video;

        if (!topVideo) {
          console.log(`No videos with ${MIN_VIEW_COUNT}+ views found for query: "${q}"`);
          return null;
        }

        return {
          id: topVideo.id!,
          title: topVideo.snippet?.title || "Unknown Title",
          channel: topVideo.snippet?.channelTitle || "Unknown Channel",
          type: 'youtube',
          tags: topVideo.snippet?.tags?.slice(0, 3) || [interests[0] || "General"],
          duration: parseDuration(topVideo.contentDetails?.duration || "PT0M"),
          description: topVideo.snippet?.description?.slice(0, 100) + "..." || "No description available."
        };
      } catch (err) {
        console.error(`YouTube search error for "${q}":`, err);
        return null;
      }
    });

    const videos = (await Promise.all(videoPromises)).filter(v => v !== null);

    // If we failed to get enough videos (e.g. API quota or errors), return empty or error
    if (videos.length === 0) {
      return NextResponse.json({ error: "Failed to fetch valid recommendations from YouTube" }, { status: 500 });
    }

    return NextResponse.json({ recommendations: videos });

  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}

// Helper to parse ISO 8601 duration (PT15M33S) to human readable (15:33)
function parseDuration(duration: string): string {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return "00:00";

  const hours = (match[1] || '').replace('H', '');
  const minutes = (match[2] || '').replace('M', '');
  const seconds = (match[3] || '').replace('S', '');

  let result = "";
  if (hours) result += `${hours}:`;
  result += `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;

  return result.replace(/^0+:/, ''); // Remove leading zeros if hours is 0
}
