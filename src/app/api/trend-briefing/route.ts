import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getTrendsCache, saveDetailCache, generateTrendId, saveTrendsCache } from "@/lib/newsCache";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

// TOP PRIORITY SOURCES (Tier 1 - Search these FIRST)
const TOP_PRIORITY_SOURCES = [
    { name: "BBC Business", urlPattern: "bbc.com/business", category: "글로벌 비즈니스" },
    { name: "BBC Korean", urlPattern: "bbc.com/korean", category: "한국어 뉴스" },
    { name: "Reuters", urlPattern: "reuters.com", category: "속보·국제" },
    { name: "AP News", urlPattern: "apnews.com", category: "속보" },
    { name: "CNN", urlPattern: "cnn.com", category: "국제·비즈니스" },
    { name: "TechCrunch", urlPattern: "techcrunch.com", category: "테크·스타트업" }
];

// PREMIUM SOURCES (Tier 2 - Search if Tier 1 doesn't have enough)
const PREMIUM_SOURCES = [
    // Economic & Business
    { name: "Bloomberg", urlPattern: "bloomberg.com", category: "경제·비즈니스" },
    { name: "Financial Times", urlPattern: "ft.com", category: "경제·금융" },
    { name: "The Wall Street Journal", urlPattern: "wsj.com", category: "비즈니스" },
    { name: "The Economist", urlPattern: "economist.com", category: "경제·정책" },

    // Global News
    { name: "BBC", urlPattern: "bbc.com", category: "국제" },

    // US Major
    { name: "The New York Times", urlPattern: "nytimes.com", category: "종합" },
    { name: "The Washington Post", urlPattern: "washingtonpost.com", category: "정치·사회" },

    // Asia
    { name: "Nikkei Asia", urlPattern: "asia.nikkei.com", category: "아시아 경제" },
    { name: "South China Morning Post", urlPattern: "scmp.com", category: "아시아·중국" },

    // Tech & Startup
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

        // Tier 1: Top Priority Sources
        const topPrioritySources = TOP_PRIORITY_SOURCES.map(s => s.name);
        const topPrioritySites = TOP_PRIORITY_SOURCES.map(s => `site:${s.urlPattern}`);

        // Tier 2: Premium Sources (excluding duplicates from Tier 1)
        const tier1Patterns = TOP_PRIORITY_SOURCES.map(s => s.urlPattern.toLowerCase());
        const premiumOnlySources = PREMIUM_SOURCES
            .filter(s => !tier1Patterns.some(pattern => s.urlPattern.toLowerCase().includes(pattern)))
            .map(s => s.name);

        const jobEnglish = job === "마케터" ? "marketing" : job === "개발자" ? "developer" : "business professional";
        const jobKorean = job;

        const prompt = `
**TODAY'S DATE:** ${today}
**TARGET:** ${job} professionals
${goal ? `**GOAL:** ${goal}` : ""}
${interests ? `**INTERESTS:** ${interests}` : ""}

**🎯 MISSION:**
Find 8-10 recent news articles (published after ${dateStr}). PRIORITIZE TOP SOURCES.

**📊 SOURCE PRIORITY:**

**🥇 TOP PRIORITY (MUST SEARCH THESE FIRST):**
• Reuters (site:reuters.com)
• AP News (site:apnews.com)
• BBC Business (site:bbc.com/business)
• BBC Korean (site:bbc.com/korean)
• CNN (site:cnn.com)
• TechCrunch (site:techcrunch.com)

**🥈 SECONDARY SOURCES:**
• Bloomberg, Financial Times, WSJ, NYT, Wired, etc.

**🔍 SEARCH INSTRUCTIONS:**

**STEP 1 - MANDATORY: Search TOP PRIORITY sites with site: filter**

Execute these exact searches (English + Korean):

1. site:reuters.com (AI OR technology${interests ? ` OR ${interests.split(',')[0]?.trim()}` : ""}) after:${dateStr}
2. site:apnews.com (technology OR business${interests ? ` OR ${interests.split(',')[0]?.trim()}` : ""}) after:${dateStr}
3. site:bbc.com/business (AI OR business) after:${dateStr}
4. site:bbc.com/korean (비즈니스 OR 기술${interests ? ` OR ${interests}` : ""}) after:${dateStr}
5. site:cnn.com (technology OR AI) after:${dateStr}
6. site:techcrunch.com (AI OR startup${interests ? ` OR ${interests.split(',')[0]?.trim()}` : ""}) after:${dateStr}

**STEP 2 - If needed: Search secondary sources**

7. "Bloomberg" technology after:${dateStr}
8. "Financial Times" AI after:${dateStr}
9. "New York Times" business after:${dateStr}

**STEP 3 - Select 8-10 BEST articles**

✓ Include AT LEAST 5-6 from TOP PRIORITY sites (Step 1)
✓ Published ${dateStr} or later
✓ Diverse topics
${interests ? `✓ At least 2-3 about: ${interests}` : ""}

**📊 OUTPUT (JSON):**
{
  "briefings": [
    {
      "title": "Korean translation of article title",
      "category": "AI | Business | Tech | Finance | Strategy | Innovation",
      "summary": "Korean 2-3 sentence summary - WHY ${job} should care",
      "sourceName": "Exact source name (e.g., 'BBC Business', 'Reuters', 'Bloomberg')",
      "sourceUrl": "Complete HTTPS URL from search",
      "publishedDate": "YYYY-MM-DD",
      "relevance": "Korean 1-sentence: specific value for ${job}"
    }
  ]
}

**⚠️ CRITICAL RULES:**
✓ Search BOTH English AND Korean for each tier
✓ Tier 1: Use site:domain.com filters
✓ Tier 2: Use "Source Name" in quotes
✓ Tier 3: General search
✓ REAL URLs only from Google Search
✓ Published ${dateStr} or later
✓ Full HTTPS URLs required
✓ Prioritize Tier 1 > Tier 2 > Tier 3

**START NOW** - Execute bilingual searches starting with Tier 1 site filters.`;

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

        // Categorize sources by priority
        const topPriorityPatterns = TOP_PRIORITY_SOURCES.map(s => s.urlPattern.toLowerCase());
        const premiumPatterns = PREMIUM_SOURCES.map(s => s.urlPattern.toLowerCase());

        const isTopPriority = (item: any) => {
            const url = (item?.sourceUrl || "").toLowerCase();
            const sourceName = (item?.sourceName || "").toLowerCase();
            return topPriorityPatterns.some(pattern =>
                url.includes(pattern) ||
                sourceName.includes(pattern.split('.')[0]) ||
                sourceName.includes('reuters') && pattern.includes('reuters') ||
                sourceName.includes('bbc') && pattern.includes('bbc') ||
                sourceName.includes('cnn') && pattern.includes('cnn') ||
                sourceName.includes('ap news') && pattern.includes('apnews') ||
                sourceName.includes('techcrunch') && pattern.includes('techcrunch')
            );
        };

        const isPremium = (item: any) => {
            const url = (item?.sourceUrl || "").toLowerCase();
            const sourceName = (item?.sourceName || "").toLowerCase();
            return premiumPatterns.some(pattern =>
                url.includes(pattern) ||
                sourceName.includes(pattern.split('.')[0])
            );
        };

        // Separate articles by priority
        const topPriorityBriefings = briefings.filter(isTopPriority);
        const premiumBriefings = briefings.filter((item: any) => !isTopPriority(item) && isPremium(item));
        const otherBriefings = briefings.filter((item: any) => !isTopPriority(item) && !isPremium(item));

        console.log(`[API] Article breakdown: Top Priority=${topPriorityBriefings.length}, Premium=${premiumBriefings.length}, Other=${otherBriefings.length}`);

        // Build final selection: prioritize top sources
        let finalBriefings: any[] = [];

        // Take at least 4 from top priority (or all if less than 4)
        const topCount = Math.min(topPriorityBriefings.length, 6);
        finalBriefings.push(...topPriorityBriefings.slice(0, topCount));

        // If we need more, add premium sources
        if (finalBriefings.length < 6) {
            const needed = 6 - finalBriefings.length;
            finalBriefings.push(...premiumBriefings.slice(0, needed));
        }

        // If still need more, add other sources
        if (finalBriefings.length < 6) {
            const needed = 6 - finalBriefings.length;
            finalBriefings.push(...otherBriefings.slice(0, needed));
        }

        // If we have more than 6, trim to 6
        finalBriefings = finalBriefings.slice(0, 6);

        if (!Array.isArray(finalBriefings) || finalBriefings.length === 0) {
            return NextResponse.json({ error: "Invalid response format" }, { status: 500 });
        }

        console.log(`[API] Final selection: ${finalBriefings.length} articles (${finalBriefings.filter(isTopPriority).length} from top priority)`);

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
