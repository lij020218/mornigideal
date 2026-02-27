import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { kvGet, kvSet } from "@/lib/kv-store";

/**
 * GET /api/trend-briefing/read
 * 오늘 읽은 브리핑 ID 목록 조회
 */
export const GET = withAuth(async (_request: NextRequest, email: string) => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const key = `read_trend_ids_${today}`;
    const readIds = await kvGet<string[]>(email, key) || [];
    return NextResponse.json({ readIds });
});

/**
 * POST /api/trend-briefing/read
 * 트렌드 브리핑 읽음 처리
 * body: { briefingId: string }
 */
export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { briefingId } = await request.json();
    if (!briefingId || typeof briefingId !== 'string') {
        return NextResponse.json({ error: "briefingId is required" }, { status: 400 });
    }

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const key = `read_trend_ids_${today}`;

    const existing = await kvGet<string[]>(email, key);
    const readIds = existing || [];

    if (!readIds.includes(briefingId)) {
        readIds.push(briefingId);
        await kvSet(email, key, readIds);
    }

    return NextResponse.json({ success: true, readIds });
});
