/**
 * 사용자 플랜 관리 유틸리티
 * - 플랜 조회, 기능 접근 권한 체크, 사용량 관리
 *
 * 플랜 구조:
 * - Standard (무료): 일일 AI 50회
 * - Pro (₩9,900): 일일 AI 100회 + 리스크 알림, 스마트 브리핑
 * - Max (₩21,900): 무제한 + 장기 기억, 선제적 제안
 *
 * 기본 AI 기능 (일일 제한):
 * - 채팅, 일정 추가/수정, 아침 인사, 일정 추천, 학습 팁 등
 *
 * 고급 기능 (플랜별):
 * - 리스크 알림: Pro, Max
 * - 스마트 브리핑: Pro, Max
 * - 장기 기억 (RAG): Max only
 * - 선제적 제안: 전 플랜 (규칙 기반, AI 비용 $0)
 */

import { supabase } from "./supabase";

// 플랜 타입
export type UserPlanType = "standard" | "pro" | "max";

// 플랜별 기능 정의
export interface PlanFeatures {
    jarvis_memory: boolean;          // 장기 기억 시스템 (Max)
    risk_alerts: boolean;            // 리스크 알림 (Pro, Max)
    smart_briefing: boolean;         // 스마트 브리핑 (Pro, Max)
    proactive_suggestions: boolean;  // 선제적 제안 (전 플랜)
}

// 플랜 정보
export interface UserPlan {
    plan: UserPlanType;
    isActive: boolean;
    dailyAiCallsLimit: number | null;  // null = 무제한 (Max)
    memoryStorageMb: number;
    features: PlanFeatures;
    expiresAt: string | null;
}

// 사용량 정보
export interface UsageInfo {
    canUse: boolean;
    currentUsage: number;
    dailyLimit: number | null;
    remaining: number | null;
}

// 기본 플랜 설정 (Standard)
const DEFAULT_PLAN: UserPlan = {
    plan: "standard",
    isActive: true,
    dailyAiCallsLimit: 50,  // Standard: 50회/일
    memoryStorageMb: 0,
    features: {
        jarvis_memory: false,
        risk_alerts: false,
        smart_briefing: false,
        proactive_suggestions: false,
    },
    expiresAt: null,
};

// 플랜별 상세 정보
export const PLAN_DETAILS: Record<UserPlanType, {
    name: string;
    nameKo: string;
    price: number;
    monthlyPrice: string;
    dailyAiCallsLimit: number | null;
    features: string[];
    highlights: string[];
}> = {
    standard: {
        name: "Standard",
        nameKo: "스탠다드",
        price: 0,
        monthlyPrice: "무료",
        dailyAiCallsLimit: 50,
        features: [
            "일일 AI 호출 50회",
            "AI 채팅",
            "일정 추가/수정/삭제",
            "AI 아침 인사",
            "일정 추천",
            "학습 팁",
            "10분 전 준비 알림",
            "리소스 추천 (유튜브)",
            "선제적 알림",
        ],
        highlights: ["기본 AI 비서 기능", "선제적 일정/목표 알림"],
    },
    pro: {
        name: "Pro",
        nameKo: "프로",
        price: 9900,
        monthlyPrice: "₩9,900/월",
        dailyAiCallsLimit: 100,
        features: [
            "일일 AI 호출 100회",
            "Standard의 모든 기능",
            "리스크 알림",
            "스마트 브리핑",
            "선제적 알림",
            "100MB 메모리 저장소",
        ],
        highlights: ["일정 충돌/준비시간 부족 경고", "맞춤 뉴스 브리핑", "선제적 일정/목표 알림"],
    },
    max: {
        name: "Max",
        nameKo: "맥스",
        price: 21900,
        monthlyPrice: "₩21,900/월",
        dailyAiCallsLimit: null,  // 무제한
        features: [
            "무제한 AI 호출",
            "Pro의 모든 기능",
            "AI 장기 기억 (RAG)",
            "선제적 제안",
            "1GB 메모리 저장소",
        ],
        highlights: ["AI가 과거 대화/메모 기억", "먼저 인사이트 제안"],
    },
};

/**
 * 이메일로 사용자 ID 조회
 */
