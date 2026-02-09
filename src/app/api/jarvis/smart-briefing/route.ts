/**
 * 자비스 스마트 브리핑 API
 * - POST: 뉴스 기반 스마트 브리핑 생성
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { generateSmartBriefing } from "@/lib/jarvis-smart-briefing";
import { canUseFeature, recordAiUsage } from "@/lib/user-plan";

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 프로/맥스 플랜 체크
        const hasAccess = await canUseFeature(email, "smart_briefing");
        if (!hasAccess) {
            return NextResponse.json(
                { error: "이 기능은 프로 이상 플랜에서만 사용 가능합니다." },
                { status: 403 }
            );
        }

        const { news, userProfile } = await request.json();

        if (!news || !Array.isArray(news)) {
            return NextResponse.json(
                { error: "news 배열이 필요합니다." },
                { status: 400 }
            );
        }

        const briefing = await generateSmartBriefing(
            email,
            news,
            userProfile || {}
        );

        // 사용량 기록
        await recordAiUsage(email, "jarvis");

        if (!briefing) {
            return NextResponse.json(
                { error: "브리핑 생성에 실패했습니다." },
                { status: 500 }
            );
        }

        return NextResponse.json({ briefing });
    } catch (error: any) {
        console.error("[Smart Briefing API] Error:", error);
        return NextResponse.json(
            { error: "브리핑 생성 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
