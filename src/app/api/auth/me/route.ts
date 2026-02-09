/**
 * 현재 사용자 정보 조회 API
 *
 * GET: JWT 토큰으로 인증된 사용자 정보 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // 토큰 검증
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 사용자 조회
    console.log('[auth/me] Looking for userId:', decoded.userId, 'email:', decoded.email);

    // 먼저 userId로 조회, 실패하면 email로 조회
    let user = null;
    let error = null;

    if (decoded.userId) {
      const result = await supabaseAdmin
        .from('users')
        .select('id, email, name, created_at')
        .eq('id', decoded.userId)
        .single();
      user = result.data;
      error = result.error;
    }

    // userId로 못 찾으면 email로 시도
    if (!user && decoded.email) {
      console.log('[auth/me] userId not found, trying email:', decoded.email);
      const result = await supabaseAdmin
        .from('users')
        .select('id, email, name, created_at')
        .eq('email', decoded.email)
        .single();
      user = result.data;
      error = result.error;
    }

    if (error || !user) {
      console.log('[auth/me] User not found, error:', error);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[auth/me] Found user:', user.email);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileImage: null,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    return NextResponse.json(
      { error: '사용자 정보를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
