import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateOAuthState(email: string): string {
    const timestamp = Date.now().toString();
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret';
    const payload = `${email}:${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
    // Base64 encode the whole thing so it's URL-safe
    return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

function verifyOAuthState(state: string): string | null {
    try {
        const decoded = Buffer.from(state, 'base64url').toString();
        const parts = decoded.split(':');
        if (parts.length < 3) return null;

        const signature = parts.pop()!;
        const timestamp = parts.pop()!;
        const email = parts.join(':'); // email might contain colons

        // Verify timestamp (state expires after 10 minutes)
        const age = Date.now() - parseInt(timestamp);
        if (isNaN(age) || age > 10 * 60 * 1000) return null;

        // Verify signature
        const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret';
        const payload = `${email}:${timestamp}`;
        const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
        if (signature !== expectedSig) return null;

        return email;
    } catch {
        return null;
    }
}

// Step 1: Initiate OAuth flow
export async function GET(req: NextRequest) {
    try {
        // Support both web session and mobile JWT
        let userEmail = await getUserEmailWithAuth(req);
        if (!userEmail) {
            const session = await auth();
            userEmail = session?.user?.email || null;
        }

        if (!userEmail) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const state = generateOAuthState(userEmail);

        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/auth/link-gmail/callback`,
            response_type: "code",
            scope: "https://www.googleapis.com/auth/gmail.readonly email profile",
            access_type: "offline",
            prompt: "consent",
            state,
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        return NextResponse.json({ authUrl });
    } catch (error) {
        console.error("[Link Gmail] Error:", error);
        return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 });
    }
}

// Step 2: Handle OAuth callback - exchange code for tokens
export async function POST(req: NextRequest) {
    try {
        const { code, state } = await req.json();

        if (!code) {
            return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
        }

        // Verify state to get authenticated user email
        let userEmail: string | null = null;

        if (state) {
            userEmail = verifyOAuthState(state);
        }

        // Fallback: verify via session/JWT (for backwards compatibility)
        if (!userEmail) {
            userEmail = await getUserEmailWithAuth(req);
        }
        if (!userEmail) {
            const session = await auth();
            userEmail = session?.user?.email || null;
        }

        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized - invalid state" }, { status: 401 });
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
            console.error("[Link Gmail] Token exchange failed");
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
            return NextResponse.json({ error: "Failed to get user profile" }, { status: 500 });
        }

        const profile = await profileResponse.json();
        const gmailEmail = profile.email;

        const expiresAt = Date.now() + (tokens.expires_in * 1000);

        // Store or update tokens in database
        const { error } = await supabase
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
