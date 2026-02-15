import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { getCachedGreeting, generateGreetingForUser } from "@/lib/greetingGenerator";

export async function POST(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. 크론으로 미리 생성된 인사 확인
        const cached = await getCachedGreeting(userEmail);
        if (cached) {
            return NextResponse.json({ greeting: cached });
        }

        // 2. 캐시 없으면 실시간 생성 (fallback)
        const greeting = await generateGreetingForUser(userEmail);
        return NextResponse.json({ greeting });
    } catch (error: any) {
        console.error("[AI Morning Greeting] Error:", error?.message || error);
        const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const h = kstNow.getHours();
        const timeGreeting = h < 5 ? '늦은 시간이네요' : h < 12 ? '좋은 아침이에요' : h < 14 ? '좋은 점심이에요' : h < 18 ? '좋은 오후에요' : '좋은 저녁이에요';
        return NextResponse.json({
            greeting: `${timeGreeting}! Fi.eri입니다 ✨\n\n오늘도 함께 일정을 관리해볼까요? 무엇이든 편하게 말씀해주세요!`
        });
    }
}
