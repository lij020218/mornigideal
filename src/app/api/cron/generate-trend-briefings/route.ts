import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from 'openai';
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateTrendId } from "@/lib/newsCache";
import { MODELS } from "@/lib/models";
import Parser from 'rss-parser';
import { saveProactiveNotification } from "@/lib/proactiveNotificationService";
import { sendPushNotification } from "@/lib/pushService";
import { LIMITS } from "@/lib/constants";
import { getPlanNamesBatch } from "@/lib/user-plan";
import { logCronExecution } from '@/lib/cron-logger';
import { withCron } from '@/lib/api-handler';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const parser = new Parser();

// RSS Feed URLs (2026년 3월 업데이트 — 관심사 태그 기반 매칭)
// tags: 유저 관심사 ID와 매칭 (ai, tech, development, startup, business, finance, marketing, design, health, selfdev, creative)
// "general" 태그 피드는 모든 유저에게 기본 제공
const RSS_FEEDS = [
    // ── AI & ML 전문 소스 ──
    { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", category: "AI", tags: ["ai", "tech", "development"] },
    { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", category: "AI", tags: ["ai", "tech"] },
    { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", category: "AI", tags: ["ai", "tech", "selfdev"] },
    { name: "VentureBeat", url: "https://venturebeat.com/feed/", category: "AI", tags: ["ai", "tech", "startup"] },
    { name: "The Decoder", url: "https://the-decoder.com/feed/", category: "AI", tags: ["ai", "tech"] },
    { name: "AI News", url: "https://www.artificialintelligence-news.com/feed/", category: "AI", tags: ["ai", "tech"] },
    { name: "Synced Review", url: "https://syncedreview.com/feed/", category: "AI", tags: ["ai", "tech", "development"] },

    // ── Technology & Engineering ──
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Technology", tags: ["tech", "startup", "development", "ai"] },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Technology", tags: ["tech", "design"] },
    { name: "Wired", url: "https://www.wired.com/feed/rss", category: "Technology", tags: ["tech", "creative", "design"] },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "Technology", tags: ["tech", "development"] },
    { name: "Hacker News", url: "https://hnrss.org/frontpage", category: "Technology", tags: ["tech", "development", "startup"] },
    { name: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/feed.rss", category: "Technology", tags: ["tech", "development"] },
    { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "Technology", tags: ["tech", "general"] },

    // ── Business & Economics ──
    { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "Business", tags: ["business", "finance"] },
    { name: "Financial Times", url: "https://www.ft.com/?format=rss", category: "Business", tags: ["business", "finance"] },
    { name: "Economist", url: "https://www.economist.com/business/rss.xml", category: "Business", tags: ["business", "finance", "selfdev"] },
    { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "Business", tags: ["business", "general"] },
    { name: "Bloomberg Markets", url: "https://feeds.bloomberg.com/markets/news.rss", category: "Business", tags: ["finance", "business"] },
    { name: "Bloomberg Economics", url: "https://feeds.bloomberg.com/economics/news.rss", category: "Economics", tags: ["finance", "business"] },
    { name: "WSJ World News", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", category: "Business", tags: ["business", "general"] },
    { name: "WSJ Tech", url: "https://feeds.a.dj.com/rss/RSSWSJD.xml", category: "Technology", tags: ["tech", "business", "startup"] },
    { name: "New York Times Economy", url: "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml", category: "Economics", tags: ["finance", "business"] },

    // ── General News ──
    { name: "CNN Top Stories", url: "http://rss.cnn.com/rss/cnn_topstories.rss", category: "Top Stories", tags: ["general"] },

    // ── Korean Sources ──
    { name: "연합뉴스", url: "https://www.yna.co.kr/rss/news.xml", category: "뉴스", tags: ["general"] },
    { name: "동아일보", url: "https://rss.donga.com/total.xml", category: "뉴스", tags: ["general"] },
    { name: "SBS 뉴스", url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER", category: "뉴스", tags: ["general"] },
    { name: "한국경제", url: "https://www.hankyung.com/rss/economy", category: "경제", tags: ["business", "finance"] },
    { name: "한국경제 IT", url: "https://www.hankyung.com/rss/it", category: "IT", tags: ["tech", "ai", "development"] },
    { name: "조선일보 경제", url: "https://www.chosun.com/arc/outboundfeeds/rss/category/economy/?outputType=xml", category: "경제", tags: ["business", "finance"] },
    { name: "매일경제", url: "https://www.mk.co.kr/rss/30100041/", category: "경제", tags: ["business", "finance", "marketing"] },
    // Arts & Design
    { name: "Hyperallergic", url: "https://hyperallergic.com/feed/", category: "Arts", tags: ["creative", "design"] },
    { name: "ARTnews", url: "https://www.artnews.com/feed/", category: "Arts", tags: ["creative"] },
    { name: "Designboom", url: "https://www.designboom.com/feed/", category: "Design", tags: ["creative", "design"] },
    { name: "Creative Bloq", url: "https://www.creativebloq.com/feeds/all", category: "Design", tags: ["creative", "design"] },
    // Science
    { name: "Science Daily", url: "https://www.sciencedaily.com/rss/all.xml", category: "Science", tags: ["general"] },
    { name: "Nature", url: "http://feeds.nature.com/nature/rss/current", category: "Science", tags: ["general"] },
    // Marketing
    { name: "Adweek", url: "https://www.adweek.com/feed/", category: "Marketing", tags: ["marketing", "business"] },
    { name: "HubSpot Marketing", url: "https://blog.hubspot.com/marketing/rss.xml", category: "Marketing", tags: ["marketing", "business"] },
    // Music & Entertainment
    { name: "Billboard", url: "https://www.billboard.com/feed/", category: "Entertainment", tags: ["creative"] },
    { name: "Variety", url: "https://variety.com/feed/", category: "Entertainment", tags: ["creative", "business"] },
    { name: "Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", category: "Entertainment", tags: ["creative"] },
    // Self-dev
    { name: "Fast Company", url: "https://www.fastcompany.com/latest/rss", category: "Business", tags: ["selfdev", "business", "startup"] },
    // Korean
    { name: "경향신문", url: "https://www.khan.co.kr/rss/rssdata/total_news.xml", category: "뉴스", tags: ["general"] },
];

/**
 * 유저 관심사에 맞는 피드만 필터링
 * - 관심사 태그와 피드 태그가 하나라도 겹치면 포함
 * - "general" 태그 피드는 항상 포함
 * - 관심사가 없으면 전체 피드 사용
 */
function getMatchingFeeds(userInterests: string[]): typeof RSS_FEEDS {
    if (!userInterests || userInterests.length === 0) return RSS_FEEDS;
    const interestSet = new Set(userInterests.map(i => i.toLowerCase()));
    return RSS_FEEDS.filter(feed =>
        feed.tags.includes('general') ||
        feed.tags.some(tag => interestSet.has(tag))
    );
}

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
                        description: item.contentSnippet || item.content || "",
                        tags: feed.tags,
                    });
                }
            }
        } catch (error) {
            console.error(`[CRON] Error fetching ${feed.name}:`, error);
        }
    }

    return allArticles.sort((a, b) => a.ageInDays - b.ageInDays);
}

