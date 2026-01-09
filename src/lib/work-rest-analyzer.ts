import db from "@/lib/db";

/**
 * 업무-휴식 균형 분석기
 *
 * 사용자의 일정을 분석하여:
 * - 업무 강도 (과밀, 정상, 여유)
 * - 휴식 패턴 (부족, 정상, 충분)
 * - 빈 시간대 감지
 * - 주말/연휴 여부
 */

export interface WorkRestBalance {
    // 업무 강도
    workIntensity: 'overloaded' | 'busy' | 'normal' | 'light' | 'empty';
    workHoursToday: number; // 오늘 업무 시간 (시간)
    workEventsToday: number; // 오늘 업무 일정 개수

    // 휴식 패턴
    restStatus: 'critical' | 'insufficient' | 'normal' | 'good';
    lastRestTime: string | null; // 마지막 휴식 시간
    hoursSinceRest: number; // 마지막 휴식 이후 시간

    // 빈 시간
    hasEmptySlots: boolean;
    emptyHoursToday: number; // 오늘 빈 시간 (시간)

    // 특수 상황
    isWeekend: boolean;
    isHoliday: boolean;
    upcomingLongBreak: boolean; // 3일 이상 연휴 다가오는지

    // 추천 방향
    recommendationType: 'rest' | 'productivity' | 'leisure' | 'travel' | 'balanced';
    reason: string;
}

/**
 * 오늘의 업무-휴식 균형 분석
 */
export async function analyzeWorkRestBalance(userEmail: string): Promise<WorkRestBalance> {
    const supabase = db.client;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;
    const currentHour = now.getHours();

    console.log(`[Work-Rest Analyzer] Analyzing balance for ${userEmail}`);

    // 사용자 프로필 가져오기 (customGoals에 일정 저장됨)
    const { data: userData } = await supabase
        .from('users')
        .select('profile')
        .eq('email', userEmail)
        .single();

    const profile = userData?.profile || {};
    const customGoals = profile.customGoals || [];

    // 오늘의 일정 필터링
    const dayOfWeek = now.getDay(); // 0=일요일
    const todayEvents = customGoals.filter((goal: any) => {
        // specificDate가 오늘인 경우
        if (goal.specificDate === today) return true;
        // 반복 일정이고 오늘 요일에 해당하는 경우
        if (goal.daysOfWeek && goal.daysOfWeek.includes(dayOfWeek) && !goal.specificDate) return true;
        return false;
    });

    console.log(`[Work-Rest Analyzer] Found ${todayEvents.length} events for today`);

    // 업무 vs 휴식 일정 분류
    const workCategories = ['업무', '회의', '작업', '공부', '학습', '개발', '미팅', 'work', 'meeting'];
    const restCategories = ['휴식', '산책', '명상', '요가', '운동', '스트레칭', 'rest', 'break', 'relax'];
    const leisureCategories = ['취미', '영화', '독서', '게임', '여행', 'hobby', 'movie', 'travel'];

    const workEvents = todayEvents.filter((e: any) =>
        workCategories.some(cat => e.text?.toLowerCase().includes(cat.toLowerCase()))
    );

    const restEvents = todayEvents.filter((e: any) =>
        restCategories.some(cat => e.text?.toLowerCase().includes(cat.toLowerCase()))
    );

    const leisureEvents = todayEvents.filter((e: any) =>
        leisureCategories.some(cat => e.text?.toLowerCase().includes(cat.toLowerCase()))
    );

    // 업무 시간 계산 (대략적)
    const workHoursToday = workEvents.length * 1.5; // 평균 1.5시간씩으로 추정
    const restHoursToday = restEvents.length * 0.5; // 평균 30분씩

    // 업무 강도 판단
    let workIntensity: WorkRestBalance['workIntensity'];
    if (workEvents.length === 0 && todayEvents.length === 0) {
        workIntensity = 'empty'; // 일정 없음
    } else if (workEvents.length >= 6 || workHoursToday >= 8) {
        workIntensity = 'overloaded'; // 과밀
    } else if (workEvents.length >= 4 || workHoursToday >= 6) {
        workIntensity = 'busy'; // 바쁨
    } else if (workEvents.length >= 2) {
        workIntensity = 'normal'; // 정상
    } else {
        workIntensity = 'light'; // 여유
    }

    // 휴식 상태 판단
    let restStatus: WorkRestBalance['restStatus'];
    if (workEvents.length > 4 && restEvents.length === 0) {
        restStatus = 'critical'; // 위험: 업무만 많고 휴식 없음
    } else if (workEvents.length > 2 && restEvents.length === 0) {
        restStatus = 'insufficient'; // 부족
    } else if (restEvents.length >= 2) {
        restStatus = 'good'; // 좋음
    } else {
        restStatus = 'normal'; // 보통
    }

    // 마지막 휴식 시간 찾기
    const sortedRestEvents = restEvents.sort((a: any, b: any) => {
        const timeA = a.startTime || '00:00';
        const timeB = b.startTime || '00:00';
        return timeB.localeCompare(timeA);
    });
    const lastRestTime = sortedRestEvents.length > 0 ? sortedRestEvents[0].startTime : null;

    // 마지막 휴식 이후 시간 계산
    let hoursSinceRest = 0;
    if (lastRestTime) {
        const lastRestHour = parseInt(lastRestTime.split(':')[0]);
        hoursSinceRest = currentHour - lastRestHour;
    } else {
        hoursSinceRest = currentHour; // 오늘 휴식 없으면 현재 시간
    }

    // 빈 시간 계산 (업무 시간 기준)
    const workStartHour = parseInt(profile.schedule?.workStart?.split(':')[0] || '9');
    const workEndHour = parseInt(profile.schedule?.workEnd?.split(':')[0] || '18');
    const totalWorkHours = workEndHour - workStartHour;
    const emptyHoursToday = Math.max(0, totalWorkHours - workHoursToday);
    const hasEmptySlots = emptyHoursToday > 2;

    // 주말/연휴 판단
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = false; // TODO: 실제 공휴일 API 연동

    // 다가오는 긴 휴식 (3일 이상)
    const upcomingLongBreak = isWeekend && dayOfWeek === 5; // 금요일이면 주말 다가옴

    // 추천 방향 결정
    let recommendationType: WorkRestBalance['recommendationType'];
    let reason: string;

    if (isWeekend || isHoliday) {
        if (upcomingLongBreak) {
            recommendationType = 'travel';
            reason = '주말/연휴 기간이므로 여행이나 장시간 여가 활동을 추천합니다.';
        } else {
            recommendationType = 'leisure';
            reason = '주말이므로 취미나 여가 활동을 추천합니다.';
        }
    } else if (workIntensity === 'overloaded' || restStatus === 'critical') {
        recommendationType = 'rest';
        reason = '업무 강도가 높고 휴식이 부족합니다. 짧은 휴식이 필수입니다.';
    } else if (workIntensity === 'empty' || hasEmptySlots) {
        recommendationType = 'productivity';
        reason = '오늘 일정이 여유롭습니다. 생산적인 활동이나 자기계발을 추천합니다.';
    } else if (hoursSinceRest > 4 && workIntensity === 'busy') {
        recommendationType = 'rest';
        reason = `마지막 휴식 이후 ${hoursSinceRest}시간이 지났습니다. 짧은 휴식을 권장합니다.`;
    } else {
        recommendationType = 'balanced';
        reason = '업무와 휴식이 균형을 이룹니다. 다양한 활동을 추천합니다.';
    }

    const balance: WorkRestBalance = {
        workIntensity,
        workHoursToday,
        workEventsToday: workEvents.length,
        restStatus,
        lastRestTime,
        hoursSinceRest,
        hasEmptySlots,
        emptyHoursToday,
        isWeekend,
        isHoliday,
        upcomingLongBreak,
        recommendationType,
        reason,
    };

    console.log('[Work-Rest Analyzer] Analysis result:', balance);

    // 분석 결과를 이벤트로 기록
    await supabase.from('user_events').insert({
        id: crypto.randomUUID(),
        user_email: userEmail,
        event_type: 'work_rest_analyzed',
        start_at: new Date().toISOString(),
        metadata: balance,
    });

    return balance;
}

