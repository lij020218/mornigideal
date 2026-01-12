import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { schedule, userProfile, timeUntil } = await request.json();

        console.log('[AI Schedule Prep] Generating preparation tips for:', schedule.text);

        // Build user context
        let userContext = "";
        if (userProfile) {
            userContext = `
사용자 정보:
- 직업: ${userProfile.job || '미설정'}
- 목표: ${userProfile.goal || '미설정'}
- 레벨: ${userProfile.level || 'intermediate'}
- 관심사: ${(userProfile.interests || []).join(', ') || '미설정'}
`;
        }

        const prompt = `당신은 Fi.eri 앱의 AI 어시스턴트입니다. ${timeUntil}분 후 "${schedule.text}" 일정이 시작됩니다.
${userContext}

**요청사항:**
1. 이 일정을 효과적으로 준비하기 위한 **구체적이고 실용적인 조언 3-4가지**
2. 사용자의 직업, 목표, 레벨을 고려하여 맞춤화
3. 각 조언은 실행 가능한 행동 중심 (예: "노트북 충전하기", "필요한 자료 미리 열어두기")
4. 존댓말 사용, 이모지 1-2개 포함

**응답 형식 (2-3문장으로 간결하게):**
${timeUntil}분 후 "${schedule.text}" 시간이에요! 🕐

준비 체크리스트:
• [구체적인 행동 1]
• [구체적인 행동 2]
• [구체적인 행동 3]

**예시:**
- (독서 + 목표: 영어공부) "영어 원서를 준비하고, 모르는 단어를 메모할 노트를 옆에 두세요 📚 사전 앱도 미리 켜두면 좋아요."
- (업무 시작 + 목표: 생산성) "책상을 정리하고, 오늘 할 일 3가지를 포스트잇에 적어보세요 ✅ 핸드폰은 서랍에 넣어두세요."
- (운동 + 레벨: beginner) "운동복으로 갈아입고, 물 한 잔 마시세요 💧 스트레칭 영상을 미리 찾아두면 도움이 됩니다."

**중요:** 사용자 정보를 활용하여 맞춤형 조언을 제공하되, 2-3문장으로 간결하게 작성하세요.`;

        // Use gpt-5.2 for complex, personalized advice
        const modelName = "gpt-5.2-2025-12-11";
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: "당신은 Fi.eri 앱의 AI 비서입니다. 사용자가 일정을 효과적으로 준비할 수 있도록 구체적이고 실용적인 조언을 제공하세요."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
        });

        const advice = completion.choices[0]?.message?.content || `${timeUntil}분 후 "${schedule.text}" 시간이에요! 준비하세요 🕐`;

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                modelName,
                '/api/ai-schedule-prep',
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        return NextResponse.json({ advice });
    } catch (error: any) {
        console.error("[AI Schedule Prep] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate schedule preparation advice" },
            { status: 500 }
        );
    }
}
