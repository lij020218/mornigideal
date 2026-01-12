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

**핵심 원칙: 초개인화 (Hyper-Personalization)**
1. **목표에 직접 연결**: 사용자의 목표("${userProfile?.goal}")를 조언에 명시적으로 연결하세요.
2. **관심사 활용**: 관심사(${(userProfile?.interests || []).join(', ')})와 관련된 구체적인 행동을 제시하세요.
3. **직업 맥락**: 직업("${userProfile?.job}")에 맞는 전문적인 도구나 자료를 언급하세요.
4. **실행 가능성**: 지금 당장 10분 안에 할 수 있는 구체적인 행동만 제시하세요.

**요청사항:**
1. 사용자의 **목표**를 첫 번째 체크리스트에 반드시 명시
2. **관심사** 중 최소 1개를 조언에 포함
3. **직업**에 필요한 구체적인 도구/자료 언급
4. 각 조언은 실행 가능한 행동 중심 + 왜 중요한지 짧게 설명
5. 자연스러운 대화체 사용, 이모지 1-2개

**응답 형식:**
${timeUntil}분 후 "${schedule.text}" 시간이에요! 🕐

준비 체크리스트:
• [목표 관련 구체적 행동] ✅
• [직업 관련 도구/자료 준비]
• [관심사 활용한 인사이트/자료 준비]

**좋은 예시 (업무 시작 + 목표: AI 스타트업 + 관심사: SK하이닉스, 엔비디아):**
"10분 후 "업무 시작" 시간이에요! 🕐

준비 체크리스트:
• 오늘 해야 할 업무를 **"AI 스타트업 준비"** 기준으로 3가지만 뽑아 투두에 적어두세요 ✅
• 노트북 충전하고, **피치덱/시장조사 문서 + OpenAI·Gemini 관련 자료 탭**을 미리 열어두세요.
• **SK하이닉스·엔비디아** 관련 최신 뉴스 1개씩만 훑고, 업무에 연결될 인사이트를 한 줄로 메모해두세요."

**나쁜 예시 (너무 일반적):**
"책상을 정리하고 오늘 할 일을 적어보세요" ❌ (목표/관심사 활용 없음)

**중요:** 반드시 목표, 직업, 관심사를 **구체적으로 명시**하여 "이 조언은 나를 위한 것이다"라고 느끼게 하세요.`;

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
