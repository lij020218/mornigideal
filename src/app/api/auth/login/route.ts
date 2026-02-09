/**
 * 모바일 앱용 로그인 API
 *
 * POST: 이메일/비밀번호로 로그인
 * - JWT 토큰 발급
 * - 모바일 앱에서 사용
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Supabase에서 사용자 조회
    console.log('로그인 시도:', email.toLowerCase());
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, password')
      .eq('email', email.toLowerCase())
      .single();

    console.log('사용자 조회 결과:', { user: user ? 'found' : 'not found', error });

    if (error || !user) {
      console.log('사용자 없음 또는 에러:', error);
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    console.log('비밀번호 비교:', {
      stored: user.password?.substring(0, 10) + '...',
      input: password.substring(0, 3) + '...',
      startsWithHash: user.password?.startsWith('$2')
    });

    // 비밀번호가 없으면 (OAuth로만 가입한 사용자)
    if (!user.password) {
      return NextResponse.json(
        { error: '이 계정은 소셜 로그인으로만 접근할 수 있습니다. 웹에서 Google/Apple 로그인을 사용해주세요.' },
        { status: 401 }
      );
    }

    // 비밀번호 확인 (bcrypt 해시만 지원)
    let isValid = false;
    if (user.password.startsWith('$2')) {
      // bcrypt 해시된 비밀번호
      isValid = await bcrypt.compare(password, user.password);
    } else {
      // 평문 비밀번호: 검증 후 자동으로 해시로 마이그레이션
      if (password === user.password) {
        isValid = true;
        // 보안 강화: 평문 비밀번호를 bcrypt 해시로 업그레이드
        const hashedPassword = await bcrypt.hash(password, 12);
        await supabaseAdmin
          .from('users')
          .update({ password: hashedPassword })
          .eq('id', user.id);
        console.log(`[Auth] Migrated plaintext password to bcrypt for user ${user.id}`);
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰 생성
    const token = signToken({ userId: user.id, email: user.email });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileImage: null,
      },
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
