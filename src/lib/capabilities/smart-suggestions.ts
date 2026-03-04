/**
 * Smart Suggestions Capability
 *
 * ai-suggest-schedules API 라우트에서 추출한 핵심 로직.
 * ReAct 도구, Jarvis Hands, API 라우트에서 공유 호출 가능.
 */

import OpenAI from 'openai';
import { getStressReliefSuggestions, getEnergyBoostSuggestions } from '@/lib/stress-detector';
import { getRecommendationsByType } from '@/lib/work-rest-analyzer';
import { getSharedUserContext, getSharedDailyState, getSharedWorkRestBalance, getSharedSuggestionPreferences } from '@/lib/shared-context';
import { logOpenAIUsage } from '@/lib/openai-usage';
import { MODELS } from '@/lib/models';
import {
    registerCapability,
    type CapabilityResult,
    type SmartSuggestionsParams,
    type SmartSuggestionsResult,
    type ScheduleSuggestion,
} from '@/lib/agent-capabilities';
import { logger } from '@/lib/logger';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 5-minute in-memory cache
interface CacheEntry {
    data: SmartSuggestionsResult;
    timestamp: number;
}

const suggestionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(cacheKey: string): SmartSuggestionsResult | null {
    const cached = suggestionCache.get(cacheKey);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        suggestionCache.delete(cacheKey);
        return null;
    }
    return cached.data;
}

function setCache(cacheKey: string, data: SmartSuggestionsResult): void {
    suggestionCache.set(cacheKey, { data, timestamp: Date.now() });
}

/**
 * 스마트 일정 추천 핵심 로직
 */