async function getUserIdByEmail(email: string): Promise<string | null> {
    const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

    if (error || !data) {
        console.error("[UserPlan] Failed to get user ID:", error);
        return null;
    }

    return data.id;
}

/**
 * 사용자 플랜 조회
 */
export async function getUserPlan(email: string): Promise<UserPlan> {
    try {
        const userId = await getUserIdByEmail(email);
        if (!userId) {
            return DEFAULT_PLAN;
        }

        const { data, error } = await supabase
            .from("user_subscriptions")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error || !data) {
            // 구독 정보가 없으면 스탠다드 플랜 생성
            await createStandardSubscription(userId);
            return DEFAULT_PLAN;
        }

        return {
            plan: data.plan as UserPlanType,
            isActive: data.is_active,
            dailyAiCallsLimit: data.daily_ai_calls_limit,
            memoryStorageMb: data.memory_storage_mb,
            features: data.features as PlanFeatures,
            expiresAt: data.expires_at,
        };
    } catch (error) {
        console.error("[UserPlan] Error getting user plan:", error);
        return DEFAULT_PLAN;
    }
}

/**
 * 스탠다드 구독 생성
 */
async function createStandardSubscription(userId: string): Promise<void> {
    try {
        await supabase
            .from("user_subscriptions")
            .upsert({
                user_id: userId,
                plan: "standard",
            }, {
                onConflict: "user_id",
            });
    } catch (error) {
        console.error("[UserPlan] Error creating standard subscription:", error);
    }
}

/**
 * 특정 기능 사용 가능 여부 확인
 */
export async function canUseFeature(
    email: string,
    feature: keyof PlanFeatures
): Promise<boolean> {
    const plan = await getUserPlan(email);
    return plan.isActive && plan.features[feature];
}

/**
 * 맥스 플랜 여부 확인 (간편 함수)
 */
export async function isMaxPlan(email: string): Promise<boolean> {
    const plan = await getUserPlan(email);
    return plan.plan === "max" && plan.isActive;
}

/**
 * 프로 이상 플랜 여부 확인
 */
export async function isProOrAbove(email: string): Promise<boolean> {
    const plan = await getUserPlan(email);
    return (plan.plan === "pro" || plan.plan === "max") && plan.isActive;
}

/**
 * AI 호출 가능 여부 확인 (일일 제한)
 */
export async function checkAiUsageLimit(email: string): Promise<UsageInfo> {
    try {
        const userId = await getUserIdByEmail(email);
        if (!userId) {
            return {
                canUse: false,
                currentUsage: 0,
                dailyLimit: 50,
                remaining: 0,
            };
        }

        const plan = await getUserPlan(email);

        // 맥스 플랜은 무제한
        if (plan.dailyAiCallsLimit === null) {
            return {
                canUse: true,
                currentUsage: 0,
                dailyLimit: null,
                remaining: null,
            };
        }

        // 오늘 사용량 조회
        const today = new Date().toISOString().split("T")[0];
        const { data } = await supabase
            .from("ai_usage_daily")
            .select("total_calls")
            .eq("user_id", userId)
            .eq("usage_date", today)
            .single();

        const currentUsage = data?.total_calls || 0;
        const remaining = Math.max(0, plan.dailyAiCallsLimit - currentUsage);

        return {
            canUse: currentUsage < plan.dailyAiCallsLimit,
            currentUsage,
            dailyLimit: plan.dailyAiCallsLimit,
            remaining,
        };
    } catch (error) {
        console.error("[UserPlan] Error checking AI usage:", error);
        return {
            canUse: true,  // 에러 시 허용 (UX 우선)
            currentUsage: 0,
            dailyLimit: 50,
            remaining: 50,
        };
    }
}

/**
 * AI 호출 기록 (사용량 증가)
 */
