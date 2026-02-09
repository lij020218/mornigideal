/**
 * 플랜 동기화 API (모바일 IAP용)
 *
 * POST: 모바일 앱에서 IAP 구매 후 플랜 상태를 백엔드에 동기화
 * - RevenueCat 웹훅이 주 검증 수단이지만,
 *   클라이언트에서도 즉시 반영하기 위한 보조 엔드포인트
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { upgradePlan, UserPlanType } from "@/lib/user-plan";

export async function POST(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { plan } = await request.json();

        if (!plan || !["standard", "pro", "max"].includes(plan)) {
            return NextResponse.json(
                { error: "유효한 플랜을 선택해주세요." },
                { status: 400 }
            );
        }

        const success = await upgradePlan(userEmail, plan as UserPlanType);

        if (!success) {
            return NextResponse.json(
                { error: "플랜 동기화에 실패했습니다." },
                { status: 500 }
            );
        }

        console.log(`[Plan Sync] ${userEmail} → ${plan}`);

        return NextResponse.json({ success: true, plan });
    } catch (error: any) {
        console.error("[Plan Sync] Error:", error);
        return NextResponse.json(
            { error: "플랜 동기화 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