export async function generateSmartSuggestions(
    email: string,
    params: SmartSuggestionsParams
): Promise<CapabilityResult<SmartSuggestionsResult>> {
    try {
        const { requestCount = 3, currentHour } = params;

        const now = new Date();
        const hour = currentHour !== undefined ? currentHour : now.getHours();
        const cacheKey = `${email}-${requestCount}-${hour}`;

        // Cache check
        const cached = getCached(cacheKey);
        if (cached) {
            return { success: true, data: cached, costTier: 'free', cachedHit: true };
        }

        // Context 생성 (공유 컨텍스트 풀 사용 — 30초 TTL 메모이제이션)
        const context = await getSharedUserContext(email) as any;
        const dailyState = await getSharedDailyState(email) as any;
        const workRestBalance = await getSharedWorkRestBalance(email) as any;
        const suggestionPrefs = await getSharedSuggestionPreferences(email).catch(() => null) as any;
        const balanceRecommendations = getRecommendationsByType(workRestBalance.recommendationType);

        const currentSeason = now.getMonth() >= 11 || now.getMonth() <= 1 ? "겨울" :
                             now.getMonth() >= 2 && now.getMonth() <= 4 ? "봄" :
                             now.getMonth() >= 5 && now.getMonth() <= 7 ? "여름" : "가을";
        const timeOfDayLabel = hour < 12 ? "오전" : hour < 18 ? "오후" : "저녁";

        // 시간대별 적절한 활동 카테고리
        let timeAppropriateCategories = "";
        if (hour >= 0 && hour < 6) {
            timeAppropriateCategories = "❌ 새벽 시간 (0-6시): 취침/수면 제외 모든 추천 금지. 사용자가 잠자야 할 시간입니다.";
        } else if (hour >= 6 && hour < 9) {
            timeAppropriateCategories = "✅ 아침 시간 (6-9시): 기상, 아침 운동, 아침 식사, 간단한 학습, 하루 계획 세우기 추천. ❌ 친구 만남, 저녁 활동 금지.";
        } else if (hour >= 9 && hour < 12) {
            timeAppropriateCategories = "✅ 오전 시간 (9-12시): 집중 업무, 학습, 회의, 프로젝트 작업 추천. ❌ 운동, 친구 만남, 저녁 식사 금지.";
        } else if (hour >= 12 && hour < 14) {
            timeAppropriateCategories = "✅ 점심 시간 (12-14시): 점심 식사, 가벼운 산책, 짧은 휴식 추천. ❌ 격렬한 운동, 긴 시간 프로젝트, 저녁 활동 금지.";
        } else if (hour >= 14 && hour < 18) {
            timeAppropriateCategories = "✅ 오후 시간 (14-18시): 실행 업무, 프로젝트 작업, 가벼운 운동, 네트워킹 추천. ❌ 아침 활동, 저녁 식사 금지.";
        } else if (hour >= 18 && hour < 21) {
            timeAppropriateCategories = "✅ 저녁 시간 (18-21시): 저녁 식사, 친구 만남, 취미 활동, 복습, 가벼운 학습 추천. ❌ 아침 활동, 집중 업무 금지.";
        } else {
            timeAppropriateCategories = "✅ 밤 시간 (21-24시): 정리, 복습, 내일 준비, 가벼운 독서, 명상, 취침 준비 추천. ❌ 운동, 친구 만남, 업무 금지.";
        }

        // 오늘 날짜의 실제 일정
        const today = new Date().toISOString().split('T')[0];
        const existingSchedules = context.profile.customGoals
            ?.filter((goal: any) => goal.specificDate === today)
            .map((goal: any) => goal.text) || [];

        const addedSchedulesText = existingSchedules.length > 0
            ? existingSchedules.join(", ")
            : "없음";

        const recentActivitiesText = context.recentActivities.length > 0
            ? context.recentActivities.map((a: any) => a.title).join(", ")
            : "기록 없음";

        const topTimeblocks = Object.entries(context.features.successRateByTimeblock)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 3)
            .map(([key, rate]) => `${key} (성공률: ${((rate as number) * 100).toFixed(0)}%)`)
            .join(", ");

        const sp = context.schedulePattern;
        const patternText = `
- 평균 기상 시간: ${sp.wakeUpTime || '데이터 없음'}
- 평균 취침 시간: ${sp.sleepTime || '데이터 없음'}
- 업무 시간: ${sp.workStartTime || '미파악'} ~ ${sp.workEndTime || '미파악'}
- 점심 시간: ${sp.lunchTime || '미파악'}
- 활동 시간대 선호: ${sp.activityDistribution.morning > 0.4 ? '아침형' : sp.activityDistribution.evening > 0.4 ? '저녁형' : '균형형'} (아침: ${(sp.activityDistribution.morning * 100).toFixed(0)}%, 오후: ${(sp.activityDistribution.afternoon * 100).toFixed(0)}%, 저녁: ${(sp.activityDistribution.evening * 100).toFixed(0)}%)
- 바쁜 요일: ${sp.busyDays.length > 0 ? sp.busyDays.join(', ') : '없음'}
- 여유로운 요일: ${sp.relaxedDays.length > 0 ? sp.relaxedDays.join(', ') : '없음'}`;

        const recurringText = sp.recurringSchedules.length > 0
            ? sp.recurringSchedules.slice(0, 5).map((r: any) => `  - ${r.title} (${r.dayOfWeek} ${r.timeBlock}, ${r.frequency}회)`).join('\n')
            : '  없음';

        // 현재 요일+시간대에 매칭되는 반복 일정 찾기
        const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const todayDayName = dayNames[now.getDay()];
        const currentTimeBlock = hour < 12 ? '오전' : hour < 18 ? '오후' : '저녁';

        const matchingRecurring = sp.recurringSchedules.filter((r: any) => {
            const dayMatch = r.dayOfWeek === todayDayName || r.dayOfWeek?.includes(todayDayName);
            const blockMatch = r.timeBlock === currentTimeBlock;
            // 이미 추가된 일정이 아닌지 확인
            const notDuplicate = !existingSchedules.some((s: string) =>
                s.includes(r.title) || r.title.includes(s)
            );
            return dayMatch && blockMatch && notDuplicate;
        });

        const recurringPriorityText = matchingRecurring.length > 0
            ? `\n**[🔥 반복 패턴 매칭 — 1순위 추천 필수] 🚨 최우선**
이 사용자는 매주 이 요일(${todayDayName}) ${currentTimeBlock} 시간대에 다음 활동을 반복적으로 수행합니다:
${matchingRecurring.map((r: any) => `  - "${r.title}" (최근 4주간 ${r.frequency}회 수행)`).join('\n')}

→ **위 활동 중 최소 1개를 반드시 추천 목록의 1번째(최우선)로 포함할 것**
→ 사용자의 확립된 루틴이므로 다른 새로운 활동보다 우선합니다
→ 이미 오늘 추가된 일정과 중복되는 경우에만 제외 가능\n`
            : '';

        const prompt = `당신은 사용자의 데이터를 기반으로 개인화된 일정을 추천하는 AI 코치입니다.

**[사용자 프로필]**
- 직업/전공: ${context.profile.job || '미설정'}
- 목표: ${context.profile.goal || '미설정'}
- 현재 시간: ${timeOfDayLabel} ${hour}시
- 계절: ${currentSeason}

**[⏰ 시간대별 추천 제약 - 절대 준수] 🚨 최우선 규칙**
${timeAppropriateCategories}

${recurringPriorityText}
**[실제 생활 패턴 - 일정 분석 기반]**
${patternText}
- 정기 반복 일정 (최근 4주):
${recurringText}

**[제약사항 - 절대 지킬 것]**
- 금지 시간대: ${context.constraints.blockedTimes.length > 0 ? JSON.stringify(context.constraints.blockedTimes) : '없음'}
- 운동 제한: ${context.constraints.workoutRestrictions.maxIntensity ? `최대 강도 ${context.constraints.workoutRestrictions.maxIntensity}` : '없음'}
${context.constraints.workoutRestrictions.injuries && context.constraints.workoutRestrictions.injuries.length > 0 ? `- 부상 부위: ${context.constraints.workoutRestrictions.injuries.join(', ')}` : ''}
${context.constraints.workoutRestrictions.avoidTypes && context.constraints.workoutRestrictions.avoidTypes.length > 0 ? `- 피해야 할 운동: ${context.constraints.workoutRestrictions.avoidTypes.join(', ')}` : ''}

**[사용자 선호]**
- 선호 운동 종류: ${context.preferences.workoutTypes.length > 0 ? context.preferences.workoutTypes.join(', ') : '미설정'}
- 주간 운동 목표: 주 ${context.preferences.workoutFrequency}회
- 선호 운동 시간: ${context.preferences.workoutDuration}분
- 생활 패턴: ${context.preferences.chronotype === 'morning' ? '아침형' : context.preferences.chronotype === 'evening' ? '저녁형' : '중립'}
- 선호 시간대: ${context.preferences.timeSlots.length > 0 ? context.preferences.timeSlots.join(', ') : '없음'}

**[사용자 행동 패턴 - 데이터 기반]**
- 이번 주 운동 횟수: ${context.features.thisWeekWorkoutCount}회 (목표: ${context.preferences.workoutFrequency}회, 남은 횟수: ${Math.max(0, context.preferences.workoutFrequency - context.features.thisWeekWorkoutCount)}회)
- 최근 7일 평균 수면: ${context.features.avgSleepHours ? `${context.features.avgSleepHours.toFixed(1)}시간` : '기록 없음'}
- 운동 완료율: ${(context.features.workoutCompletionRate * 100).toFixed(0)}%
- 가장 생산적인 시간대: ${context.features.mostProductiveTime || '데이터 부족'}
- 성공률 높은 시간블록: ${topTimeblocks || '데이터 부족'}
- 일정 밀도: ${context.features.recentScheduleDensity}

${suggestionPrefs ? `**[AI 추천 수락 패턴 - 데이터 기반 선호도] 📊**
- 선호 카테고리: ${suggestionPrefs.topCategories?.length > 0 ? suggestionPrefs.topCategories.join(', ') : '데이터 수집 중'}
- 기피 카테고리: ${suggestionPrefs.avoidCategories?.length > 0 ? suggestionPrefs.avoidCategories.join(', ') : '없음'}
- 카테고리별 가중치: ${Object.entries(suggestionPrefs.categoryWeights || {}).map(([k, v]: [string, any]) => `${k}(${v.toFixed(1)})`).join(', ') || '데이터 부족'}
- 시간대별 선호: ${['morning', 'afternoon', 'evening'].map(block => {
    const scores = suggestionPrefs.timeCategoryScores?.[block] || {};
    const top = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]).slice(0, 2);
    const label = block === 'morning' ? '오전' : block === 'afternoon' ? '오후' : '저녁';
    return top.length > 0 ? `${label}=${top.map(([k, v]: [string, any]) => `${k}(${(v * 100).toFixed(0)}%)`).join(',')}` : null;
}).filter(Boolean).join(' / ') || '데이터 부족'}

