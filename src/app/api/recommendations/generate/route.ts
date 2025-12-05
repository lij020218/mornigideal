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
      model: process.env.GEMINI_MODEL_2 || "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
    You are a professional content curator for a ${job} whose goal is "${goal}".
    The user is interested in: ${interests.join(", ")}.

    Generate 3 broad, searchable YouTube queries in ENGLISH to find EDUCATIONAL and PROFESSIONALLY RELEVANT videos that will help this specific ${job} achieve their goal.

    **CRITICAL INSTRUCTIONS:**
    1. **THINK ABOUT THE USER'S PROFESSION FIRST**: What skills, knowledge, and insights does a ${job} need to grow professionally?
    2. **MATCH CONTENT TO THEIR JOB**: Every query must be directly useful for a ${job} - not generic, not entertainment
    3. Use SIMPLE, BROAD ENGLISH keywords (1-3 words max) that are commonly used in popular educational videos
    4. ALWAYS translate Korean terms to English (e.g. "엔비디아" → "nvidia", "인공지능" → "AI", "미용" → "hairstyling")
    5. Use industry-standard English terms specific to their field
    6. ALL queries must be in ENGLISH only
    7. **STRICTLY EXCLUDE**: entertainment, ASMR, gaming, music videos, vlogs, memes, pranks, unboxing, reactions, and any non-educational content
    8. **FOCUS ON**: tutorials, skill development, industry trends, professional techniques, career advice, expert insights

    **PROFESSION-SPECIFIC EXAMPLES:**

    For Business Student (경영학과):
    ❌ BAD: "ASMR study music", "funny business fails" (Entertainment)
    ✅ GOOD: "business strategy", "marketing tutorial", "finance basics"

    For Hairstylist (미용사):
    ❌ BAD: "hair transformation reaction", "salon vlog" (Entertainment)
    ✅ GOOD: "hair cutting techniques", "color theory hair", "salon business tips"

    For Athlete (운동선수):
    ❌ BAD: "funny gym fails", "workout music" (Entertainment)
    ✅ GOOD: "strength training", "sports nutrition", "injury prevention"

    For Software Developer (개발자):
    ❌ BAD: "coding memes", "programmer lifestyle vlog" (Entertainment)
    ✅ GOOD: "React tutorial", "system design", "coding interview"

    **YOUR TASK FOR THIS ${job}:**
    Think: "What 3 topics would genuinely help a ${job} improve their skills and achieve '${goal}'?"
    Then convert those topics into simple, broad English search queries.

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
