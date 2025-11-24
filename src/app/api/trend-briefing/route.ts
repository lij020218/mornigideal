import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getTrendsCache, saveDetailCache, generateTrendId, saveTrendsCache } from "@/lib/newsCache";
import Parser from 'rss-parser';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");
const parser = new Parser();

// RSS Feed URLs for top priority sources
const RSS_FEEDS = [
    // International Sources - News & Business
    { name: "Reuters", url: "https://www.reuters.com/rssFeed/businessNews", category: "Business" },
    { name: "Reuters Tech", url: "https://www.reuters.com/rssFeed/technologyNews", category: "Technology" },
    { name: "AP News", url: "https://rsshub.app/apnews/topics/apf-topnews", category: "Top News" },
    { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "Business" },
    { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "Technology" },
    { name: "CNN Top Stories", url: "http://rss.cnn.com/rss/cnn_topstories.rss", category: "Top Stories" },
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Tech" },

    // International Sources - Sports
    { name: "ESPN", url: "http://www.espn.com/espn/rss/news", category: "Sports" },
    { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", category: "Sports" },
    { name: "Reuters Sports", url: "http://feeds.reuters.com/reuters/worldOfSport", category: "Sports" },
    { name: "Sky Sports", url: "https://www.skysports.com/rss/11095", category: "Sports" },

    // Korean Sources
    { name: "한국경제", url: "https://www.hankyung.com/feed/economy", category: "경제" },
    { name: "한국경제 IT", url: "https://www.hankyung.com/feed/it", category: "IT" },
    { name: "조선일보 경제", url: "https://www.chosun.com/arc/outboundfeeds/rss/category/economy/?outputType=xml", category: "경제" },
    { name: "매일경제", url: "https://www.mk.co.kr/rss/30100041/", category: "경제" },
    { name: "매일경제 증권", url: "https://www.mk.co.kr/rss/50200011/", category: "증권" },
];

interface RSSArticle {
    title: string;
    link: string;
    pubDate?: string;
    contentSnippet?: string;
    sourceName: string;
}

// Fetch articles from RSS feeds
async function fetchRSSArticles(): Promise<RSSArticle[]> {
    const articles: RSSArticle[] = [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log('[RSS] Fetching from', RSS_FEEDS.length, 'RSS feeds...');

    for (const feed of RSS_FEEDS) {
        try {
            const feedData = await parser.parseURL(feed.url);
            console.log(`[RSS] Fetched ${feedData.items?.length || 0} items from ${feed.name}`);

            feedData.items?.forEach((item) => {
                const pubDate = item.pubDate ? new Date(item.pubDate) : null;

                // Only include articles from last 7 days
                if (pubDate && pubDate >= sevenDaysAgo) {
                    articles.push({
                        title: item.title || 'Untitled',
                        link: item.link || '',
                        pubDate: item.pubDate,
                        contentSnippet: item.contentSnippet || item.content,
                        sourceName: feed.name
                    });
                }
            });
        } catch (error) {
            console.error(`[RSS] Error fetching ${feed.name}:`, error);
        }
    }

    console.log(`[RSS] Total articles collected: ${articles.length}`);
    return articles;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const job = searchParams.get("job") || "Marketer";
        const goal = searchParams.get("goal");
        const interests = searchParams.get("interests");
        const forceRefresh = searchParams.get("forceRefresh") === "true";

        // Check cache first
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

        console.log('[API] Generating new daily briefing from RSS feeds...');
        console.log('[API] Interests:', interests);

        // Step 1: Fetch articles from RSS feeds
        const rssArticles = await fetchRSSArticles();

        if (rssArticles.length === 0) {
            return NextResponse.json({ error: "No articles found in RSS feeds" }, { status: 500 });
        }

        // Step 2: Use Gemini to filter and select relevant articles
        const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
        });

        const articlesForPrompt = rssArticles.slice(0, 80).map((article, index) => ({
            id: index,
            title: article.title,
            source: article.sourceName,
            snippet: article.contentSnippet?.substring(0, 250),
            date: article.pubDate
        }));

        const prompt = `
You are an expert news curator specializing in personalized content for professionals.

**AVAILABLE ARTICLES (${articlesForPrompt.length} from last 7 days):**
${JSON.stringify(articlesForPrompt, null, 2)}

**USER PROFILE:**
- **직업 (Job):** ${job}
- **목표 (Goal):** ${goal || "전문성 향상"}
- **관심사 (Interests):** ${interests || "비즈니스, 기술, 전략"}
- **언어 (Language):** 한국어 (Korean)

**YOUR MISSION:**
Select exactly 6 articles that are PERFECTLY tailored to this user's profile.

**SELECTION CRITERIA (in priority order):**

1. **관심사 매칭 (Interest Match) - 40% weight**
   - MUST include at least 3 articles directly related to: ${interests || ""}
   - ${interests ? interests.split(',').map(i => `Articles about "${i.trim()}" are HIGH PRIORITY`).join('\n   - ') : ""}

2. **직무 관련성 (Job Relevance) - 30% weight**
   - How valuable is this for a ${job}?
   - Will it help them in their daily work?
   - Does it provide actionable insights for ${job}?

3. **목표 정렬 (Goal Alignment) - 20% weight**
   - ${goal ? `Does it support their goal: "${goal}"?` : "Does it support professional growth?"}

4. **다양성 (Diversity) - 10% weight**
   - Mix of topics: business, tech, innovation, sports, finance
   - Mix of sources: global (Reuters, BBC, CNN) + Korean (한국경제, 조선일보)

**PERSONALIZATION RULES:**
✓ Translate ALL titles to clear, natural Korean
✓ Write summaries explaining **WHY** this matters to a ${job}
✓ Focus on practical value and actionable insights
✓ Use professional but accessible language
✓ Emphasize how this helps achieve: ${goal || "professional excellence"}

**OUTPUT (JSON):**
{
  "selectedArticles": [
    {
      "id": <article id>,
      "title_korean": "명확하고 구체적인 한국어 제목",
      "category": "AI | Business | Tech | Finance | Strategy | Innovation | Sports",
      "summary_korean": "${job}에게 이 기사가 왜 중요한지 2-3문장으로 설명. ${interests ? `특히 ${interests} 관련하여` : ''}",
      "relevance_korean": "${job}로서 이 기사로부터 얻을 수 있는 구체적인 가치 한 문장",
      "interest_match_tags": ["${interests ? interests.split(',')[0]?.trim() : 'business'}"], 
      "relevance_score": <1-10, how relevant to this user>
    }
  ]
}

**CRITICAL:**
- Select the 6 MOST RELEVANT articles for THIS SPECIFIC ${job}
- ${interests ? `AT LEAST 3 must match interests: ${interests}` : ""}
- All content in natural, professional Korean
- Focus on actionable value

Start now.`;


        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error("[API] Failed to parse Gemini response", parseError);
            return NextResponse.json({ error: "Failed to process articles" }, { status: 500 });
        }

        const selectedArticles = data.selectedArticles || [];

        if (selectedArticles.length === 0) {
            return NextResponse.json({ error: "No relevant articles found" }, { status: 500 });
        }

        // Step 3: Map selected articles back to original RSS articles
        const trends = selectedArticles.map((selected: any) => {
            const originalArticle = rssArticles[selected.id];
            const pubDate = originalArticle?.pubDate ? new Date(originalArticle.pubDate).toISOString().split('T')[0] : today;

            return {
                id: generateTrendId(selected.title_korean),
                title: selected.title_korean,
                category: selected.category || "General",
                summary: selected.summary_korean,
                time: pubDate,
                imageColor: "bg-blue-500/20",
                originalUrl: originalArticle?.link || "",
                imageUrl: "",
                source: originalArticle?.sourceName || "Unknown",
                relevance: selected.relevance_korean
            };
        });

        console.log(`[API] Selected ${trends.length} articles from RSS feeds`);

        // Save to cache
        await saveTrendsCache(trends, true);

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

        const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
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
            detail = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse detail JSON", e);
            return NextResponse.json({ error: "Failed to generate detail" }, { status: 500 });
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
