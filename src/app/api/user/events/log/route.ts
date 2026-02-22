import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { eventLogSchema, validateBody } from '@/lib/schemas';

/**
 * 사용자 이벤트 로깅 API
 * - 일정 추가/완료/스킵
 * - 운동 완료
 * - 수면 기록
 * - 작업 완료
 */
export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const v = validateBody(eventLogSchema, body);
        if (!v.success) return v.response;
        const { eventType, startAt, endAt, metadata } = v.data;

        // 이벤트 기록
        const { data: event, error } = await supabaseAdmin
            .from('user_events')
            .insert({
                user_email: email,
                event_type: eventType,
                start_at: startAt ? new Date(startAt).toISOString() : null,
                end_at: endAt ? new Date(endAt).toISOString() : null,
                metadata: metadata || {},
            })
            .select()
            .single();

        if (error) {
            console.error("[Event Log] Insert error:", error);
            return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
        }


        return NextResponse.json({ success: true, event });
    } catch (error: any) {
        console.error("[Event Log] Error:", error);
        return NextResponse.json(
            { error: "Failed to log event" },
            { status: 500 }
        );
    }
}
