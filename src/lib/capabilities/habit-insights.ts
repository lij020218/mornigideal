/**
 * Habit Insights Capability
 *
 * 7일 패턴 분석 — AI 호출 제거, 규칙 기반 인사이트 생성.
 * 6시간 Supabase 캐시 유지.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import {
    registerCapability,
    type CapabilityResult,
    type HabitInsightsParams,
    type HabitInsightsResult,
} from '@/lib/agent-capabilities';
import { logger } from '@/lib/logger';

/**
 * 카테고리 분류
 */
function categorizeSchedule(text: string): string {
    const t = text.toLowerCase();
    if (/운동|헬스|조깅|스트레칭|요가|필라테스|러닝|수영|등산|웨이트|자전거/.test(t)) return 'exercise';
    if (/공부|독서|학습|강의|수업|시험|과제|코딩|영어|토익/.test(t)) return 'study';
    if (/업무|회의|미팅|출근|퇴근|발표|보고서|프로젝트/.test(t)) return 'work';
    if (/휴식|취침|명상|수면|낮잠|기상|힐링/.test(t)) return 'rest';
    return 'hobby';
}

/**
 * 규칙 기반 인사이트 생성
 */
function generateRuleBasedInsight(
    categories: Record<string, number>,
    totalCount: number,
    completedCount: number,
): HabitInsightsResult {
    const total = totalCount;
    const rate = total > 0 ? completedCount / total : 0;

    // 우선순위 규칙 (위에서부터 매칭되면 반환)

    // 1. 일정 자체가 없음
    if (total === 0) {
        return { insight: '이번 주 일정이 비어있어요', suggestion: '작은 일정부터 추가해보시는 건 어떨까요', emoji: '📝', category: 'consistency' };
    }

    // 2. 완료율 기반
    if (rate >= 0.9 && total >= 5) {
        return { insight: '이번 주 완료율이 뛰어나요', suggestion: '이 페이스를 유지해보세요!', emoji: '🏆', category: 'consistency' };
    }
    if (rate < 0.3 && total >= 3) {
        return { insight: '이번 주 완료율이 낮아요', suggestion: '일정을 줄여 집중해보시는 건 어떨까요', emoji: '🎯', category: 'productivity' };
    }

    // 3. 운동 없음
    if (categories.exercise === 0 && total >= 3) {
        return { insight: '이번 주 운동 일정이 없어요', suggestion: '가벼운 스트레칭부터 시작해보세요', emoji: '💪', category: 'exercise' };
    }

    // 4. 휴식 없이 공부/업무만
    if (categories.rest === 0 && (categories.study + categories.work) >= 4) {
        return { insight: '공부와 업무에 집중하고 계시네요', suggestion: '충분한 휴식도 챙겨보시는 건 어떨까요', emoji: '☕', category: 'balance' };
    }

    // 5. 공부에 집중
    if (categories.study >= 3 && categories.study > categories.work) {
        return { insight: '학습에 열심히 투자하고 계세요', suggestion: '이 흐름을 이어가면 목표에 가까워져요', emoji: '📚', category: 'productivity' };
    }

    // 6. 운동 꾸준
    if (categories.exercise >= 3) {
        return { insight: '운동을 꾸준히 하고 계시네요', suggestion: '이 루틴을 유지하면 좋겠어요!', emoji: '🔥', category: 'exercise' };
    }

    // 7. 다양한 활동
    const activeCategories = Object.values(categories).filter(v => v > 0).length;
    if (activeCategories >= 3) {
        return { insight: '다양한 활동을 하고 계세요', suggestion: '이 균형을 유지해보세요!', emoji: '🌈', category: 'balance' };
    }

    // 8. 꾸준함
    if (total >= 5) {
        return { insight: '꾸준히 일정을 관리하고 계세요', suggestion: '이 페이스를 유지하면 목표 달성!', emoji: '🔥', category: 'consistency' };
    }

    // 9. 기본
    return { insight: '일정 관리를 시작하셨군요', suggestion: '하루 2-3개 목표가 적당해요', emoji: '✨', category: 'productivity' };
}

/**
 * 습관 인사이트 핵심 로직
 */
export async function generateHabitInsights(
    email: string,
    _params: HabitInsightsParams
): Promise<CapabilityResult<HabitInsightsResult>> {
    try {
        // 6시간 Supabase 캐시 확인
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const { data: cachedData, error: cacheError } = await supabaseAdmin
            .from('habit_insights_cache')
            .select('insights, created_at')
            .eq('email', email)
            .eq('date', today)
            .maybeSingle();

        if (cachedData && !cacheError) {
            const cacheAge = Date.now() - new Date(cachedData.created_at).getTime();
            const SIX_HOURS = 6 * 60 * 60 * 1000;
            if (cacheAge < SIX_HOURS) {
                return { success: true, data: cachedData.insights, costTier: 'free', cachedHit: true };
            }
        }

        // 사용자 프로필 조회
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('profile')
            .eq('email', email)
            .maybeSingle();

        const profile = user?.profile || {};
        const customGoals = profile.customGoals || [];

        if (customGoals.length === 0) {
            const emptyResult: HabitInsightsResult = {
                insight: '아직 등록된 일정이 없어요',
                suggestion: '일정을 추가하고 패턴을 분석해보세요!',
                emoji: '📝',
                category: 'consistency',
            };
            return { success: true, data: emptyResult, costTier: 'free', cachedHit: false };
        }

        // 최근 7일 일정 분석
        const now = new Date();
        const dayOfWeek = now.getDay();

        const recentSchedules = customGoals.filter((g: any) => {
            if (g.specificDate) {
                const scheduleDate = new Date(g.specificDate);
                const diff = (now.getTime() - scheduleDate.getTime()) / (1000 * 60 * 60 * 24);
                return diff >= 0 && diff <= 7;
            }
            return g.daysOfWeek?.includes(dayOfWeek);
        });

        // 카테고리별 분류
        const categories: Record<string, number> = {
            exercise: 0, study: 0, work: 0, rest: 0, hobby: 0,
        };

        recentSchedules.forEach((s: any) => {
            categories[categorizeSchedule(s.text || '')]++;
        });

        const completedCount = recentSchedules.filter((s: any) => s.completed).length;

        // 규칙 기반 인사이트 생성
        const result = generateRuleBasedInsight(categories, recentSchedules.length, completedCount);

        // Supabase 캐시 저장
        await supabaseAdmin
            .from('habit_insights_cache')
            .upsert({
                email,
                date: today,
                insights: result,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'email,date'
            });

        return { success: true, data: result, costTier: 'free', cachedHit: false };
    } catch (error) {
        logger.error('[HabitInsights] Error:', error);
        return {
            success: false,
            error: 'Failed to generate habit insights',
            data: { insight: '분석 준비 중', suggestion: '잠시 후 다시 확인해주세요', emoji: '⏳', category: 'consistency' },
            costTier: 'free',
            cachedHit: false,
        };
    }
}

// Register capability
registerCapability<HabitInsightsParams, HabitInsightsResult>({
    name: 'habit_insights',
    description: '7일 습관 패턴 분석',
    costTier: 'free',
    execute: generateHabitInsights,
});
