/**
 * RevenueCat Webhook
 *
 * RevenueCat 서버에서 구독 이벤트 발생 시 호출
 * - 구독 갱신, 만료, 취소, 환불 등 처리
 * - 이 엔드포인트가 플랜 상태의 진실 소스(source of truth)
 *
 * RevenueCat Dashboard → Settings → Webhooks에 등록:
 * URL: https://fieri.app/api/webhooks/revenuecat
 * Authorization: Bearer {REVENUECAT_WEBHOOK_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { upgradePlan, UserPlanType } from "@/lib/user-plan";

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

// RevenueCat 이벤트 타입
type RevenueCatEventType =
    | "INITIAL_PURCHASE"
    | "RENEWAL"
    | "CANCELLATION"
    | "UNCANCELLATION"
    | "NON_RENEWING_PURCHASE"
    | "SUBSCRIPTION_PAUSED"
    | "SUBSCRIPTION_EXTENDED"
    | "BILLING_ISSUE_DETECTED"
    | "EXPIRATION"
    | "PRODUCT_CHANGE"
    | "TRANSFER";

interface RevenueCatEvent {
    type: RevenueCatEventType;
    app_user_id: string;
    product_id: string;
    entitlement_ids: string[];
    expiration_at_ms: number | null;
    event_timestamp_ms: number;
    store: "APP_STORE" | "PLAY_STORE";
}

interface RevenueCatWebhookBody {
    api_version: string;
    event: RevenueCatEvent;
}

function productIdToPlan(productId: string): UserPlanType {
    if (productId.includes("max")) return "max";
    if (productId.includes("pro")) return "pro";
    return "standard";
}

export async function POST(request: NextRequest) {
    try {
        // Webhook 인증
        if (WEBHOOK_SECRET) {
            const authHeader = request.headers.get("authorization");
            if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
                console.error("[RevenueCat Webhook] Invalid auth");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const body: RevenueCatWebhookBody = await request.json();
        const { event } = body;

        console.log(`[RevenueCat Webhook] ${event.type} | user: ${event.app_user_id} | product: ${event.product_id}`);

        // app_user_id로 사용자 이메일 조회
        const { data: user } = await supabaseAdmin
            .from("users")
            .select("email")
            .eq("id", event.app_user_id)
            .single();

        if (!user?.email) {
            console.error("[RevenueCat Webhook] User not found:", event.app_user_id);
            return NextResponse.json({ success: true }); // 200 반환하여 재시도 방지
        }

        const userEmail = user.email;

        switch (event.type) {
            case "INITIAL_PURCHASE":
            case "RENEWAL":
            case "UNCANCELLATION":
            case "SUBSCRIPTION_EXTENDED": {
                const plan = productIdToPlan(event.product_id);
                const durationDays = event.expiration_at_ms
                    ? Math.ceil((event.expiration_at_ms - Date.now()) / (1000 * 60 * 60 * 24))
                    : 31;
                await upgradePlan(userEmail, plan, durationDays);
                console.log(`[RevenueCat Webhook] Upgraded user → ${plan} (${durationDays}d)`);
                break;
            }

            case "EXPIRATION":
            case "CANCELLATION": {
                // 만료/취소 시 Standard로 다운그레이드
                if (event.type === "EXPIRATION" || (event.expiration_at_ms && event.expiration_at_ms < Date.now())) {
                    await upgradePlan(userEmail, "standard");
                    console.log(`[RevenueCat Webhook] Downgraded user → standard`);
                } else {
                    // 취소했지만 아직 만료 전이면 현재 플랜 유지
                    console.log(`[RevenueCat Webhook] Cancelled but still active`);
                }
                break;
            }

            case "PRODUCT_CHANGE": {
                const newPlan = productIdToPlan(event.product_id);
                await upgradePlan(userEmail, newPlan);
                console.log(`[RevenueCat Webhook] Plan changed → ${newPlan}`);
                break;
            }

            case "BILLING_ISSUE_DETECTED": {
                console.log(`[RevenueCat Webhook] Billing issue detected`);
                break;
            }

            default:
                console.log(`[RevenueCat Webhook] Unhandled event: ${event.type}`);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[RevenueCat Webhook] Error:", error);
        return NextResponse.json({ success: true }); // 항상 200 반환하여 무한 재시도 방지
    }
}
