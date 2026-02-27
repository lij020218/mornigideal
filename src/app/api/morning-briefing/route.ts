import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";

// [DEPRECATED] 모닝 브리핑 — 모바일은 /user/daily-briefing + cron 사용
export const POST = withAuth(async (_request: NextRequest, _email: string) => {
    return NextResponse.json(
        { error: "This feature has been discontinued." },
        { status: 410 }
    );
});
