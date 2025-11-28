import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
    try {
        // Verify the request is authorized
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting trend briefing generation at 5:00 AM...');

        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        // Step 1: 오늘의 cached_news에서 뉴스 100개 가져오기
        const { data: newsArticles, error: newsError } = await supabase
            .from('cached_news')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(100);

        if (newsError || !newsArticles || newsArticles.length === 0) {
            console.error('[CRON] No news articles found:', newsError);
            return NextResponse.json({
                error: 'No news articles available',
                message: 'Run /api/batch-news first to collect news'
            }, { status: 500 });
        }

        console.log(`[CRON] Found ${newsArticles.length} news articles`);

        // Step 2: 모든 사용자 프로필 가져오기
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

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        });

        const results = [];

        // Step 3: 각 사용자에게 맞춤형 트렌드 브리핑 생성
        for (const user of users) {
            try {
                const userEmail = user.email;
                const userProfile = user.profile as any;

                console.log(`[CRON] Generating trend briefing for: ${userEmail}`);

                const userJob = userProfile.job || 'Professional';
                const userGoal = userProfile.goal || 'Growth';
                const userInterests = userProfile.interests || [];
                const userLevel = userProfile.level || 'mid';

                // Step 3.1: Gemini로 사용자에게 맞는 뉴스 선택 (100개 중 6-8개)
                const selectionPrompt = `
당신은 개인화된 뉴스 큐레이터입니다.

**사용자 프로필:**
- 직무: ${userJob}
- 목표: ${userGoal}
- 관심사: ${userInterests.join(', ')}
- 수준: ${userLevel}

**사용 가능한 뉴스 (${newsArticles.length}개):**
${newsArticles.map((article, idx) => `
${idx + 1}. [${article.category}] ${article.title_korean}
   - 출처: ${article.source_name}
   - 요약: ${article.summary_korean}
   - 관심사 태그: ${article.interests?.join(', ') || ''}
   - 관련도: ${article.relevance_score}/10
`).join('\n')}

**임무:**
사용자의 직무, 목표, 관심사를 고려하여 가장 관련성 높은 뉴스 6-8개를 선택하세요.

**선택 기준:**
1. 사용자의 직무와 직접적으로 관련된 뉴스 우선
2. 사용자의 관심사와 겹치는 뉴스
3. 사용자의 목표 달성에 도움이 되는 인사이트가 있는 뉴스
4. 다양한 카테고리에서 균형있게 선택 (너무 한쪽에 치우치지 않게)
5. 최신 뉴스 우선

**응답 형식 (JSON):**
{
  "selected_indices": [3, 7, 15, 22, 31, 45, 67, 89],
  "selection_reasoning": "왜 이 뉴스들을 선택했는지 간단히 설명"
}
`;

                const selectionResult = await model.generateContent(selectionPrompt);
                const selectionResponse = await selectionResult.response;
                const selectionText = selectionResponse.text();

                let selectionData;
                try {
                    selectionData = JSON.parse(selectionText);
                } catch (parseError) {
                    console.error(`[CRON] Failed to parse selection for ${userEmail}:`, parseError);
                    continue;
                }

                const selectedIndices = selectionData.selected_indices || [];
                const selectedArticles = selectedIndices
                    .filter((idx: number) => idx >= 1 && idx <= newsArticles.length)
                    .map((idx: number) => newsArticles[idx - 1]); // 1-based to 0-based

                if (selectedArticles.length === 0) {
                    console.error(`[CRON] No valid articles selected for ${userEmail}`);
                    continue;
                }

                console.log(`[CRON] Selected ${selectedArticles.length} articles for ${userEmail}`);

                // Step 3.2: 선택된 뉴스로 개인화된 인사이트 생성
                const insightPrompt = `
당신은 ${userJob} 분야의 전문 멘토입니다.

**사용자 정보:**
- 직무: ${userJob}
- 목표: ${userGoal}
- 수준: ${userLevel}

**오늘의 선별된 트렌드 뉴스:**
${selectedArticles.map((article: any, idx: number) => `
${idx + 1}. [${article.category}] ${article.title_korean}
   - 요약: ${article.summary_korean}
   - 출처: ${article.source_name}
   - 링크: ${article.original_url}
`).join('\n')}

**임무:**
이 뉴스들을 바탕으로 사용자에게 맞춤형 트렌드 브리핑을 작성하세요.

**작성 요구사항:**
1. **전체 인사이트**: 전체 트렌드를 관통하는 핵심 메시지 (2-3문장)
2. **각 뉴스별 분석**:
   - 핵심 포인트 1-2문장
   - 사용자의 직무/목표에 어떻게 연결되는지
   - 실행 가능한 조언이나 시사점
3. **톤**: 전문적이면서도 친근하게, 동기부여가 되도록

**응답 형식 (JSON):**
{
  "overall_insight": "전체 트렌드를 관통하는 핵심 인사이트 (2-3문장)",
  "key_message": "오늘 트렌드의 한 줄 요약",
  "trends": [
    {
      "title": "뉴스 제목 (한국어)",
      "summary": "핵심 내용 1-2문장",
      "insight": "사용자에게 주는 인사이트와 조언 (2-3문장)",
      "url": "원문 링크",
      "source": "출처",
      "category": "카테고리",
      "relevance": "사용자와의 연관성 설명 (1문장)"
    }
  ],
  "action_items": [
    "실행 가능한 조언 1",
    "실행 가능한 조언 2",
    "실행 가능한 조언 3"
  ]
}
`;

                const insightResult = await model.generateContent(insightPrompt);
                const insightResponse = await insightResult.response;
                const insightText = insightResponse.text();

                let briefingData;
                try {
                    briefingData = JSON.parse(insightText);
                } catch (parseError) {
                    console.error(`[CRON] Failed to parse insights for ${userEmail}:`, parseError);
                    continue;
                }

                // Step 3.3: Supabase에 저장
                const { error: saveError } = await supabase
                    .from('trend_briefings')
                    .upsert({
                        email: userEmail,
                        date: today,
                        briefing_data: briefingData,
                        selected_articles: selectedArticles.map((a: any) => a.id),
                        created_at: new Date().toISOString()
                    }, {
                        onConflict: 'email,date'
                    });

                if (saveError) {
                    console.error(`[CRON] Error saving trend briefing for ${userEmail}:`, saveError);
                } else {
                    console.log(`[CRON] Successfully generated trend briefing for ${userEmail}`);
                    results.push({ email: userEmail, status: 'success' });
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