/**
 * 추천 방향에 따른 구체적인 제안
 */
export function getRecommendationsByType(type: WorkRestBalance['recommendationType']): {
    categories: string[];
    examples: string[];
    priority: string;
} {
    switch (type) {
        case 'rest':
            return {
                categories: ['wellness', 'exercise'],
                examples: [
                    '5-10분 짧은 산책',
                    '스트레칭',
                    '눈 감고 심호흡 3분',
                    '창밖 보며 물 한 잔',
                    '가벼운 명상',
                ],
                priority: 'high',
            };

        case 'productivity':
            return {
                categories: ['productivity', 'learning'],
                examples: [
                    '미뤄둔 작업 처리',
                    '온라인 강의 1개 수강',
                    '업무 관련 문서 읽기',
                    '새로운 기술 학습',
                    '포트폴리오 정리',
                ],
                priority: 'medium',
            };

        case 'leisure':
            return {
                categories: ['leisure', 'wellness'],
                examples: [
                    '좋아하는 책 읽기',
                    '영화/드라마 감상',
                    '취미 활동',
                    '친구와 만남',
                    '카페에서 여유',
                ],
                priority: 'medium',
            };

        case 'travel':
            return {
                categories: ['leisure', 'social'],
                examples: [
                    '근교 여행 계획',
                    '주말 나들이',
                    '새로운 장소 탐험',
                    '가족과 외출',
                    '자연 속 산책',
                ],
                priority: 'high',
            };

        case 'balanced':
        default:
            return {
                categories: ['productivity', 'learning', 'wellness'],
                examples: [
                    '짧은 학습 + 휴식',
                    '가벼운 운동',
                    '생산적인 취미',
                    '책 읽기',
                    '자기계발',
                ],
                priority: 'medium',
            };
    }
}
