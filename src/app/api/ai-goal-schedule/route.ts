import { NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

// Vercel Pro allows up to 60 seconds, Free plan is 10 seconds
export const maxDuration = 30;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface ScheduleRecommendation {
    text: string;
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
    color: string;
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { goal } = await request.json();

        if (!goal || !goal.title || !goal.type || !goal.category) {
            return NextResponse.json({ error: "Goal data required" }, { status: 400 });
        }

        // 목표 유형에 따른 기간 계산
        const getDurationInfo = (type: string) => {
            switch (type) {
                case "weekly":
                    return { period: "이번 주", weeks: 1 };
                case "monthly":
                    return { period: "이번 달", weeks: 4 };
                case "yearly":
                    return { period: "올해", weeks: 52 };
                default:
                    return { period: "이번 주", weeks: 1 };
            }
        };

        // 카테고리에 따른 색상 매핑
        const getCategoryColor = (category: string) => {
            const colorMap: Record<string, string> = {
                career: "purple",
                health: "green",
                exercise: "pink",
                learning: "cyan",
                finance: "amber",
                relationship: "red",
                hobby: "orange",
                general: "sky",
            };
            return colorMap[category] || "purple";
        };

        const durationInfo = getDurationInfo(goal.type);
        const color = getCategoryColor(goal.category);

        // 현재 날짜 정보
        const now = new Date();
        const currentDayOfWeek = now.getDay(); // 0=일, 1=월, ..., 6=토
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        const currentDayName = dayNames[currentDayOfWeek];

        // 이번 주 남은 요일들 계산 (오늘 포함)
        const remainingDays: number[] = [];
        for (let i = currentDayOfWeek; i <= 6; i++) {
            remainingDays.push(i);
        }
        // 주간 목표면 다음 주 요일도 포함
        if (goal.type !== "weekly") {
            for (let i = 0; i < currentDayOfWeek; i++) {
                remainingDays.push(i);
            }
        }
        const remainingDayNames = remainingDays.map(d => dayNames[d]).join(", ");

        const prompt = `사용자가 다음 목표를 설정했습니다:

목표: ${goal.title}
${goal.description ? `설명: ${goal.description}` : ""}
카테고리: ${goal.category}
기간: ${durationInfo.period} (약 ${durationInfo.weeks}주)

**오늘은 ${currentDayName}요일입니다.**
${goal.type === "weekly" ? `이번 주 남은 요일: ${remainingDayNames} (오늘 포함)` : ""}

이 목표를 달성하기 위한 **주간 반복 일정** 1-2개를 추천해주세요.

**규칙:**
1. 실용적이고 실현 가능한 일정만 추천
2. 각 일정은 30분~2시간 이내
3. 주 2-4회 정도의 빈도로 추천
4. 일반적인 직장인/학생 생활 패턴 고려 (저녁 또는 주말 시간대)
5. **주간 목표인 경우: 오늘(${currentDayName}) 이후 요일만 추천 (${remainingDayNames})**
   - 예: 오늘이 목요일이면 목, 금, 토, 일 중에서만 선택

**JSON 형식으로 응답** (다른 텍스트 없이 JSON만):
{
  "schedules": [
    {
      "text": "일정 이름 (간단명료하게, 예: '아침 조깅', '영어 공부')",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "daysOfWeek": [${remainingDays.slice(0, 3).join(", ")}],
      "reason": "추천 이유 (한 문장)"
    }
  ],
  "tip": "목표 달성을 위한 한 줄 팁"
}

daysOfWeek: 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토

**예시 응답 (오늘이 목요일인 경우):**
목표 "다이어트"의 경우:
{
  "schedules": [
    {
      "text": "저녁 운동",
      "startTime": "19:00",
      "endTime": "20:00",
      "daysOfWeek": [4, 6],
      "reason": "이번 주 남은 목요일과 토요일에 규칙적인 운동"
    }
  ],
  "tip": "운동 후 단백질 섭취로 근육 회복을 도와주세요"
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini-2024-07-18",
            messages: [
                {
                    role: "system",
                    content: "당신은 목표 달성을 위한 일정 추천 전문가입니다. 반드시 유효한 JSON 형식으로만 응답하세요. 추가 설명이나 마크다운 없이 순수 JSON만 출력하세요.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
        });

        const responseText = completion.choices[0]?.message?.content || "{}";

        let recommendation;
        try {
            recommendation = JSON.parse(responseText);
        } catch {
            console.error("[AI Goal Schedule] Failed to parse response:", responseText);
            return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
        }

        // 색상 추가
        const schedulesWithColor = (recommendation.schedules || []).map((s: any) => ({
            ...s,
            color,
        }));

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                "gpt-4o-mini-2024-07-18",
                "ai-goal-schedule",
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        return NextResponse.json({
            schedules: schedulesWithColor,
            tip: recommendation.tip || "",
        });
    } catch (error: any) {
        console.error("[AI Goal Schedule] Error:", error);
        console.error("[AI Goal Schedule] Error message:", error?.message);
        console.error("[AI Goal Schedule] Error stack:", error?.stack);

        // Return more specific error messages
        if (error?.message?.includes('API key')) {
            return NextResponse.json(
                { error: "OpenAI API key not configured" },
                { status: 500 }
            );
        }
        if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT') {
            return NextResponse.json(
                { error: "Request timed out. Please try again." },
                { status: 504 }
            );
        }

        return NextResponse.json(
            { error: `Failed to generate schedule recommendations: ${error?.message || 'Unknown error'}` },
            { status: 500 }
        );
    }
}
