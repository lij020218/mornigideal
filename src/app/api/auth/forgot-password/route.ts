/**
 * 비밀번호 찾기 API
 *
 * POST: 비밀번호 재설정 토큰 생성 및 이메일 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { success: false, message: '이메일을 입력해주세요.' },
                { status: 400 }
            );
        }

        const normalizedEmail = email.toLowerCase().trim();

        // 사용자 존재 확인
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('id, email, name')
            .eq('email', normalizedEmail)
            .maybeSingle();

        // 사용자가 없어도 동일한 응답 (이메일 열거 공격 방지)
        if (!user) {
            return NextResponse.json({
                success: true,
                message: '해당 이메일로 비밀번호 재설정 링크를 발송했습니다.',
            });
        }

        // 비밀번호 재설정 토큰 생성 (1시간 유효)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        // 토큰 저장
        await supabaseAdmin
            .from('user_kv_store')
            .upsert({
                user_email: normalizedEmail,
                key: 'password_reset_token',
                value: { token: resetToken, expiresAt },
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_email,key' });

        // 이메일 발송
        await sendPasswordResetEmail(normalizedEmail, resetToken);
        logger.info(`[Auth] Password reset requested for ${normalizedEmail}`);

        return NextResponse.json({
            success: true,
            message: '해당 이메일로 비밀번호 재설정 링크를 발송했습니다.',
        });
    } catch (error) {
        logger.error('[Auth] forgot-password error:', error);
        return NextResponse.json(
            { success: false, message: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
            { status: 500 }
        );
    }
}
