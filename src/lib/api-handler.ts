/**
 * API Route Handler Utilities
 *
 * 103개 API 라우트에 반복되는 인증 + 에러 처리 패턴을 추출합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from './auth-utils';
import { logger } from './logger';

type AuthedHandler = (
  request: NextRequest,
  userEmail: string
) => Promise<NextResponse>;

/**
 * 인증이 필요한 API 라우트를 감싸는 Higher-Order Function.
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
