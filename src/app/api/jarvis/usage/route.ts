/**
 * Jarvis AI Usage API
 * 현재 월 AI 호출 횟수 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import { PLAN_CONFIGS, PlanType } from '@/types/jarvis';
import { getPlanName } from '@/lib/user-plan';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const userPlan = await getPlanName(email);
    const planConfig = PLAN_CONFIGS[userPlan as PlanType];

    // 무제한 플랜은 -1 리턴
    if (planConfig.aiCallsPerMonth === -1) {
        return NextResponse.json({
            plan: userPlan,
            used: 0,
            limit: -1,
            unlimited: true,
            month: new Date().toISOString().slice(0, 7)
        });
    }

    // AI 사용량 조회
    const { data: usageData, error: usageError } = await supabaseAdmin.rpc('get_ai_usage', {
        p_user_email: email
    });

    if (usageError) {
        logger.error('[Usage API] Failed to get usage:', usageError);
        return NextResponse.json(
            { error: 'Failed to get usage' },
            { status: 500 }
        );
    }

    const used = usageData || 0;
    const limit = planConfig.aiCallsPerMonth;
    const remaining = Math.max(0, limit - used);
    const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;

    return NextResponse.json({
        plan: userPlan,
        used,
        limit,
        remaining,
        percentage,
        unlimited: false,
        month: new Date().toISOString().slice(0, 7)
    });
});
