import { NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface ChatAction {
    type:
        | "add_schedule"
        | "delete_schedule"
        | "update_schedule"      // 일정 수정
        | "open_link"
        | "open_curriculum"
        | "web_search"
        | "add_weekly_goal"
        | "open_briefing"
        | "show_goals"           // 목표 진행상황 조회
        | "show_habits"          // 습관 트래킹 조회
        | "show_analysis"        // 시간 분석/인사이트
        | "set_reminder"         // 리마인더 설정
        | "save_learning"        // 성장 기록 저장
        | "resolve_conflict";    // 일정 충돌 해결
    label: string;
    data: Record<string, any>;
}

// ============================================
// 서버 측 정규화 함수들 (LLM 의존 제거)
// ============================================

// 일정 이름 정규화 맵
const SCHEDULE_NAME_MAP: Record<string, string> = {
    // 식사
    "아침밥": "아침 식사", "아침": "아침 식사", "조식": "아침 식사", "breakfast": "아침 식사", "아침 먹기": "아침 식사",
    "점심밥": "점심 식사", "점심": "점심 식사", "중식": "점심 식사", "lunch": "점심 식사", "점심 먹기": "점심 식사",
    "저녁밥": "저녁 식사", "저녁": "저녁 식사", "석식": "저녁 식사", "dinner": "저녁 식사", "저녁 먹기": "저녁 식사",
    // 수면/기상
    "일어나": "기상", "일어나기": "기상", "깨어나": "기상", "일어나야지": "기상", "wake up": "기상",
    "자기": "취침", "잠자기": "취침", "잠": "취침", "자야지": "취침", "sleep": "취침", "잘 시간": "취침",
    // 업무
    "업무": "업무 시작", "업무 일정": "업무 시작", "일": "업무 시작", "work": "업무 시작", "출근": "업무 시작", "일 시작": "업무 시작", "업무 시작하기": "업무 시작", "수업 시작": "업무 시작",
    "업무 마무리": "업무 종료", "업무 끝": "업무 종료", "퇴근": "업무 종료", "일 끝": "업무 종료", "수업 끝": "업무 종료",
    // 운동
    "헬스": "운동", "요가": "운동", "필라테스": "운동", "러닝": "운동", "gym": "운동", "운동하기": "운동", "트레이닝": "운동",
    // 학습
    "책 읽기": "독서", "독서하기": "독서", "책": "독서", "reading": "독서",
    "공부": "공부", "학습": "공부", "study": "공부", "공부하기": "공부",
    "자기계발": "자기계발", "자기 계발": "자기계발", "개발": "자기계발", "성장": "자기계발",
    // 기타
    "쉬기": "휴식", "휴식": "휴식", "rest": "휴식", "쉬는 시간": "휴식",
    "여가": "여가", "취미": "여가", "여가 시간": "여가",
    "게임하기": "게임", "게임 하기": "게임", "게임 시간": "게임",
    "영화 보기": "영화", "영화 감상": "영화", "영화 시청": "영화",
    "드라마 보기": "드라마", "드라마 시청": "드라마",
};

// 일정 이름 정규화 함수
function normalizeScheduleName(text: string): string {
    const lowerText = text.toLowerCase().trim();
    // 정확히 일치하는 경우
    if (SCHEDULE_NAME_MAP[lowerText]) {
        return SCHEDULE_NAME_MAP[lowerText];
    }
    // 부분 일치 검색
    for (const [key, value] of Object.entries(SCHEDULE_NAME_MAP)) {
        if (lowerText.includes(key.toLowerCase())) {
            return value;
        }
    }
    return text; // 정규화 실패 시 원본 반환
}

// 반복 요일 파싱 함수 (향후 직접 파싱 시 사용)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseRepeatDays(text: string): number[] | null {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("매일") || lowerText.includes("every day") || lowerText.includes("일일")) {
        return [0, 1, 2, 3, 4, 5, 6];
    }
    if (lowerText.includes("평일") || lowerText.includes("weekday")) {
        return [1, 2, 3, 4, 5];
    }
    if (lowerText.includes("주말") || lowerText.includes("weekend")) {
        return [0, 6];
    }
    // 매주 특정 요일
    const dayMap: Record<string, number> = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };
    const weeklyMatch = text.match(/매주\s*([일월화수목금토]+)/);
    if (weeklyMatch) {
        const days = weeklyMatch[1].split("").map(d => dayMap[d]).filter(d => d !== undefined);
        return days.length > 0 ? days : null;
    }
    return null;
}

