import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import db from "@/lib/db";

/**
 * 사용자 이벤트 로깅 API
 * - 일정 추가/완료/스킵
 * - 운동 완료
 * - 수면 기록
 * - 작업 완료
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { eventType, startAt, endAt, metadata } = await request.json();

        if (!eventType) {
            return NextResponse.json({ error: "eventType is required" }, { status: 400 });
        }

        // 이벤트 기록
        const event = await db.query(
            `INSERT INTO user_events (id, user_email, event_type, start_at, end_at, metadata)
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
             RETURNING *`,
            [
                session.user.email,
                eventType,
                startAt ? new Date(startAt) : null,
                endAt ? new Date(endAt) : null,
                JSON.stringify(metadata || {})
            ]
        );

        console.log(`[Event Log] ${session.user.email}: ${eventType}`, metadata);

        // 특정 이벤트는 즉시 feature 업데이트 트리거
        if (['workout_completed', 'workout_skipped', 'sleep_logged'].includes(eventType)) {
            // TODO: 배치 작업 큐에 추가하거나 즉시 업데이트
            console.log(`[Event Log] Triggering feature update for ${eventType}`);
        }

        return NextResponse.json({ success: true, event: event.rows[0] });
    } catch (error: any) {
        console.error("[Event Log] Error:", error);
        return NextResponse.json(
            { error: "Failed to log event", details: error.message },
            { status: 500 }
        );
    }
}
