/**
 * 사용자 플랜 관리 React Hook
 * - 플랜 정보 조회
 * - 기능 접근 권한 체크
 * - AI 사용량 모니터링
 *
 * 플랜 구조:
 * - Standard (무료): 일일 AI 50회
 * - Pro (₩9,900): 일일 AI 100회 + 리스크 알림, 스마트 브리핑
 * - Max (₩21,900): 무제한 + 장기 기억
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

// 플랜 타입
export type UserPlanType = "standard" | "pro" | "max";

// 플랜 기능
export interface PlanFeatures {
    jarvis_memory: boolean;
    risk_alerts: boolean;
    smart_briefing: boolean;
    proactive_suggestions: boolean;
}

// 플랜 정보
export interface UserPlanInfo {
    plan: UserPlanType;
    isActive: boolean;
    dailyAiCallsLimit: number | null;
    memoryStorageMb: number;
    features: PlanFeatures;
    expiresAt: string | null;
    name: string;
    nameKo: string;
    price: number;
    monthlyPrice: string;
    featureList: string[];
    highlights: string[];
}

// 사용량 정보
export interface UsageInfo {
    totalCalls: number;
    byType: Record<string, number>;
    dailyAverage: number;
}

// Hook 반환 타입
interface UseUserPlanReturn {
    plan: UserPlanInfo | null;
    usage: UsageInfo | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;

    // 편의 함수
    isMaxPlan: boolean;
    isProOrAbove: boolean;
    isStandard: boolean;
    canUseFeature: (feature: keyof PlanFeatures) => boolean;
}

export function useUserPlan(): UseUserPlanReturn {
    const { data: session, status } = useSession();
    const [plan, setPlan] = useState<UserPlanInfo | null>(null);
    const [usage, setUsage] = useState<UsageInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPlan = useCallback(async () => {
        if (status !== "authenticated" || !session?.user?.email) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch("/api/user/plan");

            if (!response.ok) {
                throw new Error("플랜 정보를 가져올 수 없습니다.");
            }

            const data = await response.json();
            setPlan(data.plan);
            setUsage(data.usage);
        } catch (err: any) {
            console.error("[useUserPlan] Error:", err);
            setError(err.message);

            // 기본값 설정 (에러 시 스탠다드 플랜으로)
            setPlan({
                plan: "standard",
                isActive: true,
                dailyAiCallsLimit: 50,
                memoryStorageMb: 0,
                features: {
                    jarvis_memory: false,
                    risk_alerts: false,
                    smart_briefing: false,
                    proactive_suggestions: false,
                },
                expiresAt: null,
                name: "Standard",
                nameKo: "스탠다드",
                price: 0,
                monthlyPrice: "무료",
                featureList: [],
                highlights: [],
            });
        } finally {
            setIsLoading(false);
        }
    }, [session?.user?.email, status]);

    useEffect(() => {
        fetchPlan();
    }, [fetchPlan]);

    // 편의 함수들
    const isMaxPlan = plan?.plan === "max" && plan?.isActive === true;
    const isProOrAbove = (plan?.plan === "pro" || plan?.plan === "max") && plan?.isActive === true;
    const isStandard = plan?.plan === "standard" && plan?.isActive === true;

    const canUseFeature = useCallback(
        (feature: keyof PlanFeatures): boolean => {
            if (!plan?.isActive) return false;
            return plan.features[feature] === true;
        },
        [plan]
    );

    return {
        plan,
        usage,
        isLoading,
        error,
        refetch: fetchPlan,
        isMaxPlan,
        isProOrAbove,
        isStandard,
        canUseFeature,
    };
}

/**
 * 특정 기능 사용 가능 여부만 확인하는 간단한 Hook
 */
export function useCanUseFeature(feature: keyof PlanFeatures): {
    canUse: boolean;
    isLoading: boolean;
    planName: string;
    requiredPlan: string;
} {
    const { plan, isLoading, canUseFeature } = useUserPlan();

    // 기능별 필요 플랜
    const requiredPlanMap: Record<keyof PlanFeatures, string> = {
        jarvis_memory: "맥스",
        risk_alerts: "프로",
        smart_briefing: "프로",
        proactive_suggestions: "스탠다드",
    };

    return {
        canUse: canUseFeature(feature),
        isLoading,
        planName: plan?.nameKo || "스탠다드",
        requiredPlan: requiredPlanMap[feature],
    };
}

/**
 * 맥스 플랜 여부만 확인하는 간단한 Hook
 */
export function useIsMaxPlan(): {
    isMax: boolean;
    isLoading: boolean;
} {
    const { isMaxPlan, isLoading } = useUserPlan();

    return {
        isMax: isMaxPlan,
        isLoading,
    };
}

/**
 * 프로 이상 플랜 여부 확인하는 Hook
 */
export function useIsProOrAbove(): {
    isPro: boolean;
    isLoading: boolean;
} {
    const { isProOrAbove, isLoading } = useUserPlan();

    return {
        isPro: isProOrAbove,
        isLoading,
    };
}
