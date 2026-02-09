/**
 * 슬랙 OAuth 연동 API
 *
 * GET: OAuth 인증 URL 생성
 * POST: 코드 교환 + 토큰 저장
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

function generateOAuthState(email: string): string {
    const timestamp = Date.now().toString();
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret';
    const payload = `${email}:${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
    return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

function verifyOAuthState(state: string): string | null {
    try {
        const decoded = Buffer.from(state, 'base64url').toString();
        const parts = decoded.split(':');
        if (parts.length < 3) return null;

        const signature = parts.pop()!;
        const timestamp = parts.pop()!;
        const email = parts.join(':');

        const age = Date.now() - parseInt(timestamp);
        if (isNaN(age) || age > 10 * 60 * 1000) return null;

        const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret';
        const payload = `${email}:${timestamp}`;
        const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
        if (signature !== expectedSig) return null;

        return email;
    } catch {
        return null;
    }
}

// GET: OAuth URL 생성
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmailWithAuth(request);
    if (!userEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const scopes = [
      'channels:history',
      'channels:read',
      'groups:history',
      'groups:read',
      'im:history',
      'im:read',
      'chat:write',
      'users:read',
    ].join(',');

    const state = generateOAuthState(userEmail);

    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      user_scope: scopes,
      redirect_uri: `${BASE_URL}/api/auth/link-slack/callback`,
      state,
    });

    const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("[Link Slack] Error:", error);
    return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 });
  }
}

// POST: 코드 교환 + 토큰 저장
export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // Verify state to get authenticated user email
    let userEmail: string | null = null;

    if (state) {
        userEmail = verifyOAuthState(state);
    }

    // Fallback: verify via JWT/session
    if (!userEmail) {
        userEmail = await getUserEmailWithAuth(request);
    }

    if (!userEmail) {
        return NextResponse.json({ error: "Unauthorized - invalid state" }, { status: 401 });
    }

    // Slack OAuth v2 토큰 교환
    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        redirect_uri: `${BASE_URL}/api/auth/link-slack/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error("[Link Slack] Token exchange failed:", tokenData.error);
      return NextResponse.json({ error: "Failed to exchange code for tokens" }, { status: 500 });
    }

    const authedUser = tokenData.authed_user;
    if (!authedUser?.access_token) {
      return NextResponse.json({ error: "No user token received" }, { status: 500 });
    }

    // 슬랙 사용자 정보 조회
    const userInfoResponse = await fetch("https://slack.com/api/users.info", {
      headers: {
        Authorization: `Bearer ${authedUser.access_token}`,
      },
      method: "POST",
      body: new URLSearchParams({
        user: authedUser.id,
      }),
    });
    const userInfo = await userInfoResponse.json();

    // slack_tokens 테이블에 upsert
    const { error: dbError } = await supabase
      .from("slack_tokens")
      .upsert({
        user_email: userEmail,
        slack_user_id: authedUser.id,
        slack_team_id: tokenData.team?.id || '',
        slack_team_name: tokenData.team?.name || '',
        access_token: authedUser.access_token,
        scope: authedUser.scope || '',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_email",
      });

    if (dbError) {
      console.error("[Link Slack] Database error:", dbError);
      return NextResponse.json({ error: "Failed to store tokens" }, { status: 500 });
    }

    const displayName = userInfo.ok
      ? (userInfo.user?.real_name || userInfo.user?.name || authedUser.id)
      : authedUser.id;

    return NextResponse.json({
      success: true,
      message: "슬랙이 성공적으로 연동되었습니다",
      teamName: tokenData.team?.name || '',
      slackUserId: authedUser.id,
      slackUserName: displayName,
    });
  } catch (error) {
    console.error("[Link Slack] Error:", error);
    return NextResponse.json({ error: "Failed to link Slack account" }, { status: 500 });
  }
}
