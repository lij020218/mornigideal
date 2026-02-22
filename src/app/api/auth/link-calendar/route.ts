/**
 * 범용 캘린더 연동 API (모바일 + 웹)
 *
 * GET: OAuth URL 생성 (provider별)
 * POST: 코드 교환 + 토큰 저장 / Apple 연동 기록
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserEmailWithAuth } from "@/lib/auth-utils";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

// ─── OAuth URL 빌더 ───

function buildGoogleAuthUrl(userEmail: string, redirectUri: string): string {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/calendar",
        access_type: "offline",
        prompt: "consent",
        state: userEmail,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildNaverAuthUrl(userEmail: string, redirectUri: string): string {
    const params = new URLSearchParams({
        client_id: process.env.NAVER_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        state: userEmail,
    });
    return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
}

function buildKakaoAuthUrl(userEmail: string, redirectUri: string): string {
    const params = new URLSearchParams({
        client_id: process.env.KAKAO_REST_API_KEY!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "talk_calendar",
        state: userEmail,
    });
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

// ─── 토큰 교환 ───

async function exchangeGoogleToken(code: string, redirectUri: string) {
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
    if (!response.ok) throw new Error("Google token exchange failed");
    return response.json();
}

async function exchangeNaverToken(code: string, redirectUri: string) {
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
    if (!response.ok) throw new Error("Naver token exchange failed");
    return response.json();
}

async function exchangeKakaoToken(code: string, redirectUri: string) {
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
    if (!response.ok) throw new Error("Kakao token exchange failed");
    return response.json();
}

// ─── GET: OAuth URL 생성 ───

export async function GET(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const provider = request.nextUrl.searchParams.get('provider');
        const redirectUri = request.nextUrl.searchParams.get('redirect_uri') || `${BASE_URL}/api/auth/link-google-calendar/callback`;

        let authUrl = '';

        switch (provider) {
            case 'google':
                authUrl = buildGoogleAuthUrl(userEmail, redirectUri);
                break;
            case 'naver':
                authUrl = buildNaverAuthUrl(userEmail, redirectUri);
                break;
            case 'kakao':
                authUrl = buildKakaoAuthUrl(userEmail, redirectUri);
                break;
            default:
                return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
        }

        return NextResponse.json({ authUrl });
    } catch (error) {
        console.error("[Link Calendar] GET error:", error);
        return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 });
    }
}

// ─── POST: 코드 교환 + 토큰 저장 ───

export async function POST(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await request.json();
        const { provider, code, redirect_uri } = body;

        if (!provider) {
            return NextResponse.json({ error: "Missing provider" }, { status: 400 });
        }

        // Apple: 코드 교환 없이 연동 기록만
        if (provider === 'apple') {
            const { error: dbError } = await supabaseAdmin
                .from('calendar_tokens')
                .upsert({
                    user_email: userEmail,
                    provider: 'apple',
                    connected_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_email,provider' });

            if (dbError) {
                console.error("[Link Calendar] DB error (apple):", dbError);
                return NextResponse.json({ error: "Failed to store connection" }, { status: 500 });
            }

            return NextResponse.json({ success: true, provider: 'apple' });
        }

        // OAuth 프로바이더: 코드 교환 필요
        if (!code) {
            return NextResponse.json({ error: "Missing code" }, { status: 400 });
        }

        const redirectUri = redirect_uri || `${BASE_URL}/api/auth/link-google-calendar/callback`;

        let tokens;
        switch (provider) {
            case 'google':
                tokens = await exchangeGoogleToken(code, redirectUri);
                break;
            case 'naver':
                tokens = await exchangeNaverToken(code, redirectUri);
                break;
            case 'kakao':
                tokens = await exchangeKakaoToken(code, redirectUri);
                break;
            default:
                return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
        }

        // DB에 토큰 저장
        const { error: dbError } = await supabaseAdmin
            .from('calendar_tokens')
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

        if (dbError) {
            console.error("[Link Calendar] DB error:", dbError);
            return NextResponse.json({ error: "Failed to store tokens" }, { status: 500 });
        }

        // Google: 기존 google_calendar_tokens 테이블에도 동기화 (기존 sync 서비스 호환)
        if (provider === 'google') {
            const { error: legacyErr } = await supabaseAdmin
                .from('google_calendar_tokens')
                .upsert({
                    user_email: userEmail,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_type: tokens.token_type || "Bearer",
                    expires_at: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null,
                    scope: tokens.scope,
                    calendar_id: 'primary',
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_email' });
            if (legacyErr) console.error("[Link Calendar] Google legacy sync error:", legacyErr);
        }

        return NextResponse.json({ success: true, provider });
    } catch (error) {
        console.error("[Link Calendar] POST error:", error);
        return NextResponse.json({ error: "Failed to link calendar" }, { status: 500 });
    }
}