export const GET = withCron(async (_request: NextRequest) => {
    const start = Date.now();
    try {
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

        // Pre-sort articles once (그룹별 관심사 필터링은 선별 시 적용)
        const sortedArticles = rssArticles.sort((a: any, b: any) => a.ageInDays - b.ageInDays);

        // 전체 유저 관심사 분포 집계 (태그별 인기도)
        const ALWAYS_TOP_TAGS = new Set(['business', 'finance', 'tech', 'ai']);
        const interestPopularity = new Map<string, number>();
        for (const user of allUsers) {
            const interests = ((user.profile as any)?.interests || []) as string[];
            for (const interest of interests) {
                const tag = interest.toLowerCase();
                interestPopularity.set(tag, (interestPopularity.get(tag) || 0) + 1);
            }
        }
        // 항상 최상위 태그는 최소 전체 유저 수만큼 인기도 부여
        for (const tag of ALWAYS_TOP_TAGS) {
            interestPopularity.set(tag, Math.max(interestPopularity.get(tag) || 0, allUsers.length));
        }

        // 태그별 기사 분류
        const articlesByTag = new Map<string, any[]>();
        for (const article of sortedArticles) {
            const tags = (article as any).tags || ['general'];
            for (const tag of tags) {
                if (!articlesByTag.has(tag)) articlesByTag.set(tag, []);
                articlesByTag.get(tag)!.push(article);
            }
        }

        const POOL_SIZE = 100;

        // 관심사 인기도 기반으로 100개 기사 풀 생성
        const articlePoolCache = new Map<string, { articles: typeof sortedArticles; forPrompt: any[] }>();
        function getArticlePool(userInterests: string[]) {
            const cacheKey = userInterests.sort().join(',') || '__all__';
            if (articlePoolCache.has(cacheKey)) return articlePoolCache.get(cacheKey)!;

            // 이 유저의 관심사 태그 (없으면 전체 태그)
            const relevantTags = userInterests.length > 0
                ? [...new Set([...userInterests.map(i => i.toLowerCase()), ...ALWAYS_TOP_TAGS])]
                : [...interestPopularity.keys()];

            // 태그별 인기도 합산 → 비율 계산
            const tagWeights: { tag: string; weight: number }[] = [];
            let totalWeight = 0;
            for (const tag of relevantTags) {
                if (tag === 'general') continue; // general은 별도 처리
                const weight = interestPopularity.get(tag) || 1;
                tagWeights.push({ tag, weight });
                totalWeight += weight;
            }

            // general 기사 최소 10개 보장, 나머지 90개를 인기도 비례 배분
            const GENERAL_QUOTA = 10;
            const remaining = POOL_SIZE - GENERAL_QUOTA;

            // 태그별 할당량 계산 (최소 6개 보장 — 프로 유저 1회분)
            const MIN_PER_TAG = 6;
            const tagQuotas = new Map<string, number>();
            let allocated = 0;
            for (const { tag, weight } of tagWeights) {
                const quota = Math.max(MIN_PER_TAG, Math.round((weight / totalWeight) * remaining));
                tagQuotas.set(tag, quota);
                allocated += quota;
            }
            // 초과분 보정: 인기도 낮은 태그부터 1씩 감소 (최소 6개 유지)
            if (allocated > remaining) {
                const sorted = tagWeights.sort((a, b) => a.weight - b.weight);
                for (const { tag } of sorted) {
                    if (allocated <= remaining) break;
                    const current = tagQuotas.get(tag)!;
                    if (current > MIN_PER_TAG) {
                        tagQuotas.set(tag, current - 1);
                        allocated--;
                    }
                }
            }

            // 태그별 할당량만큼 기사 선택 (최신순, 이미 선택된 기사 제외)
            const selectedSet = new Set<string>();
            const selected: any[] = [];

            // general 기사 먼저
            const generalArticles = articlesByTag.get('general') || [];
            for (const article of generalArticles) {
                if (selected.length >= GENERAL_QUOTA) break;
                const key = `${article.title}|${article.sourceName}`;
                if (!selectedSet.has(key)) {
                    selectedSet.add(key);
                    selected.push(article);
                }
            }

            // 태그별 할당량 채우기
            for (const { tag } of tagWeights.sort((a, b) => b.weight - a.weight)) {
                const quota = tagQuotas.get(tag) || 2;
                const tagArticles = articlesByTag.get(tag) || [];
                let count = 0;
                for (const article of tagArticles) {
                    if (count >= quota) break;
                    const key = `${article.title}|${article.sourceName}`;
                    if (!selectedSet.has(key)) {
                        selectedSet.add(key);
                        selected.push(article);
                        count++;
                    }
                }
            }

            // 100개 미달 시 남은 최신 기사로 채우기
            if (selected.length < POOL_SIZE) {
                for (const article of sortedArticles) {
                    if (selected.length >= POOL_SIZE) break;
                    const key = `${article.title}|${article.sourceName}`;
                    if (!selectedSet.has(key)) {
                        selectedSet.add(key);
                        selected.push(article);
                    }
                }
            }

            // 최신순 정렬
            selected.sort((a: any, b: any) => a.ageInDays - b.ageInDays);

            const forPrompt = selected.slice(0, POOL_SIZE).map((article: any, index: number) => ({
                id: index,
                t: article.title,
                s: article.sourceName,
                c: article.category,
                d: article.ageInDays < 1 ? 'today' : article.ageInDays < 2 ? '1d' : `${Math.floor(article.ageInDays)}d`,
            }));
            const result = { articles: selected.slice(0, POOL_SIZE), forPrompt };
            articlePoolCache.set(cacheKey, result);
            return result;
        }
        // 기본 풀 (관심사 없는 유저용)
        const defaultPool = getArticlePool([]);

        const results: any[] = [];

        // Step 3: 관심사 기반 유저 그룹핑 → 기사 선별 LLM 호출 최소화
        // 같은 (job, interests, articleCount) 조합의 유저는 선별 결과를 공유
        // 프로 유저는 새로고침용 예비 기사 포함하여 articleCount * 3개 선별
        const userGroups = new Map<string, typeof allUsers>();
        for (const user of allUsers) {
            const p = user.profile as any;
            const job = p.job || '전문가';
            const interests = (p.interests || []).sort().join(',');
            const userPlan = planMap.get(user.email) || 'Free';
            const baseCount = LIMITS.TREND_BRIEFING_COUNT[userPlan] || 3;
            const isPro = userPlan === 'Pro' || userPlan === 'Max';
            // 프로: 6 * 3 = 18개 선별 (새로고침 2회분 예비), 프리: 3 * 2 = 6개 (새로고침 1회분 예비)
            const articleCount = isPro ? baseCount * 3 : baseCount * 2;
            const groupKey = `${job}|${interests}|${articleCount}|${isPro ? 'pro' : 'free'}`;
            if (!userGroups.has(groupKey)) userGroups.set(groupKey, []);
            userGroups.get(groupKey)!.push(user);
        }

        console.log(`[CRON] ${allUsers.length} users grouped into ${userGroups.size} groups (saving ${allUsers.length - userGroups.size} selection calls)`);

        // ── Phase 1: 모든 그룹의 기사 선별을 전부 병렬 ──
        const groupEntries = Array.from(userGroups.entries());

        // 기사 선별 함수 (Gemini → flash → OpenAI 폴백)
        async function selectArticlesForGroup(job: string, goal: string, interestList: string, level: string, articleCount: number, poolForPrompt: any[]) {
            const selectionPrompt = `Select ${articleCount} articles for a ${level} ${job}. Goal: ${goal}. Interests: ${interestList || "business, tech"}.

ARTICLES (id=id, t=title, s=source, c=category, d=age):
${JSON.stringify(poolForPrompt)}

Select ${articleCount} most relevant. Prioritize: recency (today>1d>2d), interest match, diversity.

OUTPUT JSON:
{"selectedArticles":[{"id":<number>,"title_korean":"한국어 제목","summary_korean":"${job}에게 중요한 이유 2문장","category":"Tech|Business|etc","relevance_korean":"관련성 1문장"}]}

Requirements: exactly ${articleCount}, Korean text, practical value for ${job}.`;

            try {
                const result = await selectionModel.generateContent(selectionPrompt);
                return result.response.text();
            } catch (geminiError: any) {
                const status = geminiError?.status || geminiError?.httpStatusCode;
                if (status === 503 || geminiError?.message?.includes('503')) {
                    try {
                        const flashModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
                        return (await flashModel.generateContent(selectionPrompt)).response.text();
                    } catch { /* fall through to OpenAI */ }
                }
                if (status === 429 || status === 503 || geminiError?.message?.includes('429') || geminiError?.message?.includes('quota') || geminiError?.message?.includes('503')) {
                    const completion = await openai.chat.completions.create({
                        model: MODELS.GPT_5_MINI,
                        messages: [{ role: 'system', content: 'You are a professional news curator. Always respond with valid JSON only.' }, { role: 'user', content: selectionPrompt }],
                        response_format: { type: 'json_object' },
                    });
                    return completion.choices[0]?.message?.content || '{}';
                }
                throw geminiError;
            }
        }

        // 모든 그룹의 기사 선별을 동시에 실행
        interface GroupResult {
            groupKey: string;
            groupUsers: typeof allUsers;
            trends: any[];
            job: string;
            goal: string;
            interests: string[];
            level: string;
            isPro: boolean;
        }
        const groupResults: GroupResult[] = [];

        // 그룹별 기사 선별 (배치 5개씩, rate limit 방지)
        const SELECTION_BATCH_SIZE = 5;
        const selectionResults: PromiseSettledResult<GroupResult>[] = [];
        for (let i = 0; i < groupEntries.length; i += SELECTION_BATCH_SIZE) {
            const batch = groupEntries.slice(i, i + SELECTION_BATCH_SIZE);
            const batchResults = await Promise.allSettled(
                batch.map(async ([groupKey, groupUsers]) => {
                    const representative = groupUsers[0];
                    const p = representative.profile as any;
                    const job = p.job || '전문가';
                    const goal = p.goal || '전문성 향상';
                    const interests = p.interests || [];
                    const level = p.level || 'Intermediate';
                    const interestList = interests.join(', ');
                    const userPlan = planMap.get(representative.email) || 'Free';
                    const baseCount = LIMITS.TREND_BRIEFING_COUNT[userPlan] || 3;
                    const isPro = userPlan === 'Pro' || userPlan === 'Max';
                    const articleCount = isPro ? baseCount * 3 : baseCount * 2;

                    // 관심사에 맞는 기사 풀 선택
                    const pool = getArticlePool(interests);

                    const text = await selectArticlesForGroup(job, goal, interestList, level, articleCount, pool.forPrompt);
                    let data;
                    try {
                        data = JSON.parse(text);
                    } catch (parseErr) {
                        console.error(`[CRON] JSON parse failed for group, raw text: ${text.substring(0, 200)}`);
                        throw new Error('json_parse_failed');
                    }
                    const selectedArticles = data.selectedArticles || [];
                    if (selectedArticles.length === 0) throw new Error('no_articles');

                    const trends = selectedArticles.map((selected: any) => {
                        const filteredArticle = pool.forPrompt[selected.id];
                        const originalArticle = rssArticles.find(article =>
                            article.title === filteredArticle?.t && article.sourceName === filteredArticle?.s
                        );
                        const pubDate = originalArticle?.pubDate ? new Date(originalArticle.pubDate).toISOString().split('T')[0] : today;
                        const url = originalArticle?.link || "";
                        return {
                            id: generateTrendId(selected.title_korean, url),
                            title: selected.title_korean,
                            category: selected.category || "General",
                            summary: selected.summary_korean,
                            time: pubDate,
                            imageColor: "bg-blue-500/20",
                            originalUrl: url,
                            imageUrl: "",
                            source: originalArticle?.sourceName || "Unknown",
                            relevance: selected.relevance_korean
                        };
                    });

                    return { groupKey, groupUsers, trends, job, goal, interests, level, isPro } as GroupResult;
                })
            );
            selectionResults.push(...batchResults);
            // 배치 간 대기 (rate limit 방지)
            if (i + SELECTION_BATCH_SIZE < groupEntries.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // 선별 결과 수집 + 실패 그룹 1회 재시도
        const failedEntries: [string, typeof allUsers][] = [];
        for (let i = 0; i < selectionResults.length; i++) {
            const sr = selectionResults[i];
            if (sr.status === 'fulfilled') {
                groupResults.push(sr.value);
            } else {
                failedEntries.push(groupEntries[i]);
                console.error(`[CRON] Selection failed for group ${groupEntries[i][0]}:`, sr.reason?.message);
            }
        }

        // 실패한 그룹 1회 재시도 (순차, rate limit 방지)
        if (failedEntries.length > 0) {
            console.log(`[CRON] Retrying ${failedEntries.length} failed groups...`);
            for (const [groupKey, groupUsers] of failedEntries) {
                try {
                    const representative = groupUsers[0];
                    const p = representative.profile as any;
                    const job = p.job || '전문가';
                    const goal = p.goal || '전문성 향상';
                    const interests = p.interests || [];
                    const level = p.level || 'Intermediate';
                    const interestList = interests.join(', ');
                    const userPlan = planMap.get(representative.email) || 'Free';
                    const baseCount = LIMITS.TREND_BRIEFING_COUNT[userPlan] || 3;
                    const isPro = userPlan === 'Pro' || userPlan === 'Max';
                    const articleCount = isPro ? baseCount * 3 : baseCount * 2;

                    // 관심사에 맞는 기사 풀 선택
                    const pool = getArticlePool(interests);

                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const text = await selectArticlesForGroup(job, goal, interestList, level, articleCount, pool.forPrompt);
                    let data;
                    try { data = JSON.parse(text); } catch { throw new Error('json_parse_retry_failed'); }
                    const selectedArticles = data.selectedArticles || [];
                    if (selectedArticles.length === 0) throw new Error('no_articles_retry');

                    const trends = selectedArticles.map((selected: any) => {
                        const filteredArticle = pool.forPrompt[selected.id];
                        const originalArticle = rssArticles.find(article =>
                            article.title === filteredArticle?.t && article.sourceName === filteredArticle?.s
                        );
                        const pubDate = originalArticle?.pubDate ? new Date(originalArticle.pubDate).toISOString().split('T')[0] : today;
                        const url = originalArticle?.link || "";
                        return {
                            id: generateTrendId(selected.title_korean, url),
                            title: selected.title_korean,
                            category: selected.category || "General",
                            summary: selected.summary_korean,
                            time: pubDate,
                            imageColor: "bg-blue-500/20",
                            originalUrl: url,
                            imageUrl: "",
                            source: originalArticle?.sourceName || "Unknown",
                            relevance: selected.relevance_korean
                        };
                    });

                    groupResults.push({ groupKey, groupUsers, trends, job, goal, interests, level, isPro } as GroupResult);
                    console.log(`[CRON] Retry succeeded for group ${groupKey}`);
                } catch (retryErr: any) {
                    console.error(`[CRON] Retry also failed for group ${groupKey}:`, retryErr?.message);
                    for (const u of groupUsers) {
                        results.push({ email: u.email, status: 'error', error: retryErr?.message });
                    }
                }
            }
        }

        console.log(`[CRON] Phase 1 done: ${groupResults.length}/${groupEntries.length} groups selected (${failedEntries.length} retried)`);

        // ── Phase 2: 유저별 trends_cache 저장 + 알림 (상세 브리핑은 on-demand) ──
        // 상세 브리핑(generateDetailedBriefing)은 유저가 트렌드를 열 때 /api/trend-briefing에서 생성
        // CRON에서는 기사 선별 + 캐시 저장 + 알림만 수행 (타임아웃 방지)
        for (const gr of groupResults) {
            const userSaveResults = await Promise.allSettled(
                gr.groupUsers.map(async (user) => {
                    const userProfile = user.profile as any;
                    const name = userProfile.name || '사용자';

                    const { error: saveError } = await supabaseAdmin
                        .from('trends_cache')
                        .upsert({
                            email: user.email,
                            date: today,
                            trends: gr.trends,
                            last_updated: new Date().toISOString()
                        }, { onConflict: 'email,date' });

                    if (saveError) {
                        return { email: user.email, status: 'error', error: saveError.message };
                    }

                    // 알림 (표시 개수는 기본 articleCount, 전체 풀이 아님)
                    const userPlan = planMap.get(user.email) || 'Free';
                    const displayCount = LIMITS.TREND_BRIEFING_COUNT[userPlan] || 3;
                    const topTitles = gr.trends.slice(0, 2).map((t: any) => t.title).join(', ');
                    const notification = {
                        id: `trend-briefing-${today}`,
                        type: 'trend_briefing' as const,
                        priority: 'low' as const,
                        title: '📰 오늘의 트렌드 브리핑',
                        message: `${name}님 맞춤 뉴스 ${displayCount}개가 도착했어요! ${topTitles}`,
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

                    return { email: user.email, status: 'success', trends: gr.trends.length };
                })
            );

            for (const result of userSaveResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    results.push({ email: 'unknown', status: 'error', error: result.reason?.message });
                }
            }
        }


        await logCronExecution('generate-trend-briefings', 'success', {
            affected_count: results.filter(r => r.status === 'success').length,
        }, Date.now() - start);
        return NextResponse.json({
            success: true,
            processed: allUsers.length,
            successful: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'error').length,
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        await logCronExecution('generate-trend-briefings', 'failure', { error: error?.message }, Date.now() - start);
        console.error('[CRON] Error in trend briefing generation:', error);
        return NextResponse.json({
            error: 'Failed to generate trend briefings'
        }, { status: 500 });
    }
});
