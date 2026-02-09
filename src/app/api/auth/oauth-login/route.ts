/**
 * OAuth 로그인 API (모바일 앱용)
 *
 * POST: Google/Apple OAuth로 로그인
 * - 기존 사용자면 로그인
 * - 신규 사용자면 자동 회원가입 후 로그인
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { signToken } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, email, name, image, providerId } = body;

    if (!email || !provider) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 이메일로 기존 사용자 조회
    const { data: existingUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, image')
      .eq('email', email.toLowerCase())
      .single();

    let user;

    if (existingUser) {
      // 기존 사용자 - 정보 업데이트 (이름, 이미지)
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          name: name || existingUser.name,
          image: image || existingUser.image,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
        .select('id, email, name, image')
        .single();

      if (updateError) {
        console.error('사용자 업데이트 오류:', updateError);
      }

      user = updatedUser || existingUser;
    } else {
      // 신규 사용자 - 자동 회원가입
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          image: image || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id, email, name, image')
        .single();

      if (createError) {
        console.error('사용자 생성 오류:', createError);
        return NextResponse.json(
          { error: '회원가입 처리 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      user = newUser;

      // Account 테이블에 OAuth 정보 저장 (선택적)
      if (providerId) {
        await supabaseAdmin
          .from('accounts')
          .insert({
            user_id: user.id,
            type: 'oauth',
            provider: provider,
            provider_account_id: providerId,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
      }
    }

    // JWT 토큰 생성
    const token = signToken({ userId: user.id, email: user.email });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileImage: user.image,
      },
    });
  } catch (error) {
    console.error('OAuth 로그인 오류:', error);
    return NextResponse.json(
      { error: 'OAuth 로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
