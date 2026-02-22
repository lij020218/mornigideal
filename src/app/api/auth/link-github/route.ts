/**
 * GitHub OAuth 연동 시작
 * GET: GitHub OAuth 인증 페이지로 리다이렉트
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
    const email = await getUserEmailWithAuth(request);
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 500 });
    }

    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/link-github/callback`;
    const scope = 'read:user,repo';
    const state = Buffer.from(JSON.stringify({ email })).toString('base64url');

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;

    return NextResponse.redirect(githubAuthUrl);
}
