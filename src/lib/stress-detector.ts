import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * 자동 스트레스/에너지 레벨 감지 서비스
 *
 * 사용자의 customGoals 행동 패턴으로 스트레스와 에너지를 자동 추정:
 * - 일정 건너뛰기 빈도
 * - 완료율
 * - 일정 밀도
 * - 활동 시간대
 */

export interface DailyState {
    energy_level: number; // 1-10
    stress_level: number; // 1-10
    completion_rate: number; // 0-1
    activity_count: number;
    completed_count: number;
    skipped_count: number;
    detected_at: string;
}

/**
 * 오늘의 스트레스/에너지 레벨 자동 추정
 * customGoals 기반 — 별도 이벤트 테이블 불필요
 */
export async function detectDailyState(userEmail: string): Promise<DailyState> {
    const now = new Date();
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
    const dayOfWeek = kst.getDay();
    const currentHour = kst.getHours();

    const { data: userData } = await supabaseAdmin
        .from("users")
        .select("profile")
        .eq("email", userEmail)
        .maybeSingle();

    const customGoals = userData?.profile?.customGoals || [];

    // 오늘 해당하는 일정 필터
    const todayGoals = customGoals.filter((g: any) => {
        if (g.specificDate === todayStr) return true;
        if (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate) {
            if (g.startDate && todayStr < g.startDate) return false;
            if (g.endDate && todayStr > g.endDate) return false;
            return true;
        }
        return false;
    });

    const completedCount = todayGoals.filter((g: any) => g.completed).length;
    const skippedCount = todayGoals.filter((g: any) => g.skipped).length;
    const totalCount = todayGoals.length;
    const resolvedCount = completedCount + skippedCount;
    const completionRate = resolvedCount > 0 ? completedCount / resolvedCount : 0;

    // 스트레스 레벨 계산
    let stressLevel = 5;

    // 일정 밀도가 높으면 스트레스 증가
    if (totalCount >= 8) {
        stressLevel += 2;
    } else if (totalCount >= 5) {
        stressLevel += 1;
    }

    // 완료율이 낮으면 스트레스 증가
    if (resolvedCount > 0) {
        if (completionRate < 0.3) {
            stressLevel += 2;
        } else if (completionRate < 0.5) {
            stressLevel += 1;
        } else if (completionRate >= 0.8) {
            stressLevel -= 2;
        }
    }

    // 건너뛴 일정이 많으면 스트레스 증가
    if (skippedCount >= 3) {
        stressLevel += 1;
    }

    // 오후 늦은 시간인데 미완료가 많으면 스트레스 증가
    const pendingCount = totalCount - resolvedCount;
    if (currentHour >= 18 && pendingCount > 3) {
        stressLevel += 1;
    }

    stressLevel = Math.max(1, Math.min(10, stressLevel));

    // 에너지 레벨 계산
    let energyLevel = 5;

    if (completionRate >= 0.8 && completedCount >= 3) {
        energyLevel = 8;
    } else if (completionRate >= 0.6 && completedCount >= 2) {
        energyLevel = 7;
    } else if (completionRate < 0.3 && resolvedCount > 0) {
        energyLevel = 3;
    }

    // 일정이 아예 없으면 중간
    if (totalCount === 0) {
        energyLevel = 5;
        stressLevel = 3;
    }

    // 아침 시간대에는 에너지 보정
    if (currentHour >= 6 && currentHour <= 10) {
        energyLevel = Math.min(10, energyLevel + 1);
    }
    // 오후 3-5시 슬럼프
    if (currentHour >= 15 && currentHour <= 17) {
        energyLevel = Math.max(1, energyLevel - 1);
    }

    energyLevel = Math.max(1, Math.min(10, energyLevel));

    return {
        energy_level: energyLevel,
        stress_level: stressLevel,
        completion_rate: completionRate,
        activity_count: totalCount,
        completed_count: completedCount,
        skipped_count: skippedCount,
        detected_at: new Date().toISOString(),
    };
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
