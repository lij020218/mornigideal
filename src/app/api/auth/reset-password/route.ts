/**
 * 비밀번호 재설정 API
 *
 * POST: 토큰으로 비밀번호 변경
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const { token, password } = await request.json();

        if (!token || typeof token !== 'string') {
            return NextResponse.json(
                { success: false, message: '유효하지 않은 요청입니다.' },
                { status: 400 }
            );
        }

        if (!password || typeof password !== 'string' || password.length < 8) {
            return NextResponse.json(
                { success: false, message: '비밀번호는 8자 이상이어야 합니다.' },
                { status: 400 }
            );
        }

        // 토큰으로 사용자 찾기
        const { data: kvRows } = await supabaseAdmin
            .from('user_kv_store')
            .select('user_email, value')
            .eq('key', 'password_reset_token');

        if (!kvRows || kvRows.length === 0) {
            return NextResponse.json(
                { success: false, message: '유효하지 않거나 만료된 토큰입니다.' },
                { status: 400 }
            );
        }

        // 토큰 매칭
        const matchedRow = kvRows.find((row: any) => {
            const stored = row.value as { token: string; expiresAt: string };
            return stored.token === token && new Date(stored.expiresAt) > new Date();
        });

        if (!matchedRow) {
            return NextResponse.json(
                { success: false, message: '유효하지 않거나 만료된 토큰입니다.' },
                { status: 400 }
            );
        }

        const userEmail = matchedRow.user_email;

        // 비밀번호 해시화 및 업데이트
        const hashedPassword = await bcrypt.hash(password, 12);

        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ password: hashedPassword })
            .eq('email', userEmail);

        if (updateError) {
            logger.error('[Auth] Failed to update password:', updateError);
            return NextResponse.json(
                { success: false, message: '비밀번호 변경에 실패했습니다.' },
                { status: 500 }
            );
        }

        // 사용된 토큰 삭제
        await supabaseAdmin
            .from('user_kv_store')
            .delete()
            .eq('user_email', userEmail)
            .eq('key', 'password_reset_token');

        logger.info(`[Auth] Password reset successful for ${userEmail}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[Auth] reset-password error:', error);
        return NextResponse.json(
            { success: false, message: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
            { status: 500 }
        );
    }
}
