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

        // Pending schedule context (if user wants to add from recommendation)
        let pendingScheduleContext = "";
        if (context?.pendingSchedule) {
            const ps = context.pendingSchedule;
            pendingScheduleContext = `
사용자가 추가하려는 일정:
- 제목: ${ps.title}
- 설명: ${ps.description || '없음'}
- 예상 시간: ${ps.estimatedTime}
- 카테고리: ${ps.category}

사용자가 이 일정을 추가하고 싶어합니다. 어느 시간대에 추가할지 물어보세요.
오늘의 일정을 참고하여 비어있는 시간대를 제안하고, 사용자의 선택을 받으세요.
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

        const systemPrompt = `당신은 Fi.eri 앱의 AI 어시스턴트입니다. 사용자의 학습과 성장을 돕습니다.
${currentDateContext}
${userContext}
${scheduleContext}
${trendContext}
${pendingScheduleContext}

서비스 기능:
1. 일정 관리: 사용자가 일정 추가를 요청하면 add_schedule 액션을 제안
2. 트렌드 브리핑: 사용자가 트렌드 카드에 대해 질문하면 위 컨텍스트를 참고해 쉽게 설명
3. 커리큘럼: 학습 계획 및 진행 상황 안내
4. 자료 분석: 업로드된 PDF/문서 AI 분석 기능

응답 규칙 (매우 중요!):
- 반드시 존댓말을 사용하세요 (~세요, ~습니다, ~해요 등). 이것은 절대적으로 지켜야 하는 규칙입니다.
- 절대로 반말(~해, ~야, ~어 등)을 사용하지 마세요.
- 한국어로 친근하면서도 공손하게 답변
- 응답은 짧고 간결하게, 핵심만 전달하세요
- 마크다운 서식(#, **, *) 사용을 최소화하세요. 평문으로 작성하세요.
- 이모지는 핵심 포인트에만 1-2개 사용하고 과도하게 사용하지 마세요
- 긴 설명보다는 3-5줄 이내로 핵심만 요약하세요
- 불필요한 구조화(번호 매기기, 단계 나누기 등)를 피하고 자연스러운 대화체로 작성하세요
- 일정 추가 요청 시: 구체적인 시간/날짜를 파악해서 actions에 add_schedule 포함
- 트렌드 브리핑 요약 요청 시:
  * 위 트렌드 컨텍스트를 참고해 쉬운 말로 요약 설명
  * actions 배열에 "open_briefing" 타입의 액션을 추가하여 상세보기 버튼 제공
  * 여러 브리핑을 요약할 경우 각각에 대한 상세보기 버튼 제공

일정 추가 요청 처리:
사용자가 "일정 추가해줘", "운동 일정 넣어줘" 등 요청 시 일정 이름, 시간, 날짜를 파악해서 actions 배열로 버튼 제공하세요.

JSON 응답 형식:
반드시 다음 JSON 형식으로만 응답하세요:
{
  "message": "사용자에게 보여줄 메시지 (반드시 존댓말 사용!)",
  "actions": [
    {
      "type": "add_schedule" | "open_briefing",
      "label": "버튼에 표시될 텍스트",
      "data": {
        // add_schedule인 경우
        "text": "일정 이름",
        "startTime": "HH:MM",
        "endTime": "HH:MM",
        "specificDate": "YYYY-MM-DD",
        "color": "primary"

        // open_briefing인 경우
        "briefingId": "브리핑 ID",
        "title": "브리핑 제목"
      }
    }
  ]
}

트렌드 브리핑 응답 예시:
사용자: "트렌드 브리핑 요약해줘"
응답:
{
  "message": "오늘의 주요 트렌드를 정리해드릴게요.\n\nClaude AI 3.5가 출시되어 성능이 대폭 향상되었고, 2024년에는 SNS 마케팅이 더 주목받을 전망이에요. 자세한 내용은 아래 버튼으로 확인해보세요.",
  "actions": [
    {
      "type": "open_briefing",
      "label": "Claude AI 3.5 자세히 보기",
      "data": {
        "briefingId": "briefing-1",
        "title": "Claude AI 3.5 출시"
      }
    },
    {
      "type": "open_briefing",
      "label": "디지털 마케팅 트렌드 자세히 보기",
      "data": {
        "briefingId": "briefing-2",
        "title": "2024 디지털 마케팅 트렌드"
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

