/**
 * GitHub OAuth 콜백
 * GET: OAuth 코드를 토큰으로 교환하고 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');

    if (!code || !state) {
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=github_auth_failed`);
    }

    // Decode state to get user email
    let email: string;
    try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        email = decoded.email;
        if (!email) throw new Error('No email in state');
    } catch {
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=invalid_state`);
    }

    // Exchange code for token
    try {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error || !tokenData.access_token) {
            console.error('[GitHubOAuth] Token exchange failed:', tokenData.error);
            return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=token_exchange_failed`);
        }

        // Get GitHub username
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });
        const userData = await userResponse.json();

        // Save token
        await supabaseAdmin
            .from('github_tokens')
            .upsert({
                user_email: email,
                github_username: userData.login || null,
                access_token: tokenData.access_token,
                scope: tokenData.scope || '',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_email' });

        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?github=linked`);
    } catch (error) {
        console.error('[GitHubOAuth] Callback error:', error);
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=github_callback_error`);
    }
}
