import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { kvGet, kvSet } from "@/lib/kv-store";

/** 트렌드 브리핑 날짜 결정 (KST 5시 이전이면 어제) */
function getBriefingDate(): string {
    const now = new Date();
    const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    if (kstNow.getHours() < 5) {
        kstNow.setDate(kstNow.getDate() - 1);
    }
    return kstNow.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/**
 * GET /api/trend-briefing/read
 * 읽은 브리핑 ID 목록 조회
 */
export const GET = withAuth(async (_request: NextRequest, email: string) => {
    const briefingDate = getBriefingDate();
    const key = `read_trend_ids_${briefingDate}`;
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

    const briefingDate = getBriefingDate();
    const key = `read_trend_ids_${briefingDate}`;

    const existing = await kvGet<string[]>(email, key);
    const readIds = existing || [];

    if (!readIds.includes(briefingId)) {
        readIds.push(briefingId);
        await kvSet(email, key, readIds);
    }

    return NextResponse.json({ success: true, readIds });
});
