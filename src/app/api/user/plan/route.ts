/**
 * 사용자 플랜 API
 * - GET: 현재 플랜 정보 및 사용량 조회
 * - POST: 플랜 업그레이드 (관리자/결제 시스템용)
 *
 * 플랜 구조:
 * - Free (무료): 일일 AI 30회 + 컨텍스트 융합, 선제적 알림
 * - Pro (₩6,900): 일일 AI 100회 + ReAct 에이전트, 리스크 알림
 * - Max (₩14,900): 무제한 + 장기 기억, 자동 실행
 */

import { NextRequest, NextResponse } from "next/server";
import {
    getUserPlan,
    getAiUsageStats,
    checkAiUsageLimit,
    upgradePlan,
    PLAN_DETAILS,
    UserPlanType,
} from "@/lib/user-plan";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const plan = await getUserPlan(email);
    const usage = await getAiUsageStats(email, 7);
    const usageLimit = await checkAiUsageLimit(email);
    const details = PLAN_DETAILS[plan.plan];

    return NextResponse.json({
        plan: {
            ...plan,
            name: details.name,
            nameKo: details.nameKo,
            price: details.price,
            monthlyPrice: details.monthlyPrice,
            featureList: details.features,
            highlights: details.highlights,
        },
        usage,
        usageLimit,  // 오늘 사용량 및 남은 횟수
        allPlans: PLAN_DETAILS,
    });
});

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { newPlan, durationDays, adminKey } = await request.json();

    // 관리자 키 검증 (실제로는 결제 시스템과 연동)
    const validAdminKey = process.env.ADMIN_UPGRADE_KEY;
    if (adminKey !== validAdminKey) {
        return NextResponse.json(
            { error: "권한이 없습니다." },
            { status: 403 }
        );
    }

    if (!newPlan || !["free", "pro", "max"].includes(newPlan)) {
        return NextResponse.json(
            { error: "유효한 플랜을 선택해주세요. (free, pro, max)" },
            { status: 400 }
        );
    }

    const success = await upgradePlan(
        email,
        newPlan as UserPlanType,
        durationDays
    );

    if (!success) {
        return NextResponse.json(
            { error: "플랜 변경에 실패했습니다." },
            { status: 500 }
        );
    }

    const updatedPlan = await getUserPlan(email);
    const details = PLAN_DETAILS[updatedPlan.plan];

    return NextResponse.json({
        success: true,
        plan: {
            ...updatedPlan,
            name: details.name,
            nameKo: details.nameKo,
            price: details.price,
            monthlyPrice: details.monthlyPrice,
            featureList: details.features,
            highlights: details.highlights,
        },
    });
});
