import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Step 1: Initiate OAuth flow
export async function GET(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Generate OAuth URL
        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/auth/link-gmail/callback`,
            response_type: "code",
            scope: "https://www.googleapis.com/auth/gmail.readonly email profile",
            access_type: "offline",
            prompt: "consent",
            state: session.user.email // Pass user email as state
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        return NextResponse.json({ authUrl });
    } catch (error) {
        console.error("[Link Gmail] Error:", error);
        return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 });
    }
}

// Step 2: Handle OAuth callback
export async function POST(req: NextRequest) {
    try {
        const { code, userEmail } = await req.json();

        if (!code || !userEmail) {
            return NextResponse.json({ error: "Missing code or userEmail" }, { status: 400 });
        }

        // Exchange code for tokens
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/auth/link-gmail/callback`,
                grant_type: "authorization_code",
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error("[Link Gmail] Token exchange failed:", errorData);
            return NextResponse.json({ error: "Failed to exchange code for tokens" }, { status: 500 });
        }

        const tokens = await tokenResponse.json();

        // Get Gmail email address
        const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });

        if (!profileResponse.ok) {
            console.error("[Link Gmail] Failed to get user profile");
            return NextResponse.json({ error: "Failed to get user profile" }, { status: 500 });
        }

        const profile = await profileResponse.json();
        const gmailEmail = profile.email;

        // Calculate token expiration timestamp
        const expiresAt = Date.now() + (tokens.expires_in * 1000);

        // Store or update tokens in database
        const { data, error } = await supabase
            .from("gmail_tokens")
            .upsert({
                user_email: userEmail,
                gmail_email: gmailEmail,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_type: tokens.token_type || "Bearer",
                expires_at: expiresAt,
                scope: tokens.scope,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: "user_email"
            })
            .select();

        if (error) {
            console.error("[Link Gmail] Database error:", error);
            return NextResponse.json({ error: "Failed to store tokens" }, { status: 500 });
        }

        console.log("[Link Gmail] Successfully linked Gmail:", gmailEmail, "to user:", userEmail);

        return NextResponse.json({
            success: true,
            message: "Gmail 계정이 성공적으로 연동되었습니다",
            gmailEmail
        });
    } catch (error) {
        console.error("[Link Gmail] Error:", error);
        return NextResponse.json({ error: "Failed to link Gmail account" }, { status: 500 });
    }
}
