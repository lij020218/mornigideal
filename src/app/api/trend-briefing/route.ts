import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getTrendsCache, saveDetailCache, generateTrendId, saveTrendsCache } from "@/lib/newsCache";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

// Premium news sources with URL patterns
const PREMIUM_SOURCES = [
    { name: "Bloomberg", urlPattern: "https://www.bloomberg.com/news/articles/", category: "경제·비즈니스" },
    { name: "Financial Times", urlPattern: "https://www.ft.com/content/", category: "경제·금융" },
    { name: "The Wall Street Journal", urlPattern: "https://www.wsj.com/articles/", category: "비즈니스" },
    { name: "The Economist", urlPattern: "https://www.economist.com/", category: "경제·정책" },
    { name: "BBC", urlPattern: "https://www.bbc.com/news/", category: "국제" },
    { name: "Reuters", urlPattern: "https://www.reuters.com/", category: "속보·국제" },
    { name: "The New York Times", urlPattern: "https://www.nytimes.com/", category: "종합" },
    { name: "TechCrunch", urlPattern: "https://techcrunch.com/", category: "테크·스타트업" },
    { name: "Wired", urlPattern: "https://www.wired.com/story/", category: "기술·문화" },
    { name: "Nikkei Asia", urlPattern: "https://asia.nikkei.com/", category: "아시아 경제" }
];

