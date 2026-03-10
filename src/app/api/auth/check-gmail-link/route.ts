/**
 * Gmail 연동 상태 확인 API
 *
 * GET: 연동 여부 반환 (웹 NextAuth + 모바일 JWT 모두 지원)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';

export const GET = withAuth(async (_request: NextRequest, email: string) => {
    const { data, error } = await supabaseAdmin
        .from('gmail_tokens')
        .select('gmail_email, expires_at, refresh_token')
        .eq('user_email', email)
        .maybeSingle();

    if (error || !data) {
        return NextResponse.json({ linked: false });
    }

    const now = Date.now();
    // access_token이 만료되어도 refresh_token이 있으면 연동 유효 (summary API에서 자동 갱신)
    if (data.expires_at < now && !data.refresh_token) {
        return NextResponse.json({
            linked: true,
            gmailEmail: data.gmail_email,
            expired: true,
        });
    }

    return NextResponse.json({
        linked: true,
        gmailEmail: data.gmail_email,
    });
});
