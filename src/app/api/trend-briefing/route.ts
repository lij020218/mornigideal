import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { getTrendsCache, saveDetailCache, generateTrendId, saveTrendsCache, getDetailCache } from "@/lib/newsCache";
import Parser from 'rss-parser';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import { getUserByEmail } from '@/lib/users';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");
const parser = new Parser();

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
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Tech" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Tech" },
    { name: "Wired", url: "https://www.wired.com/feed/rss", category: "Tech" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "Tech" },
    { name: "Hacker News", url: "https://hnrss.org/frontpage", category: "Tech" },

    // Premium Business Sources
    { name: "Bloomberg Markets", url: "https://feeds.bloomberg.com/markets/news.rss", category: "Business" },
    { name: "Bloomberg Economics", url: "https://feeds.bloomberg.com/economics/news.rss", category: "Economics" },
    { name: "WSJ World News", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", category: "Business" },
    { name: "New York Times Economy", url: "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml", category: "Economics" },
    { name: "New York Times AI", url: "https://www.nytimes.com/svc/collections/v1/publish/spotlight/artificial-intelligence/rss.xml", category: "AI" },

    // International Sources - Sports
    { name: "ESPN", url: "http://www.espn.com/espn/rss/news", category: "Sports" },
    { name: "ESPN Soccer", url: "https://www.espn.com/espn/rss/soccer/news", category: "Sports" },
    { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", category: "Sports" },
    { name: "Sky Sports", url: "https://www.skysports.com/rss/11095", category: "Sports" },

    // Korean Sources
    { name: "연합뉴스", url: "https://www.yna.co.kr/rss/news.xml", category: "뉴스" },
    { name: "동아일보", url: "https://rss.donga.com/total.xml", category: "뉴스" },
    { name: "SBS 뉴스", url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER", category: "뉴스" },
    { name: "한국경제", url: "https://www.hankyung.com/feed/economy", category: "경제" },
    { name: "한국경제 IT", url: "https://www.hankyung.com/feed/it", category: "IT" },
    { name: "조선일보 경제", url: "https://www.chosun.com/arc/outboundfeeds/rss/category/economy/?outputType=xml", category: "경제" },
    { name: "매일경제", url: "https://www.mk.co.kr/rss/30100041/", category: "경제" },
    { name: "매일경제 증권", url: "https://www.mk.co.kr/rss/50200011/", category: "증권" },
    { name: "Google News 비즈니스", url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko", category: "Business" },
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


    for (const feed of RSS_FEEDS) {
        try {
            const feedData = await parser.parseURL(feed.url);

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
            logger.error(`[RSS] Error fetching ${feed.name}:`, error);
        }
    }

    return articles;
}

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const { searchParams } = new URL(request.url);
    const job = searchParams.get("job") || "Marketer";
    const goal = searchParams.get("goal");
    const interests = searchParams.get("interests");
    const forceRefresh = searchParams.get("forceRefresh") === "true";
    const excludeTitles = searchParams.get("exclude")?.split("|||") || []; // 이미 본 뉴스 제목

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const userEmail = email;

    // 사용자 이름 조회 (프리생성 프롬프트에 사용)
    const currentUser = await getUserByEmail(userEmail);
    const userName = currentUser?.profile?.name || currentUser?.name || '사용자';

    // Check cache first (only if not force refreshing and no exclusions)
    if (!forceRefresh && excludeTitles.length === 0) {
        const cachedData = await getTrendsCache(userEmail);

        if (cachedData && cachedData.trends.length > 0) {
            const lastUpdatedDate = new Date(cachedData.lastUpdated);
            const cacheDate = lastUpdatedDate.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

            // Calculate 5 AM KST for today
            const nowKST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
            const cutoffTime = new Date(nowKST);
            cutoffTime.setHours(5, 0, 0, 0);

            // If currently before 5 AM, we compare with yesterday's 5 AM (or just rely on date check)
            // But simpler logic: If cache is from today, AND (it was generated after 5 AM OR it's currently before 5 AM)
            // Actually, user wants: "New briefing at 5 AM".
            // So if now >= 5 AM, cache must be >= 5 AM.
            // If now < 5 AM, cache can be from anytime today (00:00-04:59).

            let isCacheValid = false;
            if (cacheDate === today) {
                if (nowKST.getHours() >= 5) {
                    // It's past 5 AM. Cache must be after 5 AM.
                    // Convert UTC lastUpdatedDate to KST properly
                    const lastUpdatedKSTStr = lastUpdatedDate.toLocaleString("en-US", {
                        timeZone: "Asia/Seoul",
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    });
                    const lastUpdatedKST = new Date(lastUpdatedKSTStr);
                    const lastUpdatedHourKST = parseInt(lastUpdatedKSTStr.split(', ')[1].split(':')[0]);


                    if (lastUpdatedHourKST >= 5) {
                        isCacheValid = true;
                    } else {
                    }
                } else {
                    // It's before 5 AM. Any cache from today is fine.
                    isCacheValid = true;
                }
            }

            if (isCacheValid) {
                return NextResponse.json({
                    trends: cachedData.trends,
                    cached: true,
                    lastUpdated: cachedData.lastUpdated
                });
            }
        }
    }


    // Step 1: Fetch articles from RSS feeds
    const rssArticles = await fetchRSSArticles();

    if (rssArticles.length === 0) {
        return NextResponse.json({ error: "No articles found in RSS feeds" }, { status: 500 });
    }

    // Sort articles by date (newest first) and calculate recency scores
    const now = new Date();
    const sortedArticles = rssArticles
        .map(article => {
            const pubDate = article.pubDate ? new Date(article.pubDate) : null;
            const ageInDays = pubDate ? (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24) : 999;

            // Recency score: 100 for today, 90 for yesterday, 70 for 2 days ago, then decay
            let recencyScore = 0;
            if (ageInDays < 1) recencyScore = 100;
            else if (ageInDays < 2) recencyScore = 90;
            else if (ageInDays < 3) recencyScore = 70;
            else if (ageInDays < 7) recencyScore = 50;
            else recencyScore = 20;

            return { ...article, recencyScore, ageInDays };
        })
        .sort((a, b) => b.recencyScore - a.recencyScore || a.ageInDays - b.ageInDays);


    // Step 2: Use Gemini to filter and select relevant articles
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const interestList = interests ? interests.split(',').map(i => i.trim()).join(', ') : "비즈니스, 기술";

    // Check if user has sports-related interests
    const hasSportsInterest = interests ?
        /스포츠|축구|야구|농구|테니스|골프|sports|football|soccer|baseball|basketball/i.test(interests) :
        false;


    // Prioritize recent articles (first 100 sorted by recency)
    // Filter out sports articles if user has no sports interest
    const sportsSources = ['ESPN', 'ESPN Soccer', 'BBC Sport', 'Sky Sports'];
    const articlesForPrompt = sortedArticles
        .filter(article => {
            // If user has no sports interest, exclude sports sources
            if (!hasSportsInterest && sportsSources.includes(article.sourceName)) {
                return false;
            }
            return true;
        })
        .slice(0, 100)
        .map((article, index) => ({
            id: index,
            title: article.title,
            source: article.sourceName,
            date: article.pubDate,
            recencyScore: article.recencyScore
        }));

    // 제외할 뉴스가 있으면 필터링
    let filteredArticles = articlesForPrompt;
    if (excludeTitles.length > 0) {
        filteredArticles = articlesForPrompt.filter(article =>
            !excludeTitles.some(excludeTitle =>
                article.title.toLowerCase().includes(excludeTitle.toLowerCase()) ||
                excludeTitle.toLowerCase().includes(article.title.toLowerCase())
            )
        );
    }

    if (filteredArticles.length < 6) {
        // 더 많은 뉴스가 필요하면 전체 풀 사용 (recency score 포함)
        filteredArticles = sortedArticles.slice(0, 100).map((article, index) => ({
            id: index,
            title: article.title,
            source: article.sourceName,
            date: article.pubDate,
            recencyScore: article.recencyScore
        })).filter(article =>
            !excludeTitles.some(excludeTitle =>
                article.title.toLowerCase().includes(excludeTitle.toLowerCase())
            )
        );
    }

    const excludeInfo = excludeTitles.length > 0
        ? `\n\n🚫 ALREADY VIEWED (${excludeTitles.length} articles) - DO NOT SELECT SIMILAR ARTICLES:\n${excludeTitles.slice(0, 10).map((t, i) => `${i + 1}. "${t}"`).join('\n')}`
        : '';

    // Build category list based on user interests
    const allowedCategories = hasSportsInterest
        ? "AI|Business|Tech|Finance|Strategy|Innovation|Sports"
        : "AI|Business|Tech|Finance|Strategy|Innovation";

    const sportsWarning = !hasSportsInterest
        ? `\n🚫 **NO SPORTS**: User has NO sports interest. DO NOT select ANY sports articles (ESPN, BBC Sport, Sky Sports, 스포츠 뉴스 등 절대 금지)!`
        : '';

    const prompt = `You are selecting 6 COMPLETELY NEW news articles for a ${job}.
${excludeInfo}
${sportsWarning}

ARTICLES (${filteredArticles.length} available):
${JSON.stringify(filteredArticles.slice(0, 50), null, 2)}

USER:
- Job: ${job}
- Goal: ${goal || "전문성 향상"}
- Interests: ${interestList}

⚠️ **CRITICAL**: You MUST select 6 DIFFERENT articles. DO NOT repeat previous selections!
${excludeTitles.length > 0 ? '❌ The user has ALREADY SEEN the articles listed above. Select FRESH content ONLY!' : ''}
${!hasSportsInterest ? '⚠️ **NO SPORTS ARTICLES** - User is NOT interested in sports!' : ''}

TASK: Select 6 most relevant NEW articles.

CRITERIA (IN ORDER OF PRIORITY):
1. **🔥 RECENCY (HIGHEST PRIORITY)**: Strongly prefer articles with recencyScore >= 70 (published within last 2 days: today=100, yesterday=90, 2 days ago=70). Fresh news is CRITICAL.
2. **🌍 SOURCE BALANCE (MANDATORY)**: MUST select EXACTLY 3 international articles (Reuters, Bloomberg, BBC, CNN, TechCrunch, WSJ, NYT, AP News, etc.) and EXACTLY 3 Korean articles (한국경제, 조선일보, 매일경제, etc.)
3. **📰 SAME SOURCE LIMIT (MANDATORY)**: Maximum 2 articles from the SAME source! (예: BBC에서 최대 2개, 한국경제에서 최대 2개)
4. **🎯 INTEREST MATCHING (MANDATORY)**: ALL 6 articles must be related to user interests (${interestList}). ${!hasSportsInterest ? 'NO SPORTS!' : ''}
5. Valuable for ${job} daily work
6. Support goal: ${goal || "career growth"}
7. Mix of topics within user interests
8. **FRESH content - select different articles from previous selections**

⭐ NOTE: Each article has a "recencyScore" field. Prioritize articles with scores 100, 90, 70 over older articles (50, 20).

OUTPUT JSON:
{
  "selectedArticles": [
    {
      "id": <number>,
      "title_korean": "명확한 한국어 제목",
      "category": "${allowedCategories}",
      "one_line_summary": "핵심 내용을 1줄로 요약한 문장입니다. 확인하세요!",
      "relevance_korean": "구체적 가치 1문장",
      "interest_match_tags": ["태그"],
      "relevance_score": <1-10>,
      "source_type": "international|korean"
    }
  ]
}

Requirements:
- All Korean text (titles, summaries)
- **one_line_summary format**:
  * ⚠️ **CRITICAL: 반드시 주어 + 동사가 있는 완전한 문장!**
  * 최대 25자 이내
  * "~이/가" (주격조사) 필수!
  * "~했습니다/~합니다/~했어요/~됩니다" (완전한 서술어) 필수!
  *
  * ✅ 좋은 예:
  * "하이포가 AI 세일즈로 전환했습니다. 확인하세요!"
  * "메타가 자체 AI 칩 개발을 시작합니다. 확인하세요!"
  * "테슬라 주가가 10% 급등했어요. 확인하세요!"
  * "현대차가 로봇 사업에 진출합니다. 확인하세요!"
  *
  * ❌ 나쁜 예 (절대 금지):
  * "로봇, 현대차 주가↑" (주어+동사 없음 X)
  * "하이포, AI 세일즈 전환" (동사 없음 X)
  * "메타 AI 칩 개발 추진" (주격조사 없음 X)
  *
  * 2문장 금지! 무조건 1문장만!
- Focus on practical value for ${job}
- ${interests ? `At least 3 articles matching: ${interestList}` : ""}
- **MANDATORY: Exactly 3 international + 3 Korean articles (total 6)**

Select now.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let data;
    try {
        data = JSON.parse(text);
    } catch (parseError) {
        logger.error("[API] Failed to parse Gemini response", parseError);
        return NextResponse.json({ error: "Failed to process articles" }, { status: 500 });
    }

    let selectedArticles = data.selectedArticles || [];

    if (selectedArticles.length === 0) {
        return NextResponse.json({ error: "No relevant articles found" }, { status: 500 });
    }

    // Step 2.5: Enforce same source limit (max 2 articles per source)
    const sourceCount: Record<string, number> = {};
    selectedArticles = selectedArticles.filter((article: any) => {
        const filteredArticle = filteredArticles[article.id];
        const sourceName = filteredArticle?.source || 'Unknown';

        if (!sourceCount[sourceName]) {
            sourceCount[sourceName] = 0;
        }

        if (sourceCount[sourceName] >= 2) {
            return false;
        }

        sourceCount[sourceName]++;
        return true;
    });


    // Step 3: Map selected articles back to original RSS articles
    const trends = selectedArticles.map((selected: any) => {
        // Find the original article by matching the id from filteredArticles
        const filteredArticle = filteredArticles[selected.id];
        const originalArticle = rssArticles.find(article =>
            article.title === filteredArticle?.title &&
            article.sourceName === filteredArticle?.source
        );
        const pubDate = originalArticle?.pubDate ? new Date(originalArticle.pubDate).toISOString().split('T')[0] : today;

        return {
            id: generateTrendId(selected.title_korean),
            title: selected.title_korean,
            category: selected.category || "General",
            summary: selected.one_line_summary || selected.summary_korean, // Use one_line_summary if available
            time: pubDate,
            imageColor: "bg-blue-500/20",
            originalUrl: originalArticle?.link || "",
            imageUrl: "",
            source: originalArticle?.sourceName || "Unknown",
            relevance: selected.relevance_korean
        };
    });


    // Save to cache (with user email for proper caching)
    await saveTrendsCache(trends, true, userEmail);

    // Pre-generate details for all trends - MUST await to ensure cache is ready
    const detailModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    // 순차 처리 — Gemini Free Tier 분당 5요청 제한 대응 (2개씩 병렬, 배치 간 딜레이)
    try {
        const BATCH_SIZE = 2;
        const BATCH_DELAY = 13000; // 13초 대기 (분당 5요청 제한)

        for (let i = 0; i < trends.length; i += BATCH_SIZE) {
            const batch = trends.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (trend: any) => {
                try {
                    const detailPrompt = `${userName}님을 위한 맞춤 뉴스 브리핑을 작성하세요.

기사 정보:
- 제목: "${trend.title}"
- 요약: ${trend.summary}
- URL: ${trend.originalUrl}

사용자 정보:
- 이름: ${userName}
- 직업: ${job}
- 목표: ${goal || "전문성 향상"}
- 관심 분야: ${interests || "비즈니스, 기술"}

아래 4개 섹션을 순서대로 작성하세요:

1. **심층 분석**: 이 뉴스의 배경, 맥락, 업계 영향을 분석. 단순 요약이 아닌 "왜 이런 일이 일어났는지", "앞으로 어떤 변화가 예상되는지" 깊이 있게 설명.
2. **왜 ${job}인 ${userName}님에게 중요한가**: 이 뉴스가 ${userName}님의 직업(${job})과 목표(${goal || "전문성 향상"})에 구체적으로 어떤 의미인지 설명. 추상적 연결이 아니라 실무에 미치는 직접적 영향을 서술.
3. **핵심 요약**: 기사의 핵심 내용을 3문장으로 압축 (각 15-20자 이내).
4. **무엇을 할 수 있나**: ${userName}님이 지금 바로 실행할 수 있는 3가지 구체적 행동.

OUTPUT JSON:
{
  "title": "한국어 제목",
  "content": "### 심층 분석\\n\\n[배경과 맥락 분석, 업계 영향]\\n\\n### 왜 ${job}인 ${userName}님에게 중요한가\\n\\n[${userName}님의 직업과 목표에 연결된 구체적 설명. **핵심 키워드**를 <mark>태그로 강조]\\n\\n### 무엇을 할 수 있나\\n\\n- **행동 1**\\n- **행동 2**\\n- **행동 3**",
  "keyTakeaways": ["핵심 요약 1", "핵심 요약 2", "핵심 요약 3"],
  "actionItems": ["관련 기사 읽기", "트렌드 분석 정리", "관련 뉴스 스크랩"],
  "originalUrl": "${trend.originalUrl}"
}

CRITICAL RULES FOR actionItems:
- 반드시 15자 이내로 작성 (예: "AI 뉴스 읽기", "트렌드 분석", "관련 기사 스크랩")
- 일정 제목으로 사용되므로 간단하고 명확하게
- 현실적으로 30분~1시간 내에 실행 가능한 것만
- 좋은 예시: "관련 기사 3개 읽기", "핵심 키워드 정리", "경쟁사 사례 조사"
- 나쁜 예시: "국제 시야 확대 및 기술 이해 심화", "비즈니스 모델 연구"

OTHER RULES:
- keyTakeaways는 정말 짧게 핵심만 (15-20자)
- content에서 중요한 용어는 <mark>태그로 강조
- 톤: 정중하고 전문적인 비서 말투 ("~입니다", "~하세요")

한국어로 작성하세요.`;

                    const detailResult = await detailModel.generateContent(detailPrompt);
                    const detailResponse = await detailResult.response;
                    const detailText = detailResponse.text();

                    const detail = JSON.parse(detailText);

                    if (detail.content && detail.keyTakeaways && detail.actionItems) {
                        await saveDetailCache(trend.id, detail, userEmail);
                    }
                } catch (error) {
                    logger.error(`[API] Failed to pre-generate detail for ${trend.title}:`, error);
                }
            }));

            // 마지막 배치가 아니면 딜레이
            if (i + BATCH_SIZE < trends.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        }
    } catch (err) {
        logger.error('[API] Error in detail pre-generation:', err);
    }

    return NextResponse.json({
        trends,
        cached: false,
        lastUpdated: new Date().toISOString()
    });
});

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { title, level, job, originalUrl, summary, trendId } = await request.json();

    const userEmail = email;

    // Check cache first
    if (trendId) {
        const cachedDetail = await getDetailCache(trendId, userEmail);

        if (cachedDetail) {

            // Validate cache has required fields
            if (cachedDetail.content && cachedDetail.keyTakeaways && cachedDetail.actionItems) {
                return NextResponse.json({ detail: cachedDetail, cached: true });
            } else {
            }
        }
    }

    // 사용자 이름 조회
    const postUser = await getUserByEmail(userEmail);
    const postUserName = postUser?.profile?.name || postUser?.name || '사용자';
    const postUserGoal = postUser?.profile?.goal || '전문성 향상';
    const postUserInterests = (postUser?.profile?.interests || []).join(', ') || '비즈니스, 기술';

    // Check API key
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        logger.error('[API] No Gemini API key found');
        throw new Error('Gemini API key not configured');
    }

    const modelName = process.env.GEMINI_MODEL_2 || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `${postUserName}님을 위한 맞춤 뉴스 브리핑을 작성하세요.

기사 정보:
- 제목: "${title}"
- 요약: ${summary}
- URL: ${originalUrl}

사용자 정보:
- 이름: ${postUserName}
- 직업: ${job}
- 목표: ${postUserGoal}
- 관심 분야: ${postUserInterests}

아래 4개 섹션을 순서대로 작성하세요:

1. **심층 분석**: 이 뉴스의 배경, 맥락, 업계 영향을 분석. 단순 요약이 아닌 "왜 이런 일이 일어났는지", "앞으로 어떤 변화가 예상되는지" 깊이 있게 설명.
2. **왜 ${job}인 ${postUserName}님에게 중요한가**: 이 뉴스가 ${postUserName}님의 직업(${job})과 목표(${postUserGoal})에 구체적으로 어떤 의미인지 설명. 추상적 연결이 아니라 실무에 미치는 직접적 영향을 서술.
3. **핵심 요약**: 기사의 핵심 내용을 3문장으로 압축 (각 15-20자 이내).
4. **무엇을 할 수 있나**: ${postUserName}님이 지금 바로 실행할 수 있는 3가지 구체적 행동.

OUTPUT JSON:
{
  "title": "한국어 제목",
  "content": "### 심층 분석\\n\\n[배경과 맥락 분석, 업계 영향]\\n\\n### 왜 ${job}인 ${postUserName}님에게 중요한가\\n\\n[${postUserName}님의 직업과 목표에 연결된 구체적 설명. **핵심 키워드**를 <mark>태그로 강조]\\n\\n### 무엇을 할 수 있나\\n\\n- **행동 1**\\n- **행동 2**\\n- **행동 3**",
  "keyTakeaways": ["핵심 요약 1", "핵심 요약 2", "핵심 요약 3"],
  "actionItems": ["관련 기사 읽기", "트렌드 분석 정리", "관련 뉴스 스크랩"],
  "originalUrl": "${originalUrl}"
}

CRITICAL RULES FOR actionItems:
- 반드시 15자 이내로 작성 (예: "AI 뉴스 읽기", "트렌드 분석", "관련 기사 스크랩")
- 일정 제목으로 사용되므로 간단하고 명확하게
- 현실적으로 30분~1시간 내에 실행 가능한 것만
- 좋은 예시: "관련 기사 3개 읽기", "핵심 키워드 정리", "경쟁사 사례 조사"
- 나쁜 예시: "국제 시야 확대 및 기술 이해 심화", "비즈니스 모델 연구"

OTHER RULES:
- keyTakeaways는 정말 짧게 핵심만 (15-20자)
- content에서 중요한 용어는 <mark>태그로 강조
- 톤: 정중하고 전문적인 비서 말투 ("~입니다", "~하세요")

한국어로 작성하세요.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();


    if (!text || text.trim().length === 0) {
        logger.error('[API POST] Gemini returned empty response');
        return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    let detail;
    try {
        detail = JSON.parse(text);
    } catch (e) {
        logger.error("[API POST] Failed to parse detail JSON:", e);
        logger.error("[API POST] Raw text:", text.substring(0, 500));
        return NextResponse.json({ error: "Failed to generate detail" }, { status: 500 });
    }

    // Validate required fields
    if (!detail.content || detail.content.trim().length === 0) {
        logger.error('[API POST] Generated detail has empty content');
        return NextResponse.json({ error: "Generated detail has no content" }, { status: 500 });
    }

    // Ensure arrays exist
    if (!detail.keyTakeaways) detail.keyTakeaways = [];
    if (!detail.actionItems) detail.actionItems = [];

    // Cache the detail
    if (trendId) {
        await saveDetailCache(trendId, detail, userEmail);
    }

    return NextResponse.json({
        detail: { ...detail, originalUrl: originalUrl || "" },
        cached: false
    });
});
