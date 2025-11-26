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

    Generate 3 specific, distinct YouTube search queries to find helpful videos for them.
    
    **CRITICAL INSTRUCTIONS:**
    1. Queries should be in Korean or English (whichever yields better results for the topic).
    2. Focus on high-quality, educational, or inspiring content.
    3. Avoid generic terms; be specific (e.g. instead of "React", use "React 19 new features tutorial").
    4. Ensure the 3 queries cover different aspects of their interests.

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

    // 2. Search YouTube for each query
    const videoPromises = queries.slice(0, 3).map(async (q) => {
      try {
        const searchRes = await youtube.search.list({
          part: ["snippet"],
          q: q,
          maxResults: 1,
          type: ["video"],
          videoDuration: "medium", // Avoid shorts if possible, or use 'any'
          relevanceLanguage: "ko", // Prefer Korean content but not strictly
        });

        const item = searchRes.data.items?.[0];
        if (!item || !item.id?.videoId) return null;

        // Get video details for duration and tags
        const videoRes = await youtube.videos.list({
          part: ["contentDetails", "snippet"],
          id: [item.id.videoId]
        });

        const videoDetail = videoRes.data.items?.[0];
        if (!videoDetail) return null;

        return {
          id: item.id.videoId,
          title: item.snippet?.title || "Unknown Title",
          channel: item.snippet?.channelTitle || "Unknown Channel",
          type: 'youtube',
          tags: item.snippet?.tags?.slice(0, 3) || [interests[0] || "General"],
          duration: parseDuration(videoDetail.contentDetails?.duration || "PT0M"),
          description: item.snippet?.description?.slice(0, 100) + "..." || "No description available."
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
