import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
}

export interface ChatSession {
    id?: string;
    user_id: string;
    date: string;
    messages: ChatMessage[];
    title: string;
    created_at?: string;
    updated_at?: string;
}

// GET: 채팅 기록 조회 (날짜별 또는 목록)
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const listOnly = searchParams.get('list') === 'true';

        // Get user ID
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("email", session.user.email)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (listOnly) {
            // 채팅 목록만 반환 (최근 30일)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: chatList, error } = await supabase
                .from("chat_history")
                .select("id, date, title, created_at")
                .eq("user_id", userData.id)
                .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
                .order("date", { ascending: false });

            if (error) {
                console.error("[Chat History] List error:", error);
                return NextResponse.json({ error: "Failed to fetch chat list" }, { status: 500 });
            }

            return NextResponse.json({ chatList: chatList || [] });
        }

        if (date) {
            // 특정 날짜 채팅 조회
            const { data: chatData, error } = await supabase
                .from("chat_history")
                .select("*")
                .eq("user_id", userData.id)
                .eq("date", date)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("[Chat History] Get error:", error);
                return NextResponse.json({ error: "Failed to fetch chat" }, { status: 500 });
            }

            return NextResponse.json({ chat: chatData || null });
        }

        return NextResponse.json({ error: "Missing date or list parameter" }, { status: 400 });
    } catch (error) {
        console.error("[Chat History] GET Error:", error);
        return NextResponse.json({ error: "Failed to fetch chat history" }, { status: 500 });
    }
}

// POST: 채팅 저장/업데이트
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { date, messages, title } = await request.json();

        if (!date || !messages) {
            return NextResponse.json({ error: "Missing date or messages" }, { status: 400 });
        }

        // Get user ID
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("email", session.user.email)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 첫 번째 사용자 메시지를 제목으로 사용 (없으면 날짜)
        let chatTitle = title;
        if (!chatTitle) {
            const firstUserMessage = messages.find((m: ChatMessage) => m.role === 'user');
            if (firstUserMessage) {
                chatTitle = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
            } else {
                chatTitle = date;
            }
        }

        // Upsert chat
        const { data, error } = await supabase
            .from("chat_history")
            .upsert({
                user_id: userData.id,
                date,
                messages,
                title: chatTitle,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,date'
            })
            .select()
            .single();

        if (error) {
            console.error("[Chat History] Save error:", error);
            return NextResponse.json({ error: "Failed to save chat" }, { status: 500 });
        }

        return NextResponse.json({ success: true, chat: data });
    } catch (error) {
        console.error("[Chat History] POST Error:", error);
        return NextResponse.json({ error: "Failed to save chat history" }, { status: 500 });
    }
}

// DELETE: 30일 지난 채팅 자동 삭제 또는 특정 채팅 삭제
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const cleanup = searchParams.get('cleanup') === 'true';

        // Get user ID
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("email", session.user.email)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (cleanup) {
            // 30일 지난 채팅 삭제
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { error, count } = await supabase
                .from("chat_history")
                .delete()
                .eq("user_id", userData.id)
                .lt("date", thirtyDaysAgo.toISOString().split('T')[0]);

            if (error) {
                console.error("[Chat History] Cleanup error:", error);
                return NextResponse.json({ error: "Failed to cleanup old chats" }, { status: 500 });
            }

            return NextResponse.json({ success: true, deleted: count });
        }

        if (date) {
            // 특정 날짜 채팅 삭제
            const { error } = await supabase
                .from("chat_history")
                .delete()
                .eq("user_id", userData.id)
                .eq("date", date);

            if (error) {
                console.error("[Chat History] Delete error:", error);
                return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Missing date or cleanup parameter" }, { status: 400 });
    } catch (error) {
        console.error("[Chat History] DELETE Error:", error);
        return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
    }
}
