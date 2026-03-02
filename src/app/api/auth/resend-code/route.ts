/**
 * 인증코드 재발송 API
 *
 * POST: 60초 쿨다운 + 일일 5회 제한
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { kvGet, kvSet } from '@/lib/kv-store';
import { sendVerificationEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { emailSchema, validateBody } from '@/lib/schemas';

const KV_KEY = 'pending_registration';

const resendCodeSchema = z.object({
    email: emailSchema,
});

function generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
}

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
        const v = validateBody(resendCodeSchema, body);
        if (!v.success) return v.response;
        const { email } = v.data;

        const normalizedEmail = email.toLowerCase().trim();

        // 기존 대기 데이터 확인
        const pending = await kvGet<PendingRegistration>(normalizedEmail, KV_KEY);

        if (!pending) {
            return NextResponse.json(
                { error: '인증 요청을 찾을 수 없습니다. 회원가입을 다시 시도해주세요.' },
                { status: 400 }
            );
        }

        // 60초 쿨다운
        if (pending.lastSentAt) {
            const elapsed = Date.now() - new Date(pending.lastSentAt).getTime();
            if (elapsed < 60_000) {
                const remaining = Math.ceil((60_000 - elapsed) / 1000);
                return NextResponse.json(
                    { error: `${remaining}초 후에 다시 시도해주세요.`, retryAfter: remaining },
                    { status: 429 }
                );
            }
        }

        // 일일 발송 횟수 체크
        const today = new Date().toISOString().slice(0, 10);
        const dailySentCount = (pending.dailySentDate === today)
            ? (pending.dailySentCount || 0) : 0;

        if (dailySentCount >= 5) {
            return NextResponse.json(
                { error: '일일 인증코드 발송 한도를 초과했습니다.' },
                { status: 429 }
            );
        }

        // 새 인증코드 생성 + KV 업데이트
        const newCode = generateOTP();
        const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await kvSet(normalizedEmail, KV_KEY, {
            ...pending,
            code: newCode,
            expiresAt: newExpiresAt,
            attempts: 0,
            lastSentAt: new Date().toISOString(),
            dailySentCount: dailySentCount + 1,
            dailySentDate: today,
        });

        // 이메일 발송
        const sent = await sendVerificationEmail(normalizedEmail, newCode, pending.name);

        if (!sent) {
            return NextResponse.json(
                { error: '이메일 발송에 실패했습니다.' },
                { status: 500 }
            );
        }

        logger.info(`[Auth] 인증코드 재발송: ${normalizedEmail}`);

        return NextResponse.json({
            success: true,
            message: '인증코드가 재발송되었습니다.',
        });
    } catch (error) {
        logger.error('[Auth] resend-code error:', error);
        return NextResponse.json(
            { error: '인증코드 재발송 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
