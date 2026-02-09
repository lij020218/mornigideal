import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { weeklyGoals, weeklyStats, userProfile } = await request.json();

        console.log('[AI Weekly Feedback] Generating weekly feedback');

        // Build user context
        let userContext = "";
        if (userProfile) {
            userContext = `
사용자 정보:
- 이름: ${userProfile.name || '사용자'}
- 직업: ${userProfile.job || '미설정'}
- 목표: ${userProfile.goal || '미설정'}
- 관심사: ${(userProfile.interests || []).join(', ') || '미설정'}
`;
        }

        // Build weekly goals summary
        let goalsSection = '';
        if (weeklyGoals && weeklyGoals.length > 0) {
            const completedGoals = weeklyGoals.filter((g: any) => g.completed);
            const inProgressGoals = weeklyGoals.filter((g: any) => !g.completed);

            goalsSection = `
이번 주 목표 (총 ${weeklyGoals.length}개):

완료한 목표 (${completedGoals.length}개):
${completedGoals.length > 0
    ? completedGoals.map((g: any) => `  ✅ ${g.title} (${g.category || '일반'})`).join('\n')
    : '  - 없음'}

진행 중인 목표 (${inProgressGoals.length}개):
${inProgressGoals.length > 0
    ? inProgressGoals.map((g: any) => `  ⏳ ${g.title} - ${g.progress}% 진행 (${g.category || '일반'})`).join('\n')
    : '  - 없음'}
`;
        } else {
            goalsSection = '이번 주 설정된 목표가 없습니다.';
        }

        // Build weekly stats
        let statsSection = '';
        if (weeklyStats) {
            const completionRate = weeklyStats.totalSchedules > 0
                ? Math.round((weeklyStats.completedSchedules / weeklyStats.totalSchedules) * 100)
                : 0;
            statsSection = `
이번 주 일정 통계:
- 총 일정: ${weeklyStats.totalSchedules}개
- 완료: ${weeklyStats.completedSchedules}개 (${completionRate}%)
- 가장 바빴던 날: ${weeklyStats.busiestDay || '없음'}
`;
        }

        const goalCompletionRate = weeklyGoals?.length > 0
            ? Math.round((weeklyGoals.filter((g: any) => g.completed).length / weeklyGoals.length) * 100)
            : 0;

        const prompt = `당신은 Fi.eri 앱의 AI 어시스턴트입니다. 한 주가 끝났습니다.
${userContext}
${goalsSection}
${statsSection}

**요청사항:**
1. 따뜻한 한 주 마무리 인사 (1-2문장, 존댓말)
2. 이번 주 목표 달성에 대한 구체적인 피드백
3. 잘한 점 강조 및 칭찬
4. 다음 주를 위한 부드러운 조언 (1-2문장)
5. 격려와 응원 메시지
6. 이모지 2-3개 적절히 포함

**피드백 가이드:**
- 목표 달성률 80% 이상: 열정적인 축하와 칭찬, 다음 주 더 높은 목표 제안
- 목표 달성률 50-79%: 긍정적 피드백 + 부족했던 부분 분석 + 개선 제안
- 목표 달성률 50% 미만: 공감과 위로 + 달성한 것 강조 + 다음 주 목표 조정 제안
- 목표가 없었던 경우: 목표 설정의 중요성 언급 + 다음 주 목표 설정 권유

**응답 형식:**
[한 주 마무리 인사] 🎉

이번 주 돌아보기:
[구체적인 목표 달성 현황 언급]

[잘한 점 & 칭찬]

다음 주를 위한 조언:
[부드러운 개선 제안 또는 격려]

[마무리 응원 메시지]

**중요:**
- 사용자의 구체적인 목표와 진행 상황을 반드시 언급하세요
- 따뜻하고 격려하는 톤을 유지하세요
- 새로운 한 주를 시작하는 동기부여가 되도록 작성하세요`;

        const modelName = "gpt-5.2-2025-12-11";
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: "당신은 Fi.eri 앱의 AI 비서입니다. 사용자의 한 주를 돌아보며 따뜻한 피드백과 다음 주를 위한 격려를 제공하세요."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.8,
        });

        const feedback = completion.choices[0]?.message?.content ||
            `한 주 동안 고생 많으셨어요! 🎉\n\n이번 주도 열심히 달려오셨네요. 새로운 한 주도 화이팅입니다!`;

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                email,
                modelName,
                '/api/ai-weekly-feedback',
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        return NextResponse.json({ feedback });
    } catch (error: any) {
        console.error("[AI Weekly Feedback] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate weekly feedback" },
            { status: 500 }
        );
    }
}
