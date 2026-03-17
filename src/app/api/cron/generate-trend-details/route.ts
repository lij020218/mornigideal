/**
 * 트렌드 브리핑 상세 생성 CRON
 *
 * generate-trend-briefings가 기사 선별 + trends_cache 저장을 완료한 뒤,
 * 10분 후에 실행되어 상세 브리핑(detail)을 미리 생성해둠.
 *
 * Vercel Cron: UTC 20:10 (KST 05:10)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from 'openai';
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { saveDetailCache } from "@/lib/newsCache";
import { MODELS } from "@/lib/models";
import { withCron } from '@/lib/api-handler';
import { withCronLogging } from '@/lib/cron-logger';
import { getPlanNamesBatch } from "@/lib/user-plan";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateDetailedBriefing(trend: any, groupProfile: { job: string; goal: string; interests: string[]; level: string; isPro?: boolean }) {
    const { job, goal, interests, level, isPro } = groupProfile;
    const interestList = interests.length > 0 ? interests.join(', ') : '비즈니스, 기술';
    const levelLabel = level || 'Intermediate';
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
            } catch {
                console.warn(`[CRON] Gemini flash also failed, falling back to OpenAI`);
            }
        }
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

export const GET = withCron(withCronLogging('generate-trend-details', async (_request: NextRequest) => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    // trends_cache에서 오늘 생성된 트렌드 조회
    const { data: cacheRows, error: cacheError } = await supabaseAdmin
        .from('trends_cache')
        .select('email, trends')
        .eq('date', today);

    if (cacheError || !cacheRows || cacheRows.length === 0) {
        return NextResponse.json({
            success: true,
            message: 'No trends_cache for today, skipping detail generation',
        });
    }

    // 유저 프로필 조회
    const emails = cacheRows.map(r => r.email);
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('email, profile')
        .in('email', emails);

    if (!users || users.length === 0) {
        return NextResponse.json({ success: true, message: 'No users found' });
    }

    const userMap = new Map(users.map(u => [u.email, u]));
    const planMap = await getPlanNamesBatch(emails);

    // 관심사 기반 그룹핑 (LLM 호출 최소화)
    interface GroupInfo {
        job: string;
        goal: string;
        interests: string[];
        level: string;
        isPro: boolean;
        trends: any[];
        users: { email: string; profile: any }[];
    }
    const groups = new Map<string, GroupInfo>();

    for (const row of cacheRows) {
        const user = userMap.get(row.email);
        if (!user) continue;
        const p = user.profile as any;
        const job = p?.job || '전문가';
        const interests = (p?.interests || []).sort().join(',');
        const userPlan = planMap.get(row.email) || 'Free';
        const isPro = userPlan === 'Pro' || userPlan === 'Max';
        // 같은 직업+관심사+플랜레벨 → 같은 상세 브리핑 공유
        const groupKey = `${job}|${interests}|${isPro ? 'pro' : 'free'}`;

        // 상세 프리생성은 첫 표시분(articleCount)만 — 나머지는 on-demand
        const baseCount = isPro ? 6 : 3;
        const trendsForDetail = (row.trends || []).slice(0, baseCount);

        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                job,
                goal: p?.goal || '전문성 향상',
                interests: p?.interests || [],
                level: p?.level || 'Intermediate',
                isPro,
                trends: trendsForDetail,
                users: [],
            });
        }
        groups.get(groupKey)!.users.push(user);
    }

    console.log(`[CRON Detail] ${cacheRows.length} users → ${groups.size} groups`);

    // 그룹별 트렌드 상세 생성 (배치 3개씩, 타임아웃 방지)
    let generated = 0;
    let failed = 0;

    for (const [groupKey, group] of groups) {
        const BATCH_SIZE = 3;
        const detailMap = new Map<string, any>(); // trendId → detail template

        for (let i = 0; i < group.trends.length; i += BATCH_SIZE) {
            const batch = group.trends.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map((trend: any) => generateDetailedBriefing(trend, group))
            );

            for (let j = 0; j < results.length; j++) {
                const r = results[j];
                const trend = batch[j];
                if (r.status === 'fulfilled') {
                    detailMap.set(trend.id, r.value);
                    generated++;
                } else {
                    console.error(`[CRON Detail] Failed for "${trend.title}":`, r.reason?.message);
                    failed++;
                }
            }

            if (i + BATCH_SIZE < group.trends.length) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        // 그룹 내 모든 유저에 개인화 후 저장
        await Promise.allSettled(
            group.users.map(async (user) => {
                const name = (user.profile as any)?.name || '사용자';
                for (const [trendId, templateDetail] of detailMap) {
                    const personalized = personalizeDetail(templateDetail, name);
                    await saveDetailCache(trendId, personalized, user.email);
                }
            })
        );
    }

    return NextResponse.json({
        success: true,
        date: today,
        groups: groups.size,
        generated,
        failed,
        users: cacheRows.length,
    });
}));
