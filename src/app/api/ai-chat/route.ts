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

브리핑 목록 (ID와 함께):
${briefings.map((t: any, i: number) => `${i + 1}. [ID: ${t.id}] [${t.category || '일반'}] ${t.title || t.name || '제목 없음'}`).join('\n')}

**중요**: 사용자가 브리핑을 추천하거나 열어보라고 할 때는 반드시 actions에 open_briefing을 포함하고, data에 briefingId를 넣으세요.
예: actions: [{ "type": "open_briefing", "label": "브리핑 열어보기", "data": { "briefingId": ${briefings[0]?.id}, "title": "${briefings[0]?.title}" } }]
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
1. **자연스러운 대화체 (가장 중요!)**: 친구처럼 편하게 대화하되 존중하는 톤. "~드릴게요", "~할게요", "~하시면 돼요" 같은 자연스러운 표현 사용.
2. **간결함**: 2-3문장으로 핵심만 전달. 불필요한 격식 제거.
3. **불릿 포인트 최소화**: 3개 이상 나열할 때만 사용. 대신 자연스러운 문장으로 표현.
4. **이모지 활용**: 문장 끝에 적절한 이모지 1-2개로 친근함 표현 (과하지 않게).
5. **시간 추천 시 절대 규칙**: 현재 시간(${context.currentTime}) 이후만 추천. 과거 시간 절대 금지.

**나쁜 예시 (딱딱함):**
"알겠습니다. 오늘(2026-01-12) 오후 4시 28분부터 7시까지 '업무 일정'으로 등록해드릴까요? 장소나 메모도 같이 기록할까요?"

**좋은 예시 (자연스러움):**
"오늘 4시 28분부터 7시까지 업무 일정 추가할게요! 장소나 메모 있으면 같이 적어드릴게요 😊"