→ 선호 카테고리에서 최소 1개 추천 포함
→ 기피 카테고리는 우선순위 낮춤 (완전 제외는 아님)
` : ''}
**[오늘의 상태 - 실시간 감지] ⚠️ 중요**
- 에너지 레벨: ${dailyState.energy_level}/10 ${dailyState.energy_level <= 3 ? '(매우 낮음 - 가벼운 활동 권장)' : dailyState.energy_level <= 5 ? '(보통 이하)' : '(양호)'}
- 스트레스 레벨: ${dailyState.stress_level}/10 ${dailyState.stress_level >= 8 ? '(매우 높음 - 휴식 필수!)' : dailyState.stress_level >= 6 ? '(높음 - 휴식 권장)' : '(정상)'}
- 오늘 완료율: ${(dailyState.completion_rate * 100).toFixed(0)}%
- 오늘 활동 수: ${dailyState.activity_count}개

${dailyState.stress_level >= 7 ? `⚠️ **스트레스 높음 감지** - 다음 활동 우선 추천: ${getStressReliefSuggestions(dailyState.stress_level).join(', ')}` : ''}
${dailyState.energy_level <= 4 ? `⚠️ **에너지 부족 감지** - 에너지 회복 활동 우선 추천: ${getEnergyBoostSuggestions(dailyState.energy_level).join(', ')}` : ''}

**[업무-휴식 균형 분석] 🎯 최우선 고려사항**
- 업무 강도: ${workRestBalance.workIntensity} (오늘 업무 ${workRestBalance.workEventsToday}건, 약 ${workRestBalance.workHoursToday}시간)
  ${workRestBalance.workIntensity === 'overloaded' ? '⚠️ 과밀 상태 - 추가 업무 일정 추천 금지!' : ''}
  ${workRestBalance.workIntensity === 'empty' ? '📝 일정이 비어있음 - 생산적 활동 추천' : ''}
- 휴식 상태: ${workRestBalance.restStatus}
  ${workRestBalance.restStatus === 'critical' ? '🚨 위험! 업무만 있고 휴식 없음 - 휴식 필수!' : ''}
  ${workRestBalance.lastRestTime ? `마지막 휴식: ${workRestBalance.lastRestTime} (${workRestBalance.hoursSinceRest}시간 전)` : '오늘 아직 휴식 없음'}
- 빈 시간: ${workRestBalance.hasEmptySlots ? `${workRestBalance.emptyHoursToday}시간 여유` : '일정이 빡빡함'}
- 특수 상황: ${workRestBalance.isWeekend ? '주말' : '평일'}${workRestBalance.upcomingLongBreak ? ', 긴 연휴 앞둠' : ''}

**🎯 추천 방향 (반드시 따를 것): ${workRestBalance.recommendationType.toUpperCase()}**
- 이유: ${workRestBalance.reason}
- 우선 추천 카테고리: ${balanceRecommendations.categories.join(', ')}
- 구체적 예시: ${balanceRecommendations.examples.join(' | ')}
- 우선순위: ${balanceRecommendations.priority}

${workRestBalance.recommendationType === 'rest' ? `
⚠️ **휴식 최우선 모드 활성화**
- 업무/생산성 활동 추천 금지
- 3개 카드 중 최소 2개는 휴식/웰니스 활동
- 짧고 가벼운 활동 위주 (5-15분)
- 예: 산책, 스트레칭, 명상, 눈 감고 쉬기
` : ''}

${workRestBalance.recommendationType === 'productivity' ? `
📝 **생산성 모드 활성화**
- 일정이 비어있으므로 자기계발/업무 추천
- 하지만 과도하지 않게 (2-3시간 이내)
- 운동/휴식도 1개 이상 포함
` : ''}

${workRestBalance.recommendationType === 'travel' || workRestBalance.recommendationType === 'leisure' ? `
🌴 **여가/여행 모드 활성화**
- 주말/연휴이므로 업무 추천 금지
- 여가, 취미, 여행, 가족 활동 우선
- 긴 시간 (2-4시간) 활동 가능
` : ''}

**[최근 활동 (중복 방지용)]**
${recentActivitiesText}

**[⚠️ 이미 오늘 추가한 일정 - 절대 중복 금지]**
${addedSchedulesText}

**[추천 원칙 - 반드시 엄격히 준수]**

1. **🚨 중복 방지 (최우선 규칙)**:
   위의 "이미 오늘 추가한 일정" 목록을 **반드시** 확인하고:

   - **독서/책/학습 관련**이 하나라도 있으면:
     → "독서", "책 읽기", "서적", "도서", "reading", "린 스타트업", "경영서적", "경제 공부" 등 **모든 독서/학습 활동 추천 절대 금지**
     → 대신 완전히 다른 카테고리(운동, 휴식, 생산성 작업 등) 추천

   - **운동/건강 관련**이 하나라도 있으면:
     → "운동", "요가", "헬스", "산책", "스트레칭", "조깅", "웨이트", "필라테스" 등 **모든 운동 추천 절대 금지**
     → 대신 완전히 다른 카테고리 추천

   - **휴식/산책 관련**이 하나라도 있으면:
     → "산책", "휴식", "명상", "산책하기", "걷기" 등 **모든 휴식 활동 추천 절대 금지**

   - **같은 카테고리가 이미 있으면 그 카테고리 전체를 추천 후보에서 제외할 것**

2. **🎯 사용자 맞춤 추천 (필수)**:
   - 이 사용자의 직업/전공: ${context.profile.job || '미설정'}
   - 이 사용자의 목표: ${context.profile.goal || '미설정'}

   **위 사용자의 실제 직업과 목표에 맞춰 개인화된 추천을 제공할 것**
   - 사용자의 직업/목표와 직접 연관된 활동을 추천
   - **절대 일반적이거나 계절성 추천(겨울 독서, 봄맞이 운동 등) 하지 말 것**

3. **카테고리 다양성 & 필수 균형**:
   - 3개 추천은 **반드시 서로 다른 카테고리**
   - 카테고리: exercise(운동), learning(독서/학습), productivity(생산성/업무), wellness(휴식/웰니스), leisure(취미/여가), social(사회활동)
   - **⚠️ 필수 규칙: 3개 카드 중 최소 1개는 반드시 다음 중 하나여야 함**:
     * exercise(운동) * wellness(휴식/웰니스) * learning(독서/학습) * leisure(취미/여가)
   - **업무(productivity)만 3개 추천하는 것은 절대 금지**

4. **제약사항 절대 준수**: 금지 시간대, 운동 제한 등을 반드시 지킬 것
5. **생활 패턴 기반 추천**: 사용자의 실제 기상/취침 시간, 업무 시간, 활동 시간대 선호를 반드시 고려
6. **데이터 기반 추천**: 성공률 높은 시간대와 사용자 행동 패턴을 우선 고려
7. **목표 달성 지원**: 이번 주 운동 목표 남은 횟수를 고려
8. **현실적 제안**: 사용자의 직업, 시간대, 생활 리듬에 맞는 실행 가능한 활동
9. **요일 고려**: 바쁜 요일에는 가벼운 활동, 여유로운 요일에는 시간이 필요한 활동

**[시간대별 추천 가이드]**
- 오전(5-12시): 계획, 학습, 중요 업무, 아침 운동
- 오후(12-18시): 실행, 프로젝트 작업, 네트워킹, 짧은 휴식, 가벼운 운동
- 저녁(18-22시): 복습, 정리, 가벼운 학습, 내일 준비, 저녁 운동

**[활동별 현실적인 소요 시간 - 반드시 준수]**
🎬 콘텐츠 소비: 영화 감상 2시간, 드라마 1시간, 유튜브 30분-1시간
📚 학습/독서: 독서 30분-1시간, 온라인 강의 1시간, 언어 학습 30분-1시간
💪 운동: 요가/스트레칭 30분-1시간, 헬스/웨이트 1-1.5시간, 러닝/조깅 30분-1시간, 산책 20-30분
☕ 휴식/사회: 카페 1시간, 친구 만남 2-3시간, 식사 1시간, 명상 15-30분
💼 업무/생산성: 집중 작업 1-2시간, 회의 30분-1시간, 이메일 정리 30분

**요청 개수: ${requestCount}개**
- 정확히 ${requestCount}개의 추천만 생성할 것
- ${requestCount}개가 3개보다 적으면 카테고리 다양성 규칙은 적용하지 않아도 됨 (단, 중복 방지는 필수)
- ${requestCount}개가 3개인 경우 반드시 모든 카테고리가 달라야 함

**JSON 형식으로 정확히 응답하세요** (마크다운 코드블록 없이):
{
  "suggestions": [
    {
      "title": "구체적 활동 제목",
      "description": "10-15자 설명",
      "action": "일정에 추가될 텍스트",
      "category": "exercise|learning|productivity|wellness|leisure|social 중 하나",
      "estimatedTime": "30분|1시간|15분 등",
      "priority": "high|medium|low",
      "icon": "이모지 1개"
    }
  ]
}

**중요: 이 사용자의 실제 직업(${context.profile.job || '미설정'})과 목표(${context.profile.goal || '미설정'})를 반드시 반영하여 추천할 것.**

위 형식을 정확히 따라 응답하세요. 반드시 순수 JSON만 반환하고, 추가 설명이나 마크다운 없이 응답하세요.`;

        const completion = await openai.chat.completions.create({
            model: MODELS.GPT_5_MINI,
            messages: [
                {
                    role: "system",
                    content: "당신은 전문 성장 코치 AI입니다. 사용자의 목표와 상황에 맞는 구체적이고 실행 가능한 일정을 추천합니다. 반드시 순수 JSON 형식으로만 응답하세요."
                },
                { role: "user", content: prompt },
            ],
            temperature: 1.0,
            response_format: { type: "json_object" }
        });

        const responseText = completion.choices[0]?.message?.content || "{}";

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                email,
                MODELS.GPT_5_MINI,
                "ai-suggest-schedules",
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch {
            return { success: false, error: 'Invalid JSON response from OpenAI', costTier: 'moderate', cachedHit: false };
        }

        const suggestionsWithIds: ScheduleSuggestion[] = (parsedResponse.suggestions || []).map((suggestion: any, index: number) => ({
            ...suggestion,
            id: `ai-suggestion-${Date.now()}-${index}`,
        }));

        const result: SmartSuggestionsResult = { suggestions: suggestionsWithIds };

        // Cache
        setCache(cacheKey, result);

        return { success: true, data: result, costTier: 'moderate', cachedHit: false };
    } catch (error) {
        logger.error('[SmartSuggestions] Error:', error);
        return { success: false, error: 'Failed to generate suggestions', costTier: 'moderate', cachedHit: false };
    }
}

// Register capability
registerCapability<SmartSuggestionsParams, SmartSuggestionsResult>({
    name: 'smart_suggestions',
    description: 'AI 맞춤 일정 추천 (5카테고리 밸런스)',
    costTier: 'moderate',
    execute: generateSmartSuggestions,
});
