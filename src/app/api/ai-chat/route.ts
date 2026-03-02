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
import { withAuth } from "@/lib/api-handler";
import { PLAN_CONFIGS, type PlanType } from "@/types/jarvis";
import { ReActBrain, isComplexRequest, isSimpleResponse, getRequestComplexity } from "@/lib/jarvis/brain-react";
import { getFusedContextForAI } from "@/lib/contextFusionService";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MODELS } from "@/lib/models";
import { aiChatSchema, validateBody } from '@/lib/schemas';
import { LIMITS } from '@/lib/constants';
import type { ChatMessage, ChatContext, UserProfile } from '@/lib/types';
import type { CustomGoal, LongTermGoal } from '@/lib/types';
import type { MemoryRow } from '@/lib/types';
import { compressMessages } from '@/lib/context-summarizer';
import { getUserByEmail } from '@/lib/users';
import { getPlanName } from '@/lib/user-plan';
import { generateEmbedding } from '@/lib/embeddings';
import { logger } from '@/lib/logger';
import { kvGet, kvSet } from '@/lib/kv-store';
import { checkContentSafety, checkResponseSafety } from '@/lib/content-safety';

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
            .limit(LIMITS.EVENT_LOGS);

        if (error || !events || events.length === 0) return "";

        // 단일 패스로 모든 분류 수행 (O(n) × 1 instead of O(n) × 7)
        let completedCount = 0, missedCount = 0, skippedCount = 0;
        let sleepHourSum = 0, sleepCount = 0;
        let exerciseCount = 0, learningCount = 0;

        for (const e of events) {
            switch (e.event_type) {
                case 'schedule_completed': {
                    completedCount++;
                    const text = e.payload?.scheduleText || '';
                    if (text.includes('취침')) {
                        const time = e.payload?.startTime || '23:00';
                        sleepHourSum += parseInt(time.split(':')[0]);
                        sleepCount++;
                    }
                    if (text.includes('운동') || text.includes('헬스')) exerciseCount++;
                    if (text.includes('학습') || text.includes('공부')) learningCount++;
                    break;
                }
                case 'schedule_missed':
                    missedCount++;
                    break;
                case 'schedule_snoozed':
                    skippedCount++;
                    break;
            }
        }

        const totalScheduleEvents = completedCount + missedCount + skippedCount;
        const completionRate = totalScheduleEvents > 0
            ? Math.round((completedCount / totalScheduleEvents) * 100)
            : 0;
        const avgSleepTime = sleepCount > 0 ? sleepHourSum / sleepCount : null;

        return `
🧠 **사용자 행동 패턴 분석 (최근 7일):**

📊 일정 완료율: ${completionRate}%
- 완료: ${completedCount}개
- 놓침: ${missedCount}개
- 미루기: ${skippedCount}개

${avgSleepTime ? `😴 수면 패턴:
- 평균 취침 시간: 약 ${Math.round(avgSleepTime)}시
- 최근 ${sleepCount}회 취침 기록
` : ''}

${exerciseCount > 0 ? `💪 운동 패턴:
- 최근 7일간 ${exerciseCount}회 운동 완료
` : ''}

${learningCount > 0 ? `📚 학습 패턴:
- 최근 7일간 ${learningCount}회 학습 완료
` : ''}
`;
    } catch (e) {
        logger.error("[AI Chat] Failed to get event logs:", e);
        return "";
    }
}

