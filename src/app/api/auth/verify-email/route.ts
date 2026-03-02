/**
 * 이메일 인증코드 검증 API
 *
 * POST: 이메일 + 인증코드 검증 → users INSERT + JWT 발급
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { signToken } from '@/lib/auth-utils';
import { kvGet, kvSet } from '@/lib/kv-store';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { emailSchema, validateBody } from '@/lib/schemas';
import crypto from 'crypto';

const KV_KEY = 'pending_registration';

const verifyEmailSchema = z.object({
    email: emailSchema,
    code: z.string().length(6).regex(/^\d{6}$/),
});

interface PendingRegistration {
    code: string;
    hashedPassword: string;
    name: string;
    expiresAt: string;
    attempts: number;
    lastSentAt: string;
    dailySentCount: number;
    dailySentDate: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const v = validateBody(verifyEmailSchema, body);
        if (!v.success) return v.response;
        const { email, code } = v.data;

        const normalizedEmail = email.toLowerCase().trim();

        // KV에서 대기 중인 가입 데이터 조회
        const pending = await kvGet<PendingRegistration>(normalizedEmail, KV_KEY);

        if (!pending) {
            return NextResponse.json(
                { error: '인증 요청을 찾을 수 없습니다. 회원가입을 다시 시도해주세요.' },
                { status: 400 }
            );
        }

        // 만료 확인
        if (new Date(pending.expiresAt) < new Date()) {
            return NextResponse.json(
                { error: '인증코드가 만료되었습니다. 다시 발송해주세요.', expired: true },
                { status: 400 }
            );
        }

        // 시도 횟수 확인 (5회 제한)
        if (pending.attempts >= 5) {
            return NextResponse.json(
                { error: '인증 시도 횟수를 초과했습니다. 인증코드를 다시 발송해주세요.', maxAttempts: true },
                { status: 429 }
            );
        }

        // 인증코드 비교 (타이밍 공격 방지)
        const isValid = crypto.timingSafeEqual(
            Buffer.from(code),
            Buffer.from(pending.code)
        );

        if (!isValid) {
            await kvSet(normalizedEmail, KV_KEY, {
                ...pending,
                attempts: pending.attempts + 1,
            });

            const remaining = 5 - (pending.attempts + 1);
            return NextResponse.json(
                { error: `인증코드가 올바르지 않습니다. (남은 시도: ${remaining}회)` },
                { status: 400 }
            );
        }

        // 이메일 중복 재확인 (race condition 방지)
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (existingUser) {
            return NextResponse.json(
                { error: '이미 등록된 이메일입니다.' },
                { status: 409 }
            );
        }

        // users 테이블에 INSERT
        const { data: user, error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
                email: normalizedEmail,
                name: pending.name,
                password: pending.hashedPassword,
            })
            .select('id, email, name')
            .single();

        if (insertError) {
            logger.error('[Auth] 사용자 생성 오류:', insertError);
            return NextResponse.json(
                { error: '회원가입 처리 중 오류가 발생했습니다.' },
                { status: 500 }
            );
        }

        // KV에서 임시 데이터 삭제
        await supabaseAdmin
            .from('user_kv_store')
            .delete()
            .eq('user_email', normalizedEmail)
            .eq('key', KV_KEY);

        // JWT 발급
        const token = signToken({ userId: user.id, email: user.email });

        logger.info(`[Auth] 이메일 인증 완료 + 회원가입: ${normalizedEmail}`);

        return NextResponse.json({
            success: true,
            message: '이메일 인증이 완료되었습니다.',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        });
    } catch (error) {
        logger.error('[Auth] verify-email error:', error);
        return NextResponse.json(
            { error: '인증 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
