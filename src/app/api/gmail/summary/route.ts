import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GmailMessage {
    id: string;
    threadId: string;
    snippet: string;
    subject: string;
    from: string;
    date: string;
    body: string;
}

// Fetch emails using Gmail API
async function fetchGmailMessages(accessToken: string): Promise<GmailMessage[]> {
    try {
        // Get list of message IDs (unread, last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const afterTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);

        const listResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread after:${afterTimestamp}&maxResults=20`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (!listResponse.ok) {
            console.error('[Gmail API] List failed:', await listResponse.text());
            return [];
        }

        const listData = await listResponse.json();
        const messageIds = listData.messages || [];

        if (messageIds.length === 0) {
            return [];
        }

        // Fetch full message details for each ID
        const messages: GmailMessage[] = [];
        for (const { id } of messageIds.slice(0, 10)) { // Limit to 10 most recent
            const msgResponse = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            if (msgResponse.ok) {
                const msgData = await msgResponse.json();
                const headers = msgData.payload.headers;
                const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No Subject)';
                const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
                const date = headers.find((h: any) => h.name === 'Date')?.value || '';

                // Extract body (prefer text/plain, fallback to snippet)
                let body = msgData.snippet || '';
                if (msgData.payload.parts) {
                    const textPart = msgData.payload.parts.find((p: any) => p.mimeType === 'text/plain');
                    if (textPart && textPart.body.data) {
                        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                    }
                } else if (msgData.payload.body?.data) {
                    body = Buffer.from(msgData.payload.body.data, 'base64').toString('utf-8');
                }

                messages.push({
                    id,
                    threadId: msgData.threadId,
                    snippet: msgData.snippet,
                    subject,
                    from,
                    date,
                    body: body.slice(0, 2000), // Limit body length
                });
            }
        }

        return messages;
    } catch (error) {
        console.error('[Gmail API] Error fetching messages:', error);
        return [];
    }
}

// Classify and summarize emails using AI
async function classifyAndSummarizeEmails(messages: GmailMessage[], userJob: string) {
    const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `You are analyzing ${messages.length} unread emails for a ${userJob}.

EMAILS:
${messages.map((msg, i) => `
[${i + 1}]
From: ${msg.from}
Subject: ${msg.subject}
Date: ${msg.date}
Preview: ${msg.snippet}
`).join('\n---\n')}

TASK: Select the 5 MOST IMPORTANT emails and summarize them.

IMPORTANCE CRITERIA (in order):
1. Work-related and actionable (requires response or action)
2. Time-sensitive (deadlines, meetings, urgent requests)
3. From important contacts (colleagues, clients, managers)
4. Contains valuable information for ${userJob}
5. NOT promotional, newsletters, or automated notifications

For each important email, provide:
- A clear Korean summary (2-3 sentences)
- Why it's important for a ${userJob}
- Suggested action (if any)
- Priority level (high/medium/low)

OUTPUT JSON:
{
  "importantEmails": [
    {
      "id": <email index from 1-${messages.length}>,
      "summary": "핵심 내용 요약 (한국어)",
      "importance": "왜 중요한지 (한국어, 1문장)",
      "action": "제안 조치 (한국어)",
      "priority": "high|medium|low",
      "category": "업무|회의|요청|정보|기타"
    }
  ],
  "skippedCount": <number of unimportant emails>
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = JSON.parse(text);

    // Map back to original messages
    const importantEmails = data.importantEmails.map((email: any) => {
        const originalMsg = messages[email.id - 1];
        return {
            ...email,
            messageId: originalMsg.id,
            from: originalMsg.from,
            subject: originalMsg.subject,
            date: originalMsg.date,
            snippet: originalMsg.snippet
        };
    });

    return {
        importantEmails,
        totalUnread: messages.length,
        skippedCount: data.skippedCount || (messages.length - importantEmails.length)
    };
}

// Helper function to refresh access token
async function refreshAccessToken(refreshToken: string, userEmail: string): Promise<string | null> {
    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        });

        if (!response.ok) {
            console.error("[Gmail Summary] Token refresh failed:", await response.text());
            return null;
        }

        const tokens = await response.json();
        const newExpiresAt = Date.now() + (tokens.expires_in * 1000);

        // Update token in database
        await supabase
            .from("gmail_tokens")
            .update({
                access_token: tokens.access_token,
                expires_at: newExpiresAt,
                updated_at: new Date().toISOString(),
            })
            .eq("user_email", userEmail);

        return tokens.access_token;
    } catch (error) {
        console.error("[Gmail Summary] Token refresh error:", error);
        return null;
    }
}

export async function GET() {
    try {
        const session = await auth();

        console.log('[Gmail Summary] Session:', JSON.stringify(session, null, 2));

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const userEmail = session.user.email;
        let accessToken: string | null = null;

        // First, try to get token from session (for Google login users)
        // @ts-ignore - NextAuth token access
        const sessionToken = session.accessToken;

        if (sessionToken) {
            console.log('[Gmail Summary] Using session token (Google login)');
            accessToken = sessionToken;
        } else {
            // Try to get token from database (for linked Gmail accounts)
            console.log('[Gmail Summary] Checking database for linked Gmail');
            const { data, error } = await supabase
                .from("gmail_tokens")
                .select("*")
                .eq("user_email", userEmail)
                .single();

            if (error || !data) {
                console.log('[Gmail Summary] No linked Gmail account found');
                return NextResponse.json({
                    error: "Gmail not linked",
                    message: "Google 계정을 연동해주세요"
                }, { status: 403 });
            }

            // Check if token is expired
            const now = Date.now();
            if (data.expires_at < now) {
                console.log('[Gmail Summary] Token expired, refreshing...');

                if (!data.refresh_token) {
                    return NextResponse.json({
                        error: "No refresh token",
                        message: "Gmail 계정을 다시 연동해주세요"
                    }, { status: 403 });
                }

                accessToken = await refreshAccessToken(data.refresh_token, userEmail);

                if (!accessToken) {
                    return NextResponse.json({
                        error: "Token refresh failed",
                        message: "Gmail 계정을 다시 연동해주세요"
                    }, { status: 403 });
                }
            } else {
                accessToken = data.access_token;
            }

            console.log('[Gmail Summary] Using database token (linked account)');
        }

        if (!accessToken) {
            return NextResponse.json({
                error: "No access token",
                message: "이메일 요약 기능을 사용하려면 Gmail 계정을 연동해주세요"
            }, { status: 403 });
        }

        // Get user profile for job context
        let userJob = "사용자";
        try {
            const profileResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/user/profile`, {
                headers: {
                    Cookie: `authjs.session-token=${session.user.email}` // Simplified, adjust based on your auth setup
                }
            });
            if (profileResponse.ok) {
                const { profile } = await profileResponse.json();
                userJob = profile?.job || "사용자";
            }
        } catch (error) {
            console.error('[Gmail Summary] Failed to get user profile:', error);
        }

        // Fetch Gmail messages
        const messages = await fetchGmailMessages(accessToken);

        if (messages.length === 0) {
            return NextResponse.json({
                importantEmails: [],
                totalUnread: 0,
                skippedCount: 0,
                message: "읽지 않은 이메일이 없습니다"
            });
        }

        // Classify and summarize
        const summary = await classifyAndSummarizeEmails(messages, userJob);

        return NextResponse.json(summary);
    } catch (error) {
        console.error("[Gmail Summary] Error:", error);
        return NextResponse.json({
            error: "Failed to fetch email summary",
            message: "이메일 요약 생성에 실패했습니다"
        }, { status: 500 });
    }
}
