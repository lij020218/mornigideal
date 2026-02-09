import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { getUserByEmail } from "@/lib/users";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const youtube = google.youtube({
  version: "v3",
  auth: process.env.GEMINI_API_KEY // YouTube Data API v3 can use Gemini API key
});

interface UserProfileData {
  userType?: string;
  major?: string;
  field?: string;
  experience?: string;
  goal?: string;
  interests?: string[];
  job?: string;
  level?: string;
}

export async function POST(request: NextRequest) {
  try {
    let { job, goal, interests, exclude = [], excludeIds = [] } = await request.json();

    // If profile data not provided, fetch from database
    if (!job || !goal || !interests || interests.length === 0) {
      const email = await getUserEmailWithAuth(request);
      if (email) {
        try {
          const user = await getUserByEmail(email);
          if (user?.profile) {
            const profile = user.profile as UserProfileData;

            // Map interest IDs to readable labels for better search queries
            const interestMap: Record<string, string> = {
              ai: "artificial intelligence AI",
              startup: "startup entrepreneurship",
              marketing: "marketing branding",
              development: "software development programming",
              design: "UX design",
              finance: "investing finance",
              selfdev: "self improvement productivity",
              health: "fitness health",
            };

            job = job || profile.job || profile.field || "professional";
            goal = goal || profile.goal || "self improvement";
            interests = interests?.length > 0 ? interests : (profile.interests || []).map((i: string) => interestMap[i] || i);

            console.log("[Recommendations] Loaded profile from DB:", { job, goal, interests });
          }
        } catch (error) {
          console.error("[Recommendations] Failed to load profile:", error);
        }
      }
    }

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

    **LANGUAGE MIX REQUIREMENT:**
    - Generate 2 queries in English (for international/English content)
    - Generate 1 query in Korean (for Korean content)
    - This ensures a mix of English and Korean videos

    **REQUIRED OUTPUT (JSON):**
    {
      "queries": ["english query 1", "english query 2", "한국어 검색어"]
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

    // 2. Search YouTube for each query with view count filtering (sequential to avoid duplicates)
    const videos = [];
    const selectedVideoIds = new Set<string>(); // Track selected video IDs to prevent duplicates

    // Add previously shown video IDs to exclusion set
    const excludedVideoIds = new Set<string>(excludeIds);

    // PRIORITY SETTINGS
    const MIN_VIEW_COUNT_PRIORITY = 200000; // 조회수 20만 이상 우선
    const MIN_VIEW_COUNT_FALLBACK = 50000;  // fallback: 5만 이상
    const RECENCY_DAYS = 30; // 1달 이내 최신성 우선

    for (const q of queries.slice(0, 3)) {
      try {
        // Calculate date 1 month ago for recency (prioritize recent content)
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(oneMonthAgo.getDate() - RECENCY_DAYS);
        const publishedAfter = oneMonthAgo.toISOString();

        // Also search 3 months ago as fallback
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const publishedAfterFallback = threeMonthsAgo.toISOString();

        // Get more results to filter by view count
        const searchRes = await youtube.search.list({
          part: ["snippet"],
          q: q,
          maxResults: 25, // Get more results to have better options
          type: ["video"],
          videoDuration: "medium", // Avoid shorts
          publishedAfter: publishedAfter, // Only get videos from last 1 month first
          order: "viewCount" // Sort by view count to get popular videos
        });

        let videoItems = searchRes.data.items || [];

        // If not enough results from last month, expand to 3 months
        if (videoItems.length < 10) {
          console.log(`[YouTube] Query "${q}": Only ${videoItems.length} recent videos, expanding to 3 months...`);
          const fallbackRes = await youtube.search.list({
            part: ["snippet"],
            q: q,
            maxResults: 25,
            type: ["video"],
            videoDuration: "medium",
            publishedAfter: publishedAfterFallback,
            order: "viewCount"
          });
          videoItems = fallbackRes.data.items || [];
        }

        if (videoItems.length === 0) {
          console.log(`[YouTube] No results for query: "${q}"`);
          continue;
        }

        // Get video details including statistics for all results
        const videoIds = videoItems
          .filter(item => item.id?.videoId)
          .map(item => item.id!.videoId!);

        const videoRes = await youtube.videos.list({
          part: ["contentDetails", "snippet", "statistics"],
          id: videoIds
        });

        if (!videoRes.data.items || videoRes.data.items.length === 0) continue;

        // Filter videos - prefer 200k+ views, fallback to 50k+
        const filterVideos = (minViews: number) => {
          return videoRes.data.items!.filter(video => {
            const viewCount = parseInt(video.statistics?.viewCount || "0");
            const title = video.snippet?.title || "";
            const videoId = video.id!;

            // Filter out videos we've already shown (by ID - primary method)
            const alreadyShownById = excludedVideoIds.has(videoId);

            // Filter out videos we've already shown (by title - fallback method)
            const alreadyShownByTitle = exclude.some((excludedTitle: string) =>
              title.toLowerCase().includes(excludedTitle.toLowerCase()) ||
              excludedTitle.toLowerCase().includes(title.toLowerCase())
            );

            // Filter out already selected videos in this session
            const alreadySelected = selectedVideoIds.has(videoId);

            return viewCount >= minViews && !alreadyShownById && !alreadyShownByTitle && !alreadySelected;
          });
        };

        // Try 200k+ views first, then fallback to 50k+
        let qualityVideos = filterVideos(MIN_VIEW_COUNT_PRIORITY);
        if (qualityVideos.length === 0) {
          console.log(`[YouTube] No 200k+ videos for "${q}", trying 50k+...`);
          qualityVideos = filterVideos(MIN_VIEW_COUNT_FALLBACK);
        }

        // Sort by recency-weighted popularity score (stronger recency boost)
        const scoredVideos = qualityVideos.map(video => {
          const viewCount = parseInt(video.statistics?.viewCount || "0");
          const publishedAt = new Date(video.snippet?.publishedAt || "");
          const daysOld = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);

          // Stronger recency boost: videos within 30 days get major boost
          // exponential decay over 30 days instead of 180
          const recencyBoost = Math.exp(-daysOld / 30);

          // View count bonus for 200k+ videos
          const viewCountBonus = viewCount >= MIN_VIEW_COUNT_PRIORITY ? 1.5 : 1;

          const score = viewCount * viewCountBonus * (1 + recencyBoost * 3); // Up to 4x boost for newest content

          return { video, score, viewCount, daysOld };
        });

        // Pick the highest scoring video that hasn't been selected yet
        const sortedVideos = scoredVideos.sort((a, b) => b.score - a.score);
        const topVideo = sortedVideos[0]?.video;

        if (!topVideo) {
          console.log(`[YouTube] No qualifying videos found for query: "${q}"`);
          continue;
        }

        const selectedInfo = sortedVideos[0];
        console.log(`[YouTube] Selected for "${q}": ${topVideo.snippet?.title} (${selectedInfo.viewCount} views, ${Math.round(selectedInfo.daysOld)} days old)`);

        // Add to selected set to prevent duplicates
        selectedVideoIds.add(topVideo.id!);

        videos.push({
          id: topVideo.id!,
          title: topVideo.snippet?.title || "Unknown Title",
          channel: topVideo.snippet?.channelTitle || "Unknown Channel",
          type: 'youtube',
          tags: topVideo.snippet?.tags?.slice(0, 3) || [interests[0] || "General"],
          duration: parseDuration(topVideo.contentDetails?.duration || "PT0M"),
          description: topVideo.snippet?.description?.slice(0, 100) + "..." || "No description available."
        });
      } catch (err) {
        console.error(`YouTube search error for "${q}":`, err);
      }
    }

    // ENSURE 3 VIDEOS: If we don't have 3 videos, try additional backup queries
    if (videos.length < 3) {
      console.log(`[YouTube] Only ${videos.length} videos found, trying backup queries...`);

      const backupQueries = [
        `${job} tips 2024`,
        `${interests[0] || job} tutorial`,
        `${goal} how to`
      ];

      for (const q of backupQueries) {
        if (videos.length >= 3) break;

        try {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

          const searchRes = await youtube.search.list({
            part: ["snippet"],
            q: q,
            maxResults: 20,
            type: ["video"],
            videoDuration: "medium",
            publishedAfter: threeMonthsAgo.toISOString(),
            order: "viewCount"
          });

          if (!searchRes.data.items?.length) continue;

          const videoIds = searchRes.data.items
            .filter(item => item.id?.videoId && !selectedVideoIds.has(item.id.videoId))
            .map(item => item.id!.videoId!);

          if (videoIds.length === 0) continue;

          const videoRes = await youtube.videos.list({
            part: ["contentDetails", "snippet", "statistics"],
            id: videoIds
          });

          const validVideo = videoRes.data.items?.find(video => {
            const viewCount = parseInt(video.statistics?.viewCount || "0");
            return viewCount >= 50000 && !excludedVideoIds.has(video.id!);
          });

          if (validVideo) {
            selectedVideoIds.add(validVideo.id!);
            videos.push({
              id: validVideo.id!,
              title: validVideo.snippet?.title || "Unknown Title",
              channel: validVideo.snippet?.channelTitle || "Unknown Channel",
              type: 'youtube',
              tags: validVideo.snippet?.tags?.slice(0, 3) || ["General"],
              duration: parseDuration(validVideo.contentDetails?.duration || "PT0M"),
              description: validVideo.snippet?.description?.slice(0, 100) + "..." || "No description available."
            });
            console.log(`[YouTube] Backup video added: ${validVideo.snippet?.title}`);
          }
        } catch (err) {
          console.error(`YouTube backup search error for "${q}":`, err);
        }
      }
    }

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