// 시간 검증 및 조정 함수 (과거 시간 방지)
function validateAndAdjustTime(suggestedTime: string, currentTime: string): string {
    const [suggestedHour, suggestedMinute] = suggestedTime.split(":").map(Number);
    const [currentHour, currentMinute] = currentTime.split(":").map(Number);

    const suggestedMinutes = suggestedHour * 60 + (suggestedMinute || 0);
    const currentMinutes = currentHour * 60 + currentMinute;

    // 제안 시간이 현재 시간 이전이면 30분 후로 조정
    if (suggestedMinutes < currentMinutes) {
        const adjustedMinutes = currentMinutes + 30;
        const adjustedHour = Math.floor(adjustedMinutes / 60);
        const adjustedMinute = adjustedMinutes % 60;

        if (adjustedHour < 23) {
            return `${String(adjustedHour).padStart(2, "0")}:${String(adjustedMinute).padStart(2, "0")}`;
        }
        return ""; // 너무 늦으면 빈 문자열 반환 (필터링용)
    }
    return suggestedTime;
}

// 메모 파싱 함수 ('세부내용'으로 일정 → text: 일정, memo: 세부내용) (향후 직접 파싱 시 사용)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseScheduleWithMemo(input: string): { text: string; memo: string } {
    // 패턴: '세부내용'으로 일정유형 or '세부내용'로 일정유형
    const memoPattern = /['']([^'']+)[''](?:으?로|로)\s*(.+?)(?:\s*일정)?(?:\s*추가|등록|잡아)?/;
    const match = input.match(memoPattern);

    if (match) {
        const memo = match[1].trim();
        let scheduleType = match[2].trim();
        // 일정 유형도 정규화
        scheduleType = normalizeScheduleName(scheduleType);
        return { text: scheduleType, memo };
    }

    return { text: input, memo: "" };
}