**기능별 지침:**
- **일정 추가**:
  - **즉시 등록 조건** (다음 중 하나라도 해당하면 바로 add_schedule action 포함):
    1. **최우선**: 사용자 메시지에 "바로 등록", "바로 추가", "즉시 등록", "그냥 등록" 같은 키워드가 포함되면 무조건 즉시 등록
    2. 사용자가 "필요 없어", "없어", "세부사항 필요 없어" 등 거부 의사 표현
    3. 사용자가 이미 장소를 제공함 (예: "장소는 집", "집에서")
    4. 이전 대화에서 이미 세부사항 질문을 했고 사용자가 답변함
  - **즉시 등록 예시** (반드시 actions 배열에 add_schedule 포함):
    * 사용자: "오늘 7시 반에 저녁 식사 잡아줘. 장소는 집이고 바로 등록해"
    * 응답: {"message": "좋아요! 오늘 7시 반에 저녁 식사 일정(장소: 집) 바로 등록할게요 🍽️", "actions": [{"type": "add_schedule", "label": "저녁 식사 추가", "data": {"text": "저녁 식사", "startTime": "19:30", "endTime": "20:30", "specificDate": "2026-01-12", "daysOfWeek": null, "color": "primary", "location": "집", "memo": ""}}]}
    * 사용자: "오늘 7시 반에 저녁 식사 잡아줘. 장소는 집"
    * 응답: {"message": "좋아요! 오늘 7시 반에 저녁 식사 일정(장소: 집) 등록할게요. 메모 추가할 내용 있으면 알려주세요 😊", "actions": []}
    * 사용자: "없어"
    * 응답: {"message": "알겠어요! 바로 등록할게요 🍽️", "actions": [{"type": "add_schedule", "label": "저녁 식사 추가", "data": {"text": "저녁 식사", "startTime": "19:30", "endTime": "20:30", "specificDate": "2026-01-12", "daysOfWeek": null, "color": "primary", "location": "집", "memo": ""}}]}
    * 사용자: "오늘 3시에 운동 일정 잡아줘"
    * 응답: {"message": "3시에 운동 일정 추가할게요! 어디서 하시는지 장소 알려주시면 같이 적을게요 😊", "actions": []}
    * 사용자: "헬스장"
    * 응답: {"message": "헬스장에서 운동하시는군요! 바로 등록할게요 💪", "actions": [{"type": "add_schedule", "label": "운동 추가", "data": {"text": "운동", "startTime": "15:00", "endTime": "16:00", "specificDate": "2026-01-12", "daysOfWeek": null, "color": "primary", "location": "헬스장", "memo": ""}}]}
  - **물어보기 조건**: 위 조건에 해당하지 않고, 사용자가 처음으로 일정만 요청한 경우에만 자연스럽게 물어봄.
    * 예시: "4시 28분부터 7시까지 '업무 일정' 추가할게요! 장소나 메모 있으면 알려주세요 😊" (자연스러운 느낌 ✅)
    * 이 경우 actions는 빈 배열 []로 응답
  - **시간 제안 시**: 사용자에게 빈 시간을 제안할 때는 현재 시간(${context.currentTime}) 이후의 시간만 제안합니다. 현재 시간보다 이전 시간은 절대 제안하지 마세요.
  - **일정 이름 정규화** (절대적으로 중요! 캘린더에 정의된 정확한 이름 사용):
    **규칙**: 사용자가 말한 키워드를 아래 **정확한 일정 이름**으로 변환하세요. 캘린더에 미리 정의된 이름과 일치해야 아이콘과 색상이 제대로 표시됩니다.

    **식사 관련** (가장 중요!):
    * "아침밥", "아침", "조식", "breakfast", "아침 먹기" → **"아침 식사"** (정확히 이것!)
    * "점심밥", "점심", "중식", "lunch", "점심 먹기" → **"점심 식사"** (정확히 이것!)
    * "저녁밥", "저녁", "석식", "dinner", "저녁 먹기" → **"저녁 식사"** (정확히 이것!)

    **수면/기상**:
    * "일어나", "일어나기", "깨어나", "일어나야지", "wake up" → **"기상"** (정확히 이것!)
    * "자기", "잠자기", "잠", "자야지", "sleep", "잘 시간" → **"취침"** (정확히 이것!)

    **업무 관련**:
    * "업무", "업무 일정", "일", "work", "출근", "일 시작", "업무 시작하기", "수업 시작" → **"업무 시작"** (정확히 이것!)
    * "업무 마무리", "업무 끝", "퇴근", "일 끝", "수업 끝" → **"업무 종료"** (정확히 이것!)

    **운동 관련**:
    * "헬스", "요가", "필라테스", "러닝", "gym", "운동하기", "트레이닝" → **"운동"** (정확히 이것!)

    **학습 관련**:
    * "책 읽기", "독서하기", "책", "reading" → **"독서"** (정확히 이것!)
    * "공부", "학습", "study", "공부하기" → **"공부"** (정확히 이것!)
    * "자기계발", "자기 계발", "개발", "성장" → **"자기계발"** (정확히 이것!)

    **기타**:
    * "쉬기", "휴식", "rest", "쉬는 시간" → **"휴식"** (정확히 이것!)
    * "여가", "취미", "여가 시간" → **"여가"** (정확히 이것!)
    * "게임하기", "게임 하기", "게임 시간" → **"게임"** (정확히 이것!)
    * "영화 보기", "영화 감상", "영화 시청" → **"영화"** (정확히 이것!)
    * "드라마 보기", "드라마 시청" → **"드라마"** (정확히 이것!)

    **예시 (정확한 변환)**:
    ✅ 사용자: "저녁 식사 잡아줘" → text: "저녁 식사"
    ✅ 사용자: "저녁밥 먹을 시간" → text: "저녁 식사"
    ✅ 사용자: "저녁" → text: "저녁 식사"
    ✅ 사용자: "점심 먹기" → text: "점심 식사"
    ✅ 사용자: "업무 일정" → text: "업무 시작"
    ✅ 사용자: "일어날 시간" → text: "기상"
    ✅ 사용자: "헬스 가기" → text: "운동"
    ✅ 사용자: "게임할 시간" → text: "게임"
    ✅ 사용자: "영화 보기" → text: "영화"
    ✅ 사용자: "드라마 시청" → text: "드라마"

    **절대 금지 (커스텀 일정으로 등록됨)**:
    ❌ "저녁" (X) → "저녁 식사" (O)
    ❌ "아침" (X) → "아침 식사" (O)
    ❌ "점심" (X) → "점심 식사" (O)
    ❌ "업무 일정" (X) → "업무 시작" (O)
    ❌ "일어나기" (X) → "기상" (O)
  - **반복 일정** (매일/매주):
    * "매일", "every day", "일일" 등이 포함되면 daysOfWeek: [0,1,2,3,4,5,6] 추가
    * "매주 월수금" → daysOfWeek: [1,3,5]
    * "평일마다" → daysOfWeek: [1,2,3,4,5]
    * "주말마다" → daysOfWeek: [0,6]
    * specificDate는 반복 일정이면 null, 특정 날짜면 "YYYY-MM-DD"
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
        // add_schedule: { text, startTime, endTime, specificDate, daysOfWeek, color: 'primary', location, memo }
        // - text: 정규화된 일정 이름 (예: "기상", "업무 시작", "운동")
        // - daysOfWeek: 반복 요일 배열 [0-6] 또는 null (0=일, 1=월, ..., 6=토)
        // - specificDate: 특정 날짜 "YYYY-MM-DD" 또는 null (반복 일정이면 null)
        // open_briefing: { briefingId, title }
      }
    }
  ]
}

**CRITICAL: 일정 등록 시 actions 배열 필수!**
- 사용자가 "없어", "필요 없어", "그냥 등록해" 등으로 확정하면 **반드시** actions 배열에 add_schedule을 포함하세요.
- message만 보내고 actions를 빈 배열로 보내면 일정이 등록되지 않습니다!
- "등록해드렸어요", "추가할게요" 같은 메시지를 보낼 때는 **반드시** actions에 실제 동작을 포함해야 합니다.

**좋은 예 (올바른 즉시 등록):**
{"message": "좋아요! 오늘 7시 반에 저녁 식사 일정 추가할게요 🍽️", "actions": [{"type": "add_schedule", "label": "저녁 식사 추가", "data": {"text": "저녁 식사", "startTime": "19:30", "endTime": "20:30", "specificDate": "2026-01-12", "daysOfWeek": null, "color": "primary", "location": "집", "memo": ""}}]}

**나쁜 예 (말만 하고 등록 안 됨):**
{"message": "좋아요! 등록해드렸어요", "actions": []} ❌❌❌`;

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

        // Debug logging
        console.log('[AI Chat] Raw AI Response:', responseContent);

        try {
            const parsed = JSON.parse(responseContent);
            console.log('[AI Chat] Parsed Response:', JSON.stringify(parsed, null, 2));
            console.log('[AI Chat] Actions included:', parsed.actions?.length || 0);

            return NextResponse.json({
                message: parsed.message || "응답을 처리하지 못했습니다.",
                actions: parsed.actions || [],
            });
        } catch (e) {
            // If JSON parsing fails, return as plain message
            console.error('[AI Chat] JSON parse error:', e);
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

