import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { eventLogSchema, validateBody } from '@/lib/schemas';
import { logger } from '@/lib/logger';

/**
 * 사용자 이벤트 로깅 API
 * - 일정 추가/완료/스킵
 * - 운동 완료
 * - 수면 기록
 * - 작업 완료
 */
export const POST = withAuth(async (request: NextRequest, email: string) => {
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
        logger.error("[Event Log] Insert error:", error);
        return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
    }

    return NextResponse.json({ success: true, event });
});