async function fetchRagContext(messages: ChatMessage[], userEmail: string, userId?: string, userPlan?: string): Promise<string> {
    try {
        const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
        if (!lastUserMessage?.content) return "";

        const query = lastUserMessage.content;

        // userId가 없으면 DB 조회 (폴백)
        let resolvedUserId = userId;
        const resolvedPlan = userPlan || "Free";
        if (!resolvedUserId) {
            const { data: userData } = await supabaseAdmin
                .from("users")
                .select("id")
                .eq("email", userEmail)
                .maybeSingle();
            if (!userData) return "";
            resolvedUserId = userData.id;
        }

        const { embedding: queryEmbedding } = await generateEmbedding(query);
        const planThresholds: Record<string, { threshold: number; limit: number }> = {
            Free: { threshold: 0.8, limit: 3 },
            Standard: { threshold: 0.8, limit: 3 },
            Pro: { threshold: 0.75, limit: 5 },
            Max: { threshold: 0.7, limit: 10 },
        };
        const { threshold, limit } = planThresholds[resolvedPlan] || planThresholds.Free;

        const { data: memories, error } = await supabaseAdmin.rpc(
            'search_similar_memories',
            {
                query_embedding: JSON.stringify(queryEmbedding),
                match_user_id: resolvedUserId,
                match_threshold: threshold,
                match_count: limit,
            }
        );

        if (error || !memories || memories.length === 0) return "";


        return `
🧠 **과거 대화 컨텍스트 (RAG):**

다음은 사용자의 과거 대화/일정/목표에서 현재 질문과 유사한 내용입니다:

${memories.map((m: MemoryRow, idx: number) => `
${idx + 1}. [${m.content_type}] (유사도: ${Math.round((m.similarity ?? 0) * 100)}%)
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
        logger.error("[AI Chat] Failed to retrieve RAG context:", e);
        return "";
    }
}

// ============================================
// 사용자 일정 패턴 분석 컨텍스트 (추천 시 활용)
// ============================================

