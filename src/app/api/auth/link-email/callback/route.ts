/**
 * 메일 연동 OAuth 콜백 (모바일용)
 *
 * GET: Google/Naver/Kakao/Outlook OAuth 콜백 → 토큰 교환 → 앱으로 딥링크
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

async function exchangeGmailToken(code: string, redirectUri: string) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });
    if (!response.ok) throw new Error('Gmail token exchange failed');
    return response.json();
}

async function exchangeNaverToken(code: string, redirectUri: string) {
    const response = await fetch('https://nid.naver.com/oauth2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.NAVER_CLIENT_ID!,
            client_secret: process.env.NAVER_CLIENT_SECRET!,
            code,
            redirect_uri: redirectUri,
        }),
    });
    if (!response.ok) throw new Error('Naver token exchange failed');
    return response.json();
}

async function exchangeKakaoToken(code: string, redirectUri: string) {
    const response = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.KAKAO_REST_API_KEY!,
            ...(process.env.KAKAO_CLIENT_SECRET ? { client_secret: process.env.KAKAO_CLIENT_SECRET } : {}),
            code,
            redirect_uri: redirectUri,
        }),
    });
    if (!response.ok) throw new Error('Kakao token exchange failed');
    return response.json();
}

async function exchangeOutlookToken(code: string, redirectUri: string) {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            code,
            redirect_uri: redirectUri,
        }),
    });
    if (!response.ok) throw new Error('Outlook token exchange failed');
    return response.json();
}

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state'); // "email:provider" 형식
    const error = req.nextUrl.searchParams.get('error');

    if (error || !code || !state) {
        return NextResponse.redirect(
            `fieri://email-callback?success=false&error=${encodeURIComponent(error || 'missing_params')}`
        );
    }

    // state에서 email과 provider 파싱
    const separatorIdx = state.lastIndexOf(':');
    const userEmail = separatorIdx > 0 ? state.substring(0, separatorIdx) : state;
    const provider = separatorIdx > 0 ? state.substring(separatorIdx + 1) : 'gmail';

    const callbackUrl = `${BASE_URL}/api/auth/link-email/callback`;

    try {
        let tokens;

        switch (provider) {
            case 'gmail':
                tokens = await exchangeGmailToken(code, callbackUrl);
                break;
            case 'naver':
                tokens = await exchangeNaverToken(code, callbackUrl);
                break;
            case 'kakao':
                tokens = await exchangeKakaoToken(code, callbackUrl);
                break;
            case 'outlook':
                tokens = await exchangeOutlookToken(code, callbackUrl);
                break;
            default:
                return NextResponse.redirect(
                    `fieri://email-callback?success=false&error=unsupported_provider`
                );
        }

        // email_tokens 테이블에 저장
        await supabaseAdmin
            .from('email_tokens')
            .upsert({
                user_email: userEmail,
                provider,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || null,
                expires_at: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null,
                scope: tokens.scope || null,
                connected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_email,provider' });

        // Gmail: gmail_tokens에도 동기화 (기존 서비스 호환)
        if (provider === 'gmail') {
            let gmailEmail = userEmail;
            try {
                const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                    headers: { Authorization: `Bearer ${tokens.access_token}` },
                });
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    gmailEmail = profile.email || userEmail;
                }
            } catch { /* fallback */ }

            await supabaseAdmin
                .from('gmail_tokens')
                .upsert({
                    user_email: userEmail,
                    gmail_email: gmailEmail,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_type: tokens.token_type || 'Bearer',
                    expires_at: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null,
                    scope: tokens.scope,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_email' });
        }

        logger.info(`[Link Email Callback] ${provider} 연동 완료: ${userEmail}`);
        return NextResponse.redirect(`fieri://email-callback?success=true&provider=${provider}`);
    } catch (err) {
        logger.error('[Link Email Callback] Error:', err);
        return NextResponse.redirect(
            `fieri://email-callback?success=false&error=${encodeURIComponent('token_exchange_failed')}`
        );
    }
}
