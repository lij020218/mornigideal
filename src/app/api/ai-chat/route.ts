import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import {
    classifyIntent,
    getActionSchemaForIntent,
    postProcessActions,
    assembleContextBlocks,
    buildSystemPrompt,
    getRequiredDataSources,
} from "@/lib/chat-utils";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { PLAN_CONFIGS, type PlanType } from "@/types/jarvis";
import { ReActBrain, isComplexRequest, isSimpleResponse } from "@/lib/jarvis/brain-react";
import { getFusedContextForAI } from "@/lib/contextFusionService";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MODELS } from "@/lib/models";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// 데이터 페칭 함수들 (Lazy Loading용)
// ============================================

async function fetchEventLogs(userEmail: string): Promise<string> {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: events, error } = await supabaseAdmin
            .from('event_logs')
            .select('*')
            .eq('user_email', userEmail)
            .gte('occurred_at', sevenDaysAgo.toISOString())
            .order('occurred_at', { ascending: false })
            .limit(50);

        if (error || !events || events.length === 0) return "";

        const completedSchedules = events.filter(e => e.event_type === 'schedule_completed');
        const missedSchedules = events.filter(e => e.event_type === 'schedule_missed');
        const skippedSchedules = events.filter(e => e.event_type === 'schedule_snoozed');

        const totalScheduleEvents = completedSchedules.length + missedSchedules.length + skippedSchedules.length;
        const completionRate = totalScheduleEvents > 0
            ? Math.round((completedSchedules.length / totalScheduleEvents) * 100)
            : 0;

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

        const exerciseEvents = events.filter(e =>
            e.event_type === 'schedule_completed' &&
            (e.payload?.scheduleText?.includes('운동') || e.payload?.scheduleText?.includes('헬스'))
        );

        const learningEvents = events.filter(e =>
            e.event_type === 'schedule_completed' &&
            (e.payload?.scheduleText?.includes('학습') || e.payload?.scheduleText?.includes('공부'))
        );

        return `
🧠 **사용자 행동 패턴 분석 (최근 7일):**

📊 일정 완료율: ${completionRate}%
- 완료: ${completedSchedules.length}개
- 놓침: ${missedSchedules.length}개
- 미루기: ${skippedSchedules.length}개

${avgSleepTime ? `😴 수면 패턴:
- 평균 취침 시간: 약 ${Math.round(avgSleepTime)}시
- 최근 ${sleepEvents.length}회 취침 기록
` : ''}

${exerciseEvents.length > 0 ? `💪 운동 패턴:
- 최근 7일간 ${exerciseEvents.length}회 운동 완료
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
    } catch (e) {
        console.error("[AI Chat] Failed to get event logs:", e);
        return "";
    }
}

