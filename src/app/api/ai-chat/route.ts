import { NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface ChatAction {
    type: "add_schedule" | "open_link" | "open_curriculum";
    label: string;
    data: Record<string, any>;
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { messages, context } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: "Messages are required" },
                { status: 400 }
            );
        }

        // Get user profile for context
        let userContext = "";
        let scheduleContext = "";
        try {
            const { getUserByEmail } = await import("@/lib/users");
            const user = await getUserByEmail(session.user.email);
            if (user?.profile) {
                const p = user.profile;
                userContext = `
사용자 정보:
- 이름: ${user.name}
- 직업: ${p.job || "미설정"}
- 목표: ${p.goal || "미설정"}
- 레벨: ${p.level || "intermediate"}
- 관심 분야: ${(p.interests || []).join(", ") || "미설정"}
`;
                // Include today's schedule
                if (p.customGoals && p.customGoals.length > 0) {
                    const today = new Date();
                    const todayStr = today.toISOString().split('T')[0];
                    const dayOfWeek = today.getDay();

                    const todayGoals = p.customGoals.filter((g: any) =>
                        g.specificDate === todayStr ||
                        (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
                    );

                    if (todayGoals.length > 0) {
                        scheduleContext = `
오늘의 일정:
${todayGoals.map((g: any) => `- ${g.startTime}: ${g.text}`).join('\n')}
`;
                    }
                }
            }
        } catch (e) {
            console.error("[AI Chat] Failed to get user context:", e);
        }

        // Trend briefing context (if provided)
        let trendContext = "";
        if (context?.trendBriefings && context.trendBriefings.length > 0) {
            trendContext = `
현재 대시보드에 표시된 트렌드 브리핑:
${context.trendBriefings.map((t: any, i: number) =>
                `${i + 1}. [${t.category}] ${t.title}\n   요약: ${t.summary}\n   출처: ${t.source}`
            ).join('\n\n')}
`;
        }

        // Get current date/time for context
        const now = new Date();
        const currentDateContext = `
현재 날짜 및 시간: ${now.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit'
        })}
현재 연도: ${now.getFullYear()}년
`;

        const systemPrompt = `당신은 A.ideal 앱의 AI 어시스턴트입니다. 사용자의 학습과 성장을 돕습니다.
${currentDateContext}
${userContext}
${scheduleContext}
${trendContext}

## 서비스 기능
1. **일정 관리**: 사용자가 일정 추가를 요청하면 add_schedule 액션을 제안
2. **트렌드 브리핑**: 사용자가 트렌드 카드에 대해 질문하면 위 컨텍스트를 참고해 쉽게 설명
3. **커리큘럼**: 학습 계획 및 진행 상황 안내
4. **자료 분석**: 업로드된 PDF/문서 AI 분석 기능

## 응답 규칙
- 한국어로 친근하게 답변
- 일정 추가 요청 시: 구체적인 시간/날짜를 파악해서 actions에 add_schedule 포함
- 트렌드 설명 요청 시: 위 트렌드 컨텍스트를 참고해 쉬운 말로 재설명
- 이모지 적절히 사용

## 일정 추가 요청 처리
사용자가 "일정 추가해줘", "운동 일정 넣어줘" 등 요청 시:
1. 일정 이름, 시간, 날짜를 파악
2. 응답에 actions 배열로 버튼 제공

## JSON 응답 형식
반드시 다음 JSON 형식으로만 응답하세요:
{
  "message": "사용자에게 보여줄 메시지",
  "actions": [
    {
      "type": "add_schedule",
      "label": "일정 추가하기",
      "data": {
        "text": "일정 이름",
        "startTime": "HH:MM",
        "endTime": "HH:MM",
        "specificDate": "YYYY-MM-DD",
        "color": "primary"
      }
    }
  ]
}

actions는 필요할 때만 포함하세요. 일반 대화는 actions 없이 message만 응답하세요.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-5.1-2025-11-13",
            messages: [
                { role: "system", content: systemPrompt },
                ...messages.slice(-10),
            ],
            temperature: 1.0,
            response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0]?.message?.content || '{"message": "죄송합니다. 응답을 생성하지 못했습니다."}';

        try {
            const parsed = JSON.parse(responseContent);
            return NextResponse.json({
                message: parsed.message || "응답을 처리하지 못했습니다.",
                actions: parsed.actions || [],
            });
        } catch {
            // If JSON parsing fails, return as plain message
            return NextResponse.json({
                message: responseContent,
                actions: [],
            });
        }
    } catch (error: any) {
        console.error("[AI Chat] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate response" },
            { status: 500 }
        );
    }
}

