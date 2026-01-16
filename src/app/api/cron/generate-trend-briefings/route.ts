import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateTrendId, saveDetailCache } from "@/lib/newsCache";
import Parser from 'rss-parser';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");
const parser = new Parser();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// RSS Feed URLs (2026년 1월 업데이트 - 작동하지 않는 피드 대체)
const RSS_FEEDS = [
    // International Sources - News & Business
    // Reuters/AP 피드가 막혀서 대체 소스 사용
    { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "Business" },
    { name: "Financial Times", url: "https://www.ft.com/?format=rss", category: "Business" },
    { name: "Economist", url: "https://www.economist.com/business/rss.xml", category: "Business" },
    { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "Business" },
    { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "Technology" },
    { name: "CNN Top Stories", url: "http://rss.cnn.com/rss/cnn_topstories.rss", category: "Top Stories" },

    // Tech & Startup Sources
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Technology" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Technology" },
    { name: "Wired", url: "https://www.wired.com/feed/rss", category: "Technology" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "Technology" },
    { name: "Hacker News", url: "https://hnrss.org/frontpage", category: "Technology" },

    // Premium Business Sources
    { name: "Bloomberg Markets", url: "https://feeds.bloomberg.com/markets/news.rss", category: "Business" },
    { name: "Bloomberg Economics", url: "https://feeds.bloomberg.com/economics/news.rss", category: "Economics" },
    { name: "WSJ World News", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", category: "Business" },
    { name: "New York Times Economy", url: "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml", category: "Economics" },

    // Korean Sources
    { name: "연합뉴스", url: "https://www.yna.co.kr/rss/news.xml", category: "뉴스" },
    { name: "동아일보", url: "https://rss.donga.com/total.xml", category: "뉴스" },
    { name: "SBS 뉴스", url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER", category: "뉴스" },
    { name: "한국경제", url: "https://www.hankyung.com/feed/economy", category: "경제" },
    { name: "한국경제 IT", url: "https://www.hankyung.com/feed/it", category: "IT" },
    { name: "조선일보 경제", url: "https://www.chosun.com/arc/outboundfeeds/rss/category/economy/?outputType=xml", category: "경제" },
    { name: "매일경제", url: "https://www.mk.co.kr/rss/30100041/", category: "경제" },
];

async function fetchRSSArticles() {
    const allArticles = [];
    const now = new Date();

    for (const feed of RSS_FEEDS) {
        try {
            console.log(`[CRON] Fetching RSS from ${feed.name}...`);
            const rss = await parser.parseURL(feed.url);

            for (const item of rss.items) {
                if (!item.title || !item.link) continue;

                const pubDate = item.pubDate ? new Date(item.pubDate) : now;
                const ageInDays = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24);

                if (ageInDays <= 3) {
                    allArticles.push({
                        title: item.title.trim(),
                        link: item.link,
                        pubDate: pubDate,
                        ageInDays,
                        sourceName: feed.name,
                        category: feed.category,
                        description: item.contentSnippet || item.content || ""
                    });
                }
            }
        } catch (error) {
            console.error(`[CRON] Error fetching ${feed.name}:`, error);
        }
    }

    return allArticles.sort((a, b) => a.ageInDays - b.ageInDays);
}

async function generateDetailedBriefing(trend: any, job: string) {
    const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Create a briefing for Intermediate ${job}.

ARTICLE:
- Title: "${trend.title}"
- Summary: ${trend.summary}
- URL: ${trend.originalUrl}

SECTIONS NEEDED:
1. 핵심 내용: What happened and why it matters
2. Intermediate ${job}인 당신에게: Impact on ${job} professionals
3. 주요 인사이트: 3-4 key takeaways
4. 실행 아이템: 3 actionable steps for Intermediate ${job}

OUTPUT JSON:
{
  "title": "Korean title",
  "content": "### 핵심 내용\\n\\n[content]\\n\\n### Intermediate ${job}인 당신에게\\n\\n[analysis]\\n\\n### 주요 인사이트\\n\\n- **Point 1**\\n- **Point 2**\\n- **Point 3**",
  "keyTakeaways": ["Insight 1", "Insight 2", "Insight 3"],
  "actionItems": ["Action 1", "Action 2", "Action 3"],
  "originalUrl": "${trend.originalUrl}"
}

Write in Korean. Be practical and specific for Intermediate ${job}.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return JSON.parse(text);
}

