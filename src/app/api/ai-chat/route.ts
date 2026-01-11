import { NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { routeChatRequest } from "@/lib/smart-chat-router";

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

        // Get the latest user message
        const latestMessage = messages[messages.length - 1];
        if (latestMessage.role !== 'user') {
            return NextResponse.json(
                { error: "Last message must be from user" },
                { status: 400 }
            );
        }

        // Try rule-based routing first
        const routeResult = routeChatRequest(latestMessage.content, context);

        if (routeResult.type === 'rule-based') {
            console.log('[AI Chat] ✅ Handled by rule-based system - NO AI COST');

            const response: any = {
                message: routeResult.message || "처리했습니다.",
                actions: [],
            };

            // Add actions based on route result
            if (routeResult.action === 'add_schedule' && routeResult.data) {
                response.actions.push({
                    type: 'add_schedule',
                    label: '',
                    data: routeResult.data,
                });
            } else if (routeResult.action === 'show_briefings' && routeResult.data?.briefings) {
                // Add briefing actions
                routeResult.data.briefings.slice(0, 3).forEach((b: any) => {
                    response.actions.push({
                        type: 'open_briefing',
                        label: `${b.title} 자세히 보기`,
                        data: {
                            briefingId: b.id,
                            title: b.title,
                        },
                    });
                });
            }

            return NextResponse.json(response);
        }

        // If AI is required, proceed with OpenAI API call
        console.log('[AI Chat] 🤖 Complex request - using AI');

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
                // Use schedules from context if provided, otherwise fetch from profile
                if (context?.schedules && context.schedules.length > 0) {
                    console.log('[AI Chat] Using schedules from context:', context.currentDate);
                    scheduleContext = `
오늘의 일정 (${context.currentDate}):
${context.schedules.map((g: any) => `- ${g.startTime}: ${g.text}${g.completed ? ' ✓ 완료' : g.skipped ? ' ⊘ 건너뜀' : ''}`).join('\n')}
`;
                } else if (p.customGoals && p.customGoals.length > 0) {
                    const today = new Date();
                    const todayStr = today.toISOString().split('T')[0];
                    const dayOfWeek = today.getDay();

                    const todayGoals = p.customGoals.filter((g: any) =>
                        g.specificDate === todayStr ||
                        (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
                    );

                    if (todayGoals.length > 0) {
                        scheduleContext = `
오늘의 일정 (${todayStr}):
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
        if (context?.trendBriefings && Array.isArray(context.trendBriefings)) {
            const briefings = context.trendBriefings;
            if (briefings.length > 0) {
                trendContext = `
📰 오늘의 트렌드 브리핑 정보:
- 총 브리핑 수: ${briefings.length}개

브리핑 목록:
${briefings.map((t: any, i: number) => `${i + 1}. [${t.category || '일반'}] ${t.title || t.name || '제목 없음'}`).join('\n')}

사용자가 "브리핑", "트렌드", "안 읽은", "뭐 있어" 등의 키워드로 물어보면 위의 브리핑 목록을 자연스럽게 알려주세요.
`;
            }
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
        let currentDateContext = "";

        if (context?.currentDate && context?.currentTime) {
            // Use provided date and time (with 5am cutoff applied)
            const [year, month, day] = context.currentDate.split('-');
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const weekdayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
            const weekday = weekdayNames[dateObj.getDay()];

            currentDateContext = `
현재 날짜: ${year}년 ${month}월 ${day}일 ${weekday}
현재 시간: ${context.currentTime}
현재 연도: ${year}년

중요: 사용자가 "오늘" 또는 "today"라고 하면 ${year}년 ${month}월 ${day}일을 의미합니다.
`;
            console.log('[AI Chat] Using context date:', context.currentDate, context.currentTime);
        } else {
            currentDateContext = `
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
        }

        const systemPrompt = `당신은 Fi.eri 앱의 AI 어시스턴트입니다. ${currentDateContext}
${userContext}
${scheduleContext}
${trendContext}
${pendingScheduleContext}

**핵심 규칙:**
1. 존댓말 사용 (필수), 반말 금지.
2. 짧고 핵심만 간결하게 답변 (2-3문장).
3. 자연스러운 대화체로 작성. 불릿 포인트(-)는 꼭 필요할 때만 사용 (3개 이상 나열할 때만).
4. 일정 추가/트렌드 요약 외에는 actions 없이 message만 응답.

**기능별 지침:**
- **일정 추가**:
  - **즉시 등록 조건** (다음 중 하나라도 해당하면 바로 add_schedule action 포함):
    1. 사용자가 "바로 등록", "필요 없어", "없어", "그냥 등록", "세부사항 필요 없어", "기록할 필요 없어" 등 명확한 의사 표현
    2. 사용자가 이미 장소/메모를 제공함
    3. 이전 대화에서 이미 세부사항 질문을 했고 사용자가 답변함
  - **물어보기 조건**: 위 조건에 해당하지 않고, 사용자가 처음으로 일정만 요청한 경우에만 "장소나 세부 사항도 같이 기록할까요?"라고 **딱 한 번만** 물어봄.
  - 장소(location), 메모(memo) 정보가 있으면 data에 포함, 없으면 빈 문자열로.
- **트렌드 브리핑**: 컨텍스트 참고하여 요약하고 actions에 open_briefing 포함.

**JSON 응답 형식 (엄수):**
{
  "message": "사용자에게 보여줄 메시지 (존댓말)",
  "actions": [
    {
      "type": "add_schedule" | "open_briefing",
      "label": "버튼 텍스트",
      "data": {
        // add_schedule: { text, startTime, endTime, specificDate, color: 'primary' }
        // open_briefing: { briefingId, title }
      }
    }
  ]
}`;

        const modelName = "gpt-5-mini-2025-08-07";
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: systemPrompt },
                ...messages.slice(-10),
            ],
            temperature: 1.0,
            response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0]?.message?.content || '{"message": "죄송합니다. 응답을 생성하지 못했습니다."}';

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                modelName,
                '/api/ai-chat',
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

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

