import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { generateUserContext } from "@/lib/user-context-service";
import { detectDailyState, getStressReliefSuggestions, getEnergyBoostSuggestions } from "@/lib/stress-detector";
import { analyzeWorkRestBalance, getRecommendationsByType } from "@/lib/work-rest-analyzer";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory cache with 5-minute TTL
interface CacheEntry {
    data: any;
    timestamp: number;
}

const suggestionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedSuggestions(email: string, requestCount: number): any | null {
    const cacheKey = `${email}-${requestCount}`;
    const cached = suggestionCache.get(cacheKey);

    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > CACHE_TTL_MS) {
        suggestionCache.delete(cacheKey);
        return null;
    }

    console.log('[AI Suggest Schedules] Cache hit! Returning cached suggestions');
    return cached.data;
}

function setCachedSuggestions(email: string, requestCount: number, data: any): void {
    const cacheKey = `${email}-${requestCount}`;
    suggestionCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });
    console.log('[AI Suggest Schedules] Cached suggestions for', cacheKey);
}

export async function POST(request: NextRequest) {
    try {
        console.log("[AI Suggest Schedules] API 호출 시작");

        // 인증 확인
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { requestCount = 3 } = await request.json();
        console.log("[AI Suggest Schedules] 요청 개수:", requestCount);

        // Check cache first
        const cachedResult = getCachedSuggestions(session.user.email, requestCount);
        if (cachedResult) {
            return NextResponse.json(cachedResult);
        }

        // Context 생성 (캐시 사용하지 않고 항상 최신 데이터 가져오기)
        console.log("[AI Suggest Schedules] User context 생성 중...");
        const context = await generateUserContext(session.user.email); // 캐시 대신 직접 생성

        // 스트레스/에너지 레벨 자동 감지
        console.log("[AI Suggest Schedules] 스트레스/에너지 레벨 감지 중...");
        const dailyState = await detectDailyState(session.user.email);

        // 업무-휴식 균형 분석
        console.log("[AI Suggest Schedules] 업무-휴식 균형 분석 중...");
        const workRestBalance = await analyzeWorkRestBalance(session.user.email);
        const balanceRecommendations = getRecommendationsByType(workRestBalance.recommendationType);

        // Get current context
        const now = new Date();
        const hour = now.getHours();
        const currentSeason = now.getMonth() >= 11 || now.getMonth() <= 1 ? "겨울" :
                             now.getMonth() >= 2 && now.getMonth() <= 4 ? "봄" :
                             now.getMonth() >= 5 && now.getMonth() <= 7 ? "여름" : "가을";
        const timeOfDayLabel = hour < 12 ? "오전" : hour < 18 ? "오후" : "저녁";

        // 오늘 날짜의 실제 일정을 DB에서 실시간으로 가져오기
        const today = new Date().toISOString().split('T')[0];
        const existingSchedules = context.profile.customGoals
            ?.filter((goal: any) => goal.specificDate === today)
            .map((goal: any) => goal.text) || [];

        console.log("[AI Suggest Schedules] 오늘 일정 (DB 실시간):", existingSchedules);

        const addedSchedulesText = existingSchedules.length > 0
            ? existingSchedules.join(", ")
            : "없음";

        // 최근 활동 텍스트 생성
        const recentActivitiesText = context.recentActivities.length > 0
            ? context.recentActivities.map(a => a.title).join(", ")
            : "기록 없음";

        // 성공률 높은 시간대 추출
        const topTimeblocks = Object.entries(context.features.successRateByTimeblock)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([key, rate]) => `${key} (성공률: ${(rate * 100).toFixed(0)}%)`)
            .join(", ");

        // 일정 패턴 텍스트 생성
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
            ? sp.recurringSchedules.slice(0, 5).map(r => `  - ${r.title} (${r.dayOfWeek} ${r.timeBlock}, ${r.frequency}회)`).join('\n')
            : '  없음';

        // Context 기반 Prompt 생성
        const prompt = `당신은 사용자의 데이터를 기반으로 개인화된 일정을 추천하는 AI 코치입니다.

**[사용자 프로필]**
- 직업/전공: ${context.profile.job || '미설정'}
- 목표: ${context.profile.goal || '미설정'}
- 현재 시간: ${timeOfDayLabel} ${hour}시
- 계절: ${currentSeason}

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
   - 예: "경영학과"면 → 경영/마케팅/재무 관련 활동
   - 예: "AI 스타트업 창업"이면 → AI 트렌드, MVP 개발, 고객 인터뷰, 시장 조사 등
   - 예: "취업 준비"면 → 포트폴리오, 면접 준비, 이력서 작성, 네트워킹 등
   - **절대 일반적이거나 계절성 추천(겨울 독서, 봄맞이 운동 등) 하지 말 것**
   - **사용자 정보를 무시하고 일반적인 추천을 하면 안됨**

3. **카테고리 다양성 & 필수 균형**:
   - 3개 추천은 **반드시 서로 다른 카테고리**
   - 카테고리: exercise(운동), learning(독서/학습), productivity(생산성/업무), wellness(휴식/웰니스), leisure(취미/여가), social(사회활동)
   - **⚠️ 필수 규칙: 3개 카드 중 최소 1개는 반드시 다음 중 하나여야 함**:
     * exercise(운동): 요가, 조깅, 스트레칭, 헬스, 산책, 필라테스, 수영 등
     * wellness(휴식/웰니스): 명상, 휴식, 수면, 심호흡, 마사지 등
     * learning(독서/학습): 책 읽기, 독서, 온라인 강의, 학습 등
     * leisure(취미/여가): 취미 활동, 음악 감상, 영화 보기, 글쓰기 등
   - **업무(productivity)만 3개 추천하는 것은 절대 금지**
   - 일과 삶의 균형(work-life balance)을 반드시 고려

4. **제약사항 절대 준수**: 금지 시간대, 운동 제한 등을 반드시 지킬 것

5. **생활 패턴 기반 추천**: 사용자의 실제 기상/취침 시간, 업무 시간, 활동 시간대 선호를 반드시 고려
   - 예: 항상 7시에 기상한다면 6시 운동 추천 금지
   - 예: 저녁형(evening 70%)이면 아침 활동보다 저녁 활동 우선 추천

6. **데이터 기반 추천**: 성공률 높은 시간대와 사용자 행동 패턴을 우선 고려

7. **목표 달성 지원**: 이번 주 운동 목표 남은 횟수를 고려

8. **현실적 제안**: 사용자의 직업, 시간대, 생활 리듬에 맞는 실행 가능한 활동

9. **요일 고려**: 바쁜 요일에는 가벼운 활동, 여유로운 요일에는 시간이 필요한 활동

**[시간대별 추천 가이드]**
- 오전(5-12시): 계획, 학습, 중요 업무, 아침 운동
- 오후(12-18시): 실행, 프로젝트 작업, 네트워킹, 짧은 휴식, 가벼운 운동
- 저녁(18-22시): 복습, 정리, 가벼운 학습, 내일 준비, 저녁 운동

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

**중요: 위의 "사용자 맞춤 추천" 섹션에 명시된 이 사용자의 실제 직업(${context.profile.job || '미설정'})과 목표(${context.profile.goal || '미설정'})를 반드시 반영하여 추천할 것. 하드코딩된 예시가 아닌 실제 사용자에게 맞는 활동을 추천해야 함.**

위 형식을 정확히 따라 응답하세요. 반드시 순수 JSON만 반환하고, 추가 설명이나 마크다운 없이 응답하세요.`;

        console.log("[AI Suggest Schedules] OpenAI 요청 시작");
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "당신은 전문 성장 코치 AI입니다. 사용자의 목표와 상황에 맞는 구체적이고 실행 가능한 일정을 추천합니다. 반드시 순수 JSON 형식으로만 응답하세요."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.8,
            response_format: { type: "json_object" }
        });

        console.log("[AI Suggest Schedules] OpenAI 응답 성공");
        const responseText = completion.choices[0]?.message?.content || "{}";

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (e) {
            console.error("[AI Suggest Schedules] JSON 파싱 실패:", responseText);
            throw new Error("Invalid JSON response from OpenAI");
        }

        // Add unique IDs to suggestions
        const suggestionsWithIds = (parsedResponse.suggestions || []).map((suggestion: any, index: number) => ({
            ...suggestion,
            id: `ai-suggestion-${Date.now()}-${index}`,
        }));

        console.log("[AI Suggest Schedules] 생성된 추천:", suggestionsWithIds);

        const responseData = {
            suggestions: suggestionsWithIds,
        };

        // Cache the result
        setCachedSuggestions(session.user.email, requestCount, responseData);

        return NextResponse.json(responseData);
    } catch (error: any) {
        console.error("[AI Suggest Schedules] 에러 발생:", error);
        console.error("[AI Suggest Schedules] 에러 상세:", error.message);
        return NextResponse.json(
            { error: "Failed to generate schedule suggestions", details: error.message },
            { status: 500 }
        );
    }
}
