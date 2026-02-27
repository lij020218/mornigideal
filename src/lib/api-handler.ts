/**
 * API Route Handler Utilities
 *
 * 103개 API 라우트에 반복되는 인증 + 에러 처리 패턴을 추출합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from './auth-utils';
import { logger } from './logger';

// ============================================
// 사용자별 Rate Limiting (인메모리 슬라이딩 윈도우)
// ============================================

const RATE_LIMIT_WINDOW_MS = 60_000; // 1분
const RATE_LIMIT_MAX_REQUESTS = 30;  // 1분당 최대 30회

const rateLimitMap = new Map<string, number[]>();

// 5분마다 만료된 엔트리 정리
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap) {
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, valid);
    }
  }
}, 5 * 60_000);

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(email) || [];
  const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  valid.push(now);
  rateLimitMap.set(email, valid);
  return valid.length <= RATE_LIMIT_MAX_REQUESTS;
}

type AuthedHandler = (
  request: NextRequest,
  userEmail: string
) => Promise<NextResponse>;

/**
 * 인증이 필요한 API 라우트를 감싸는 Higher-Order Function.
 * - 사용자별 rate limiting (1분당 30회)
 * - 인증 검사 (실패 시 401)
 * - try-catch 에러 처리 (실패 시 500)
 * - 에러 로깅
 */
export function withAuth(handler: AuthedHandler) {
  return async (request: NextRequest) => {
    try {
      const email = await getUserEmailWithAuth(request);
      if (!email) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      if (!checkRateLimit(email)) {
        return NextResponse.json(
          { error: 'Too many requests. Please slow down.' },
          { status: 429 }
        );
      }

      return await handler(request, email);
    } catch (error) {
      logger.error(`[API] ${request.nextUrl.pathname}:`, error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

type CronHandler = (request: NextRequest) => Promise<NextResponse>;

/**
 * 크론 API 라우트를 감싸는 Higher-Order Function.
 * - Authorization: Bearer <CRON_SECRET> 헤더 검증
 * - CRON_SECRET 미설정 시 500
 * - try-catch 에러 처리
 */
export function withCron(handler: CronHandler) {
  return async (request: NextRequest) => {
    try {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        logger.error('[Cron] CRON_SECRET not configured');
        return NextResponse.json(
          { error: 'CRON_SECRET not configured' },
          { status: 500 }
        );
      }

      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      return await handler(request);
    } catch (error) {
      logger.error(`[Cron] ${request.nextUrl.pathname}:`, error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
