/**
 * Google Calendar OAuth 연동 API
 *
 * GET: OAuth 인증 URL 생성
 * POST: 코드 교환 + 토큰 저장
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserEmailWithAuth } from "@/lib/auth-utils";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

// Step 1: OAuth URL 생성
export async function GET(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            redirect_uri: `${BASE_URL}/api/auth/link-google-calendar/callback`,
            response_type: "code",
            scope: "https://www.googleapis.com/auth/calendar",
            access_type: "offline",
            prompt: "consent",
            state: userEmail,
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        return NextResponse.json({ authUrl });
    } catch (error) {
        console.error("[Link GCal] Error:", error);
        return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 });
    }
}

// Step 2: 코드 교환 + 토큰 저장
export async function POST(request: NextRequest) {
    try {
        const { code, userEmail } = await request.json();

        if (!code || !userEmail) {
            return NextResponse.json({ error: "Missing code or userEmail" }, { status: 400 });
        }

        // 코드 → 토큰 교환
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: `${BASE_URL}/api/auth/link-google-calendar/callback`,
                grant_type: "authorization_code",
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error("[Link GCal] Token exchange failed:", errorData);
            return NextResponse.json({ error: "Failed to exchange code for tokens" }, { status: 500 });
        }

        const tokens = await tokenResponse.json();
        const expiresAt = Date.now() + (tokens.expires_in * 1000);

        // DB에 토큰 저장
        const { error: dbError } = await supabase
            .from("google_calendar_tokens")
            .upsert({
                user_email: userEmail,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_type: tokens.token_type || "Bearer",
                expires_at: expiresAt,
                scope: tokens.scope,
                calendar_id: 'primary',
                updated_at: new Date().toISOString(),
            }, {
                onConflict: "user_email",
            });

        if (dbError) {
            console.error("[Link GCal] Database error:", dbError);
            return NextResponse.json({ error: "Failed to store tokens" }, { status: 500 });
        }

        console.log("[Link GCal] Successfully linked Google Calendar");

        return NextResponse.json({
            success: true,
            message: "Google 캘린더가 성공적으로 연동되었습니다",
        });
    } catch (error) {
        console.error("[Link GCal] Error:", error);
        return NextResponse.json({ error: "Failed to link Google Calendar" }, { status: 500 });
    }
}
