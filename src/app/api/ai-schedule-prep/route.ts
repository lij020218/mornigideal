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

        const prompt = `당신은 Fi.eri 앱의 조용한 비서 AI입니다. ${timeUntil}분 후 "${schedule.text}" 일정이 시작됩니다.
${userContext}

**역할: 조용한 비서 (Quiet Assistant)**
당신의 임무는 사용자가 업무에 집중할 수 있도록 **최소한의 준비만 도와주는 것**입니다.

**핵심 원칙:**
1. **짧고 간결하게**: 2-3개 항목만. 리마인더 수준.
2. **물리적 준비 위주**: 환경, 도구, 기기 상태 확인
3. **인사이트 금지**: 전략, 아이디어, 브레인스토밍 제안 절대 금지
4. **방해 최소화**: "~해보세요", "~하면 좋아요" 같은 제안 금지
5. **체크 항목만**: 단순 확인 리스트

**좋은 예시 (업무 시작):**
"10분 후 "업무 시작" 시간이에요 🕐

준비 체크:
• 노트북 충전 확인
• 필요한 창/파일 열어두기
• 방해 요소 제거 (알림 끄기 등)"

**좋은 예시 (운동):**
"10분 후 "운동" 시간이에요 🏃

준비 체크:
• 운동복 착용
• 물병 챙기기
• 타이머 설정"

**좋은 예시 (회의):**
"10분 후 "팀 회의" 시간이에요 💼

준비 체크:
• 회의 링크 확인
• 자료 준비됐는지 체크
• 조용한 장소 확보"

**나쁜 예시 (과잉 개입):**
❌ "오늘 해야 할 업무를 3가지 뽑아보세요"
❌ "SK하이닉스 최신 뉴스를 확인하고 인사이트를 메모하세요"
❌ "각 섹션마다 비즈니스 기회를 생각해보세요"
👉 이런 건 나중에! 지금은 준비만.

**중요:**
- 일정 이름("${schedule.text}")에 맞는 물리적 준비만 제안
- 사용자 정보는 **준비 항목 추론**에만 사용 (명시적 언급 금지)
- 전략/인사이트는 업무 시작 후에 제공될 예정이므로 여기선 절대 금지
- 2-3줄로 끝내기`;

        // Use gpt-4o-mini for simple, quick preparation tips (cost-effective)
        const modelName = "gpt-4o-mini-2024-07-18";
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: "당신은 조용한 비서 AI입니다. 일정 시작 전 최소한의 물리적 준비만 간단히 리마인드하세요. 인사이트나 전략 제안은 하지 마세요."
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
