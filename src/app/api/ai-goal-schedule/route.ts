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

        // 현재 날짜/시간 정보 (KST 기준)
        const now = new Date();
        const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentDayOfWeek = kstNow.getDay(); // 0=일, 1=월, ..., 6=토
        const currentHour = kstNow.getHours();
        const currentMinute = kstNow.getMinutes();
        const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        const currentDayName = dayNames[currentDayOfWeek];

        // 오늘 남은 시간이 충분한지 확인 (저녁 10시 이후면 오늘은 제외)
        const isTodayAvailable = currentHour < 22;

        // 이번 주 남은 요일들 계산
        const remainingDays: number[] = [];
        // 오늘이 아직 가능하면 오늘 포함
        if (isTodayAvailable) {
            remainingDays.push(currentDayOfWeek);
        }
        // 이번 주 나머지 요일
        for (let i = currentDayOfWeek + 1; i <= 6; i++) {
            remainingDays.push(i);
        }
        // 주간 목표가 아니면 다음 주 요일도 포함
        if (goal.type !== "weekly") {
            for (let i = 0; i < currentDayOfWeek; i++) {
                remainingDays.push(i);
            }
        }
        const remainingDayNames = remainingDays.map(d => dayNames[d]).join(", ");

        // 오늘의 경우 추천 가능한 시간대 계산
        const getAvailableTimeInfo = () => {
            if (!isTodayAvailable) {
                return "오늘은 너무 늦어서 내일부터 일정을 추천합니다.";
            }
            if (currentHour >= 20) {
                return `오늘은 ${currentTimeStr}이므로, 오늘 일정을 추천할 경우 내일로 시작하세요.`;
            }
            if (currentHour >= 18) {
                return `현재 시간이 ${currentTimeStr}이므로, 오늘 일정은 ${currentHour + 1}:00 이후로 추천하세요.`;
            }
            return `현재 시간은 ${currentTimeStr}입니다.`;
        };
        const timeInfo = getAvailableTimeInfo();

        const prompt = `사용자가 다음 목표를 설정했습니다:

목표: ${goal.title}
${goal.description ? `설명: ${goal.description}` : ""}
카테고리: ${goal.category}
기간: ${durationInfo.period} (약 ${durationInfo.weeks}주)

**현재 시간 정보 (매우 중요!):**
- 오늘: ${currentDayName}요일
- 현재 시간: ${currentTimeStr} (KST)
- ${timeInfo}
- 추천 가능한 요일: ${remainingDayNames}

이 목표를 달성하기 위한 **주간 반복 일정** 1-2개를 추천해주세요.

**규칙 (반드시 준수!):**
1. 실용적이고 실현 가능한 일정만 추천
2. 각 일정은 30분~2시간 이내
3. 주 2-4회 정도의 빈도로 추천
4. **현재 시간 ${currentTimeStr} 이후의 시간대만 추천**
   - 현재 밤 ${currentHour}시이므로, 오늘 일정은 피하고 내일부터 시작
   - 밤 10시 이후면 오늘은 제외
5. **추천 가능한 요일만 사용: [${remainingDays.join(", ")}]**
   - 이 배열에 없는 요일 번호는 절대 사용 금지!
6. 일반적인 생활 패턴 고려 (아침: 6-9시, 저녁: 18-21시, 주말 낮)

**JSON 형식으로 응답** (다른 텍스트 없이 JSON만):
{
  "schedules": [
    {
      "text": "일정 이름 (간단명료하게, 예: '아침 조깅', '영어 공부')",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "daysOfWeek": [${remainingDays.length > 0 ? remainingDays.slice(0, Math.min(2, remainingDays.length)).join(", ") : "0"}],
      "reason": "추천 이유 (한 문장)"
    }
  ],
  "tip": "목표 달성을 위한 한 줄 팁"
}

daysOfWeek 코드: 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
**허용된 요일만 사용: [${remainingDays.join(", ")}]**

**예시 (현재 금요일 밤 11시인 경우):**
{
  "schedules": [
    {
      "text": "영어 공부",
      "startTime": "10:00",
      "endTime": "11:00",
      "daysOfWeek": [6, 0],
      "reason": "주말 오전에 집중해서 학습"
    }
  ],
  "tip": "짧은 시간이라도 매일 꾸준히!"
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

        // 색상 추가 + 유효하지 않은 요일 필터링
        const schedulesWithColor = (recommendation.schedules || []).map((s: any) => {
            // AI가 허용되지 않은 요일을 추천한 경우 필터링
            const validDaysOfWeek = (s.daysOfWeek || []).filter((day: number) =>
                remainingDays.includes(day)
            );

            // 유효한 요일이 없으면 남은 요일 중 첫 번째 사용
            const finalDaysOfWeek = validDaysOfWeek.length > 0
                ? validDaysOfWeek
                : remainingDays.slice(0, 2);

            return {
                ...s,
                daysOfWeek: finalDaysOfWeek,
                color,
            };
        });

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
