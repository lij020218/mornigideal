/**
 * 브리핑 검증 + 보정 CRON
 *
 * UTC 21:00 (KST 06:00) — generate-trend-briefings (UTC 20:00) 1시간 후 실행
 *
 * 1. trends_cache에서 오늘 날짜 기준 브리핑이 없는 유저 탐지
 * 2. 미생성 유저에게 개별 브리핑 생성 (실시간 생성 로직 활용)
 * 3. 결과 로깅 + 알림 전송
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withCron } from '@/lib/api-handler';
import { withCronLogging } from '@/lib/cron-logger';
import { logger } from '@/lib/logger';
import { generateTrendId, saveDetailCache } from '@/lib/newsCache';
import { saveProactiveNotification } from '@/lib/proactiveNotificationService';
import { sendPushNotification } from '@/lib/pushService';
import { getPlanNamesBatch } from '@/lib/user-plan';
import { LIMITS } from '@/lib/constants';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { MODELS } from '@/lib/models';
import Parser from 'rss-parser';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const parser = new Parser();

export const maxDuration = 300;

// RSS 피드 (generate-trend-briefings와 동일)
const RSS_FEEDS = [
    { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "Business" },
    { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "Business" },
    { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "Technology" },
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Technology" },
    { name: "Hacker News", url: "https://hnrss.org/frontpage", category: "Technology" },
    { name: "연합뉴스", url: "https://www.yna.co.kr/rss/news.xml", category: "뉴스" },
    { name: "한국경제", url: "https://www.hankyung.com/rss/economy", category: "경제" },
    { name: "한국경제 IT", url: "https://www.hankyung.com/rss/it", category: "IT" },
    { name: "매일경제", url: "https://www.mk.co.kr/rss/30100041/", category: "경제" },
];

async function fetchRSSArticles() {
    const allArticles: any[] = [];
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
                        pubDate,
                        ageInDays,
                        sourceName: feed.name,
                        category: feed.category,
                    });
                }
            }
        } catch {
            // RSS 실패는 무시
        }
    }

    return allArticles.sort((a, b) => a.ageInDays - b.ageInDays);
}

export const GET = withCron(withCronLogging('verify-briefings', async (_request: NextRequest) => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    // 1. 전체 유저 조회
    const { data: allUsers } = await supabaseAdmin
        .from('users')
        .select('email, profile')
        .not('profile', 'is', null);

    if (!allUsers || allUsers.length === 0) {
        return NextResponse.json({ message: 'No users', checked: 0 });
    }

    // 2. 오늘 브리핑이 있는 유저 조회
    const { data: cachedUsers } = await supabaseAdmin
        .from('trends_cache')
        .select('email')
        .eq('date', today);

    const cachedEmails = new Set((cachedUsers || []).map((u: any) => u.email));

    // 3. 미생성 유저 필터링
    const missingUsers = allUsers.filter(u => !cachedEmails.has(u.email));

    if (missingUsers.length === 0) {
        logger.info(`[VerifyBriefings] All ${allUsers.length} users have briefings for ${today}`);
        return NextResponse.json({
            success: true,
            date: today,
            totalUsers: allUsers.length,
            allCovered: true,
            missing: 0,
            fixed: 0,
        });
    }

    logger.warn(`[VerifyBriefings] ${missingUsers.length}/${allUsers.length} users missing briefings for ${today}`);

    // 4. RSS 기사 가져오기
    const rssArticles = await fetchRSSArticles();
    if (rssArticles.length === 0) {
        logger.error('[VerifyBriefings] No RSS articles available');
        return NextResponse.json({
            success: false,
            date: today,
            totalUsers: allUsers.length,
            missing: missingUsers.length,
            fixed: 0,
            error: 'No RSS articles',
        });
    }

    const articlesForPrompt = rssArticles.slice(0, 60).map((article, index) => ({
        id: index,
        t: article.title,
        s: article.sourceName,
        c: article.category,
        d: article.ageInDays < 1 ? 'today' : article.ageInDays < 2 ? '1d' : `${Math.floor(article.ageInDays)}d`,
    }));

    // 5. 플랜 배치 조회
    const planMap = await getPlanNamesBatch(missingUsers.map(u => u.email));

    // 6. 미생성 유저 그룹핑 (기존 CRON과 동일 방식)
    const userGroups = new Map<string, typeof missingUsers>();
    for (const user of missingUsers) {
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

    logger.info(`[VerifyBriefings] ${missingUsers.length} missing users in ${userGroups.size} groups`);

    let fixed = 0;
    let errors = 0;

    // 7. 그룹별 순차 처리 (rate limit 안전)
    for (const [groupKey, groupUsers] of userGroups) {
        try {
            const representative = groupUsers[0];
            const p = representative.profile as any;
            const job = p.job || '전문가';
            const goal = p.goal || '전문성 향상';
            const interests = p.interests || [];
            const interestList = interests.join(', ') || 'business, tech';
            const level = p.level || 'Intermediate';
            const userPlan = planMap.get(representative.email) || 'Free';
            const articleCount = LIMITS.TREND_BRIEFING_COUNT[userPlan] || 3;
            const isPro = userPlan === 'Pro' || userPlan === 'Max';

            // 기사 선별
            const selectionPrompt = `Select ${articleCount} articles for a ${level} ${job}. Goal: ${goal}. Interests: ${interestList}.

ARTICLES (id=id, t=title, s=source, c=category, d=age):
${JSON.stringify(articlesForPrompt)}

Select ${articleCount} most relevant. Prioritize: recency (today>1d>2d), interest match, diversity.

OUTPUT JSON:
{"selectedArticles":[{"id":<number>,"title_korean":"한국어 제목","summary_korean":"${job}에게 중요한 이유 2문장","category":"Tech|Business|etc","relevance_korean":"관련성 1문장"}]}

Requirements: exactly ${articleCount}, Korean text, practical value for ${job}.`;

            let selectionText: string;
            try {
                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    generationConfig: { responseMimeType: 'application/json' },
                });
                const result = await model.generateContent(selectionPrompt);
                selectionText = result.response.text();
            } catch (geminiErr: any) {
                // Gemini 실패 → OpenAI 폴백
                const completion = await openai.chat.completions.create({
                    model: MODELS.GPT_5_MINI,
                    messages: [
                        { role: 'system', content: 'You are a professional news curator. Always respond with valid JSON only.' },
                        { role: 'user', content: selectionPrompt },
                    ],
                    response_format: { type: 'json_object' },
                });
                selectionText = completion.choices[0]?.message?.content || '{}';
            }

            let selectedArticles;
            try {
                const data = JSON.parse(selectionText);
                selectedArticles = data.selectedArticles || [];
            } catch {
                logger.error(`[VerifyBriefings] JSON parse failed for group ${groupKey}`);
                errors += groupUsers.length;
                continue;
            }

            if (selectedArticles.length === 0) {
                errors += groupUsers.length;
                continue;
            }

            const trends = selectedArticles.map((selected: any) => {
                const filteredArticle = articlesForPrompt[selected.id];
                const originalArticle = rssArticles.find(article =>
                    article.title === filteredArticle?.t && article.sourceName === filteredArticle?.s
                );
                const pubDate = originalArticle?.pubDate ? new Date(originalArticle.pubDate).toISOString().split('T')[0] : today;
                return {
                    id: generateTrendId(selected.title_korean),
                    title: selected.title_korean,
                    category: selected.category || 'General',
                    summary: selected.summary_korean,
                    time: pubDate,
                    imageColor: 'bg-blue-500/20',
                    originalUrl: originalArticle?.link || '',
                    imageUrl: '',
                    source: originalArticle?.sourceName || 'Unknown',
                    relevance: selected.relevance_korean,
                };
            });

            // 상세 브리핑 생성 (순차, 트렌드당 1개씩)
            const detailMap = new Map<string, any>();
            for (const trend of trends) {
                try {
                    const detailPrompt = `{{NAME}}님을 위한 맞춤 뉴스 브리핑을 작성하세요.

기사 정보:
- 제목: "${trend.title}"
- 요약: ${trend.summary}
- URL: ${trend.originalUrl}

사용자 정보:
- 이름: {{NAME}}
- 직업: ${job}
- 경력 수준: ${level}
- 목표: ${goal}
- 관심 분야: ${interestList}

${isPro ? `아래 6개 섹션을 순서대로 작성하세요 (프리미엄 브리핑):
1. **심층 분석**: 배경, 맥락, 업계 영향
2. **산업 파급 효과**: 연쇄적 영향 분석
3. **왜 ${job}인 {{NAME}}님에게 중요한가**: 직접적 영향
4. **핵심 요약**: 3문장 (15-20자)
5. **무엇을 할 수 있나**: 3가지 구체적 행동
6. **더 읽어볼 키워드**: 3개

OUTPUT JSON:
{
  "title": "한국어 제목",
  "content": "### 심층 분석\\n\\n[분석]\\n\\n### 산업 파급 효과\\n\\n[분석]\\n\\n### 왜 ${job}인 {{NAME}}님에게 중요한가\\n\\n[설명]\\n\\n### 더 읽어볼 키워드\\n\\n- 키워드\\n\\n### 무엇을 할 수 있나\\n\\n- **행동**",
  "keyTakeaways": ["요약1", "요약2", "요약3"],
  "actionItems": ["행동1", "행동2", "행동3"],
  "originalUrl": "${trend.originalUrl}"
}` : `아래 4개 섹션을 작성하세요:
1. **심층 분석**: 배경, 맥락, 업계 영향
2. **왜 ${job}인 {{NAME}}님에게 중요한가**: 직접적 영향
3. **핵심 요약**: 3문장 (15-20자)
4. **무엇을 할 수 있나**: 3가지 행동

OUTPUT JSON:
{
  "title": "한국어 제목",
  "content": "### 심층 분석\\n\\n[분석]\\n\\n### 왜 ${job}인 {{NAME}}님에게 중요한가\\n\\n[설명]\\n\\n### 무엇을 할 수 있나\\n\\n- **행동**",
  "keyTakeaways": ["요약1", "요약2", "요약3"],
  "actionItems": ["행동1", "행동2", "행동3"],
  "originalUrl": "${trend.originalUrl}"
}`}

RULES: actionItems 15자 이내, keyTakeaways 15-20자, content에서 <mark>태그 강조, 한국어.`;

                    let detail;
                    try {
                        const model = genAI.getGenerativeModel({
                            model: 'gemini-2.5-flash',
                            generationConfig: { responseMimeType: 'application/json' },
                        });
                        const result = await model.generateContent(detailPrompt);
                        detail = JSON.parse(result.response.text());
                    } catch {
                        const completion = await openai.chat.completions.create({
                            model: MODELS.GPT_5_MINI,
                            messages: [
                                { role: 'system', content: 'You are a professional Korean news briefing writer. Always respond with valid JSON only.' },
                                { role: 'user', content: detailPrompt },
                            ],
                            response_format: { type: 'json_object' },
                        });
                        detail = JSON.parse(completion.choices[0]?.message?.content || '{}');
                    }

                    if (detail.content) {
                        detailMap.set(trend.id, detail);
                    }

                    // rate limit 대기
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (detailErr) {
                    logger.error(`[VerifyBriefings] Detail failed for ${trend.title}:`, detailErr);
                }
            }

            // 유저별 저장
            for (const user of groupUsers) {
                try {
                    const userProfile = user.profile as any;
                    const name = userProfile.name || '사용자';

                    // {{NAME}} → 실제 이름 치환 후 detail 저장
                    for (const [trendId, templateDetail] of detailMap) {
                        const personalized = {
                            ...templateDetail,
                            title: templateDetail.title?.replaceAll('{{NAME}}', name),
                            content: templateDetail.content?.replaceAll('{{NAME}}', name),
                            keyTakeaways: templateDetail.keyTakeaways?.map((t: string) => t.replaceAll('{{NAME}}', name)),
                            actionItems: templateDetail.actionItems?.map((t: string) => t.replaceAll('{{NAME}}', name)),
                        };
                        await saveDetailCache(trendId, personalized, user.email);
                    }

                    // trends_cache 저장
                    await supabaseAdmin
                        .from('trends_cache')
                        .upsert({
                            email: user.email,
                            date: today,
                            trends,
                            last_updated: new Date().toISOString(),
                        }, { onConflict: 'email,date' });

                    // 푸시 알림
                    const topTitles = trends.slice(0, 2).map((t: any) => t.title).join(', ');
                    const notification = {
                        id: `trend-briefing-${today}`,
                        type: 'trend_briefing' as const,
                        priority: 'low' as const,
                        title: '📰 오늘의 트렌드 브리핑',
                        message: `${name}님 맞춤 뉴스 ${trends.length}개가 도착했어요! ${topTitles}`,
                        actionType: 'open_trend_briefing',
                    };

                    await saveProactiveNotification(user.email, notification).catch(() => {});
                    await sendPushNotification(user.email, {
                        title: notification.title,
                        body: notification.message,
                        data: {
                            notificationId: notification.id,
                            type: notification.type,
                            actionType: notification.actionType,
                        },
                    }).catch(() => {});

                    fixed++;
                } catch (saveErr) {
                    logger.error(`[VerifyBriefings] Save failed for ${user.email}:`, saveErr);
                    errors++;
                }
            }

            // 그룹 간 대기
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (groupErr: any) {
            logger.error(`[VerifyBriefings] Group ${groupKey} failed:`, groupErr?.message);
            errors += groupUsers.length;
        }
    }

    logger.info(`[VerifyBriefings] Done: ${fixed} fixed, ${errors} errors out of ${missingUsers.length} missing`);

    return NextResponse.json({
        success: true,
        date: today,
        totalUsers: allUsers.length,
        allCovered: false,
        missing: missingUsers.length,
        fixed,
        errors,
    });
}));
