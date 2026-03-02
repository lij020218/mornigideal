/**
 * 캐시된 유튜브 추천 조회 API
 *
 * cron이 아침 6시에 생성한 추천을 반환.
 * 캐시가 없으면 { cached: false }를 반환하여 클라이언트가 generate를 호출하도록 유도.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-handler';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const GET = withAuth(async (_request: NextRequest, email: string) => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    const { data, error } = await supabaseAdmin
        .from('recommendations_cache')
        .select('recommendations')
        .eq('email', email)
        .eq('date', today)
        .maybeSingle();

    if (error || !data || !data.recommendations) {
        return NextResponse.json({ cached: false, recommendations: [] });
    }

    return NextResponse.json({
        cached: true,
        recommendations: data.recommendations,
    });
});
