/**
 * 범용 메일 연동 API (모바일 + 웹)
 *
 * GET: OAuth URL 생성 (provider별)
 * POST: 코드 교환 + 토큰 저장
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from "@/lib/api-handler";
import { logger } from '@/lib/logger';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

// ─── OAuth URL 빌더 ───

function buildGmailAuthUrl(userEmail: string, redirectUri: string): string {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/gmail.readonly email profile",
        access_type: "offline",
        prompt: "consent",
        state: `${userEmail}:gmail`,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildNaverMailAuthUrl(userEmail: string, redirectUri: string): string {
    const params = new URLSearchParams({
        client_id: process.env.NAVER_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        state: `${userEmail}:naver`,
    });
    return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
}

function buildKakaoMailAuthUrl(userEmail: string, redirectUri: string): string {
    const params = new URLSearchParams({
        client_id: process.env.KAKAO_REST_API_KEY!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "talk_message account_email",
        state: `${userEmail}:kakao`,
    });
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

function buildOutlookAuthUrl(userEmail: string, redirectUri: string): string {
    const params = new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email Mail.Read offline_access",
        state: `${userEmail}:outlook`,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

// ─── 토큰 교환 ───

async function exchangeGmailToken(code: string, redirectUri: string) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }),
    });
    if (!response.ok) throw new Error("Gmail token exchange failed");
    return response.json();
}

async function exchangeNaverMailToken(code: string, redirectUri: string) {
    const response = await fetch("https://nid.naver.com/oauth2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.NAVER_CLIENT_ID!,
            client_secret: process.env.NAVER_CLIENT_SECRET!,
            code,
            redirect_uri: redirectUri,
        }),
    });
    if (!response.ok) throw new Error("Naver mail token exchange failed");
    return response.json();
}

async function exchangeKakaoMailToken(code: string, redirectUri: string) {
    const response = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.KAKAO_REST_API_KEY!,
            ...(process.env.KAKAO_CLIENT_SECRET ? { client_secret: process.env.KAKAO_CLIENT_SECRET } : {}),
            code,
            redirect_uri: redirectUri,
        }),
    });
    if (!response.ok) throw new Error("Kakao mail token exchange failed");
    return response.json();
}

async function exchangeOutlookToken(code: string, redirectUri: string) {
    const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            code,
            redirect_uri: redirectUri,
        }),
    });
    if (!response.ok) throw new Error("Outlook token exchange failed");
    return response.json();
}

// ─── GET: OAuth URL 생성 ───

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const provider = request.nextUrl.searchParams.get('provider');
    // 서버 콜백 URL을 redirect_uri로 사용 (모바일 커스텀 스킴은 Google OAuth에서 불가)
    const redirectUri = `${BASE_URL}/api/auth/link-email/callback`;

    let authUrl = '';

    switch (provider) {
        case 'gmail':
            authUrl = buildGmailAuthUrl(email, redirectUri);
            break;
        case 'naver':
            authUrl = buildNaverMailAuthUrl(email, redirectUri);
            break;
        case 'kakao':
            authUrl = buildKakaoMailAuthUrl(email, redirectUri);
            break;
        case 'outlook':
            authUrl = buildOutlookAuthUrl(email, redirectUri);
            break;
        default:
            return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    return NextResponse.json({ authUrl });
});

// ─── POST: 코드 교환 + 토큰 저장 ───

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const body = await request.json();
    const { provider, code, redirect_uri } = body;

    if (!provider) {
        return NextResponse.json({ error: "Missing provider" }, { status: 400 });
    }

    if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const redirectUri = redirect_uri || `${BASE_URL}/api/auth/link-email/callback`;

    let tokens;
    switch (provider) {
        case 'gmail':
            tokens = await exchangeGmailToken(code, redirectUri);
            break;
        case 'naver':
            tokens = await exchangeNaverMailToken(code, redirectUri);
            break;
        case 'kakao':
            tokens = await exchangeKakaoMailToken(code, redirectUri);
            break;
        case 'outlook':
            tokens = await exchangeOutlookToken(code, redirectUri);
            break;
        default:
            return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // DB에 토큰 저장
    const { error: dbError } = await supabaseAdmin
        .from('email_tokens')
        .upsert({
            user_email: email,
            provider,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            expires_at: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null,
            scope: tokens.scope || null,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email,provider' });

    if (dbError) {
        logger.error("[Link Email] DB error:", dbError);
        return NextResponse.json({ error: "Failed to store tokens" }, { status: 500 });
    }

    // Gmail: 기존 gmail_tokens 테이블에도 동기화 (기존 서비스 호환)
    if (provider === 'gmail') {
        // Gmail 프로필에서 이메일 가져오기
        let gmailEmail = email;
        try {
            const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
            });
            if (profileRes.ok) {
                const profile = await profileRes.json();
                gmailEmail = profile.email || email;
            }
        } catch { /* fallback to email */ }

        const { error: legacyErr } = await supabaseAdmin
            .from('gmail_tokens')
            .upsert({
                user_email: email,
                gmail_email: gmailEmail,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_type: tokens.token_type || "Bearer",
                expires_at: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null,
                scope: tokens.scope,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_email' });
        if (legacyErr) logger.error("[Link Email] Gmail legacy sync error:", legacyErr);
    }

    return NextResponse.json({ success: true, provider });
});
