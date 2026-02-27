import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";

// [DEPRECATED] 학습 자료 분석 기능 삭제됨
export const POST = withAuth(async (_request: NextRequest, _email: string) => {
    return NextResponse.json(
        { error: "This feature has been discontinued." },
        { status: 410 }
    );
});