export async function recordAiUsage(
    email: string,
    callType: string,
    inputTokens: number = 0,
    outputTokens: number = 0
): Promise<void> {
    try {
        const userId = await getUserIdByEmail(email);
        if (!userId) return;

        const today = new Date().toISOString().split("T")[0];

        // Upsert로 오늘 레코드 생성 또는 업데이트
        const { data: existing } = await supabase
            .from("ai_usage_daily")
            .select("*")
            .eq("user_id", userId)
            .eq("usage_date", today)
            .single();

        if (existing) {
            // 기존 레코드 업데이트
            const updates: Record<string, any> = {
                total_calls: existing.total_calls + 1,
                total_input_tokens: existing.total_input_tokens + inputTokens,
                total_output_tokens: existing.total_output_tokens + outputTokens,
                updated_at: new Date().toISOString(),
            };

            // 특정 호출 타입 카운트 증가
            const callTypeColumn = `${callType}_calls`;
            if (existing[callTypeColumn] !== undefined) {
                updates[callTypeColumn] = existing[callTypeColumn] + 1;
            }

            await supabase
                .from("ai_usage_daily")
                .update(updates)
                .eq("id", existing.id);
        } else {
            // 새 레코드 생성
            const newRecord: Record<string, any> = {
                user_id: userId,
                usage_date: today,
                total_calls: 1,
                total_input_tokens: inputTokens,
                total_output_tokens: outputTokens,
            };

            // 특정 호출 타입 카운트 설정
            const callTypeColumn = `${callType}_calls`;
            newRecord[callTypeColumn] = 1;

            await supabase
                .from("ai_usage_daily")
                .insert(newRecord);
        }
    } catch (error) {
        console.error("[UserPlan] Error recording AI usage:", error);
    }
}

/**
 * 사용자 AI 사용 통계 조회 (대시보드용)
 */
export async function getAiUsageStats(email: string, days: number = 7): Promise<{
    totalCalls: number;
    byType: Record<string, number>;
    dailyAverage: number;
}> {
    try {
        const userId = await getUserIdByEmail(email);
        if (!userId) {
            return { totalCalls: 0, byType: {}, dailyAverage: 0 };
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data } = await supabase
            .from("ai_usage_daily")
            .select("*")
            .eq("user_id", userId)
            .gte("usage_date", startDate.toISOString().split("T")[0]);

        if (!data || data.length === 0) {
            return { totalCalls: 0, byType: {}, dailyAverage: 0 };
        }

        let totalCalls = 0;
        const byType: Record<string, number> = {};

        for (const day of data) {
            totalCalls += day.total_calls || 0;

            // 타입별 집계
            if (day.morning_greeting_calls) byType.morning_greeting = (byType.morning_greeting || 0) + day.morning_greeting_calls;
            if (day.schedule_prep_calls) byType.schedule_prep = (byType.schedule_prep || 0) + day.schedule_prep_calls;
            if (day.resource_recommend_calls) byType.resource_recommend = (byType.resource_recommend || 0) + day.resource_recommend_calls;
            if (day.suggest_schedules_calls) byType.suggest_schedules = (byType.suggest_schedules || 0) + day.suggest_schedules_calls;
            if (day.memory_search_calls) byType.memory_search = (byType.memory_search || 0) + day.memory_search_calls;
            if (day.jarvis_calls) byType.jarvis = (byType.jarvis || 0) + day.jarvis_calls;
        }

        return {
            totalCalls,
            byType,
            dailyAverage: Math.round(totalCalls / days),
        };
    } catch (error) {
        console.error("[UserPlan] Error getting usage stats:", error);
        return { totalCalls: 0, byType: {}, dailyAverage: 0 };
    }
}

/**
 * 플랜 업그레이드 (관리자용 또는 결제 시스템 연동)
 */
export async function upgradePlan(
    email: string,
    newPlan: UserPlanType,
    durationDays?: number
): Promise<boolean> {
    try {
        const userId = await getUserIdByEmail(email);
        if (!userId) return false;

        const expiresAt = durationDays
            ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
            : null;

        const { error } = await supabase
            .from("user_subscriptions")
            .upsert({
                user_id: userId,
                plan: newPlan,
                is_active: true,
                expires_at: expiresAt,
                started_at: new Date().toISOString(),
            }, {
                onConflict: "user_id",
            });

        if (error) {
            console.error("[UserPlan] Error upgrading plan:", error);
            return false;
        }

        console.log(`[UserPlan] User ${email} upgraded to ${newPlan}`);
        return true;
    } catch (error) {
        console.error("[UserPlan] Error upgrading plan:", error);
        return false;
    }
}
