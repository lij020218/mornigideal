import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getTrendsCache, saveDetailCache, generateTrendId, saveTrendsCache } from "@/lib/newsCache";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

// Premium news sources with URL patterns
const PREMIUM_SOURCES = [
    // Economic & Business
    { name: "Bloomberg", urlPattern: "bloomberg.com", category: "경제·비즈니스" },
    { name: "Financial Times", urlPattern: "ft.com", category: "경제·금융" },
    { name: "The Wall Street Journal", urlPattern: "wsj.com", category: "비즈니스" },
    { name: "The Economist", urlPattern: "economist.com", category: "경제·정책" },

    // Global News
    { name: "BBC", urlPattern: "bbc.com", category: "국제" },
    { name: "Reuters", urlPattern: "reuters.com", category: "속보·국제" },
    { name: "AP News", urlPattern: "apnews.com", category: "속보" },

    // US Major
    { name: "The New York Times", urlPattern: "nytimes.com", category: "종합" },
    { name: "The Washington Post", urlPattern: "washingtonpost.com", category: "정치·사회" },

    // Asia
    { name: "Nikkei Asia", urlPattern: "asia.nikkei.com", category: "아시아 경제" },
    { name: "South China Morning Post", urlPattern: "scmp.com", category: "아시아·중국" },

    // Tech & Startup
    { name: "TechCrunch", urlPattern: "techcrunch.com", category: "테크·스타트업" },
    { name: "Wired", urlPattern: "wired.com", category: "기술·문화" },
    { name: "The Information", urlPattern: "theinformation.com", category: "테크·인사이트" }
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
        const forceRefresh = searchParams.get("forceRefresh") === "true";

        // Check cache first - only return if it's from today and not force refreshing
        const cachedData = await getTrendsCache();
        const today = new Date().toISOString().split('T')[0];

        if (!forceRefresh && cachedData && cachedData.trends.length > 0) {
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

        if (forceRefresh) {
            console.log('[API] Force refresh requested with interests:', interests);
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

        // Create simple search queries for each premium source
        const economicSources = ["Bloomberg", "Financial Times", "Wall Street Journal", "The Economist"];
        const newsSources = ["BBC", "Reuters", "AP News"];
        const usSources = ["New York Times", "Washington Post"];
        const asiaSources = ["Nikkei Asia", "South China Morning Post"];
        const techSources = ["TechCrunch", "Wired", "The Information"];

        const allSources = [...economicSources, ...newsSources, ...usSources, ...asiaSources, ...techSources];

        // Create example queries
        const jobEnglish = job === "마케터" ? "marketing" : job === "개발자" ? "developer" : "business professional";
        const exampleQueries = [
            `"Bloomberg AI" after:${dateStr}`,
            `"Reuters technology" after:${dateStr}`,
            `"TechCrunch startup" after:${dateStr}`,
            `"Financial Times business" after:${dateStr}`,
            `"AP News innovation" after:${dateStr}`
        ];

        const prompt = `
**TODAY'S DATE:** ${today}
**TARGET:** ${job} professionals
${goal ? `**GOAL:** ${goal}` : ""}
${interests ? `**INTERESTS:** ${interests}` : ""}

**🎯 MISSION:**
Find 6 recent news articles (published after ${dateStr}) from PREMIUM SOURCES using simple English search queries.

**📰 PREMIUM SOURCES (USE THESE ONLY):**
• Economic/Business: ${economicSources.join(", ")}
• Global News: ${newsSources.join(", ")}
• US Major: ${usSources.join(", ")}
• Asia: ${asiaSources.join(", ")}
• Tech/Startup: ${techSources.join(", ")}

**🔍 SEARCH METHOD:**
Use SIMPLE queries combining source name + topic in ENGLISH:

Examples:
${exampleQueries.join('\n')}

For ${job}:
- "Bloomberg ${jobEnglish}" after:${dateStr}
- "Reuters AI ${jobEnglish}" after:${dateStr}
- "TechCrunch ${jobEnglish}" after:${dateStr}
- "Financial Times ${jobEnglish}" after:${dateStr}
- "BBC technology ${jobEnglish}" after:${dateStr}
- "Nikkei Asia business" after:${dateStr}

${interests ? `
For user interests (${interests}):
${interests.split(',').map(interest => {
            const engInterest = interest.trim();
            return `- "Bloomberg ${engInterest}" after:${dateStr}
- "Reuters ${engInterest}" after:${dateStr}
- "TechCrunch ${engInterest}" after:${dateStr}`;
        }).join('\n')}
` : ""}

**📋 STEP-BY-STEP:**

1. **Execute searches** using the simple query format above:
   - Try EACH premium source with relevant keywords in ENGLISH
   - Include "after:${dateStr}" in all searches
   - Example: Search "Bloomberg artificial intelligence" OR "Reuters AI technology"

2. **Collect 8-10 candidate articles** from premium sources only

3. **Select BEST 6 articles** ensuring:
   ✓ All from premium sources list above
   ✓ Published ${dateStr} or later
   ✓ Diverse topics (AI, business, tech, strategy, etc.)
   ✓ Highly relevant to ${job}
   ${interests ? `✓ At least 2-3 related to: ${interests}` : ""}

**📊 OUTPUT (JSON):**
{
  "briefings": [
    {
      "title": "Korean translation of article title (professional, specific)",
      "category": "AI | Business | Tech | Finance | Strategy | Innovation",
      "summary": "Korean 2-3 sentence summary - explain WHY ${job} should care",
      "sourceName": "Exact source name (e.g., 'Bloomberg', 'Reuters', 'TechCrunch')",
      "sourceUrl": "Complete HTTPS URL from search",
      "publishedDate": "YYYY-MM-DD",
      "relevance": "Korean 1-sentence: specific value for ${job}"
    }
  ]
}

**⚠️ CRITICAL RULES:**
✓ ALL 6 articles MUST be from premium sources listed above
✓ Use simple English queries: "[Source Name] [keyword]"
✓ REAL URLs only (from actual Google Search results)
✓ Published ${dateStr} or later only
✓ Full HTTPS URLs
✓ Never fabricate or guess URLs

**START NOW** - Execute simple English searches for each premium source.`;

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

        // Prefer premium sources; if not enough, backfill with others
        const premiumPatterns = PREMIUM_SOURCES.map(s => s.urlPattern.replace(/^https?:\/\//, "").replace(/^www\./, ""));
        const isPremiumSource = (item: any) => {
            const url = item?.sourceUrl || "";
            const normalized = url.startsWith("http") ? url : `https://${url.replace(/^\/\//, "")}`;
            try {
                const host = new URL(normalized).hostname.replace(/^www\./, "");
                return premiumPatterns.some(pattern => host === pattern || host.endsWith(`.${pattern}`) || host.includes(pattern));
            } catch {
                const sourceName = (item?.sourceName || "").toLowerCase();
                return premiumPatterns.some(pattern => sourceName.includes(pattern.split(".")[0]));
            }
        };

        const premiumBriefings = (briefings || []).filter(isPremiumSource);
        const nonPremiumBriefings = (briefings || []).filter((item: any) => !isPremiumSource(item));

        // Aim for at least 4 premium items; fill remaining slots with others if needed
        const desiredCount = Math.min(briefings.length, 6);
        const finalBriefings = [...premiumBriefings, ...nonPremiumBriefings].slice(0, desiredCount);

        if (!Array.isArray(finalBriefings) || finalBriefings.length === 0) {
            return NextResponse.json({ error: "Invalid response format" }, { status: 500 });
        }

        console.log(`[API] Parsed ${briefings.length} briefings (premium ${premiumBriefings.length}, final ${finalBriefings.length})`);

        const trends = finalBriefings.map((item: any) => ({
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
