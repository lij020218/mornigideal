/**
 * Referral System API
 *
 * GET: 내 추천 코드 조회 (없으면 자동 생성)
 * POST: 추천 코드로 가입 시 양쪽에 Pro 7일 무료
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * 6자리 추천 코드 생성 (영문+숫자)
 */
function generateReferralCode(): string {
    return crypto.randomBytes(4).toString("base64url").substring(0, 6).toUpperCase();
}

/**
 * GET: 내 추천 코드 조회 + 추천 통계
 */
export const GET = withAuth(async (request: NextRequest, email: string) => {
    // user_kv_store에서 추천 코드 조회
    const { data: existing } = await supabaseAdmin
        .from("user_kv_store")
        .select("value")
        .eq("user_email", email)
        .eq("key", "referral_code")
        .maybeSingle();

    let referralCode = existing?.value?.code;

    // 없으면 생성
    if (!referralCode) {
        // 중복 체크 루프
        let attempts = 0;
        do {
            referralCode = generateReferralCode();
            const { data: dup } = await supabaseAdmin
                .from("user_kv_store")
                .select("value")
                .eq("key", "referral_code")
                .filter("value->>code", "eq", referralCode)
                .maybeSingle();

            if (!dup) break;
            attempts++;
        } while (attempts < 5);

        await supabaseAdmin.from("user_kv_store").upsert(
            {
                user_email: email,
                key: "referral_code",
                value: {
                    code: referralCode,
                    createdAt: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_email,key" }
        );
    }

    // 추천 통계 조회
    const { data: stats } = await supabaseAdmin
        .from("user_kv_store")
        .select("value")
        .eq("user_email", email)
        .eq("key", "referral_stats")
        .maybeSingle();

    const referralStats = stats?.value || { totalReferred: 0, rewardsEarned: 0 };

    return NextResponse.json({
        referralCode,
        stats: referralStats,
        shareMessage: `Fi.eri - AI 일정 비서를 추천합니다! 추천 코드: ${referralCode}\n가입 시 Pro 7일 무료!\nhttps://fieri.app/invite/${referralCode}`,
    });
});

/**
 * POST: 추천 코드 적용
 * body: { referralCode: string }
 */
export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { referralCode } = await request.json();

    if (!referralCode || referralCode.length !== 6) {
        return NextResponse.json({ error: "유효하지 않은 추천 코드입니다." }, { status: 400 });
    }

    // 이미 추천 코드를 사용했는지 확인
    const { data: alreadyUsed } = await supabaseAdmin
        .from("user_kv_store")
        .select("value")
        .eq("user_email", email)
        .eq("key", "referral_used")
        .maybeSingle();

    if (alreadyUsed?.value?.used) {
        return NextResponse.json({ error: "이미 추천 코드를 사용하셨습니다." }, { status: 400 });
    }

    // 추천 코드 소유자 찾기
    const { data: codeOwners } = await supabaseAdmin
        .from("user_kv_store")
        .select("user_email, value")
        .eq("key", "referral_code")
        .filter("value->>code", "eq", referralCode.toUpperCase());

    if (!codeOwners || codeOwners.length === 0) {
        return NextResponse.json({ error: "존재하지 않는 추천 코드입니다." }, { status: 404 });
    }

    const referrerEmail = codeOwners[0].user_email;

    // 자기 자신의 코드는 사용 불가
    if (referrerEmail === email) {
        return NextResponse.json({ error: "자신의 추천 코드는 사용할 수 없습니다." }, { status: 400 });
    }

    // 양쪽에 Pro 7일 보상 부여
    const rewardExpiry = new Date();
    rewardExpiry.setDate(rewardExpiry.getDate() + 7);
    const rewardExpiryStr = rewardExpiry.toISOString();

    // 1. 신규 사용자에게 보상 기록
    await supabaseAdmin.from("user_kv_store").upsert(
        {
            user_email: email,
            key: "referral_used",
            value: {
                used: true,
                referrerEmail: referrerEmail,
                code: referralCode,
                usedAt: new Date().toISOString(),
                rewardExpiry: rewardExpiryStr,
            },
            updated_at: new Date().toISOString(),
        },
        { onConflict: "user_email,key" }
    );

    // 2. 추천인에게 보상 기록
    const { data: referrerStats } = await supabaseAdmin
        .from("user_kv_store")
        .select("value")
        .eq("user_email", referrerEmail)
        .eq("key", "referral_stats")
        .maybeSingle();

    const currentStats = referrerStats?.value || { totalReferred: 0, rewardsEarned: 0, referrals: [] };
    currentStats.totalReferred += 1;
    currentStats.rewardsEarned += 7;
    currentStats.referrals = currentStats.referrals || [];
    currentStats.referrals.push({
        referredAt: new Date().toISOString(),
        rewardExpiry: rewardExpiryStr,
    });

    await supabaseAdmin.from("user_kv_store").upsert(
        {
            user_email: referrerEmail,
            key: "referral_stats",
            value: currentStats,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "user_email,key" }
    );

    // 3. 추천인에게 Pro 보상 기록
    const { data: referrerReward } = await supabaseAdmin
        .from("user_kv_store")
        .select("value")
        .eq("user_email", referrerEmail)
        .eq("key", "referral_reward")
        .maybeSingle();

    const currentReward = referrerReward?.value || { rewards: [] };
    currentReward.rewards.push({
        type: "pro_trial",
        days: 7,
        grantedAt: new Date().toISOString(),
        expiresAt: rewardExpiryStr,
    });

    await supabaseAdmin.from("user_kv_store").upsert(
        {
            user_email: referrerEmail,
            key: "referral_reward",
            value: currentReward,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "user_email,key" }
    );

    return NextResponse.json({
        success: true,
        message: "추천 코드가 적용되었습니다! 양쪽 모두 Pro 7일 무료 혜택이 부여됩니다.",
        rewardExpiry: rewardExpiryStr,
    });
});
