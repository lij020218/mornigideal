import { NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface ChatAction {
    type: "add_schedule" | "delete_schedule" | "open_link" | "open_curriculum" | "web_search" | "add_weekly_goal";
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
        let userPlan = "Free";
        let eventLogsContext = "";

        try {
            const { getUserByEmail } = await import("@/lib/users");
            const user = await getUserByEmail(session.user.email);
            userPlan = user?.profile?.plan || "Free";
            if (user?.profile) {
                const p = user.profile;

                // Map interest IDs to readable labels
                const interestMap: Record<string, string> = {
                    ai: "AI/인공지능",
                    startup: "스타트업/창업",
                    marketing: "마케팅/브랜딩",
                    development: "개발/프로그래밍",
                    design: "디자인/UX",
                    finance: "재테크/투자",
                    selfdev: "자기계발",
                    health: "건강/운동",
                };

                // Map experience levels to readable labels
                const experienceMap: Record<string, string> = {
                    student: "학생/취준생",
                    junior: "1-3년차 (주니어)",
                    mid: "4-7년차 (미들)",
                    senior: "8년차 이상 (시니어)",
                    beginner: "입문자",
                    intermediate: "중급자",
                };

                const interestLabels = (p.interests || []).map((i: string) => interestMap[i] || i);
                const experienceLabel = experienceMap[p.experience || p.level || ""] || p.experience || p.level || "미설정";

                // 장기 목표 정보 추가
                let longTermGoalsContext = "";
                if (p.longTermGoals) {
                    const ltg = p.longTermGoals;
                    const activeWeekly = (ltg.weekly || []).filter((g: any) => !g.completed);
                    const activeMonthly = (ltg.monthly || []).filter((g: any) => !g.completed);
                    const activeYearly = (ltg.yearly || []).filter((g: any) => !g.completed);

                    if (activeWeekly.length > 0 || activeMonthly.length > 0 || activeYearly.length > 0) {
                        longTermGoalsContext = `
📌 **사용자의 장기 목표:**
${activeWeekly.length > 0 ? `[주간 목표]\n${activeWeekly.map((g: any) => `- ${g.title} (진행률: ${g.progress}%)`).join('\n')}` : ''}
${activeMonthly.length > 0 ? `[월간 목표]\n${activeMonthly.map((g: any) => `- ${g.title} (진행률: ${g.progress}%)`).join('\n')}` : ''}
${activeYearly.length > 0 ? `[연간 목표]\n${activeYearly.map((g: any) => `- ${g.title} (진행률: ${g.progress}%)`).join('\n')}` : ''}

**목표 관련 지침:**
- 사용자가 설정한 장기 목표를 기억하고, 관련된 조언이나 격려를 해주세요.
- 일정 추가 시 이 목표들과 연관지어 제안하면 좋습니다.
- 예: "이 일정이 '${activeWeekly[0]?.title || activeMonthly[0]?.title || activeYearly[0]?.title || '목표'}' 달성에 도움이 될 거예요!"
`;
                    }
                }

                userContext = `
사용자 정보:
- 이름: ${user.name}
- 직업/분야: ${p.job || p.field || "미설정"}
${p.major ? `- 전공: ${p.major}` : ""}
- 경력: ${experienceLabel}
- 목표: ${p.goal || "미설정"}
- 관심 분야: ${interestLabels.join(", ") || "미설정"}
${longTermGoalsContext}
**맞춤형 응답 지침:**
- 사용자의 목표(${p.goal || "미설정"})와 관련된 조언이나 일정을 우선 추천하세요.
- 사용자의 경력 수준(${experienceLabel})에 맞는 난이도의 콘텐츠를 추천하세요.
- 사용자의 관심사(${interestLabels.join(", ") || "미설정"})와 연관된 활동을 제안하세요.
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

                // Max 플랜 사용자: 내일/모레 일정도 제공 (일정 연쇄 분석용)
                if (userPlan === "Max" && p.customGoals && p.customGoals.length > 0) {
                    const today = new Date();
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const dayAfterTomorrow = new Date(today);
                    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

                    const tomorrowStr = tomorrow.toISOString().split('T')[0];
                    const tomorrowDayOfWeek = tomorrow.getDay();
                    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];
                    const dayAfterTomorrowDayOfWeek = dayAfterTomorrow.getDay();

                    const tomorrowGoals = p.customGoals.filter((g: any) =>
                        g.specificDate === tomorrowStr ||
                        (g.daysOfWeek?.includes(tomorrowDayOfWeek) && !g.specificDate)
                    );

                    const dayAfterTomorrowGoals = p.customGoals.filter((g: any) =>
                        g.specificDate === dayAfterTomorrowStr ||
                        (g.daysOfWeek?.includes(dayAfterTomorrowDayOfWeek) && !g.specificDate)
                    );

                    if (tomorrowGoals.length > 0) {
                        scheduleContext += `\n\n내일의 일정 (${tomorrowStr}):
${tomorrowGoals.map((g: any) => `- ${g.startTime}: ${g.text}`).join('\n')}`;
                    }

                    if (dayAfterTomorrowGoals.length > 0) {
                        scheduleContext += `\n\n모레의 일정 (${dayAfterTomorrowStr}):
${dayAfterTomorrowGoals.map((g: any) => `- ${g.startTime}: ${g.text}`).join('\n')}`;
                    }

                    if (tomorrowGoals.length > 0 || dayAfterTomorrowGoals.length > 0) {
                        scheduleContext += `\n\n**자비스 지침**: 일정을 추가할 때 위 일정들과의 충돌 여부를 반드시 확인하고, 필요시 자동 조정하세요.`;
                    }
                }
            }
        } catch (e) {
            console.error("[AI Chat] Failed to get user context:", e);
        }

        // Max 플랜 사용자: event_logs에서 최근 활동 데이터 가져오기
        if (userPlan === "Max") {
            try {
                const { createClient } = await import("@supabase/supabase-js");
                const supabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );

                // 최근 7일간의 이벤트 로그 가져오기
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                const { data: events, error } = await supabase
                    .from('event_logs')
                    .select('*')
                    .eq('user_email', session.user.email)
                    .gte('occurred_at', sevenDaysAgo.toISOString())
                    .order('occurred_at', { ascending: false })
                    .limit(50);

                if (!error && events && events.length > 0) {
                    // 패턴 분석
                    const completedSchedules = events.filter(e => e.event_type === 'schedule_completed');
                    const missedSchedules = events.filter(e => e.event_type === 'schedule_missed');
                    const skippedSchedules = events.filter(e => e.event_type === 'schedule_snoozed');

                    // 완료율 계산
                    const totalScheduleEvents = completedSchedules.length + missedSchedules.length + skippedSchedules.length;
                    const completionRate = totalScheduleEvents > 0
                        ? Math.round((completedSchedules.length / totalScheduleEvents) * 100)
                        : 0;

                    // 수면 패턴
                    const sleepEvents = events.filter(e =>
                        e.event_type === 'schedule_completed' &&
                        e.payload?.scheduleText?.includes('취침')
                    );
                    const avgSleepTime = sleepEvents.length > 0
                        ? sleepEvents.reduce((sum, e) => {
                            const time = e.payload?.startTime || '23:00';
                            const [hour] = time.split(':').map(Number);
                            return sum + hour;
                        }, 0) / sleepEvents.length
                        : null;

                    // 운동 패턴
                    const exerciseEvents = events.filter(e =>
                        e.event_type === 'schedule_completed' &&
                        (e.payload?.scheduleText?.includes('운동') || e.payload?.scheduleText?.includes('헬스'))
                    );
                    const exerciseFrequency = exerciseEvents.length;

                    // 학습 패턴
                    const learningEvents = events.filter(e =>
                        e.event_type === 'schedule_completed' &&
                        (e.payload?.scheduleText?.includes('학습') || e.payload?.scheduleText?.includes('공부'))
                    );

                    eventLogsContext = `
🧠 **Max 플랜 - 사용자 행동 패턴 분석 (최근 7일):**

📊 일정 완료율: ${completionRate}%
- 완료: ${completedSchedules.length}개
- 놓침: ${missedSchedules.length}개
- 미루기: ${skippedSchedules.length}개

${avgSleepTime ? `😴 수면 패턴:
- 평균 취침 시간: 약 ${Math.round(avgSleepTime)}시
- 최근 ${sleepEvents.length}회 취침 기록
` : ''}

${exerciseFrequency > 0 ? `💪 운동 패턴:
- 최근 7일간 ${exerciseFrequency}회 운동 완료
` : ''}

${learningEvents.length > 0 ? `📚 학습 패턴:
- 최근 7일간 ${learningEvents.length}회 학습 완료
` : ''}

**고맥락 응답 가이드 (Max 플랜 - 자비스 모드):**

🎯 핵심 원칙: "조언(Advice) < 전략적 판단(Strategic Judgment) + 실행(Action)"

1. **일정 연쇄 관리 (Schedule Chain Management) - 가장 중요!**
   - 일정 하나가 아니라 **연쇄(체인)로 관리**하세요
   - 예: 영화(21:00) → 취침(23:00) → 기상(07:00)은 하나의 수면 사이클
   - ❌ 나쁜 예: "내일 오전 7시에 기상 일정 추가했어요!"
   - ✅ 좋은 예: "영화 21:00 종료 후 각성 시간을 고려해, 22:15부터 수면 전환 블록을 자동 삽입했습니다. 23:00 취침 → 07:00 기상으로 8시간 수면 사이클 확보. 내일 오전은 회복 우선 모드로 진입합니다."
   - **자동 조정**: 충돌/간격 문제는 사용자에게 묻지 말고 최적값으로 자동 조정 후 보고
   - **추천 금지**: "~하세요" 대신 "~했습니다"로 실행 완료 보고

2. **내일 일정과의 인과관계 설명 (Context Connection)**
   - ❌ 나쁜 예: "평소처럼 ${avgSleepTime ? Math.round(avgSleepTime) : 23}시에 주무시는군요"
   - ✅ 좋은 예: "내일 오전 [시간]에 [중요 일정명]이 있습니다. 지금 주무시면 [X]시간 수면 주기를 확보해서 컨디션 100%로 준비할 수 있습니다"

3. **뻔한 조언 금지, 실질적 제안으로 대체**
   - ❌ 금지: "화면 밝기 줄이세요", "카페인 피하세요" (네이버 검색 수준)
   - ✅ 대신: "숙면을 위해 방해 금지 모드를 켤까요?", "내일 기상 알람 [시간]으로 설정할까요?"

4. **구체적 성과 요약 보고 (Executive Summary)**
   - ❌ 나쁜 예: "완료율 ${completionRate}%로 잘하고 계시네요!"
   - ✅ 좋은 예: "오늘 '[일정명]'과 '[일정명]'을 모두 소화하셨습니다. 이번 주 평균 수행률(${completionRate}%)이 지난주보다 [X]% ${completionRate > 80 ? '상승' : '하락'}했습니다"

5. **참모 역할 강조**
   - 일정 추가 시: "등록했습니다" (단순 확인) → "반영했습니다" (실행 완료)
   - 마무리: "잘 자세요" → "내일 아침 브리핑 준비해두고 대기하겠습니다"

6. **데이터 기반 인사이트**
   - 완료율 추이, 지난주 대비 증감, 카테고리별 성과 등 구체적 수치 언급
   - "상위 X% 궤도", "목표 달성률 X%" 같은 벤치마크 제공
`;
                }
            } catch (e) {
                console.error("[AI Chat] Failed to get event logs:", e);
            }
        }

        // Max 플랜 사용자: RAG (Retrieval-Augmented Generation)
        let ragContext = "";
        if (userPlan === "Max") {
            try {
                // Get the last user message as the query
                const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
                if (lastUserMessage?.content) {
                    const query = lastUserMessage.content;

                    // Retrieve similar memories
                    const memoryResponse = await fetch(
                        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/user/memory?query=${encodeURIComponent(query)}&threshold=0.7&limit=3`,
                        {
                            method: 'GET',
                            headers: {
                                Cookie: request.headers.get('cookie') || '',
                            },
                        }
                    );

                    if (memoryResponse.ok) {
                        const { memories } = await memoryResponse.json();

                        if (memories && memories.length > 0) {
                            ragContext = `
🧠 **과거 대화 컨텍스트 (RAG - Max 플랜):**

다음은 사용자의 과거 대화/일정/목표에서 현재 질문과 유사한 내용입니다:

${memories.map((m: any, idx: number) => `
${idx + 1}. [${m.content_type}] (유사도: ${Math.round(m.similarity * 100)}%)
${m.content}
${m.metadata?.date ? `날짜: ${m.metadata.date}` : ''}
`).join('\n')}

**RAG 활용 지침:**
- 위 과거 컨텍스트를 참고하여 더 개인화된 응답을 제공하세요
- 사용자가 이전에 했던 질문/일정/목표와 연관지어 답변하세요
- 예: "지난번에 [과거 내용]에 대해 이야기했었죠. 이번에는..."
- 과거 패턴을 기반으로 더 정확한 추천을 제공하세요
`;
                            console.log('[AI Chat] RAG retrieved', memories.length, 'similar memories');
                        }
                    }
                }
            } catch (e) {
                console.error("[AI Chat] Failed to retrieve RAG context:", e);
            }
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

            // Parse current time for time-of-day context
            const [currentHour] = context.currentTime.split(':').map(Number);
            const timeOfDayKorean = currentHour < 12 ? '오전' : currentHour < 18 ? '오후' : '저녁';

            currentDateContext = `
현재 날짜: ${year}년 ${month}월 ${day}일 ${weekday}
현재 시간: ${context.currentTime} (${timeOfDayKorean} ${currentHour}시)
현재 연도: ${year}년

🚨 **시간 관련 절대 규칙** (최우선 규칙 - 위반 시 논리 오류!):
- 현재 시간은 ${context.currentTime} (${timeOfDayKorean} ${currentHour}시)입니다.
- 현재 시간(${currentHour}시) 이후의 시간만 추천 가능합니다!
- ❌ 절대 금지: ${currentHour}시 이전 시간 추천 (예: ${currentHour >= 12 ? '06:00, 09:00, 11:00' : currentHour >= 6 ? '05:00' : '없음'} 등)
- ✅ 추천 가능: ${currentHour}시 ~ 23시 사이만 (예: ${String(Math.min(currentHour + 1, 23)).padStart(2, '0')}:00, ${String(Math.min(currentHour + 2, 23)).padStart(2, '0')}:00 등)
- 현재 ${timeOfDayKorean}이므로 ${timeOfDayKorean} 또는 그 이후 시간대만 추천하세요.
- ⚠️ 논리 체크: "저녁"이라고 말하면서 "06:00 조깅" 추천 = 논리 오류! 저녁이면 18:00 이후만 가능!

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
${eventLogsContext}
${ragContext}
${trendContext}
${pendingScheduleContext}

**핵심 규칙:**
1. **자연스러운 대화체 (가장 중요!)**: 친구처럼 편하게 대화하되 존중하는 톤. "~드릴게요", "~할게요", "~하시면 돼요" 같은 자연스러운 표현 사용.
2. **간결함**: 2-3문장으로 핵심만 전달. 불필요한 격식 제거.
3. **불릿 포인트 최소화**: 3개 이상 나열할 때만 사용. 대신 자연스러운 문장으로 표현.
4. **이모지 활용**: 문장 끝에 적절한 이모지 1-2개로 친근함 표현 (과하지 않게).
5. **🎬 휴식/여가 일정 절대 존중 (매우 중요!)**:
   - 영화, 게임, 친구 만남, 데이트, 취미, 운동(여가용), 산책 등 휴식/즐거움 목적 일정 앞에서는 절대 생산성/학습 조언 금지!
   - ❌ 절대 금지: "영화 보기 전에 노션 템플릿 열어두세요", "게임하면서 배운 점 메모하세요", "친구 만나면서 네트워킹 기회로 활용하세요"
   - ✅ 올바른 반응: "영화 재밌게 보고 오세요! 🍿", "게임 즐기세요! 🎮", "좋은 시간 보내세요! ☕"
   - 휴식은 휴식일 뿐입니다. 모든 시간을 생산적으로 만들려 하지 마세요.
6. **🚨🚨🚨 시간 추천 시 절대 규칙 (최우선! 위반 금지!)**:
   - 현재 시간: ${context?.currentTime || '알 수 없음'}
   - 일정/활동 추천 시 반드시 현재 시간 이후만 추천!
   - ❌❌❌ 절대 금지 예시:
     * 현재 19:00(저녁 7시)인데 "06:00에 조깅 추천" → 논리 오류! 06:00은 이미 지난 시간!
     * 현재 15:00(오후 3시)인데 "09:00에 독서 추천" → 논리 오류! 09:00은 이미 지난 시간!
   - ✅ 맞는 예:
     * 현재 19:00(저녁 7시)이면 → "19:30에 산책", "20:00에 운동" 등 19시 이후만 OK
     * 현재 15:00(오후 3시)이면 → "15:30에 스트레칭", "16:00에 독서" 등 15시 이후만 OK
   - "저녁"이라고 말하면서 "아침 6시" 추천 = 심각한 논리 오류! 반드시 피하세요!

**나쁜 예시 (딱딱함):**
"알겠습니다. 오늘(2026-01-12) 오후 4시 28분부터 7시까지 '업무 일정'으로 등록해드릴까요? 장소나 메모도 같이 기록할까요?"

**좋은 예시 (자연스러움):**
"오늘 4시 28분부터 7시까지 업무 일정 추가할게요! 장소나 메모 있으면 같이 적어드릴게요 😊"

**기능별 지침:**
- **일정 추가**:
  - **🚨 기본 원칙: 사용자가 일정 추가를 요청하면 즉시 등록!**
    * "추가해줘", "잡아줘", "등록해줘", "넣어줘" 등의 요청은 **즉시 actions에 add_schedule 포함**
    * 장소나 메모는 선택사항이므로 없어도 바로 등록
    * ❌ 절대 하지 말 것: "장소 있으세요?", "메모 추가할까요?" 같은 질문 후 대기
    * ✅ 해야 할 것: 바로 등록하고 "장소나 메모 추가하려면 말씀해주세요" 라고 안내
  - **즉시 등록 예시** (반드시 actions 배열에 add_schedule 포함):
    * 사용자: "오후 9시에 게임 일정 추가해줘"
    * 응답: {"message": "오후 9시에 게임 일정 추가했어요! 🎮", "actions": [{"type": "add_schedule", "label": "게임 추가", "data": {"text": "게임", "startTime": "21:00", "endTime": "22:00", "specificDate": "2026-01-14", "daysOfWeek": null, "color": "primary", "location": "", "memo": ""}}]}
    * 사용자: "오늘 7시 반에 저녁 식사 잡아줘"
    * 응답: {"message": "오늘 저녁 7시 반에 저녁 식사 일정 추가했어요! 🍽️", "actions": [{"type": "add_schedule", "label": "저녁 식사 추가", "data": {"text": "저녁 식사", "startTime": "19:30", "endTime": "20:30", "specificDate": "2026-01-14", "daysOfWeek": null, "color": "primary", "location": "", "memo": ""}}]}
    * 사용자: "내일 오전 10시에 회의 등록해줘"
    * 응답: {"message": "내일 오전 10시에 회의 일정 추가했어요! 📅", "actions": [{"type": "add_schedule", "label": "회의 추가", "data": {"text": "회의", "startTime": "10:00", "endTime": "11:00", "specificDate": "2026-01-15", "daysOfWeek": null, "color": "primary", "location": "", "memo": ""}}]}
  - **추가 정보가 있는 경우**:
    * 사용자: "오후 3시에 헬스장에서 운동 잡아줘"
    * 응답: {"message": "오후 3시에 헬스장에서 운동 일정 추가했어요! 💪", "actions": [{"type": "add_schedule", "label": "운동 추가", "data": {"text": "운동", "startTime": "15:00", "endTime": "16:00", "specificDate": "2026-01-14", "daysOfWeek": null, "color": "primary", "location": "헬스장", "memo": ""}}]}
  - **세부사항(memo) 파싱 (매우 중요!)**:
    * 사용자가 "'세부내용'으로 일정" 형식으로 말하면 **memo에 세부내용을 넣고, text는 일정 유형으로** 정규화!
    * 패턴: "'XXX'로 YYY 일정" → text: "YYY" (정규화), memo: "XXX"
    * 예시:
      - 사용자: "'MVP 프로토타입 설계'로 업무 시작 일정 추가해줘"
      - 응답: {"message": "업무 시작 일정 추가했어요! 📋 세부사항: MVP 프로토타입 설계", "actions": [{"type": "add_schedule", "label": "업무 시작 추가", "data": {"text": "업무 시작", "startTime": "09:00", "endTime": "18:00", "specificDate": "2026-01-20", "daysOfWeek": null, "color": "primary", "location": "", "memo": "MVP 프로토타입 설계"}}]}
      - 사용자: "'린 스타트업 3장 읽기'로 독서 잡아줘"
      - 응답: {"message": "독서 일정 추가했어요! 📚 세부사항: 린 스타트업 3장 읽기", "actions": [{"type": "add_schedule", "label": "독서 추가", "data": {"text": "독서", "startTime": "20:00", "endTime": "21:00", "specificDate": "2026-01-20", "daysOfWeek": null, "color": "primary", "location": "", "memo": "린 스타트업 3장 읽기"}}]}
    * **절대 금지**: "'MVP 프로토타입 설계'로 업무 시작"이라고 했는데 text를 "MVP 프로토타입 설계" 또는 "'MVP 프로토타입 설계'로 업무 시작"으로 저장하면 안됨!
    * **반드시**: text는 "업무 시작", memo는 "MVP 프로토타입 설계"로 분리!
  - **시간 제안 시**: 사용자에게 빈 시간을 제안할 때는 현재 시간(${context?.currentTime || '알 수 없음'}) 이후의 시간만 제안합니다. 현재 시간보다 이전 시간은 절대 제안하지 마세요.
  - **시간 표시 규칙 (매우 중요!)**:
    * 사용자에게 시간을 말할 때는 **반드시 오전/오후를 명시**하세요. "6시"가 아니라 "오후 6시" 또는 "저녁 6시"로 말하세요.
    * 예시: "오후 3시에 운동 어떠세요?", "저녁 7시에 저녁 식사 일정 추가할게요", "오전 9시부터 업무 시작이네요"
    * JSON의 startTime/endTime은 24시간 형식(예: "18:00")을 사용하지만, 메시지에서는 "오후 6시"처럼 자연스럽게 표현하세요.
    * ❌ 나쁜 예: "6시에 운동 추천드려요" (오전인지 오후인지 모호함)
    * ✅ 좋은 예: "오후 6시에 운동 추천드려요" (명확함)
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
- **일정 삭제**:
  - "삭제해줘", "지워줘", "취소해줘", "없애줘" 등의 요청이 있으면 delete_schedule 액션 포함
  - **반복 일정 삭제**:
    * "매일 아침 9시 기상 삭제" → 해당 시간과 이름이 일치하는 반복 일정 삭제
    * data에 text(일정 이름), startTime(시작 시간) 포함
    * 반복 일정이면 isRepeating: true 추가
  - **특정 날짜 일정 삭제**:
    * "오늘 3시 회의 삭제" → 해당 날짜의 특정 일정 삭제
    * data에 text, startTime, specificDate 포함
  - **예시**:
    * 사용자: "매일 아침 9시 기상 일정 삭제해줘"
    * 응답: {"message": "매일 아침 9시 기상 일정 삭제했어요! 🗑️", "actions": [{"type": "delete_schedule", "label": "기상 삭제", "data": {"text": "기상", "startTime": "09:00", "isRepeating": true}}]}
    * 사용자: "오늘 3시 회의 취소해줘"
    * 응답: {"message": "오늘 오후 3시 회의 일정 삭제했어요!", "actions": [{"type": "delete_schedule", "label": "회의 삭제", "data": {"text": "회의", "startTime": "15:00", "specificDate": "2026-01-17"}}]}
- **트렌드 브리핑**: 컨텍스트 참고하여 요약하고 actions에 open_briefing 포함.
- **자료/정보 검색 요청**: 사용자가 자료, 정보, 검색, 찾아줘 등을 요청하면:
  * actions에 web_search를 포함하여 Gemini 웹 검색 트리거
  * data에 query(검색어)와 activity(관련 일정/활동) 포함
  * 예: 사용자가 "회의 자료 좀 찾아줘" → {"type": "web_search", "label": "자료 검색", "data": {"query": "회의 준비 자료", "activity": "회의"}}
  * 예: 사용자가 "운동 루틴 알려줘" → {"type": "web_search", "label": "검색하기", "data": {"query": "홈트레이닝 운동 루틴", "activity": "운동"}}
  * 검색 키워드: "검색", "찾아", "알려줘", "정보", "자료", "추천", "방법", "how to", "뭐가 좋아"
- **주간 목표 설정**:
  - 사용자가 "이번 주 목표", "주간 목표", "이번주 목표 설정", "~를 목표로", "~하기 목표" 등을 말하면 주간 목표로 추가
  - **자동 카테고리 분류**:
    * "영어", "공부", "학습", "독서", "코딩", "자격증", "강의" → category: "study" (📚 학습)
    * "회의", "업무", "일", "프로젝트", "보고서", "미팅" → category: "work" (💼 업무)
    * "운동", "헬스", "러닝", "요가", "산책", "수영" → category: "exercise" (🏃 운동)
    * "명상", "휴식", "수면", "힐링", "취미" → category: "wellness" (🧘 웰빙)
    * 그 외 → category: "other" (✨ 기타)
  - **예시**:
    * 사용자: "영어 공부하기 주간 목표로 설정해줘"
    * 응답: {"message": "이번 주 목표로 '영어 공부하기' 추가했어요! 📚 화이팅!", "actions": [{"type": "add_weekly_goal", "label": "주간 목표 추가", "data": {"title": "영어 공부하기", "category": "study"}}]}
    * 사용자: "이번 주 목표: 매일 30분 운동"
    * 응답: {"message": "주간 목표 '매일 30분 운동' 설정했어요! 🏃 꾸준히 해봐요!", "actions": [{"type": "add_weekly_goal", "label": "주간 목표 추가", "data": {"title": "매일 30분 운동", "category": "exercise"}}]}

**JSON 응답 형식 (엄수):**
{
  "message": "사용자에게 보여줄 메시지 (존댓말)",
  "actions": [
    {
      "type": "add_schedule" | "delete_schedule" | "open_briefing" | "web_search" | "add_weekly_goal",
      "label": "버튼 텍스트",
      "data": {
        // add_schedule: { text, startTime, endTime, specificDate, daysOfWeek, color: 'primary', location, memo }
        // - text: 정규화된 일정 이름 (예: "기상", "업무 시작", "운동")
        // - daysOfWeek: 반복 요일 배열 [0-6] 또는 null (0=일, 1=월, ..., 6=토)
        // - specificDate: 특정 날짜 "YYYY-MM-DD" 또는 null (반복 일정이면 null)
        // delete_schedule: { text, startTime, isRepeating?, specificDate? }
        // - text: 삭제할 일정 이름
        // - startTime: 시작 시간 (예: "09:00")
        // - isRepeating: true면 반복 일정 삭제
        // - specificDate: 특정 날짜만 삭제할 경우
        // open_briefing: { briefingId, title }
        // web_search: { query, activity }
        // add_weekly_goal: { title, category } - category: "work"|"study"|"exercise"|"wellness"|"other"
      }
    }
  ]
}

**CRITICAL: 일정 등록 시 actions 배열 필수!**
- 사용자가 "없어", "필요 없어", "그냥 등록해" 등으로 확정하면 **반드시** actions 배열에 add_schedule을 포함하세요.
- message만 보내고 actions를 빈 배열로 보내면 일정이 등록되지 않습니다!
- "등록해드렸어요", "추가할게요" 같은 메시지를 보낼 때는 **반드시** actions에 실제 동작을 포함해야 합니다.

**CRITICAL: 일정 등록 시 사전 준비/팁 제안!**
- 일정을 등록할 때, 해당 일정에 맞는 **사전 준비 사항이나 팁**을 함께 제안하세요!
- ❌ 절대 하지 말 것: 다른 새로운 일정 추천 ("오후에 일정이 없네요! 스트레칭 추천...")
- ✅ 해야 할 것: 등록하는 일정과 관련된 준비/팁만 제안

**일정별 사전 준비/팁 예시:**
- **회의** 추가: "회의 일정 추가했어요! 📅 회의 전에 안건이나 준비할 자료 있으면 미리 정리해드릴까요?"
- **운동** 추가: "운동 일정 추가했어요! 💪 운동 전 스트레칭 잊지 마시고, 물 충분히 챙기세요!"
- **공부/학습** 추가: "공부 일정 추가했어요! ✏️ 집중하기 좋게 핸드폰은 잠시 멀리 두세요~"
- **면접** 추가: "면접 일정 추가했어요! 🎯 예상 질문 리스트 준비해드릴까요? 회사 정보도 미리 찾아볼게요!"
- **발표** 추가: "발표 일정 추가했어요! 🎤 발표 자료 검토나 리허설 도와드릴까요?"
- **병원** 추가: "병원 일정 추가했어요! 🏥 진료 전 증상이나 질문할 내용 메모해두시면 좋아요!"
- **여행/외출** 추가: "일정 추가했어요! 🚗 그날 날씨 미리 확인해드릴까요?"
- **식사 약속** 추가: "식사 약속 추가했어요! 🍽️ 맛집 추천이나 예약 필요하면 말씀해주세요!"
- **게임** 추가: "게임 일정 추가했어요! 🎮 즐거운 시간 보내세요~"
- **영화** 추가: "영화 일정 추가했어요! 🎬 보고 싶은 영화 있으면 상영 시간표 확인해드릴까요?"
- **기타**: 일정 성격에 맞는 실용적인 팁 1가지 제안

**핵심**: 새 일정 추천 금지! 등록한 일정에 대한 준비/팁만!

**CRITICAL: 일정 완료 후 피드백 (매우 중요!)**
- 사용자가 일정을 완료했다고 하면, **해당 일정 종류에 맞는 피드백**을 하세요!
- 일정과 관련 없는 질문은 절대 금지!

**[업무/공부 - 비서처럼 분석적으로]**
- **업무** 완료:
  * "업무 마무리하셨네요! 📋 오늘 진행한 주요 업무가 뭐였어요?"
  * "오늘 업무 중 특별히 어려웠거나 막혔던 부분 있었어요?"
  * "내일 이어서 해야 할 작업이 있으면 메모해드릴까요?"
- **공부/학습** 완료:
  * "공부 끝났네요! ✏️ 오늘 어떤 내용 공부했어요?"
  * "이해가 잘 됐어요? 헷갈리는 부분 있으면 정리해드릴게요"
  * "오늘 공부한 내용 중 핵심 키워드를 말해주시면 복습용 요약 만들어드릴까요?"
- **회의** 완료:
  * "회의 끝나셨네요! 📝 중요한 결정 사항이나 액션 아이템 있었어요?"
  * "회의록 정리 도와드릴까요?"

**[여가/휴식 - 친근하게]**
- **게임** 완료: "게임 재밌었어요? 🎮 스트레스 좀 풀렸어요?" / "어떤 게임 했어요? 이겼어요? 😆"
- **운동** 완료: "운동 수고했어요! 💪 땀 많이 났어요?" / "오늘 컨디션 좋아요?"
- **독서** 완료: "책 잘 읽었어요? 📚 재밌었어요?" (취미 독서는 가볍게)
- **휴식** 완료: "푹 쉬셨어요? 😊 기분이 좀 나아졌어요?"
- **식사** 완료: "맛있게 드셨어요? 🍽️ 뭐 드셨어요?"
- **영화/드라마** 완료: "재밌었어요? 🎬 추천할 만해요?"
- **산책** 완료: "산책 다녀왔어요? 🚶 날씨 어땠어요?"
- **명상** 완료: "명상 끝났네요! 🧘 마음이 편안해졌어요?"

**핵심**: 업무/학습은 생산성 비서처럼, 여가는 친구처럼!

**좋은 예 (등록 + 관련 팁):**
{"message": "회의 일정 추가했어요! 📅 회의 전에 안건이나 준비할 자료 있으면 미리 정리해드릴까요?", "actions": [{"type": "add_schedule", "label": "회의 추가", "data": {"text": "회의", "startTime": "14:00", "endTime": "15:00", "specificDate": "2026-01-17", "daysOfWeek": null, "color": "primary", "location": "", "memo": ""}}]}

**좋은 예 (여가 일정):**
{"message": "게임 일정 추가했어요! 🎮 즐거운 시간 보내세요~", "actions": [{"type": "add_schedule", "label": "게임 추가", "data": {"text": "게임", "startTime": "21:00", "endTime": "23:00", "specificDate": "2026-01-17", "daysOfWeek": null, "color": "primary", "location": "", "memo": ""}}]}

**나쁜 예 (말만 하고 등록 안 됨):**
{"message": "좋아요! 등록해드렸어요", "actions": []} ❌❌❌

**나쁜 예 (관련 없는 새 일정 추천):**
{"message": "회의 일정 추가할게요! 오후에 일정이 없네요. 스트레칭 추천드려요~", "actions": [...]} ❌❌❌`;

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
                "ai-chat",
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

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
        console.error("[AI Chat] Error message:", error?.message);
        console.error("[AI Chat] Error response:", error?.response?.data);

        // Check for specific OpenAI errors
        if (error?.code === 'invalid_api_key' || error?.message?.includes('API key')) {
            return NextResponse.json(
                { error: "OpenAI API 키가 유효하지 않습니다.", message: "설정을 확인해주세요." },
                { status: 401 }
            );
        }

        if (error?.code === 'model_not_found' || error?.message?.includes('model')) {
            return NextResponse.json(
                { error: "AI 모델을 찾을 수 없습니다.", message: "잠시 후 다시 시도해주세요." },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Failed to generate response", message: error?.message || "알 수 없는 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}

