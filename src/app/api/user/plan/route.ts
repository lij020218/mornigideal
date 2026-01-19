/**
 * 사용자 플랜 API
 * - GET: 현재 플랜 정보 및 사용량 조회
 * - POST: 플랜 업그레이드 (관리자/결제 시스템용)
 *
 * 플랜 구조:
 * - Standard (₩4,900): 일일 AI 50회
 * - Pro (₩9,900): 일일 AI 100회 + 리스크 알림, 스마트 브리핑
 * - Max (₩21,900): 무제한 + 장기 기억, 선제적 제안
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
    getUserPlan,
    getAiUsageStats,
    checkAiUsageLimit,
    upgradePlan,
    PLAN_DETAILS,
    UserPlanType,
} from "@/lib/user-plan";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const plan = await getUserPlan(session.user.email);
        const usage = await getAiUsageStats(session.user.email, 7);
        const usageLimit = await checkAiUsageLimit(session.user.email);
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
    } catch (error: any) {
        console.error("[User Plan API] GET Error:", error);
        return NextResponse.json(
            { error: "플랜 정보 조회 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { newPlan, durationDays, adminKey } = await request.json();

        // 관리자 키 검증 (실제로는 결제 시스템과 연동)
        const validAdminKey = process.env.ADMIN_UPGRADE_KEY;
        if (adminKey !== validAdminKey) {
            return NextResponse.json(
                { error: "권한이 없습니다." },
                { status: 403 }
            );
        }

        if (!newPlan || !["standard", "pro", "max"].includes(newPlan)) {
            return NextResponse.json(
                { error: "유효한 플랜을 선택해주세요. (standard, pro, max)" },
                { status: 400 }
            );
        }

        const success = await upgradePlan(
            session.user.email,
            newPlan as UserPlanType,
            durationDays
        );

        if (!success) {
            return NextResponse.json(
                { error: "플랜 변경에 실패했습니다." },
                { status: 500 }
            );
        }

        const updatedPlan = await getUserPlan(session.user.email);
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
    } catch (error: any) {
        console.error("[User Plan API] POST Error:", error);
        return NextResponse.json(
            { error: "플랜 변경 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
