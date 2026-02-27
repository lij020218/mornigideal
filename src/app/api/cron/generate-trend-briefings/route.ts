import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from 'openai';
import { NextResponse } from "next/server";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateTrendId, saveDetailCache } from "@/lib/newsCache";
import { MODELS } from "@/lib/models";
import Parser from 'rss-parser';
import { saveProactiveNotification } from "@/lib/proactiveNotificationService";
import { sendPushNotification } from "@/lib/pushService";
import { LIMITS } from "@/lib/constants";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

async function generateDetailedBriefing(trend: any, userProfile: { name: string; job: string; goal: string; interests: string[]; level: string }) {
    const { name, job, goal, interests } = userProfile;
    const userName = name || '사용자';
    const interestList = interests.length > 0 ? interests.join(', ') : '비즈니스, 기술';

    const prompt = `${userName}님을 위한 맞춤 뉴스 브리핑을 작성하세요.

기사 정보:
- 제목: "${trend.title}"
- 요약: ${trend.summary}
- URL: ${trend.originalUrl}

사용자 정보:
- 이름: ${userName}
- 직업: ${job}
- 목표: ${goal}
- 관심 분야: ${interestList}

아래 4개 섹션을 순서대로 작성하세요:

1. **심층 분석**: 이 뉴스의 배경, 맥락, 업계 영향을 분석. 단순 요약이 아닌 "왜 이런 일이 일어났는지", "앞으로 어떤 변화가 예상되는지" 깊이 있게 설명.
2. **왜 ${job}인 ${userName}님에게 중요한가**: 이 뉴스가 ${userName}님의 직업(${job})과 목표(${goal})에 구체적으로 어떤 의미인지 설명. 추상적 연결이 아니라 실무에 미치는 직접적 영향을 서술.
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

    // Try Gemini first, fallback to flash model on 503, then OpenAI on 429/quota
    try {
        const modelName = process.env.GEMINI_MODEL || "gemini-3.0-flash";
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (geminiError: any) {
        const status = geminiError?.status || geminiError?.httpStatusCode;
        // 503: 모델 과부하 → gemini-3.0-flash로 재시도
        if (status === 503 || geminiError?.message?.includes('503')) {
            console.warn(`[CRON] Gemini 503, retrying with gemini-3.0-flash`);
            try {
                const flashModel = genAI.getGenerativeModel({
                    model: "gemini-3.0-flash",
                    generationConfig: { responseMimeType: "application/json" }
                });
                const result = await flashModel.generateContent(prompt);
                const response = await result.response;
                return JSON.parse(response.text());
            } catch (flashError: any) {
                console.warn(`[CRON] Gemini flash also failed, falling back to OpenAI`);
            }
        }
        // 429/quota 또는 flash 실패 → OpenAI 폴백
        if (status === 429 || status === 503 || geminiError?.message?.includes('429') || geminiError?.message?.includes('quota') || geminiError?.message?.includes('503')) {
            console.warn(`[CRON] Gemini ${status} in generateDetailedBriefing, falling back to OpenAI`);
            const completion = await openai.chat.completions.create({
                model: MODELS.GPT_5_MINI,
                messages: [
                    { role: 'system', content: 'You are a professional Korean news briefing writer. Always respond with valid JSON only.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
            });
            const text = completion.choices[0]?.message?.content || '{}';
            return JSON.parse(text);
        }
        throw geminiError;
    }
}

export async function GET(request: Request) {
    try {
        // Verify the request is authorized
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }


        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        // Step 1: Fetch all RSS articles
        const rssArticles = await fetchRSSArticles();

        if (rssArticles.length === 0) {
            return NextResponse.json({
                error: 'No articles available',
                message: 'No recent articles found in RSS feeds'
            }, { status: 500 });
        }

        // Step 2: Get users with profiles (paginated)
        const USER_BATCH_SIZE = 50;
        let userOffset = 0;
        let allUsers: { email: string; profile: any; plan: string }[] = [];

        while (true) {
            const { data: batch, error: usersError } = await supabaseAdmin
                .from('users')
                .select('email, profile, plan')
                .not('profile', 'is', null)
                .range(userOffset, userOffset + USER_BATCH_SIZE - 1);

            if (usersError) {
                console.error('[CRON] Error fetching users:', usersError);
                break;
            }
            if (!batch || batch.length === 0) break;
            allUsers = allUsers.concat(batch);
            if (batch.length < USER_BATCH_SIZE) break;
            userOffset += USER_BATCH_SIZE;
        }

        if (allUsers.length === 0) {
            return NextResponse.json({ success: true, message: 'No users to process' });
        }


        const selectionModel = genAI.getGenerativeModel({
            model: "gemini-3.0-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // Pre-sort and prepare articles once (not per user)
        const sortedArticles = rssArticles.sort((a, b) => a.ageInDays - b.ageInDays);
        const articlesForPrompt = sortedArticles.slice(0, 100).map((article, index) => ({
            id: index,
            title: article.title,
            source: article.sourceName,
            category: article.category,
            age: `${article.ageInDays.toFixed(1)} days ago`,
            snippet: article.description?.slice(0, 200) || ""
        }));

        const results: any[] = [];

        // Step 3: Process users in parallel batches of 3 (Gemini API rate limits)
        const CONCURRENCY = 3;
        for (let i = 0; i < allUsers.length; i += CONCURRENCY) {
            const userBatch = allUsers.slice(i, i + CONCURRENCY);
            const batchResults = await Promise.allSettled(
                userBatch.map(async (user) => {
                    const userProfile = user.profile as any;
                    const name = userProfile.name || '사용자';
                    const job = userProfile.job || '전문가';
                    const goal = userProfile.goal || '전문성 향상';
                    const interests = userProfile.interests || [];
                    const level = userProfile.level || 'Intermediate';
                    const interestList = interests.join(', ');
                    const userPlan = (user.plan || 'Free').charAt(0).toUpperCase() + (user.plan || 'Free').slice(1).toLowerCase();
                    const articleCount = LIMITS.TREND_BRIEFING_COUNT[userPlan] || 3;

                    const selectionPrompt = `You are curating news for a ${level} ${job}.

USER PROFILE:
- Job: ${job}
- Goal: ${goal}
- Interests: ${interestList || "General business and technology"}

AVAILABLE ARTICLES (${articlesForPrompt.length}):
${JSON.stringify(articlesForPrompt, null, 2)}

TASK: Select EXACTLY ${articleCount} most relevant articles.

CRITERIA:
1. **Relevance to ${job}**: Directly useful for their work
2. **Recency**: Prioritize newer articles (lower "days ago")
3. **Diversity**: Mix of categories (avoid all same topic)
4. **Actionability**: Articles with practical takeaways
5. **Interest match**: ${interests.length > 0 ? `At least ${Math.min(3, articleCount)} articles matching: ${interestList}` : ""}

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
- MUST select EXACTLY ${articleCount} articles
- Summaries in Korean, natural and professional
- Focus on practical value for ${job}
- ${interests ? `At least ${Math.min(3, articleCount)} articles matching: ${interestList}` : ""}

Select now.`;

                    let text: string;
                    try {
                        const result = await selectionModel.generateContent(selectionPrompt);
                        const response = await result.response;
                        text = response.text();
                    } catch (geminiError: any) {
                        const status = geminiError?.status || geminiError?.httpStatusCode;
                        if (status === 429 || status === 503 || geminiError?.message?.includes('429') || geminiError?.message?.includes('quota') || geminiError?.message?.includes('503')) {
                            // 503: flash 모델로 재시도
                            if (status === 503 || geminiError?.message?.includes('503')) {
                                console.warn(`[CRON] Gemini 503 in article selection, retrying with gemini-3.0-flash`);
                                try {
                                    const flashModel = genAI.getGenerativeModel({
                                        model: "gemini-3.0-flash",
                                        generationConfig: { responseMimeType: "application/json" }
                                    });
                                    const flashResult = await flashModel.generateContent(selectionPrompt);
                                    text = flashResult.response.text();
                                } catch {
                                    console.warn(`[CRON] Gemini flash also failed for ${user.email}, falling back to OpenAI`);
                                    const completion = await openai.chat.completions.create({
                                        model: MODELS.GPT_5_MINI,
                                        messages: [
                                            { role: 'system', content: 'You are a professional news curator. Always respond with valid JSON only.' },
                                            { role: 'user', content: selectionPrompt }
                                        ],
                                        response_format: { type: 'json_object' },
                                    });
                                    text = completion.choices[0]?.message?.content || '{}';
                                }
                            } else {
                                console.warn(`[CRON] Gemini 429 in article selection for ${user.email}, falling back to OpenAI`);
                                const completion = await openai.chat.completions.create({
                                    model: MODELS.GPT_5_MINI,
                                    messages: [
                                        { role: 'system', content: 'You are a professional news curator. Always respond with valid JSON only.' },
                                        { role: 'user', content: selectionPrompt }
                                    ],
                                    response_format: { type: 'json_object' },
                                });
                                text = completion.choices[0]?.message?.content || '{}';
                            }
                        } else {
                            throw geminiError;
                        }
                    }

                    let data;
                    try {
                        data = JSON.parse(text);
                    } catch {
                        console.error(`[CRON] Failed to parse LLM response for ${user.email}`);
                        return { email: user.email, status: 'parse_error' };
                    }

                    const selectedArticles = data.selectedArticles || [];
                    if (selectedArticles.length === 0) {
                        return { email: user.email, status: 'no_articles' };
                    }

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

                    // Generate detailed briefings in parallel
                    const userCtx = { name, job, goal, interests, level };
                    await Promise.all(trends.map(async (trend: any) => {
                        try {
                            const detail = await generateDetailedBriefing(trend, userCtx);
                            await saveDetailCache(trend.id, detail, user.email);
                        } catch (error) {
                            console.error(`[CRON] Error generating detail for ${trend.title}:`, error);
                        }
                    }));

                    const { error: saveError } = await supabaseAdmin
                        .from('trends_cache')
                        .upsert({
                            email: user.email,
                            date: today,
                            trends,
                            created_at: new Date().toISOString()
                        }, { onConflict: 'email,date' });

                    if (saveError) {
                        return { email: user.email, status: 'error', error: saveError.message };
                    }

                    // 트렌드 브리핑 도착 알림 전송
                    const topTitles = trends.slice(0, 2).map((t: any) => t.title).join(', ');
                    const notification = {
                        id: `trend-briefing-${today}`,
                        type: 'morning_briefing' as const,
                        priority: 'low' as const,
                        title: '📰 오늘의 트렌드 브리핑',
                        message: `${name}님 맞춤 뉴스 ${trends.length}개가 도착했어요! ${topTitles}`,
                        actionType: 'open_trend_briefing',
                    };

                    await saveProactiveNotification(user.email, notification);
                    await sendPushNotification(user.email, {
                        title: notification.title,
                        body: notification.message,
                        data: {
                            notificationId: notification.id,
                            type: notification.type,
                            actionType: notification.actionType,
                        },
                    }).catch(() => {}); // 푸시 실패는 무시

                    return { email: user.email, status: 'success', trends: trends.length };
                })
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    const email = userBatch[batchResults.indexOf(result)]?.email || 'unknown';
                    results.push({ email, status: 'error', error: result.reason?.message });
                }
            }

            // Rate limiting between batches
            if (i + CONCURRENCY < allUsers.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }


        return NextResponse.json({
            success: true,
            processed: allUsers.length,
            successful: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'error').length,
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[CRON] Error in trend briefing generation:', error);
        return NextResponse.json({
            error: 'Failed to generate trend briefings'
        }, { status: 500 });
    }
}
