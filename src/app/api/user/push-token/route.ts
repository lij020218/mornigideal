import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';

/**
 * POST: 푸시 토큰 등록/갱신
 */
export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { token, platform, deviceName } = await request.json();

    if (!token || !platform) {
        return NextResponse.json({ error: 'token and platform are required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
        .from('push_tokens')
        .upsert({
            user_email: email,
            token,
            platform,
            device_name: deviceName || null,
            active: true,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email,token' });

    if (error) {
        logger.error('[Push Token] Upsert error:', error);
        return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
});

/**
 * GET: 등록된 푸시 토큰 목록 조회 (디버깅용)
 */
export const GET = withAuth(async (_request: NextRequest, email: string) => {
    const { data, error } = await supabaseAdmin
        .from('push_tokens')
        .select('token, platform, device_name, active, updated_at')
        .eq('user_email', email)
        .order('updated_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 });
    }

    return NextResponse.json({
        tokens: data || [],
        activeCount: (data || []).filter(t => t.active).length,
    });
});

/**
 * DELETE: 푸시 토큰 비활성화 (로그아웃 시)
 */
export const DELETE = withAuth(async (request: NextRequest, email: string) => {
    const { token } = await request.json();

    if (token) {
        // 특정 토큰 비활성화
        await supabaseAdmin
            .from('push_tokens')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('user_email', email)
            .eq('token', token);
    } else {
        // 모든 토큰 비활성화
        await supabaseAdmin
            .from('push_tokens')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('user_email', email);
    }

    return NextResponse.json({ success: true });
});
