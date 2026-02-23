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

    // 기존 토큰 확인
    const { data: existing } = await supabaseAdmin
        .from('push_tokens')
        .select('id')
        .eq('user_email', email)
        .eq('token', token)
        .maybeSingle();

    if (existing) {
        // 이미 존재하면 업데이트
        const { error } = await supabaseAdmin
            .from('push_tokens')
            .update({
                platform,
                device_name: deviceName || null,
                active: true,
                updated_at: new Date().toISOString(),
            })
            .eq('user_email', email)
            .eq('token', token);

        if (error) {
            logger.error('[Push Token] Update error:', error);
            return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
        }
    } else {
        // 없으면 삽입
        const { error } = await supabaseAdmin
            .from('push_tokens')
            .insert({
                user_email: email,
                token,
                platform,
                device_name: deviceName || null,
                active: true,
                updated_at: new Date().toISOString(),
            });

        if (error) {
            logger.error('[Push Token] Insert error:', error);
            return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
        }
    }

    return NextResponse.json({ success: true });
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
