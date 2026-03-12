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
import { getPlanNamesBatch } from "@/lib/user-plan";

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

async function generateDetailedBriefing(trend: any, groupProfile: { job: string; goal: string; interests: string[]; level: string; isPro?: boolean }) {
    const { job, goal, interests, level, isPro } = groupProfile;
    const interestList = interests.length > 0 ? interests.join(', ') : '비즈니스, 기술';
    const levelLabel = level || 'Intermediate';
    // 이름은 {{NAME}} 플레이스홀더 사용 → 유저별 치환으로 LLM 호출 1회로 그룹 공유
    const placeholder = '{{NAME}}';

    const prompt = `${placeholder}님을 위한 맞춤 뉴스 브리핑을 작성하세요.

기사 정보:
- 제목: "${trend.title}"
- 요약: ${trend.summary}
- URL: ${trend.originalUrl}

사용자 정보:
- 이름: ${placeholder}
- 직업: ${job}
- 경력 수준: ${levelLabel}
- 목표: ${goal}
- 관심 분야: ${interestList}

${isPro ? `아래 6개 섹션을 순서대로 작성하세요 (프리미엄 브리핑):

1. **심층 분석**: 이 뉴스의 배경, 맥락, 업계 영향을 심도 있게 분석. "왜 이런 일이 일어났는지", "역사적 맥락에서 어떤 의미인지", "앞으로 어떤 변화가 예상되는지" 전문가 수준으로 설명. 경력 수준(${levelLabel})에 맞는 전문 용어와 깊이로 설명하세요. 관련 데이터나 수치가 있으면 포함하세요.
2. **산업 파급 효과**: 이 뉴스가 관련 산업 생태계에 미치는 연쇄적 영향. 경쟁사 동향, 시장 구조 변화, 공급망 영향 등 거시적 관점에서 분석. 가능하면 구체적 기업이나 사례를 언급하세요.
3. **왜 ${job}인 ${placeholder}님에게 중요한가**: 이 뉴스가 ${placeholder}님의 직업(${job}), 경력 수준(${levelLabel}), 목표(${goal})에 구체적으로 어떤 의미인지 설명. 실무에 미치는 직접적 영향과 커리어 관점에서의 시사점을 함께 서술.
4. **핵심 요약**: 기사의 핵심 내용을 3문장으로 압축 (각 15-20자 이내).
5. **무엇을 할 수 있나**: ${placeholder}님이 지금 바로 실행할 수 있는 3가지 구체적 행동.
6. **더 읽어볼 키워드**: 이 주제를 더 깊이 이해하기 위해 검색해볼 키워드 3개.

OUTPUT JSON:
{
  "title": "한국어 제목",
  "content": "### 심층 분석\\n\\n[배경, 맥락, 데이터 포함 심도 있는 분석]\\n\\n### 산업 파급 효과\\n\\n[관련 산업 생태계 영향, 경쟁사/시장 분석]\\n\\n### 왜 ${job}인 ${placeholder}님에게 중요한가\\n\\n[직업과 목표에 연결된 구체적 설명 + 커리어 시사점. **핵심 키워드**를 <mark>태그로 강조]\\n\\n### 더 읽어볼 키워드\\n\\n- 키워드 1\\n- 키워드 2\\n- 키워드 3\\n\\n### 무엇을 할 수 있나\\n\\n- **행동 1**\\n- **행동 2**\\n- **행동 3**",
  "keyTakeaways": ["핵심 요약 1", "핵심 요약 2", "핵심 요약 3"],
  "actionItems": ["관련 기사 읽기", "트렌드 분석 정리", "관련 뉴스 스크랩"],
  "originalUrl": "${trend.originalUrl}"
}` : `아래 4개 섹션을 순서대로 작성하세요:

1. **심층 분석**: 이 뉴스의 배경, 맥락, 업계 영향을 분석. 단순 요약이 아닌 "왜 이런 일이 일어났는지", "앞으로 어떤 변화가 예상되는지" 깊이 있게 설명. 경력 수준(${levelLabel})에 맞는 용어와 깊이로 설명하세요.
2. **왜 ${job}인 ${placeholder}님에게 중요한가**: 이 뉴스가 ${placeholder}님의 직업(${job}), 경력 수준(${levelLabel}), 목표(${goal})에 구체적으로 어떤 의미인지 설명. 추상적 연결이 아니라 실무에 미치는 직접적 영향을 서술.
3. **핵심 요약**: 기사의 핵심 내용을 3문장으로 압축 (각 15-20자 이내).
4. **무엇을 할 수 있나**: ${placeholder}님이 지금 바로 실행할 수 있는 3가지 구체적 행동.

OUTPUT JSON:
{
  "title": "한국어 제목",
  "content": "### 심층 분석\\n\\n[배경과 맥락 분석, 업계 영향]\\n\\n### 왜 ${job}인 ${placeholder}님에게 중요한가\\n\\n[${placeholder}님의 직업과 목표에 연결된 구체적 설명. **핵심 키워드**를 <mark>태그로 강조]\\n\\n### 무엇을 할 수 있나\\n\\n- **행동 1**\\n- **행동 2**\\n- **행동 3**",
  "keyTakeaways": ["핵심 요약 1", "핵심 요약 2", "핵심 요약 3"],
  "actionItems": ["관련 기사 읽기", "트렌드 분석 정리", "관련 뉴스 스크랩"],
  "originalUrl": "${trend.originalUrl}"
}`}

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
- 이름(${placeholder})은 그대로 유지하세요. 시스템이 자동 치환합니다.

한국어로 작성하세요.`;

    // Try Gemini first, fallback to flash model on 503, then OpenAI on 429/quota
    try {
        const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (geminiError: any) {
        const status = geminiError?.status || geminiError?.httpStatusCode;
        // 503: 모델 과부하 → gemini-2.5-flash로 재시도
        if (status === 503 || geminiError?.message?.includes('503')) {
            console.warn(`[CRON] Gemini 503, retrying with gemini-2.5-flash`);
            try {
                const flashModel = genAI.getGenerativeModel({
                    model: "gemini-2.5-flash",
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

/** {{NAME}} 플레이스홀더를 실제 사용자 이름으로 치환 */
function personalizeDetail(detail: any, userName: string): any {
    const name = userName || '사용자';
    return {
        ...detail,
        title: detail.title?.replaceAll('{{NAME}}', name),
        content: detail.content?.replaceAll('{{NAME}}', name),
        keyTakeaways: detail.keyTakeaways?.map((t: string) => t.replaceAll('{{NAME}}', name)),
        actionItems: detail.actionItems?.map((t: string) => t.replaceAll('{{NAME}}', name)),
    };
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
        let allUsers: { email: string; profile: any }[] = [];

        while (true) {
            const { data: batch, error: usersError } = await supabaseAdmin
                .from('users')
                .select('email, profile')
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

        // user_subscriptions 기반 플랜 배치 조회 (2회 DB 쿼리로 전체 유저 플랜 확정)
        const planMap = await getPlanNamesBatch(allUsers.map(u => u.email));

        const selectionModel = genAI.getGenerativeModel({
            model: "gemini-3-flash-preview",
            generationConfig: { responseMimeType: "application/json" }
        });

        // Pre-sort and prepare articles once (not per user)
        // 토큰 절약: 제목+소스+카테고리만 전송 (snippet 제거, compact format)
        const sortedArticles = rssArticles.sort((a, b) => a.ageInDays - b.ageInDays);
        const articlesForPrompt = sortedArticles.slice(0, 80).map((article, index) => ({
            id: index,
            t: article.title,
            s: article.sourceName,
            c: article.category,
            d: article.ageInDays < 1 ? 'today' : article.ageInDays < 2 ? '1d' : `${Math.floor(article.ageInDays)}d`,
        }));

        const results: any[] = [];

        // Step 3: 관심사 기반 유저 그룹핑 → 기사 선별 LLM 호출 최소화
        // 같은 (job, interests, articleCount) 조합의 유저는 선별 결과를 공유
        const userGroups = new Map<string, typeof allUsers>();
        for (const user of allUsers) {
            const p = user.profile as any;
            const job = p.job || '전문가';
            const interests = (p.interests || []).sort().join(',');
            const userPlan = planMap.get(user.email) || 'Free';
            const articleCount = LIMITS.TREND_BRIEFING_COUNT[userPlan] || 3;
            const isPro = userPlan === 'Pro' || userPlan === 'Max';
            const groupKey = `${job}|${interests}|${articleCount}|${isPro ? 'pro' : 'free'}`;
            if (!userGroups.has(groupKey)) userGroups.set(groupKey, []);
            userGroups.get(groupKey)!.push(user);
        }

        console.log(`[CRON] ${allUsers.length} users grouped into ${userGroups.size} groups (saving ${allUsers.length - userGroups.size} selection calls)`);

        // 그룹별로 기사 선별 1회 → 그룹 내 유저 전원에게 적용
        const selectionCache = new Map<string, any[]>(); // groupKey → selectedArticles

        // 그룹별 선별 (2그룹씩 병렬, rate limit 대응)
        const groupEntries = Array.from(userGroups.entries());
        for (let gi = 0; gi < groupEntries.length; gi += 2) {
        const groupBatch = groupEntries.slice(gi, gi + 2);
        await Promise.allSettled(groupBatch.map(async ([groupKey, groupUsers]) => {
            const representative = groupUsers[0];
            const p = representative.profile as any;
            const job = p.job || '전문가';
            const goal = p.goal || '전문성 향상';
            const interests = p.interests || [];
            const level = p.level || 'Intermediate';
            const interestList = interests.join(', ');
            const userPlan = planMap.get(representative.email) || 'Free';
            const articleCount = LIMITS.TREND_BRIEFING_COUNT[userPlan] || 3;

            const selectionPrompt = `Select ${articleCount} articles for a ${level} ${job}. Goal: ${goal}. Interests: ${interestList || "business, tech"}.

ARTICLES (id=id, t=title, s=source, c=category, d=age):
${JSON.stringify(articlesForPrompt)}

Select ${articleCount} most relevant. Prioritize: recency (today>1d>2d), interest match, diversity.

OUTPUT JSON:
{"selectedArticles":[{"id":<number>,"title_korean":"한국어 제목","summary_korean":"${job}에게 중요한 이유 2문장","category":"Tech|Business|etc","relevance_korean":"관련성 1문장"}]}

Requirements: exactly ${articleCount}, Korean text, practical value for ${job}.`;

            let text: string;
            try {
                const result = await selectionModel.generateContent(selectionPrompt);
                const response = await result.response;
                text = response.text();
            } catch (geminiError: any) {
                const status = geminiError?.status || geminiError?.httpStatusCode;
                if (status === 503 || geminiError?.message?.includes('503')) {
                    console.warn(`[CRON] Gemini 503 in article selection, retrying with gemini-2.5-flash`);
                    try {
                        const flashModel = genAI.getGenerativeModel({
                            model: "gemini-2.5-flash",
                            generationConfig: { responseMimeType: "application/json" }
                        });
                        const flashResult = await flashModel.generateContent(selectionPrompt);
                        text = flashResult.response.text();
                    } catch {
                        console.warn(`[CRON] Gemini flash also failed, falling back to OpenAI`);
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
                } else if (status === 429 || geminiError?.message?.includes('429') || geminiError?.message?.includes('quota')) {
                    console.warn(`[CRON] Gemini 429, falling back to OpenAI`);
                    const completion = await openai.chat.completions.create({
                        model: MODELS.GPT_5_MINI,
                        messages: [
                            { role: 'system', content: 'You are a professional news curator. Always respond with valid JSON only.' },
                            { role: 'user', content: selectionPrompt }
                        ],
                        response_format: { type: 'json_object' },
                    });
                    text = completion.choices[0]?.message?.content || '{}';
                } else {
                    console.error(`[CRON] Selection failed for group ${groupKey}:`, geminiError);
                    for (const u of groupUsers) {
                        results.push({ email: u.email, status: 'error', error: geminiError?.message });
                    }
                    return;
                }
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch {
                console.error(`[CRON] Failed to parse selection for group ${groupKey}`);
                for (const u of groupUsers) {
                    results.push({ email: u.email, status: 'parse_error' });
                }
                return;
            }

            const selectedArticles = data.selectedArticles || [];
            if (selectedArticles.length === 0) {
                for (const u of groupUsers) {
                    results.push({ email: u.email, status: 'no_articles' });
                }
                return;
            }

            selectionCache.set(groupKey, selectedArticles);

            // 선별된 기사를 trends로 변환 (그룹 공통)
            const trends = selectedArticles.map((selected: any) => {
                const filteredArticle = articlesForPrompt[selected.id];
                const originalArticle = rssArticles.find(article =>
                    article.title === filteredArticle?.t &&
                    article.sourceName === filteredArticle?.s
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

            // 그룹당 상세 브리핑 1회 생성 ({{NAME}} 플레이스홀더 포함)
            const isPro = groupKey.endsWith('|pro');
            const groupCtx = { job, goal, interests, level, isPro };
            const groupDetails = new Map<string, any>(); // trendId → detail (with {{NAME}})

            for (const trend of trends) {
                try {
                    const detail = await generateDetailedBriefing(trend, groupCtx);
                    groupDetails.set(trend.id, detail);
                } catch (error) {
                    console.error(`[CRON] Error generating detail for ${trend.title}:`, error);
                }
            }

            console.log(`[CRON] Group "${groupKey}": generated ${groupDetails.size} details for ${groupUsers.length} users`);

            // 유저별: 이름 치환 + 캐시 저장 + 알림
            const CONCURRENCY = 5;
            for (let i = 0; i < groupUsers.length; i += CONCURRENCY) {
                const userBatch = groupUsers.slice(i, i + CONCURRENCY);
                const batchResults = await Promise.allSettled(
                    userBatch.map(async (user) => {
                        const userProfile = user.profile as any;
                        const name = userProfile.name || '사용자';

                        // {{NAME}} → 실제 이름 치환 후 저장
                        for (const [trendId, templateDetail] of groupDetails) {
                            const personalizedDetail = personalizeDetail(templateDetail, name);
                            await saveDetailCache(trendId, personalizedDetail, user.email);
                        }

                        const { error: saveError } = await supabaseAdmin
                            .from('trends_cache')
                            .upsert({
                                email: user.email,
                                date: today,
                                trends,
                                last_updated: new Date().toISOString()
                            }, { onConflict: 'email,date' });

                        if (saveError) {
                            return { email: user.email, status: 'error', error: saveError.message };
                        }

                        // 알림
                        const topTitles = trends.slice(0, 2).map((t: any) => t.title).join(', ');
                        const notification = {
                            id: `trend-briefing-${today}`,
                            type: 'trend_briefing' as const,
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
                        }).catch(() => {});

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
            }

        }));
            // 그룹 배치 간 rate limit 대기
            await new Promise(resolve => setTimeout(resolve, 500));
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