// JSON parser
function cleanAndParseJSON(text: string): any {
    let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const firstBrace = cleanText.indexOf('{');
    const firstBracket = cleanText.indexOf('[');

    let start = -1;
    let openChar = '';
    let closeChar = '';

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        openChar = '{';
        closeChar = '}';
    } else if (firstBracket !== -1) {
        start = firstBracket;
        openChar = '[';
        closeChar = ']';
    }

    if (start !== -1) {
        let balance = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = start; i < cleanText.length; i++) {
            const char = cleanText[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === openChar) {
                    balance++;
                } else if (char === closeChar) {
                    balance--;
                    if (balance === 0) {
                        const jsonCandidate = cleanText.substring(start, i + 1);
                        return JSON.parse(jsonCandidate);
                    }
                }
            }
        }
    }

    return JSON.parse(cleanText);
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const job = searchParams.get("job") || "Marketer";
        const goal = searchParams.get("goal");
        const interests = searchParams.get("interests");

        // Check cache first - only return if it's from today
        const cachedData = await getTrendsCache();
        const today = new Date().toISOString().split('T')[0];

        if (cachedData && cachedData.trends.length > 0) {
            const cacheDate = new Date(cachedData.lastUpdated).toISOString().split('T')[0];
            if (cacheDate === today) {
                console.log('[API] Returning cached trends from today:', cachedData.lastUpdated);
                return NextResponse.json({
                    trends: cachedData.trends,
                    cached: true,
                    lastUpdated: cachedData.lastUpdated
                });
            }
        }

        console.log('[API] Generating new daily briefing with Google Search...');

        // Use configured Gemini model with Google Search tool
        const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
        console.log(`[API] Using model: ${modelName}`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            // @ts-expect-error - googleSearch is valid in latest SDK
            tools: [{ googleSearch: {} }]
        });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dateStr = sevenDaysAgo.toISOString().split('T')[0];

        const sourcesInfo = PREMIUM_SOURCES.map(s => `${s.name}`).join(", ");

        const prompt = `
**TODAY'S DATE:** ${today}
**TARGET AUDIENCE:** ${job} professionals
${goal ? `**USER GOAL:** ${goal}` : ""}
${interests ? `**USER INTERESTS:** ${interests}` : ""}

**YOUR TASK:**
Use Google Search to find 6 REAL news articles published in the last 7 days (after ${dateStr}) that are highly relevant for ${job} professionals${interests ? ` and specifically related to these interests: ${interests}` : ""}.

**SEARCH REQUIREMENTS:**
1. **PREMIUM SOURCES ONLY**: Prioritize these sources: ${sourcesInfo}
2. **RECENT**: Articles must be published between ${dateStr} and ${today}
3. **RELEVANT**: Directly useful for ${job}'s career, industry knowledge, or professional development${goal ? `, helping them achieve: "${goal}"` : ""}
4. **DIVERSE**: Cover different topics - AI, business strategy, market trends, innovation, regulations, etc.

**SEARCH STRATEGY:**
- Search for: "${job} news", "AI ${job}", "${job} industry trends", "business technology"${interests ? `, ${interests.split(',').map(i => `"${i} news"`).join(', ')}` : ""}
- Add source filters: site:bloomberg.com, site:ft.com, site:techcrunch.com, etc.
- Verify publication dates are within last 7 days

**OUTPUT FORMAT (JSON):**
Return exactly 6 articles in this format:

{
  "briefings": [
    {
      "title": "Korean translation of article title (tailored for ${job})",
      "category": "AI | Business | Tech | Finance | Strategy | Innovation",
      "summary": "Korean summary (2-3 sentences) explaining why this matters to ${job}",
      "sourceName": "Exact source name (e.g., Bloomberg, TechCrunch)",
      "sourceUrl": "EXACT original article URL from search results",
      "publishedDate": "YYYY-MM-DD (actual publication date)",
      "relevance": "Why ${job} should care about this (Korean, 1 sentence)"
    }
  ]
}

**CRITICAL:**
- Use REAL URLs found via Google Search
- Verify dates are within last 7 days
- Prioritize premium sources
- Ensure diversity of topics
- If user interests are provided, ensure at least 2-3 articles relate to them

Start searching and curating now.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('[API] Gemini response received. Length:', text.length);

        // Log grounding metadata to verify search was used
        if (response.candidates && response.candidates[0].groundingMetadata) {
            console.log('[API] ✅ Google Search was used! Grounding metadata present.');
        } else {
            console.warn('[API] ⚠️ No grounding metadata - search might not have been performed.');
        }

        let data;
        try {
            data = cleanAndParseJSON(text);
        } catch (parseError) {
            console.error("[API] Failed to parse JSON", parseError);
            console.error("[API] Failed text:", text);
            return NextResponse.json({ error: "Failed to parse briefings" }, { status: 500 });
        }

        const briefings = data.briefings || [];

        if (!Array.isArray(briefings) || briefings.length === 0) {
            return NextResponse.json({ error: "Invalid response format" }, { status: 500 });
        }

        console.log(`[API] Parsed ${briefings.length} briefings`);

        const trends = briefings.map((item: any) => ({
            id: generateTrendId(item.title),
            title: item.title,
            category: item.category || "General",
            summary: item.summary,
            time: item.publishedDate || today,
            imageColor: "bg-blue-500/20",
            originalUrl: item.sourceUrl,
            imageUrl: "",
            source: item.sourceName,
            relevance: item.relevance
        }));

        // Save to cache - this will be today's briefing
        await saveTrendsCache(trends, true); // Clear old trends

        return NextResponse.json({
            trends,
            cached: false,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error fetching trends:", error);
        return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { title, level, job, originalUrl, summary, trendId } = await request.json();

        // Check cache first
        if (trendId) {
            const cachedDetail = await (async () => {
                const { getDetailCache } = await import("@/lib/newsCache");
                return getDetailCache(trendId);
            })();

            if (cachedDetail) {
                return NextResponse.json({ detail: cachedDetail, cached: true });
            }
        }

        const modelName = process.env.GEMINI_MODEL || "gemini-3-pro-preview";
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
You are an expert mentor for ${level}-level ${job} professionals.

**CONTEXT:**
- Article Title: "${title}"
- Basic Summary: ${summary}
- Source: ${originalUrl}

**YOUR TASK:**
Create a comprehensive briefing that helps ${level} ${job} understand this news deeply.

**REQUIRED SECTIONS:**

1. **핵심 내용 (Core Content)**
   - What happened? Key facts and context
   - Why is this significant?
   - What's the bigger picture?

2. **${level} ${job}인 당신에게 (For You as ${level} ${job})**
   - How does this directly impact ${job} professionals?
   - What opportunities or challenges does this present?
   - Industry-specific implications

3. **이 브리핑에서 얻을 수 있는 것 (Key Takeaways)**
   - 3-4 bullet points of critical insights
   - Actionable knowledge
   - Strategic implications

4. **실행 가능한 액션 아이템 (Action Items)**
   - 3 specific actions ${level} ${job} can take
   - Both short-term and long-term suggestions
   - Practical and concrete

**OUTPUT FORMAT (JSON):**
{
  "title": "Engaging Korean title (clear and specific)",
  "content": "### 핵심 내용\\n\\n[detailed content]\\n\\n### ${level} ${job}인 당신에게\\n\\n[personalized analysis]\\n\\n### 이 브리핑에서 얻을 수 있는 것\\n\\n- **포인트 1**\\n- **포인트 2**\\n- **포인트 3**",
  "keyTakeaways": ["Insight 1", "Insight 2", "Insight 3"],
  "actionItems": ["Action 1", "Action 2", "Action 3"],
  "originalUrl": "${originalUrl}"
}

Write in Korean. Be insightful, practical, and tailored to ${level} ${job}.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        let detail;
        try {
            detail = cleanAndParseJSON(text);
        } catch (e) {
            console.error("Failed to parse detail JSON", e);
            const simpleClean = text.replace(/```json/g, "").replace(/```/g, "").trim();
            detail = JSON.parse(simpleClean);
        }

        // Cache the detail
        if (trendId) {
            await saveDetailCache(trendId, detail);
        }

        return NextResponse.json({
            detail: { ...detail, originalUrl: originalUrl || "" },
            cached: false
        });
    } catch (error) {
        console.error("Error generating briefing detail:", error);
        return NextResponse.json({ error: "Failed to generate briefing detail" }, { status: 500 });
    }
}