// 액션 후처리 함수 (LLM 응답을 정규화)
function postProcessActions(actions: ChatAction[], currentTime: string): ChatAction[] {
    return actions.map(action => {
        if (action.type === "add_schedule" && action.data) {
            // 일정 이름 정규화
            if (action.data.text) {
                action.data.text = normalizeScheduleName(action.data.text);
            }
            // 시간 검증
            if (action.data.startTime && currentTime) {
                const adjusted = validateAndAdjustTime(action.data.startTime, currentTime);
                if (adjusted === "") {
                    console.log(`[AI Chat] Filtered out past time action: ${action.data.startTime}`);
                    return null;
                }
                if (adjusted !== action.data.startTime) {
                    console.log(`[AI Chat] Adjusted time: ${action.data.startTime} -> ${adjusted}`);
                    action.data.startTime = adjusted;
                }
            }
        }
        return action;
    }).filter(Boolean) as ChatAction[];
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

🚨 **시간 관련 규칙**:
- 현재 시간은 ${context.currentTime} (${timeOfDayKorean} ${currentHour}시)입니다.
- **오늘** 일정: 현재 시간(${currentHour}시) 이후만 추천 가능
- **내일/미래 날짜** 일정: 시간 제약 없음! 오전/오후/저녁 모두 가능
- 예: "내일 오후 1시 점심" → 13:00에 등록 OK (미래 날짜이므로)
- 예: "오늘 저녁" (현재 ${currentHour}시) → ${currentHour}시 이후만 가능

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

        // ============================================
        // 최적화된 시스템 프롬프트 (토큰 절약)
        // ============================================
        const systemPrompt = `# Fi.eri AI Assistant

## Context
${currentDateContext}
${userContext}
${scheduleContext}
${eventLogsContext}
${ragContext}
${trendContext}
${pendingScheduleContext}

## Response Style
${userPlan === "Max" ? `**자비스 모드**: 실행 중심. "~반영했습니다" 완료형. 간결하게 2-3문장. 이모지 최소화. 데이터/수치 포함.` : `**친구 모드**: "~할게요" 자연스럽게. 2-3문장. 이모지 1-2개로 친근하게.`}

## Core Rules
1. **즉시 실행**: "추가해줘/잡아줘/등록해줘" → 바로 actions에 포함. 질문 금지.
2. **휴식 존중**: 여가 일정(게임/영화/운동) 앞에서 생산성 조언 금지.
3. **시간 제약**: 오늘 일정만 현재 시간 이후 제한. 내일/미래는 시간 제약 없음!

## Action Schema (TypeScript)
\`\`\`typescript
interface Response {
  message: string;  // 사용자에게 보여줄 메시지
  actions: Action[];
}

type Action =
  | { type: "add_schedule"; label: string; data: AddScheduleData }
  | { type: "delete_schedule"; label: string; data: DeleteScheduleData }
  | { type: "update_schedule"; label: string; data: UpdateScheduleData }
  | { type: "open_briefing"; label: string; data: { briefingId: number; title: string } }
  | { type: "web_search"; label: string; data: { query: string; activity: string } }
  | { type: "add_weekly_goal"; label: string; data: { title: string; category: "work"|"study"|"exercise"|"wellness"|"other" } }
  | { type: "show_goals"; label: string; data: { goalType?: "weekly"|"monthly"|"yearly"|"all" } }
  | { type: "show_habits"; label: string; data: { period?: "week"|"month" } }
  | { type: "show_analysis"; label: string; data: { analysisType: "time_distribution"|"productivity"|"sleep"|"exercise"|"all" } }
  | { type: "set_reminder"; label: string; data: SetReminderData }
  | { type: "save_learning"; label: string; data: SaveLearningData }
  | { type: "resolve_conflict"; label: string; data: { scheduleIds: string[]; suggestion: string } };

interface AddScheduleData {
  text: string;           // 일정 이름 (서버에서 정규화됨)
  startTime: string;      // "HH:MM" 24시간
  endTime: string;        // "HH:MM" 24시간
  specificDate: string | null;  // "YYYY-MM-DD" 또는 null
  daysOfWeek: number[] | null;  // [0-6] 반복 또는 null
  color: "primary";
  location: string;
  memo: string;
}

interface DeleteScheduleData {
  text: string;
  startTime: string;
  isRepeating?: boolean;
  specificDate?: string;
}

interface UpdateScheduleData {
  scheduleId?: string;    // 수정할 일정 ID (있으면 직접 수정)
  originalText: string;   // 기존 일정 이름
  originalTime: string;   // 기존 시작 시간
  newText?: string;       // 새 일정 이름
  newStartTime?: string;  // 새 시작 시간
  newEndTime?: string;    // 새 종료 시간
  newLocation?: string;   // 새 장소
  newMemo?: string;       // 새 메모
}

interface SetReminderData {
  targetTime: string;     // 알림 시간 "HH:MM"
  message: string;        // 알림 메시지
  relatedSchedule?: string; // 관련 일정 이름 (선택)
}

interface SaveLearningData {
  content: string;        // 배운 내용/성장 기록
  category: "insight"|"skill"|"reflection"|"goal_progress";
  relatedGoal?: string;   // 관련 목표 (선택)
}
\`\`\`

## Key Behaviors
- **일정 추가**: 즉시 등록 + 관련 팁 1가지만 (새 일정 추천 금지)
- **일정 이름**: 정규화된 이름 사용 (아침/점심/저녁→"아침 식사"/"점심 식사"/"저녁 식사", 잠→"취침", 일어나→"기상", 헬스→"운동")
- **메모 패턴**: "'세부내용'으로 일정" → text: "일정유형", memo: "세부내용"
- **반복 일정**: 매일=[0-6], 평일=[1-5], 주말=[0,6], 매주 월수금=[1,3,5]
- **시간 표시**: 메시지에서 "오전/오후" 명시 (6시 X → 오후 6시 O)
- **일정 완료**: 업무/학습은 분석적("뭐 했어요?"), 여가는 친근하게("재밌었어요?")
- **팁 예시**: 회의→안건 정리, 운동→스트레칭, 면접→예상 질문, 게임/영화→"즐거운 시간 보내세요"
- **삭제**: delete_schedule에 text, startTime 필수. 반복이면 isRepeating:true
- **브리핑**: open_briefing에 briefingId 필수
- **검색**: "찾아줘/알려줘" → web_search
- **일정 수정**: "바꿔줘/변경해줘/수정해줘" → update_schedule (originalText, originalTime 필수)
- **목표 조회**: "목표 보여줘/진행상황 어때" → show_goals
- **습관 조회**: "습관 보여줘/얼마나 했어" → show_habits
- **시간 분석**: "시간 분석해줘/어떻게 보냈어" → show_analysis
- **리마인더**: "알려줘/잊지 않게 해줘" → set_reminder
- **성장 기록**: "오늘 배운 거/깨달은 점 저장" → save_learning

## Examples
**1. 일정 추가 (장소 포함)**
User: "오후 3시에 헬스장에서 운동 잡아줘"
\`\`\`json
{"message": "${userPlan === "Max" ? "15:00 헬스장 운동 반영. 스트레칭 권장." : "오후 3시에 운동 일정 추가했어요! 💪 스트레칭 잊지 마세요~"}", "actions": [{"type": "add_schedule", "label": "운동 추가", "data": {"text": "운동", "startTime": "15:00", "endTime": "16:00", "specificDate": "${context?.currentDate || new Date().toISOString().split('T')[0]}", "daysOfWeek": null, "color": "primary", "location": "헬스장", "memo": ""}}]}
\`\`\`

**2. 식사 일정 (정규화 필수)**
User: "저녁 7시에 저녁 잡아줘"
\`\`\`json
{"message": "${userPlan === "Max" ? "19:00 저녁 식사 반영." : "저녁 7시에 저녁 식사 일정 추가했어요! 🍽️"}", "actions": [{"type": "add_schedule", "label": "저녁 식사", "data": {"text": "저녁 식사", "startTime": "19:00", "endTime": "20:00", "specificDate": "${context?.currentDate || new Date().toISOString().split('T')[0]}", "daysOfWeek": null, "color": "primary", "location": "", "memo": ""}}]}
\`\`\`

**3. 일정 삭제**
User: "매일 아침 9시 기상 삭제해줘"
\`\`\`json
{"message": "${userPlan === "Max" ? "매일 09:00 기상 일정 삭제 처리." : "매일 아침 9시 기상 일정 삭제했어요! 🗑️"}", "actions": [{"type": "delete_schedule", "label": "기상 삭제", "data": {"text": "기상", "startTime": "09:00", "isRepeating": true}}]}
\`\`\`

**CRITICAL**: 말만 하고 actions 빈 배열 = 실패. 반드시 actions에 실제 동작 포함!`;

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

            // 서버 측 후처리: 일정 이름 정규화, 시간 검증
            const currentTime = context?.currentTime || new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            const processedActions = postProcessActions(parsed.actions || [], currentTime);

            console.log('[AI Chat] Processed Actions:', processedActions.length);

            return NextResponse.json({
                message: parsed.message || "응답을 처리하지 못했습니다.",
                actions: processedActions,
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