async function fetchRagContext(messages: any[], userEmail: string): Promise<string> {
    try {
        const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
        if (!lastUserMessage?.content) return "";

        const query = lastUserMessage.content;

        const { data: userData } = await supabaseAdmin
            .from("users")
            .select("id, plan")
            .eq("email", userEmail)
            .maybeSingle();

        if (!userData) return "";

        const { generateEmbedding } = await import("@/lib/embeddings");
        const { embedding: queryEmbedding } = await generateEmbedding(query);

        const userPlan = userData.plan || "Free";
        const planThresholds: Record<string, { threshold: number; limit: number }> = {
            Free: { threshold: 0.8, limit: 3 },
            Standard: { threshold: 0.8, limit: 3 },
            Pro: { threshold: 0.75, limit: 5 },
            Max: { threshold: 0.7, limit: 10 },
        };
        const { threshold, limit } = planThresholds[userPlan] || planThresholds.Free;

        const { data: memories, error } = await supabaseAdmin.rpc(
            'search_similar_memories',
            {
                query_embedding: JSON.stringify(queryEmbedding),
                match_user_id: userData.id,
                match_threshold: threshold,
                match_count: limit,
            }
        );

        if (error || !memories || memories.length === 0) return "";


        return `
🧠 **과거 대화 컨텍스트 (RAG):**

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
    } catch (e) {
        console.error("[AI Chat] Failed to retrieve RAG context:", e);
        return "";
    }
}

// ============================================
// 사용자 프로필 + 일정 컨텍스트 빌드
// ============================================

async function buildUserAndScheduleContext(userEmail: string, context: any): Promise<{
    userContext: string;
    scheduleContext: string;
    userPlan: string;
    profile: any;
}> {
    try {
        const { getUserByEmail } = await import("@/lib/users");
        const user = await getUserByEmail(userEmail);
        const userPlan = user?.profile?.plan || "Free";

        if (!user?.profile) {
            return { userContext: "", scheduleContext: "", userPlan, profile: null };
        }

        const p = user.profile;

        const interestMap: Record<string, string> = {
            ai: "AI/인공지능", startup: "스타트업/창업", marketing: "마케팅/브랜딩",
            development: "개발/프로그래밍", design: "디자인/UX", finance: "재테크/투자",
            selfdev: "자기계발", health: "건강/운동",
        };

        const experienceMap: Record<string, string> = {
            student: "학생/취준생", junior: "1-3년차 (주니어)", mid: "4-7년차 (미들)",
            senior: "8년차 이상 (시니어)", beginner: "입문자", intermediate: "중급자",
        };

        const interestLabels = (p.interests || []).map((i: string) => interestMap[i] || i);
        const experienceLabel = experienceMap[p.experience || p.level || ""] || p.experience || p.level || "미설정";

        // 장기 목표
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

        const userContext = `
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

        // 일정 컨텍스트
        let scheduleContext = "";

        if (context?.schedules && context.schedules.length > 0) {
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

        // 내일/모레 일정
        if (p.customGoals && p.customGoals.length > 0) {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dayAfterTomorrow = new Date(today);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            const tomorrowDayOfWeek = tomorrow.getDay();
            const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];
            const dayAfterTomorrowDayOfWeek = dayAfterTomorrow.getDay();

            const tomorrowGoals = p.customGoals.filter((g: any) => {
                if (g.specificDate === tomorrowStr) return true;
                if (g.daysOfWeek?.includes(tomorrowDayOfWeek)) {
                    if (g.startDate && tomorrowStr < g.startDate) return false;
                    return true;
                }
                return false;
            });

            const dayAfterTomorrowGoals = p.customGoals.filter((g: any) => {
                if (g.specificDate === dayAfterTomorrowStr) return true;
                if (g.daysOfWeek?.includes(dayAfterTomorrowDayOfWeek)) {
                    if (g.startDate && dayAfterTomorrowStr < g.startDate) return false;
                    return true;
                }
                return false;
            });

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

        return { userContext, scheduleContext, userPlan, profile: p };
    } catch (e) {
        console.error("[AI Chat] Failed to get user context:", e);
        return { userContext: "", scheduleContext: "", userPlan: "Free", profile: null };
    }
}

// ============================================
// 트렌드 & 펜딩 컨텍스트 빌드 (순수 함수)
// ============================================

function buildTrendContext(context: any): string {
    if (!context?.trendBriefings || !Array.isArray(context.trendBriefings)) return "";
    const briefings = context.trendBriefings;
    if (briefings.length === 0) return "";

    return `
📰 오늘의 트렌드 브리핑 정보:
- 총 브리핑 수: ${briefings.length}개

브리핑 목록:
${briefings.map((t: any, i: number) => `${i + 1}. ID: "${t.id}" | [${t.category || '일반'}] ${t.title || t.name || '제목 없음'}`).join('\n')}

**중요**: 사용자가 브리핑을 추천/열기 요청 시, 반드시 위 목록에 있는 브리핑만 추천하세요. 목록에 없는 브리핑을 만들어내지 마세요.
actions에 open_briefing을 포함할 때 briefingId는 위 목록의 ID 문자열을 그대로 복사하세요.
예: actions: [{ "type": "open_briefing", "label": "브리핑 보기", "data": { "briefingId": "${briefings[0]?.id || ''}", "title": "${briefings[0]?.title || ''}" } }]
`;
}

function buildPendingScheduleContext(context: any): string {
    if (!context?.pendingSchedule) return "";
    const ps = context.pendingSchedule;

    return `
사용자가 추가하려는 일정:
- 제목: ${ps.title}
- 설명: ${ps.description || '없음'}
- 예상 시간: ${ps.estimatedTime}
- 카테고리: ${ps.category}

사용자가 이 일정을 추가하고 싶어합니다. 어느 시간대에 추가할지 물어보세요.
오늘의 일정을 참고하여 비어있는 시간대를 제안하고, 사용자의 선택을 받으세요.
`;
}

function buildDateContext(context: any): string {
    const now = new Date();

    if (context?.currentDate && context?.currentTime) {
        const [year, month, day] = context.currentDate.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const weekdayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const weekday = weekdayNames[dateObj.getDay()];

        const [currentHour] = context.currentTime.split(':').map(Number);
        const timeOfDayKorean = currentHour < 12 ? '오전' : currentHour < 18 ? '오후' : '저녁';

        return `
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
    }

    return `
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
// POST 핸들러 (흐름 제어만 담당)
// ============================================

export async function POST(request: NextRequest) {
    try {
        // 1. 인증
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. 요청 파싱
        const { messages, context } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Messages are required" }, { status: 400 });
        }

        // 3. 의도 분류 (먼저!)
        const intent = classifyIntent(messages);

        // 4. 사용자 프로필 + 일정 (항상 필요)
        const { userContext, scheduleContext, userPlan, profile } = await buildUserAndScheduleContext(userEmail, context);


        // 4.5. ReAct 에이전트 분기 (Pro/Max + 복합 요청)
        const planConfig = PLAN_CONFIGS[userPlan as PlanType];
        const shouldUseReAct = planConfig?.features.reactLoop
            && !isSimpleResponse(messages)
            && (intent !== 'chat' || isComplexRequest(messages));

        if (shouldUseReAct) {
            try {
                const reactBrain = new ReActBrain(userEmail, userPlan as PlanType);
                const result = await reactBrain.run({
                    messages,
                    userEmail,
                    userPlan: userPlan as PlanType,
                    profile,
                    context: {
                        currentDate: context?.currentDate || new Date().toISOString().split('T')[0],
                        currentTime: context?.currentTime || new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        scheduleContext: scheduleContext || undefined,
                        userContext: userContext || undefined,
                    },
                });

                // ReAct 사용량 기록 (LLM 호출 수만큼)
                if (result.totalLlmCalls > 0) {
                    await logOpenAIUsage(userEmail, 'react-agent', 'ai-chat-react', 0, 0);
                }


                return NextResponse.json({
                    message: result.message,
                    actions: result.actions,
                });
            } catch (reactError) {
                console.error('[AI Chat] ReAct failed, falling back to single-shot:', reactError);
                // 폴백: 아래 기존 GPT 단발 경로로 진행
            }
        }

        // 5. 의도별 필요한 데이터만 조회 (Lazy Loading)
        const dataSources = getRequiredDataSources(intent, userPlan);

        const asyncFetches: Promise<void>[] = [];
        let eventLogsContext = "";
        let ragContext = "";
        let fusedContextStr = "";

        if (dataSources.needsEventLogs) {
            asyncFetches.push(
                fetchEventLogs(userEmail).then(result => { eventLogsContext = result; })
            );
        }

        if (dataSources.needsRag) {
            asyncFetches.push(
                fetchRagContext(messages, userEmail).then(result => { ragContext = result; })
            );
        }

        // Pro/Max: 컨텍스트 융합 엔진
        if (userPlan === 'Pro' || userPlan === 'Max') {
            asyncFetches.push(
                getFusedContextForAI(userEmail).then(result => { fusedContextStr = result; })
            );
        }

        // 병렬 실행
        await Promise.all(asyncFetches);

        // 6. 나머지 컨텍스트 (순수 함수, DB 호출 없음)
        const currentDateContext = buildDateContext(context);
        const trendContext = dataSources.needsTrend ? buildTrendContext(context) : "";
        const pendingScheduleContext = buildPendingScheduleContext(context);
        const locationContext = context?.location
            ? `📍 사용자 현재 위치: ${context.location.city || `${context.location.latitude}, ${context.location.longitude}`}`
            : "";

        // 성장 탭 데이터 컨텍스트 (클라이언트에서 전달받음)
        let goalsContext = "";
        if (context?.goals && Array.isArray(context.goals) && context.goals.length > 0) {
            const goalTypeMap: Record<string, string> = {
                weekly: '주간',
                monthly: '월간',
                yearly: '연간'
            };
            goalsContext = `
🎯 **사용자의 장기 목표:**
${context.goals.map((g: any) => `- [${goalTypeMap[g.type] || g.type}] ${g.title}${g.category ? ` (${g.category})` : ''} - 진행률 ${g.progress || 0}%`).join('\n')}

목표와 관련된 질문이나 일정 요청 시 이 정보를 참고하세요.
`;
        }

        let learningContext = "";
        if (context?.learningCurriculums && Array.isArray(context.learningCurriculums) && context.learningCurriculums.length > 0) {
            learningContext = `
📚 **사용자의 학습 커리큘럼:**
${context.learningCurriculums.map((c: any) => `- ${c.title}${c.currentModule ? ` (현재: ${c.currentModule})` : ''} - 진행률 ${c.progress || 0}%`).join('\n')}

학습 관련 질문이나 진행 상황 문의 시 이 정보를 참고하세요.
`;
        }

        // 7. 프롬프트 조립
        const currentDate = context?.currentDate || new Date().toISOString().split('T')[0];
        const actionSchema = getActionSchemaForIntent(intent, userPlan, context);

        const contextBlocks = assembleContextBlocks({
            intent,
            currentDateContext,
            userContext,
            scheduleContext,
            eventLogsContext,
            ragContext,
            trendContext,
            pendingScheduleContext,
            locationContext,
            goalsContext,
            learningContext,
        });

        // Pro/Max: 컨텍스트 융합 인사이트 추가
        if (fusedContextStr) {
            contextBlocks.push(fusedContextStr);
        }

        const systemPrompt = buildSystemPrompt({
            intent,
            userPlan,
            contextBlocks,
            actionSchema,
            currentDate,
            personaStyle: profile?.personaStyle,
        });

        // 8. LLM 호출
        const modelName = MODELS.GPT_5_MINI;
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: systemPrompt },
                ...messages.slice(-10),
            ],
            temperature: 1.0,
            max_completion_tokens: 4096,
            response_format: { type: "json_object" },
        });

        const finishReason = completion.choices[0]?.finish_reason;
        const responseContent = completion.choices[0]?.message?.content || '{"message": "죄송합니다. 응답을 생성하지 못했습니다."}';

        // 9. 사용량 로깅
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(userEmail, modelName, "ai-chat", usage.prompt_tokens, usage.completion_tokens);
        }

        if (finishReason === 'length') {
        }

        // 10. 응답 파싱 + 후처리
        try {
            const parsed = JSON.parse(responseContent);

            const currentTime = context?.currentTime || new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            const { actions: processedActions, conflictWarning, focusSuggestion } = postProcessActions(parsed.actions || [], currentTime);


            return NextResponse.json({
                message: parsed.message || "응답을 처리하지 못했습니다.",
                actions: processedActions,
                ...(conflictWarning && { conflictWarning }),
                ...(focusSuggestion && { focusSuggestion }),
            });
        } catch (e) {
            console.error('[AI Chat] JSON parse error:', e);
            // JSON이 잘린 경우 message 필드만 추출 시도
            const messageMatch = responseContent.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const extractedMessage = messageMatch ? messageMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : "죄송합니다. 응답 처리 중 오류가 발생했어요.";
            // actions도 부분 추출 시도
            let extractedActions: any[] = [];
            try {
                const actionsMatch = responseContent.match(/"actions"\s*:\s*(\[[\s\S]*?\])/);
                if (actionsMatch) extractedActions = JSON.parse(actionsMatch[1]);
            } catch { /* actions 추출 실패 — 무시 */ }
            return NextResponse.json({
                message: extractedMessage,
                actions: extractedActions,
            });
        }
    } catch (error: any) {
        console.error("[AI Chat] Error:", error);
        console.error("[AI Chat] Error message:", error?.message);
        console.error("[AI Chat] Error response:", error?.response?.data);

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
            { error: "Failed to generate response", message: "알 수 없는 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