async function fetchSchedulePatternContext(userEmail: string, preloadedProfile?: UserProfile | null): Promise<string> {
    try {
        let customGoals: CustomGoal[];
        if (preloadedProfile?.customGoals) {
            customGoals = preloadedProfile.customGoals;
        } else {
            const { data: userData } = await supabaseAdmin
                .from('users')
                .select('profile')
                .eq('email', userEmail)
                .maybeSingle();
            if (!userData?.profile?.customGoals) return "";
            customGoals = userData.profile.customGoals;
        }
        if (customGoals.length < 5) return ""; // 데이터 부족

        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];

        const recentGoals = customGoals.filter((g) =>
            g.specificDate && g.specificDate >= fourWeeksAgoStr
        );
        if (recentGoals.length < 3) return "";

        // 카테고리별 활동 분류
        const categories: Record<string, { items: string[]; times: string[]; days: Set<number>; completedCount: number; totalCount: number }> = {
            rest: { items: [], times: [], days: new Set(), completedCount: 0, totalCount: 0 },
            exercise: { items: [], times: [], days: new Set(), completedCount: 0, totalCount: 0 },
            meal: { items: [], times: [], days: new Set(), completedCount: 0, totalCount: 0 },
            study: { items: [], times: [], days: new Set(), completedCount: 0, totalCount: 0 },
            leisure: { items: [], times: [], days: new Set(), completedCount: 0, totalCount: 0 },
            work: { items: [], times: [], days: new Set(), completedCount: 0, totalCount: 0 },
            social: { items: [], times: [], days: new Set(), completedCount: 0, totalCount: 0 },
        };

        const categoryKeywords: Record<string, string[]> = {
            rest: ['휴식', '쉬기', '낮잠', '명상', '산책', '스트레칭', '수면', '취침', '잠'],
            exercise: ['운동', '헬스', '요가', '필라테스', '러닝', '조깅', '수영', '웨이트', '등산', '자전거', '탁구', '배드민턴', '테니스', '축구', '농구'],
            meal: ['식사', '아침', '점심', '저녁', '밥', '브런치', '간식', '카페'],
            study: ['공부', '학습', '독서', '책', '강의', '스터디', '과제', '시험', '자격증', '영어', '코딩'],
            leisure: ['게임', '영화', '드라마', '유튜브', '음악', '넷플릭스', '취미', '그림', '사진', '글쓰기', '그리기'],
            work: ['업무', '회의', '미팅', '프로젝트', '개발', '기획', '보고서', '출근', '퇴근', '작업'],
            social: ['친구', '모임', '약속', '데이트', '가족', '만남', '전화'],
        };

        for (const goal of recentGoals) {
            const text = (goal.text || '').toLowerCase();
            const dayOfWeek = goal.specificDate ? new Date(goal.specificDate + 'T12:00:00').getDay() : null;

            for (const [cat, keywords] of Object.entries(categoryKeywords)) {
                if (keywords.some(kw => text.includes(kw))) {
                    const catData = categories[cat];
                    if (!catData.items.includes(goal.text)) {
                        catData.items.push(goal.text);
                    }
                    if (goal.startTime) catData.times.push(goal.startTime);
                    if (dayOfWeek !== null) catData.days.add(dayOfWeek);
                    catData.totalCount++;
                    if (goal.completed) catData.completedCount++;
                    break; // 첫 매칭 카테고리만
                }
            }
        }

        // 빈도 분석
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const lines: string[] = [];

        for (const [cat, data] of Object.entries(categories)) {
            if (data.totalCount === 0) continue;

            const catLabels: Record<string, string> = {
                rest: '휴식', exercise: '운동', meal: '식사', study: '학습',
                leisure: '여가/취미', work: '업무', social: '사회활동',
            };

            // 자주 하는 시간대 계산
            const timeFreq: Record<string, number> = {};
            for (const t of data.times) {
                const hour = parseInt(t.split(':')[0]);
                const block = hour < 12 ? '오전' : hour < 18 ? '오후' : '저녁';
                timeFreq[block] = (timeFreq[block] || 0) + 1;
            }
            const topTime = Object.entries(timeFreq).sort((a, b) => b[1] - a[1])[0];

            // 자주 하는 요일
            const dayArr = [...data.days].sort().map(d => dayNames[d]);

            // 고유 활동 이름 (최대 5개)
            const uniqueActivities = data.items.slice(0, 5).join(', ');

            const completionRate = data.totalCount > 0
                ? Math.round((data.completedCount / data.totalCount) * 100)
                : 0;

            lines.push(`- ${catLabels[cat]}: 최근 4주간 ${data.totalCount}회 (완료율 ${completionRate}%)
  활동: ${uniqueActivities}
  선호 시간대: ${topTime ? topTime[0] : '데이터 부족'}${dayArr.length > 0 ? ` | 주로 ${dayArr.join('·')}요일` : ''}`);
        }

        if (lines.length === 0) return "";

        // 전체 패턴 요약
        const totalSchedules = recentGoals.length;
        const completedSchedules = recentGoals.filter((g) => g.completed).length;
        const overallRate = Math.round((completedSchedules / totalSchedules) * 100);

        return `
📊 **사용자의 일정 패턴 (최근 4주 분석)**

전체: ${totalSchedules}개 일정, 완료율 ${overallRate}%

${lines.join('\n')}

**추천 시 활용 지침:**
- 휴식 추천 시: 사용자가 실제로 하는 휴식 활동(위 데이터)을 기반으로 추천하세요. 새로운 활동보다 익숙한 활동이 실행 가능성이 높습니다.
- 시간대 추천 시: 사용자가 해당 카테고리를 주로 하는 시간대에 맞춰 추천하세요.
- 완료율이 높은 카테고리의 활동을 우선 추천하세요.
- 사용자가 한 번도 하지 않은 유형의 활동은 신중하게 추천하세요.
`;
    } catch (e) {
        logger.error("[AI Chat] Failed to build schedule pattern context:", e);
        return "";
    }
}

// ============================================
// 사용자 프로필 + 일정 컨텍스트 빌드
// ============================================

