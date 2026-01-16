import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { generateTrendId } from "@/lib/newsCache";
import { logOpenAIUsage } from "@/lib/openai-usage";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const MINI_MODEL = "gpt-5-mini-2025-08-07";

/**
 * GET /api/trend-briefing-v2
 *
 * 캐시된 뉴스에서 사용자 맞춤 뉴스 선택
 *
 * 비용: 기존 대비 90% 절감
 * - 기존: 매번 RSS 크롤링 + Gemini 요약 ($0.10-0.20)
 * - 신규: 캐시 조회 + GPT-5-mini 필터링 ($0.01-0.02)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const job = searchParams.get("job") || "Marketer";
    const goal = searchParams.get("goal");
    const interests = searchParams.get("interests");

    console.log(`[API V2] Fetching trends for ${job}, interests: ${interests}`);

    // Step 1: 캐시된 뉴스 조회 (최근 3일)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: cachedNews, error } = await supabase
      .from('cached_news')
      .select('*')
      .eq('is_active', true)
      .gte('pub_date', threeDaysAgo.toISOString())
      .order('pub_date', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[API V2] Error fetching cached news:', error);
      return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
    }

    if (!cachedNews || cachedNews.length === 0) {
      return NextResponse.json({
        error: "No cached news available. Please run batch job first.",
        hint: "POST /api/batch-news"
      }, { status: 404 });
    }

    console.log(`[API V2] Found ${cachedNews.length} cached articles`);

    // Step 2: GPT-5-mini로 사용자 맞춤 필터링 (저렴함!)
    const interestList = interests ? interests.split(',').map(i => i.trim()).join(', ') : "비즈니스, 기술";

    const newsForPrompt = cachedNews.map((article, idx) => ({
      id: idx,
      title_korean: article.title_korean,
      category: article.category,
      summary: article.summary_korean,
      interests: article.interests,
      source: article.source_name,
      date: article.pub_date,
      relevance_score: article.relevance_score,
    }));

    const completion = await openai.chat.completions.create({
      model: MINI_MODEL,
      messages: [
        {
          role: "system",
          content: "당신은 사용자 맞춤 뉴스 큐레이터입니다. 사용자의 직업과 관심사에 가장 적합한 뉴스를 선별합니다."
        },
        {
          role: "user",
          content: `다음 ${newsForPrompt.length}개의 뉴스에서 ${job}에게 가장 유용한 6개를 선택하세요.

뉴스 목록:
${JSON.stringify(newsForPrompt, null, 2)}

사용자 정보:
- 직업: ${job}
- 목표: ${goal || "전문성 향상"}
- 관심사: ${interestList}

선택 기준:
1. 관심사(${interestList}) 매칭 - 최소 3개 이상
2. ${job}의 업무에 실질적 가치
3. 목표(${goal || "커리어 성장"}) 달성에 도움
4. 다양한 주제와 출처 (글로벌 + 한국)

다음 JSON 형식으로 응답:
{
  "selectedArticles": [
    {
      "id": <number>,
      "relevance_reason": "${job}에게 왜 중요한지 1문장"
    }
  ]
}

정확히 6개를 선택하세요.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 1.0,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    const selectedIds = (result.selectedArticles || []).map((a: any) => a.id);

    // Log usage (no user session in GET, use anonymous)
    const usage = completion.usage;
    if (usage) {
      await logOpenAIUsage(
        "anonymous@trend-briefing",
        MINI_MODEL,
        "trend-briefing-v2/filter",
        usage.prompt_tokens,
        usage.completion_tokens
      );
    }

    console.log(`[API V2] Selected ${selectedIds.length} articles:`, selectedIds);

    // Step 3: 선택된 뉴스 매핑
    const trends = selectedIds.map((id: number) => {
      const article = cachedNews[id];
      const relevanceInfo = result.selectedArticles.find((a: any) => a.id === id);

      if (!article) return null;

      const pubDate = article.pub_date ? new Date(article.pub_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      return {
        id: generateTrendId(article.title_korean),
        title: article.title_korean,
        category: article.category,
        summary: article.summary_korean,
        time: pubDate,
        imageColor: "bg-blue-500/20",
        originalUrl: article.original_url,
        imageUrl: "",
        source: article.source_name,
        relevance: relevanceInfo?.relevance_reason || `${job}에게 유용한 뉴스입니다.`,
      };
    }).filter(Boolean);

    console.log(`[API V2] Returning ${trends.length} personalized trends`);

    return NextResponse.json({
      trends,
      cached: true,
      lastUpdated: new Date().toISOString(),
      source: "cached_news_v2",
    });

  } catch (error) {
    console.error("[API V2] Error:", error);
    return NextResponse.json({
      error: "Failed to fetch trends",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/trend-briefing-v2
 *
 * 뉴스 상세 브리핑 생성 (기존과 동일)
 */
export async function POST(request: Request) {
  try {
    const { title, level, job, originalUrl, summary } = await request.json();

    const completion = await openai.chat.completions.create({
      model: MINI_MODEL,
      messages: [
        {
          role: "system",
          content: "당신은 전문적인 뉴스 브리핑 작성자입니다. 실무에 적용 가능한 구체적인 인사이트를 제공합니다."
        },
        {
          role: "user",
          content: `다음 뉴스를 ${level} ${job}를 위한 브리핑으로 작성하세요:

제목: "${title}"
요약: ${summary}
URL: ${originalUrl}

다음 섹션 포함:
1. 핵심 내용: 무슨 일이 있었고 왜 중요한지
2. ${level} ${job}인 당신에게: ${job} 전문가에게 미치는 영향
3. 주요 인사이트: 3-4개 핵심 포인트
4. 실행 아이템: ${level} ${job}가 취할 수 있는 3가지 액션

다음 JSON 형식으로 응답:
{
  "title": "한국어 제목",
  "content": "### 핵심 내용\\n\\n[내용]\\n\\n### ${level} ${job}인 당신에게\\n\\n[분석]\\n\\n### 주요 인사이트\\n\\n- **포인트 1**\\n- **포인트 2**\\n- **포인트 3**",
  "keyTakeaways": ["인사이트 1", "인사이트 2", "인사이트 3"],
  "actionItems": ["액션 1", "액션 2", "액션 3"],
  "originalUrl": "${originalUrl}"
}

한국어로 작성하고, ${level} ${job}에게 실용적이고 구체적으로 작성하세요.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 1.0,
    });

    const detail = JSON.parse(completion.choices[0].message.content || "{}");

    // Log usage for briefing detail
    const usage = completion.usage;
    if (usage) {
      await logOpenAIUsage(
        "anonymous@trend-briefing",
        MINI_MODEL,
        "trend-briefing-v2/detail",
        usage.prompt_tokens,
        usage.completion_tokens
      );
    }

    return NextResponse.json({
      detail: { ...detail, originalUrl: originalUrl || "" },
      cached: false,
    });

  } catch (error) {
    console.error("[API V2 POST] Error:", error);
    return NextResponse.json({
      error: "Failed to generate briefing detail",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
