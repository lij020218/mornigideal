/**
 * 자비스 장기 기억 API
 * - GET: 관련 기억 검색 또는 최근 기억 조회
 * - POST: 새 기억 저장
 * - DELETE: 기억 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import {
    saveMemory,
    searchMemories,
    getRecentMemories,
    deleteMemory,
    MemoryType,
} from "@/lib/jarvis-memory";
import { canUseFeature, recordAiUsage } from "@/lib/user-plan";

export const GET = withAuth(async (request: NextRequest, email: string) => {
    // 맥스 플랜 체크
    const hasAccess = await canUseFeature(email, "jarvis_memory");
    if (!hasAccess) {
        return NextResponse.json(
            { error: "이 기능은 맥스 플랜에서만 사용 가능합니다." },
            { status: 403 }
        );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "5");

    if (query) {
        // 검색 모드
        const result = await searchMemories(email, query, { limit });

        // 사용량 기록
        await recordAiUsage(email, "memory_search");

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ memories: result.memories });
    } else {
        // 최근 기억 조회 모드
        const result = await getRecentMemories(email, limit);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ memories: result.memories });
    }
});

export const POST = withAuth(async (request: NextRequest, email: string) => {
    // 맥스 플랜 체크
    const hasAccess = await canUseFeature(email, "jarvis_memory");
    if (!hasAccess) {
        return NextResponse.json(
            { error: "이 기능은 맥스 플랜에서만 사용 가능합니다." },
            { status: 403 }
        );
    }

    const body = await request.json();
    const {
        content,
        type = "memo",
        metadata = {},
        importanceScore = 0.5,
    } = body;

    if (!content || typeof content !== "string") {
        return NextResponse.json(
            { error: "content는 필수입니다." },
            { status: 400 }
        );
    }

    const result = await saveMemory(
        email,
        content,
        type as MemoryType,
        metadata,
        importanceScore
    );

    // 사용량 기록
    await recordAiUsage(email, "memory_search");

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: result.id });
});

export const DELETE = withAuth(async (request: NextRequest, email: string) => {
    const { searchParams } = new URL(request.url);
    const memoryId = searchParams.get("id");

    if (!memoryId) {
        return NextResponse.json(
            { error: "id 파라미터가 필요합니다." },
            { status: 400 }
        );
    }

    const result = await deleteMemory(email, memoryId);

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
});
