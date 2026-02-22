/**
 * Authentication Utilities
 *
 * JWT 검증 및 사용자 인증 관련 공통 유틸리티
 */

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './supabase-admin';
import { logger } from './logger';

// JWT Secret - 환경 변수에서만 로드, 하드코딩 금지
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

if (!JWT_SECRET) {
    logger.error('[CRITICAL] JWT_SECRET is not configured. Authentication will fail.');
}

/**
 * JWT Secret 가져오기 (없으면 에러)
 */
export function getJwtSecret(): string {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not configured');
    }
    return JWT_SECRET;
}

/**
 * JWT 토큰 검증
 */
export function verifyToken(token: string): { userId?: string; email?: string } | null {
    try {
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        return {
            userId: decoded.userId,
            email: decoded.email,
        };
    } catch {
        return null;
    }
}

/**
 * JWT 토큰 생성
 */
export function signToken(payload: { userId: string; email: string }, expiresIn: string = '30d'): string {
    return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
}

/**
 * Request에서 사용자 ID 추출 (JWT 또는 세션)
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
    // Bearer 토큰에서 추출
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (decoded?.userId) return decoded.userId;
        if (decoded?.email) {
            // email로 userId 조회
            const { data } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', decoded.email)
                .maybeSingle();
            return data?.id || null;
        }
    }

    // 세션 쿠키에서 추출
    const sessionCookie = request.cookies.get('session')?.value;
    if (sessionCookie) {
        const decoded = verifyToken(sessionCookie);
        return decoded?.userId || null;
    }

    return null;
}

/**
 * Request에서 사용자 이메일 추출 (JWT 또는 세션)
 */
export async function getUserEmailFromRequest(request: NextRequest): Promise<string | null> {
    // Bearer 토큰에서 추출
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (decoded?.email) return decoded.email;
        if (decoded?.userId) {
            // userId로 email 조회
            const { data } = await supabaseAdmin
                .from('users')
                .select('email')
                .eq('id', decoded.userId)
                .maybeSingle();
            return data?.email || null;
        }
    }

    // 세션 쿠키에서 추출
    const sessionCookie = request.cookies.get('session')?.value;
    if (sessionCookie) {
        const decoded = verifyToken(sessionCookie);
        if (decoded?.email) return decoded.email;
        if (decoded?.userId) {
            const { data } = await supabaseAdmin
                .from('users')
                .select('email')
                .eq('id', decoded.userId)
                .maybeSingle();
            return data?.email || null;
        }
    }

    return null;
}

/**
 * Request에서 사용자 이메일 추출 (JWT, 세션 쿠키, NextAuth 세션 지원)
 * NextAuth auth()를 사용하는 라우트용
 */
export async function getUserEmailWithAuth(request: NextRequest): Promise<string | null> {
    // 먼저 JWT/쿠키 확인
    const email = await getUserEmailFromRequest(request);
    if (email) return email;

    // NextAuth 세션 확인
    try {
        const { auth } = await import('@/auth');
        const session = await auth();
        return session?.user?.email || null;
    } catch {
        return null;
    }
}

/**
 * Request에서 사용자 ID 추출 (JWT, 세션 쿠키, NextAuth 세션 지원)
 * NextAuth auth()를 사용하는 라우트용
 */
export async function getUserIdWithAuth(request: NextRequest): Promise<string | null> {
    // 먼저 JWT/쿠키 확인
    const userId = await getUserIdFromRequest(request);
    if (userId) return userId;

    // NextAuth 세션에서 이메일로 userId 조회
    try {
        const { auth } = await import('@/auth');
        const session = await auth();
        if (session?.user?.email) {
            const { data } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', session.user.email)
                .maybeSingle();
            return data?.id || null;
        }
    } catch {
        return null;
    }

    return null;
}
