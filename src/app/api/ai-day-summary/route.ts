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

        const { todaySchedules, completedCount, totalCount, userProfile } = await request.json();

        console.log('[AI Day Summary] Generating day summary and feedback');

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

        // Build schedule summary
        let scheduleList = '';
        if (todaySchedules && todaySchedules.length > 0) {
            scheduleList = todaySchedules
                .map((s: any) => `  ${s.completed ? '✅' : '⏸️'} ${s.startTime} - ${s.text}`)
                .join('\n');
        }

        const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        const prompt = `당신은 Fi.eri 앱의 AI 어시스턴트입니다. 오늘 하루가 모두 끝났습니다.
${userContext}

오늘의 일정:
${scheduleList || '- 일정 없음'}

성과:
- 완료: ${completedCount}/${totalCount}개 (${completionRate}%)

**요청사항:**
1. 따뜻한 하루 마무리 인사 (1-2문장, 존댓말)
2. 오늘의 성과에 대한 긍정적인 피드백 (구체적으로)
3. 개선 제안 또는 내일을 위한 격려 (1-2문장)
4. 사용자의 목표를 고려한 맞춤형 조언
5. 이모지 1-2개 포함

**피드백 가이드:**
- 완료율 80% 이상: 열정적인 칭찬과 격려
- 완료율 50-79%: 긍정적 피드백 + 부드러운 개선 제안
- 완료율 50% 미만: 공감과 위로 + 작은 성공 강조

**응답 형식:**
[하루 마무리 인사] 🌙

오늘의 하이라이트:
[오늘 완료한 일정 중 의미 있는 것 언급]

[피드백 및 내일을 위한 조언]

**예시 (완료율 90%):**
"오늘 하루 정말 고생 많으셨어요! 🌟 계획했던 일정의 90%를 완수하셨네요.

오늘의 하이라이트:
'업무 시작'부터 '독서'까지 알차게 보내셨어요. 특히 목표로 하신 영어 공부에 집중하신 점이 인상적입니다 📚

내일도 이 에너지를 이어가세요! 충분한 휴식 후 내일 아침에 뵙겠습니다."

**예시 (완료율 40%):**
"오늘 하루도 수고하셨어요 🌙 계획대로 되지 않은 부분이 있어도 괜찮습니다.

오늘의 하이라이트:
'업무 시작'과 '점심' 일정을 완료하셨네요. 작은 성공도 의미 있는 한 걸음이에요 ✨

내일은 일정을 조금 줄여서 시작해보는 건 어떨까요? 완성 가능한 목표를 세우면 성취감이 더 커집니다."

**중요:** 사용자의 목표와 오늘 완료한 일정을 구체적으로 언급하며, 따뜻하고 격려하는 톤으로 작성하세요.`;

        // Use gpt-5.2 for personalized, empathetic feedback
        const modelName = "gpt-5.2-2025-12-11";
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: "당신은 Fi.eri 앱의 AI 비서입니다. 사용자의 하루를 돌아보며 따뜻한 피드백과 격려를 제공하세요."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.8,
        });

        const summary = completion.choices[0]?.message?.content ||
            `오늘 하루 고생 많으셨어요! 🌙\n\n오늘의 성과: ${completedCount}/${totalCount}개 완료\n\n충분한 휴식 취하시고, 내일 또 만나요!`;

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                modelName,
                '/api/ai-day-summary',
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        return NextResponse.json({ summary });
    } catch (error: any) {
        console.error("[AI Day Summary] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate day summary" },
            { status: 500 }
        );
    }
}
