/**
 * 모바일 앱용 회원가입 API (이메일 인증 단계 1)
 *
 * POST: 인증코드 발송 → 202 응답
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { registerSchema, validateBody } from '@/lib/schemas';
import { kvGet, kvSet } from '@/lib/kv-store';
import { sendVerificationEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

const KV_KEY = 'pending_registration';

function generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const v = validateBody(registerSchema, body);
        if (!v.success) return v.response;
        const { email, password, name } = v.data;

        const normalizedEmail = email.toLowerCase().trim();

        // 이메일 중복 확인
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

        // 기존 대기 데이터 확인 (재발송 쿨다운)
        const existing = await kvGet<{
            lastSentAt: string;
            dailySentCount: number;
            dailySentDate: string;
        }>(normalizedEmail, KV_KEY);

        if (existing?.lastSentAt) {
            const elapsed = Date.now() - new Date(existing.lastSentAt).getTime();
            if (elapsed < 60_000) {
                const remaining = Math.ceil((60_000 - elapsed) / 1000);
                return NextResponse.json(
                    { error: `${remaining}초 후에 다시 시도해주세요.` },
                    { status: 429 }
                );
            }
        }

        // 일일 발송 횟수 체크 (5회 제한)
        const today = new Date().toISOString().slice(0, 10);
        const dailySentCount = (existing?.dailySentDate === today)
            ? (existing.dailySentCount || 0) : 0;

        if (dailySentCount >= 5) {
            return NextResponse.json(
                { error: '일일 인증코드 발송 한도를 초과했습니다. 내일 다시 시도해주세요.' },
                { status: 429 }
            );
        }

        // 비밀번호 해싱 + 인증코드 생성
        const hashedPassword = await bcrypt.hash(password, 12);
        const code = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // user_kv_store에 임시 데이터 저장
        await kvSet(normalizedEmail, KV_KEY, {
            code,
            hashedPassword,
            name,
            expiresAt,
            attempts: 0,
            lastSentAt: new Date().toISOString(),
            dailySentCount: dailySentCount + 1,
            dailySentDate: today,
        });

        // 이메일 발송
        const sent = await sendVerificationEmail(normalizedEmail, code, name);

        if (!sent) {
            logger.error(`[Auth] 인증코드 이메일 발송 실패: ${normalizedEmail}`);
            return NextResponse.json(
                { error: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' },
                { status: 500 }
            );
        }

        logger.info(`[Auth] 인증코드 발송: ${normalizedEmail}`);

        return NextResponse.json({
            success: true,
            message: '인증코드가 이메일로 발송되었습니다.',
            requiresVerification: true,
        }, { status: 202 });
    } catch (error) {
        logger.error('회원가입 오류:', error);
        return NextResponse.json(
            { error: '회원가입 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
