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
    { name: "BB Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "Business" },
    { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "Technology" },
    { name: "CNN Top Stories", url: "http://rss.cnn.com/rss/cnn_topstories.rss", category: "Top Stories" },
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Tech" },

    // Premium Business Sources
    { name: "Bloomberg Markets", url: "https://feeds.bloomberg.com/markets/news.rss", category: "Business" },
    { name: "Bloomberg Economics", url: "https://feeds.bloomberg.com/economics/news.rss", category: "Economics" },
    { name: "WSJ World News", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", category: "Business" },
    { name: "New York Times Economy", url: "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml", category: "Economics" },
    { name: "New York Times AI", url: "https://www.nytimes.com/svc/collections/v1/publish/spotlight/artificial-intelligence/rss.xml", category: "AI" },

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

        const articlesForPrompt = rssArticles.slice(0, 50).map((article, index) => ({
            id: index,
            title: article.title,
            source: article.sourceName,
            date: article.pubDate
        }));

        const interestList = interests ? interests.split(',').map(i => i.trim()).join(', ') : "비즈니스, 기술";

        const prompt = `You are selecting 6 news articles for a ${job}.

ARTICLES (${articlesForPrompt.length} available):
${JSON.stringify(articlesForPrompt, null, 2)}

USER:
- Job: ${job}
- Goal: ${goal || "전문성 향상"}
- Interests: ${interestList}

TASK: Select 6 most relevant articles.

CRITERIA:
1. Match interests (${interestList}) - minimum 3 articles
2. Valuable for ${job} daily work
3. Support goal: ${goal || "career growth"}
4. Mix of topics and sources (global + Korean)

OUTPUT JSON:
{
  "selectedArticles": [
    {
      "id": <number>,
      "title_korean": "명확한 한국어 제목",
      "category": "AI|Business|Tech|Finance|Strategy|Innovation|Sports",
      "summary_korean": "${job}에게 왜 중요한지 2문장",
      "relevance_korean": "구체적 가치 1문장",
      "interest_match_tags": ["태그"],
      "relevance_score": <1-10>
    }
  ]
}

Requirements:
- All Korean text (titles, summaries)
- Focus on practical value for ${job}
- ${interests ? `At least 3 articles matching: ${interestList}` : ""}

Select now.`;

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

        const prompt = `Create a briefing for ${level} ${job}.

ARTICLE:
- Title: "${title}"
- Summary: ${summary}
- URL: ${originalUrl}

SECTIONS NEEDED:
1. 핵심 내용: What happened and why it matters
2. ${level} ${job}인 당신에게: Impact on ${job} professionals
3. 주요 인사이트: 3-4 key takeaways
4. 실행 아이템: 3 actionable steps for ${level} ${job}

OUTPUT JSON:
{
  "title": "Korean title",
  "content": "### 핵심 내용\\n\\n[content]\\n\\n### ${level} ${job}인 당신에게\\n\\n[analysis]\\n\\n### 주요 인사이트\\n\\n- **Point 1**\\n- **Point 2**\\n- **Point 3**",
  "keyTakeaways": ["Insight 1", "Insight 2", "Insight 3"],
  "actionItems": ["Action 1", "Action 2", "Action 3"],
  "originalUrl": "${originalUrl}"
}

Write in Korean. Be practical and specific for ${level} ${job}.`;

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