async function buildUserAndScheduleContext(userEmail: string, context: ChatContext | undefined): Promise<{
    userContext: string;
    scheduleContext: string;
    userPlan: string;
    userId: string | undefined;
    profile: UserProfile | null;
}> {
    try {
        const user = await getUserByEmail(userEmail);
        const userPlan = await getPlanName(userEmail);

        if (!user?.profile) {
            return { userContext: "", scheduleContext: "", userPlan, userId: user?.id, profile: null };
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
            const ltg = p.longTermGoals as { weekly?: LongTermGoal[]; monthly?: LongTermGoal[]; yearly?: LongTermGoal[] };
            const activeWeekly = (ltg.weekly || []).filter((g: LongTermGoal) => !g.completed);
            const activeMonthly = (ltg.monthly || []).filter((g: LongTermGoal) => !g.completed);
            const activeYearly = (ltg.yearly || []).filter((g: LongTermGoal) => !g.completed);

            if (activeWeekly.length > 0 || activeMonthly.length > 0 || activeYearly.length > 0) {
                longTermGoalsContext = `
📌 **사용자의 장기 목표:**
${activeWeekly.length > 0 ? `[주간 목표]\n${activeWeekly.map((g) => `- ${g.title} (진행률: ${g.progress}%)`).join('\n')}` : ''}
${activeMonthly.length > 0 ? `[월간 목표]\n${activeMonthly.map((g) => `- ${g.title} (진행률: ${g.progress}%)`).join('\n')}` : ''}
${activeYearly.length > 0 ? `[연간 목표]\n${activeYearly.map((g) => `- ${g.title} (진행률: ${g.progress}%)`).join('\n')}` : ''}

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
${context.schedules.map((g) => `- ${g.startTime}: ${g.text}${g.completed ? ' ✓ 완료' : g.skipped ? ' ⊘ 건너뜀' : ''}`).join('\n')}
`;
        } else if (p.customGoals && p.customGoals.length > 0) {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const dayOfWeek = today.getDay();

            const todayGoals = p.customGoals.filter((g: CustomGoal) =>
                g.specificDate === todayStr ||
                (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
            );

            if (todayGoals.length > 0) {
                scheduleContext = `
오늘의 일정 (${todayStr}):
${todayGoals.map((g) => `- ${g.startTime}: ${g.text}`).join('\n')}
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

            const tomorrowGoals = p.customGoals.filter((g: CustomGoal) => {
                if (g.specificDate === tomorrowStr) return true;
                if (g.daysOfWeek?.includes(tomorrowDayOfWeek)) {
                    if (g.startDate && tomorrowStr < g.startDate) return false;
                    return true;
                }
                return false;
            });

            const dayAfterTomorrowGoals = p.customGoals.filter((g: CustomGoal) => {
                if (g.specificDate === dayAfterTomorrowStr) return true;
                if (g.daysOfWeek?.includes(dayAfterTomorrowDayOfWeek)) {
                    if (g.startDate && dayAfterTomorrowStr < g.startDate) return false;
                    return true;
                }
                return false;
            });

            if (tomorrowGoals.length > 0) {
                scheduleContext += `\n\n내일의 일정 (${tomorrowStr}):
${tomorrowGoals.map((g) => `- ${g.startTime}: ${g.text}`).join('\n')}`;
            }

            if (dayAfterTomorrowGoals.length > 0) {
                scheduleContext += `\n\n모레의 일정 (${dayAfterTomorrowStr}):
${dayAfterTomorrowGoals.map((g) => `- ${g.startTime}: ${g.text}`).join('\n')}`;
            }

            if (tomorrowGoals.length > 0 || dayAfterTomorrowGoals.length > 0) {
                scheduleContext += `\n\n**자비스 지침**: 일정을 추가할 때 위 일정들과의 충돌 여부를 반드시 확인하고, 필요시 자동 조정하세요.`;
            }
        }

        return { userContext, scheduleContext, userPlan, userId: user?.id, profile: p };
    } catch (e) {
        logger.error("[AI Chat] Failed to get user context:", e);
        return { userContext: "", scheduleContext: "", userPlan: "Free", userId: undefined, profile: null };
    }
}

// ============================================
// 트렌드 & 펜딩 컨텍스트 빌드 (순수 함수)
// ============================================

function buildTrendContext(context: ChatContext | undefined): string {
    if (!context?.trendBriefings || !Array.isArray(context.trendBriefings)) return "";
    const briefings = context.trendBriefings;
    if (briefings.length === 0) return "";

    return `
📰 오늘의 트렌드 브리핑 정보:
- 총 브리핑 수: ${briefings.length}개

브리핑 목록:
${briefings.map((t, i: number) => `${i + 1}. ID: "${t.id}" | [${t.category || '일반'}] ${t.title || t.name || '제목 없음'}`).join('\n')}

**중요**: 사용자가 브리핑을 추천/열기 요청 시, 반드시 위 목록에 있는 브리핑만 추천하세요. 목록에 없는 브리핑을 만들어내지 마세요.
actions에 open_briefing을 포함할 때 briefingId는 위 목록의 ID 문자열을 그대로 복사하세요.
예: actions: [{ "type": "open_briefing", "label": "브리핑 보기", "data": { "briefingId": "${briefings[0]?.id || ''}", "title": "${briefings[0]?.title || ''}" } }]
`;
}

function buildPendingScheduleContext(context: ChatContext | undefined): string {
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

function buildDateContext(context: ChatContext | undefined): string {
    const now = new Date();

    if (context?.currentDate && context?.currentTime) {
        const [year, month, day] = context.currentDate.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const weekdayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const weekday = weekdayNames[dateObj.getDay()];

        const [currentHour] = context.currentTime.split(':').map(Number);
        const timeOfDayKorean = currentHour < 12 ? '오전' : currentHour < 18 ? '오후' : '저녁';

        // 내일/모레 날짜 계산
        const tomorrowDate = new Date(dateObj);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
        const dayAfterDate = new Date(dateObj);
        dayAfterDate.setDate(dayAfterDate.getDate() + 2);
        const dayAfterStr = `${dayAfterDate.getFullYear()}-${String(dayAfterDate.getMonth() + 1).padStart(2, '0')}-${String(dayAfterDate.getDate()).padStart(2, '0')}`;

        return `
현재 날짜: ${year}년 ${month}월 ${day}일 ${weekday}
현재 시간: ${context.currentTime} (${timeOfDayKorean} ${currentHour}시)
현재 연도: ${year}년

📅 **날짜 매핑** (specificDate에 반드시 이 값을 사용):
- 오늘 → "${context.currentDate}"
- 내일 → "${tomorrowStr}"
- 모레 → "${dayAfterStr}"

🚨 **시간 관련 규칙**:
- 현재 시간은 ${context.currentTime} (${timeOfDayKorean} ${currentHour}시)입니다.
- **오늘** 일정: 현재 시간(${currentHour}시) 이후만 추천 가능
- **내일/미래 날짜** 일정: 시간 제약 없음! 오전/오후/저녁 모두 가능
- 예: "내일 오후 1시 점심" → specificDate: "${tomorrowStr}", startTime: "13:00"
- 예: "오늘 저녁" (현재 ${currentHour}시) → ${currentHour}시 이후만 가능
- **오전/오후 미지정 시 추론**: 사용자가 "5시", "3시"처럼 오전/오후 없이 시간만 말하면, 오늘 일정일 경우 현재 시간(${currentHour}시) 기준으로 추론하세요. 해당 시각이 이미 지났으면 오후(+12시간)로 해석합니다. 예: 현재 ${currentHour}시에 "5시 일정 잡아줘" → ${currentHour > 5 ? '17:00 (오후 5시)' : '05:00 (오전 5시)'}. 내일/미래 날짜면 활동명으로 상식 판단 (기상/아침→오전, 저녁 식사/운동→오후)

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

export const POST = withAuth(async (request: NextRequest, userEmail: string) => {
    try {
        // 1. 일일 AI 호출 제한 체크
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const dailyCountKey = `ai_chat_count_${todayStr}`;
        const currentCount = await kvGet<number>(userEmail, dailyCountKey) ?? 0;

        // 사용자 플랜은 아래에서 조회하므로, 먼저 간이 체크 (최대 플랜 한도로)
        const maxPossibleLimit = LIMITS.AI_CHAT_DAILY.Max;
        if (currentCount >= maxPossibleLimit) {
            return NextResponse.json(
                { error: '일일 AI 채팅 한도를 초과했습니다. 내일 다시 이용해주세요.', message: '일일 사용 한도에 도달했어요.' },
                { status: 429 }
            );
        }

        // 2. 요청 파싱
        const body = await request.json();
        const v = validateBody(aiChatSchema, body);
        if (!v.success) return v.response;
        const { messages, context: rawContext } = v.data;
        const context = rawContext as ChatContext | undefined;

        // 2.5. 콘텐츠 안전 필터 (유해 메시지 사전 차단)
        const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
        if (lastUserMsg?.content) {
            const safetyCheck = checkContentSafety(lastUserMsg.content);
            if (safetyCheck.blocked) {
                logger.warn(`[AI-Chat] Content blocked: category=${safetyCheck.category}, user=${userEmail}`);
                return NextResponse.json({ message: safetyCheck.response, actions: [] });
            }
        }

        // 3. 의도 분류 (먼저!)
        const intent = classifyIntent(messages);

        // 4. 사용자 프로필 + 일정 (항상 필요)
        const { userContext, scheduleContext, userPlan, userId, profile } = await buildUserAndScheduleContext(userEmail, context);

        // 4.1 플랜별 일일 제한 재확인
        const dailyLimit = LIMITS.AI_CHAT_DAILY[userPlan] ?? LIMITS.AI_CHAT_DAILY.Free;
        if (currentCount >= dailyLimit) {
            return NextResponse.json(
                { error: '일일 AI 채팅 한도를 초과했습니다.', message: `${userPlan} 플랜의 일일 한도(${dailyLimit}회)에 도달했어요.` },
                { status: 429 }
            );
        }

        // 호출 카운트 증가
        await kvSet(userEmail, dailyCountKey, currentCount + 1);


        // 4.5. ReAct 에이전트 분기 (Pro/Max + 복합 요청만)
        // 단순 일정 추가/삭제("점심 잡아줘")는 단발 GPT가 더 정확하고 빠름
        const planConfig = PLAN_CONFIGS[userPlan as PlanType];
        const complexity = getRequestComplexity(messages);
        const shouldUseReAct = planConfig?.features.reactLoop
            && !isSimpleResponse(messages)
            && complexity > 0;

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
                }, complexity);

                // wasTerminatedEarly여도 message가 있으면 (fallback 생성 성공) 사용
                if (result.wasTerminatedEarly && !result.message) {
                    throw new Error('ReAct terminated early with no response');
                }

                // ReAct 사용량 기록 (LLM 호출 수만큼)
                if (result.totalLlmCalls > 0) {
                    await logOpenAIUsage(userEmail, 'react-agent', 'ai-chat-react', 0, 0);
                }

                // ReAct 결과에도 동일한 후처리 적용 (이름 정규화, 시간 검증, 충돌 감지)
                const currentTime = context?.currentTime || new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                const { actions: processedActions, conflictWarning, focusSuggestion } = postProcessActions(
                    result.actions || [], currentTime
                );

                return NextResponse.json({
                    message: result.message,
                    actions: processedActions,
                    ...(conflictWarning && { conflictWarning }),
                    ...(focusSuggestion && { focusSuggestion }),
                });
            } catch (reactError) {
                logger.error('[AI Chat] ReAct failed, falling back to single-shot:', reactError);
                // 폴백: 아래 기존 GPT 단발 경로로 진행
            }
        }

        // 5. 의도별 필요한 데이터만 병렬 조회 (Lazy Loading)
        const dataSources = getRequiredDataSources(intent, userPlan);

        const asyncFetches: Promise<void>[] = [];
        let eventLogsContext = "";
        let ragContext = "";
        let fusedContextStr = "";
        let schedulePatternContext = "";

        // 개별 타임아웃 래퍼 (전체 10초 대기 대신 개별 5초 제한)
        const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
            Promise.race([promise, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

        if (dataSources.needsEventLogs) {
            asyncFetches.push(
                withTimeout(fetchEventLogs(userEmail), 5000, "").then(result => { eventLogsContext = result; })
            );
        }

        if (dataSources.needsRag) {
            asyncFetches.push(
                withTimeout(fetchRagContext(messages, userEmail, userId, userPlan), 5000, "").then(result => { ragContext = result; })
            );
        }

        // 추천 요청 시 일정 패턴 분석 (search/chat에서 활용, 이미 로드된 profile 재활용)
        if (intent === 'search' || intent === 'chat') {
            asyncFetches.push(
                withTimeout(fetchSchedulePatternContext(userEmail, profile), 3000, "").then(result => { schedulePatternContext = result; })
            );
        }

        // 컨텍스트 융합 엔진 — 분석/목표/검색에만 사용 (chat/settings/schedule은 불필요)
        if (intent !== 'schedule' && intent !== 'chat' && intent !== 'settings') {
            asyncFetches.push(
                withTimeout(getFusedContextForAI(userEmail), 5000, "").then(result => { fusedContextStr = result; })
            );
        }

        // 메시지 압축 (13개 초과일 때만 LLM 호출, 이하면 slice로 충분)
        let compressedMessages = messages.slice(-10);
        if (messages.length > 13) {
            asyncFetches.push(
                withTimeout(compressMessages(messages), 8000, messages.slice(-10)).then(result => { compressedMessages = result; })
            );
        }

        // 병렬 실행 (개별 타임아웃으로 관리, 전체는 allSettled로 완료 대기)
        await Promise.allSettled(asyncFetches);

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
${context.goals.map((g) => `- [${goalTypeMap[g.type] || g.type}] ${g.title}${g.category ? ` (${g.category})` : ''} - 진행률 ${g.progress || 0}%`).join('\n')}

목표와 관련된 질문이나 일정 요청 시 이 정보를 참고하세요.
`;
        }

        let learningContext = "";
        if (context?.learningCurriculums && Array.isArray(context.learningCurriculums) && context.learningCurriculums.length > 0) {
            learningContext = `
📚 **사용자의 학습 커리큘럼:**
${context.learningCurriculums.map((c) => `- ${c.title}${c.currentModule ? ` (현재: ${c.currentModule})` : ''} - 진행률 ${c.progress || 0}%`).join('\n')}

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
            schedulePatternContext,
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

        // 8. LLM 호출 (타임아웃 포함, 메시지 압축은 5단계에서 병렬 완료)
        const modelName = MODELS.GPT_5_MINI;
        const LLM_TIMEOUT = 30000; // 30초
        const completion = await Promise.race([
            openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: systemPrompt },
                    ...compressedMessages,
                ],
                temperature: 1.0,
                response_format: { type: "json_object" },
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('AI chat LLM call timed out')), LLM_TIMEOUT)
            ),
        ]);

        const finishReason = completion.choices[0]?.finish_reason;

        // 응답 안전 검사 (OpenAI content_filter 감지)
        const responseSafety = checkResponseSafety(finishReason);
        if (responseSafety.blocked) {
            logger.warn(`[AI-Chat] Response blocked by OpenAI: finish_reason=${finishReason}, user=${userEmail}`);
            return NextResponse.json({ message: responseSafety.response, actions: [] });
        }

        const responseContent = completion.choices[0]?.message?.content || '{"message": "죄송합니다. 응답을 생성하지 못했습니다."}';

        // 9. 사용량 로깅
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(userEmail, modelName, "ai-chat", usage.prompt_tokens, usage.completion_tokens);
        }

        if (finishReason === 'length') {
            logger.warn(`[AI Chat] Response truncated (finish_reason=length) for user=${userEmail}`);
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
            logger.error('[AI Chat] JSON parse error:', e);
            // JSON이 잘린 경우 message 필드만 추출 시도
            const messageMatch = responseContent.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const extractedMessage = messageMatch ? messageMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : "죄송합니다. 응답 처리 중 오류가 발생했어요.";
            // actions도 부분 추출 시도
            let extractedActions: unknown[] = [];
            try {
                const actionsMatch = responseContent.match(/"actions"\s*:\s*(\[[\s\S]*?\])/);
                if (actionsMatch) extractedActions = JSON.parse(actionsMatch[1]);
            } catch (e) {
                logger.error('[AI Chat] Partial actions extraction failed:', e instanceof Error ? e.message : e);
            }
            return NextResponse.json({
                message: extractedMessage,
                actions: extractedActions,
            });
        }
    } catch (error: unknown) {
        const err = error as { code?: string; message?: string; response?: { data?: unknown } };
        logger.error("[AI Chat] Error:", error);
        logger.error("[AI Chat] Error message:", err?.message);
        logger.error("[AI Chat] Error response:", err?.response?.data);

        if (err?.code === 'invalid_api_key' || err?.message?.includes('API key')) {
            return NextResponse.json(
                { error: "OpenAI API 키가 유효하지 않습니다.", message: "설정을 확인해주세요." },
                { status: 401 }
            );
        }

        if (err?.code === 'model_not_found' || err?.message?.includes('model')) {
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
});
