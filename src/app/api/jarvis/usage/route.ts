/**
 * Jarvis AI Usage API
 * 현재 월 AI 호출 횟수 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PLAN_CONFIGS, PlanType } from '@/types/jarvis';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userEmail = searchParams.get('email');

        if (!userEmail) {
            return NextResponse.json(
                { error: 'email parameter required' },
                { status: 400 }
            );
        }

        // 사용자 플랜 조회
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('profile')
            .eq('email', userEmail)
            .single();

        if (userError || !userData) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const userPlan = userData.profile?.plan || 'Free';
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
        const { data: usageData, error: usageError } = await supabase.rpc('get_ai_usage', {
            p_user_email: userEmail
        });

        if (usageError) {
            console.error('[Usage API] Failed to get usage:', usageError);
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
    } catch (error) {
        console.error('[Usage API] Exception:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
