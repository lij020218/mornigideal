import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { getCachedGreeting, generateGreetingForUser } from "@/lib/greetingGenerator";

export const POST = withAuth(async (request: NextRequest, email: string) => {
    // 1. 크론으로 미리 생성된 인사 확인
    const cached = await getCachedGreeting(email);
    if (cached) {
        return NextResponse.json({ greeting: cached });
    }

    // 2. 캐시 없으면 실시간 생성 (fallback)
    const greeting = await generateGreetingForUser(email);
    return NextResponse.json({ greeting });
});
