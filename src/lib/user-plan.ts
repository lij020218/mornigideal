/**
 * 사용자 플랜 관리 유틸리티
 * - 플랜 조회, 기능 접근 권한 체크, 사용량 관리
 *
 * 플랜 구조:
 * - Free (무료): 일일 AI 30회 + 컨텍스트 융합, 메모리, 선제적 알림
 * - Pro (₩6,900): 일일 AI 100회 + ReAct 에이전트, 리스크 알림, 스마트 브리핑
 * - Max (₩14,900): 무제한 + 장기 기억, 자동 실행
 *
 * 규칙 기반 기능 ($0 비용)은 전 플랜 제공:
 * - 의도 분류, 컨텍스트 융합, 메모리 컨텍스트, 선제적 알림, 메모리 서피싱
 */

import { supabaseAdmin } from "./supabase-admin";

// 플랜 타입
export type UserPlanType = "free" | "pro" | "max";

// 플랜별 기능 정의
export interface PlanFeatures {
    jarvis_memory: boolean;          // 장기 기억 시스템 (Max)
    risk_alerts: boolean;            // 리스크 알림 (Pro, Max)
    smart_briefing: boolean;         // 스마트 브리핑 (Pro, Max)
    proactive_suggestions: boolean;  // 선제적 제안 (전 플랜)
    mood_patterns: boolean;          // 기분 패턴 분석 (Pro+)
    ai_templates: boolean;           // AI 맞춤 루틴 생성 (Pro+)
    voice_journal: boolean;          // 음성 저널 (Pro+)
    health_sync: boolean;            // 건강 데이터 동기화 (Pro+)
    github_sync: boolean;            // GitHub 연동 (Max)
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

// 기본 플랜 설정 (Free)
const DEFAULT_PLAN: UserPlan = {
    plan: "free",
    isActive: true,
    dailyAiCallsLimit: 30,  // Free: 30회/일
    memoryStorageMb: 50,
    features: {
        jarvis_memory: false,
        risk_alerts: false,
        smart_briefing: false,
        proactive_suggestions: true,
        mood_patterns: false,
        ai_templates: false,
        voice_journal: false,
        health_sync: false,
        github_sync: false,
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
    free: {
        name: "Free",
        nameKo: "무료",
        price: 0,
        monthlyPrice: "무료",
        dailyAiCallsLimit: 30,
        features: [
            "일일 AI 호출 30회",
            "AI 채팅 + 일정 관리",
            "컨텍스트 융합 (날씨+일정)",
            "메모리 서피싱",
            "선제적 알림",
            "주간 리포트",
            "50MB 메모리 저장소",
        ],
        highlights: ["AI 일정 비서", "선제적 알림", "메모리 서피싱"],
    },
    pro: {
        name: "Pro",
        nameKo: "프로",
        price: 6900,
        monthlyPrice: "₩6,900/월",
        dailyAiCallsLimit: 100,
        features: [
            "일일 AI 호출 100회",
            "Free의 모든 기능",
            "ReAct 다단계 에이전트",
            "리스크 알림",
            "스마트 브리핑",
            "100MB 메모리 저장소",
        ],
        highlights: ["다단계 추론 에이전트", "일정 충돌 경고", "맞춤 브리핑"],
    },
    max: {
        name: "Max",
        nameKo: "맥스",
        price: 14900,
        monthlyPrice: "₩14,900/월",
        dailyAiCallsLimit: null,  // 무제한
        features: [
            "무제한 AI 호출",
            "Pro의 모든 기능",
            "AI 장기 기억 (RAG)",
            "자동 실행",
            "1GB 메모리 저장소",
        ],
        highlights: ["AI가 과거 대화 기억", "자동 일정 최적화"],
    },
};

/**
 * 이메일로 사용자 ID 조회
 */
async function getUserIdByEmail(email: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

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

        const { data, error } = await supabaseAdmin
            .from("user_subscriptions")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

        if (error || !data) {
            // 구독 정보가 없으면 Free 플랜 생성
            await createFreeSubscription(userId);
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
 * Free 구독 생성
 */
async function createFreeSubscription(userId: string): Promise<void> {
    try {
        await supabaseAdmin
            .from("user_subscriptions")
            .upsert({
                user_id: userId,
                plan: "free",
            }, {
                onConflict: "user_id",
            });
    } catch (error) {
        console.error("[UserPlan] Error creating free subscription:", error);
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
                dailyLimit: 40,
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
        const { data } = await supabaseAdmin
            .from("ai_usage_daily")
            .select("total_calls")
            .eq("user_id", userId)
            .eq("usage_date", today)
            .maybeSingle();

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
            dailyLimit: 40,
            remaining: 40,
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
        const { data: existing } = await supabaseAdmin
            .from("ai_usage_daily")
            .select("*")
            .eq("user_id", userId)
            .eq("usage_date", today)
            .maybeSingle();

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

            await supabaseAdmin
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

            await supabaseAdmin
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

        const { data } = await supabaseAdmin
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

        const { error } = await supabaseAdmin
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

        return true;
    } catch (error) {
        console.error("[UserPlan] Error upgrading plan:", error);
        return false;
    }
}
