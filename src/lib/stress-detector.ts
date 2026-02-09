import db from "@/lib/db";

/**
 * 자동 스트레스/에너지 레벨 감지 서비스
 *
 * 사용자의 행동 패턴으로 스트레스와 에너지를 자동 추정:
 * - 일정 건너뛰기 빈도
 * - 일정 수정 빈도
 * - 완료율
 * - 활동 시간
 */

export interface DailyState {
    energy_level: number; // 1-10
    stress_level: number; // 1-10
    completion_rate: number; // 0-1
    activity_count: number;
    detected_at: string;
}

/**
 * 오늘의 스트레스/에너지 레벨 자동 추정
 */
export async function detectDailyState(userEmail: string): Promise<DailyState> {
    const supabase = db.client;
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;

    console.log(`[Stress Detector] Analyzing state for ${today}`);

    // 오늘의 모든 이벤트 가져오기
    const { data: events, error } = await supabase
        .from('user_events')
        .select('event_type, metadata, created_at')
        .eq('user_email', userEmail)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

    if (error || !events) {
        console.error('[Stress Detector] Error fetching events:', error);
        return {
            energy_level: 5,
            stress_level: 5,
            completion_rate: 0,
            activity_count: 0,
            detected_at: new Date().toISOString(),
        };
    }

    // 이벤트 분석
    const completedCount = events.filter(e =>
        e.event_type.includes('completed') ||
        e.event_type === 'ai_suggestion_accepted'
    ).length;

    const skippedCount = events.filter(e =>
        e.event_type.includes('skipped') ||
        e.event_type.includes('cancelled')
    ).length;

    const rescheduledCount = events.filter(e =>
        e.event_type === 'schedule_rescheduled'
    ).length;

    const totalActivities = completedCount + skippedCount;
    const completionRate = totalActivities > 0 ? completedCount / totalActivities : 0;

    // 스트레스 레벨 계산
    let stressLevel = 5; // 기본값

    // 완료율이 낮으면 스트레스 높음
    if (completionRate < 0.3) {
        stressLevel = 8;
    } else if (completionRate < 0.6) {
        stressLevel = 6;
    } else if (completionRate >= 0.8) {
        stressLevel = 3; // 잘 완료하면 스트레스 낮음
    }

    // 일정 재조정이 많으면 스트레스 증가
    if (rescheduledCount > 3) {
        stressLevel = Math.min(10, stressLevel + 2);
    }

    // 건너뛴 일정이 많으면 스트레스 증가
    if (skippedCount > 3) {
        stressLevel = Math.min(10, stressLevel + 2);
    }

    // 에너지 레벨 계산 (완료율과 활동량 기반)
    let energyLevel = 5;

    if (completionRate >= 0.8 && completedCount >= 3) {
        energyLevel = 8; // 높은 완료율 + 많은 활동 = 에너지 높음
    } else if (completionRate >= 0.6) {
        energyLevel = 6;
    } else if (completionRate < 0.3) {
        energyLevel = 3; // 낮은 완료율 = 에너지 부족
    }

    // 활동이 아예 없으면 에너지 낮음
    if (totalActivities === 0) {
        energyLevel = 4;
    }

    const state: DailyState = {
        energy_level: energyLevel,
        stress_level: stressLevel,
        completion_rate: completionRate,
        activity_count: totalActivities,
        detected_at: new Date().toISOString(),
    };

    console.log('[Stress Detector] Detected state:', state);

    // 이벤트로 기록
    await supabase.from('user_events').insert({
        id: crypto.randomUUID(),
        user_email: userEmail,
        event_type: 'daily_state_detected',
        start_at: new Date().toISOString(),
        metadata: state,
    });

    return state;
}

/**
 * 스트레스 높을 때 자동 추천
 */
export function getStressReliefSuggestions(stressLevel: number): string[] {
    if (stressLevel >= 8) {
        return [
            "5분 심호흡 휴식",
            "짧은 산책 (10분)",
            "스트레칭",
            "물 한 잔 마시고 창밖 보기",
        ];
    } else if (stressLevel >= 6) {
        return [
            "15분 휴식",
            "좋아하는 음악 듣기",
            "커피 한 잔과 함께 쉬기",
        ];
    }
    return [];
}

/**
 * 에너지 낮을 때 자동 추천
 */
export function getEnergyBoostSuggestions(energyLevel: number): string[] {
    if (energyLevel <= 3) {
        return [
            "가벼운 간식 먹기",
            "10분 파워 낮잠",
            "짧은 스트레칭",
            "물 마시기",
        ];
    } else if (energyLevel <= 5) {
        return [
            "커피/차 마시기",
            "5분 산책",
            "간단한 스낵",
        ];
    }
    return [];
}
