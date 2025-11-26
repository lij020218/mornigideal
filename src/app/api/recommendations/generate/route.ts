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

    Generate 3 broad, searchable YouTube queries to find popular videos about their interests.

    **CRITICAL INSTRUCTIONS:**
    1. Use SIMPLE, BROAD keywords that are commonly used in popular videos
    2. DO NOT combine too many concepts - keep each query to 1-2 words maximum
    3. Use the EXACT interest name or a broader category (e.g. "엔비디아" not "엔비디아 경영 전략")
    4. Think about what casual viewers would search for, not academic terms
    5. Queries should be in Korean for Korean topics, English for English topics

    **EXAMPLES:**
    ❌ BAD: "엔비디아 경영 전략 분석" (too specific, won't find popular videos)
    ✅ GOOD: "엔비디아" (broad, will find many popular videos)

    ❌ BAD: "React 19 새로운 기능 상세 가이드" (too long, too specific)
    ✅ GOOD: "React 강의" (broad, commonly searched)

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
        // Get more results to filter by view count
        const searchRes = await youtube.search.list({
          part: ["snippet"],
          q: q,
          maxResults: 10, // Get 10 results to filter
          type: ["video"],
          videoDuration: "medium", // Avoid shorts
          relevanceLanguage: "ko",
          order: "relevance" // Sort by relevance first
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
          return viewCount >= MIN_VIEW_COUNT;
        });

        // Sort by view count (descending) and pick the top one
        const topVideo = qualityVideos.sort((a, b) => {
          const viewsA = parseInt(a.statistics?.viewCount || "0");
          const viewsB = parseInt(b.statistics?.viewCount || "0");
          return viewsB - viewsA;
        })[0];

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