export async function GET(request: Request) {
    try {
        // Verify the request is authorized
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting trend briefing generation at 4:30 AM...');

        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        // Step 1: Fetch all RSS articles
        const rssArticles = await fetchRSSArticles();
        console.log(`[CRON] Fetched ${rssArticles.length} articles from RSS feeds`);

        if (rssArticles.length === 0) {
            return NextResponse.json({
                error: 'No articles available',
                message: 'No recent articles found in RSS feeds'
            }, { status: 500 });
        }

        // Step 2: Get all users with profiles
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('email, profile')
            .not('profile', 'is', null);

        if (usersError || !users || users.length === 0) {
            console.error('[CRON] No users found:', usersError);
            return NextResponse.json({
                success: true,
                message: 'No users to process'
            });
        }

        console.log(`[CRON] Found ${users.length} users to generate trend briefings for`);

        const selectionModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const results = [];

        // Step 3: Generate personalized trend briefings for each user
        for (const user of users) {
            try {
                const userEmail = user.email;
                const userProfile = user.profile as any;

                console.log(`[CRON] Generating trend briefing for: ${userEmail}`);

                const job = userProfile.job || 'Professional';
                const goal = userProfile.goal || 'Growth';
                const interests = userProfile.interests || [];
                const level = userProfile.level || 'Intermediate';

                // Sort by recency
                const sortedArticles = rssArticles.sort((a, b) => a.ageInDays - b.ageInDays);

                // Prepare articles for Gemini selection
                const articlesForPrompt = sortedArticles.slice(0, 100).map((article, index) => ({
                    id: index,
                    title: article.title,
                    source: article.sourceName,
                    category: article.category,
                    age: `${article.ageInDays.toFixed(1)} days ago`,
                    snippet: article.description?.slice(0, 200) || ""
                }));

                const interestList = interests.join(', ');

                const selectionPrompt = `You are curating news for a ${level} ${job}.

USER PROFILE:
- Job: ${job}
- Goal: ${goal}
- Interests: ${interestList || "General business and technology"}

AVAILABLE ARTICLES (${articlesForPrompt.length}):
${JSON.stringify(articlesForPrompt, null, 2)}

TASK: Select EXACTLY 6 most relevant articles.

CRITERIA:
1. **Relevance to ${job}**: Directly useful for their work
2. **Recency**: Prioritize newer articles (lower "days ago")
3. **Diversity**: Mix of categories (avoid 6 tech articles)
4. **Actionability**: Articles with practical takeaways
5. **Interest match**: ${interests.length > 0 ? `At least 3 articles matching: ${interestList}` : ""}

OUTPUT JSON:
{
  "selectedArticles": [
    {
      "id": <article index 0-${articlesForPrompt.length - 1}>,
      "title_korean": "Korean translation of title",
      "summary_korean": "2-3 sentence Korean summary focusing on why it matters for ${job}",
      "category": "Technology|Business|Marketing|etc",
      "relevance_korean": "1 sentence explaining relevance to ${job}"
    }
  ]
}

Requirements:
- MUST select EXACTLY 6 articles
- Summaries in Korean, natural and professional
- Focus on practical value for ${job}
- ${interests ? `At least 3 articles matching: ${interestList}` : ""}

Select now.`;

                const result = await selectionModel.generateContent(selectionPrompt);
                const response = await result.response;
                const text = response.text();

                let data;
                try {
                    data = JSON.parse(text);
                } catch (parseError) {
                    console.error(`[CRON] Failed to parse Gemini response for ${userEmail}:`, parseError);
                    continue;
                }

                const selectedArticles = data.selectedArticles || [];

                if (selectedArticles.length === 0) {
                    console.error(`[CRON] No articles selected for ${userEmail}`);
                    continue;
                }

                // Map selected articles back to original RSS articles
                const trends = selectedArticles.map((selected: any) => {
                    const filteredArticle = articlesForPrompt[selected.id];
                    const originalArticle = rssArticles.find(article =>
                        article.title === filteredArticle?.title &&
                        article.sourceName === filteredArticle?.source
                    );
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

                console.log(`[CRON] Selected ${trends.length} articles for ${userEmail}, generating detailed briefings...`);

                // Step 4: Generate detailed briefings for all 6 trends in parallel
                const detailPromises = trends.map(async (trend: any) => {
                    try {
                        const detail = await generateDetailedBriefing(trend, job);
                        await saveDetailCache(trend.id, detail, userEmail);
                        console.log(`[CRON] Cached detail for: ${trend.title}`);
                        return { success: true };
                    } catch (error) {
                        console.error(`[CRON] Error generating detail for ${trend.title}:`, error);
                        return { success: false };
                    }
                });

                await Promise.all(detailPromises);

                // Step 5: Save trends to cache
                const { error: saveError } = await supabase
                    .from('trends_cache')
                    .upsert({
                        email: userEmail,
                        date: today,
                        trends: trends,
                        created_at: new Date().toISOString()
                    }, {
                        onConflict: 'email,date'
                    });

                if (saveError) {
                    console.error(`[CRON] Error saving trends for ${userEmail}:`, saveError);
                } else {
                    console.log(`[CRON] Successfully generated and cached trends + details for ${userEmail}`);
                    results.push({ email: userEmail, status: 'success', trends: trends.length });
                }

                // Rate limiting delay
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error(`[CRON] Error processing user ${user.email}:`, error);
                results.push({
                    email: user.email,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        console.log('[CRON] Trend briefing generation completed');

        return NextResponse.json({
            success: true,
            processed: users.length,
            successful: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'error').length,
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[CRON] Error in trend briefing generation:', error);
        return NextResponse.json({
            error: 'Failed to generate trend briefings',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
