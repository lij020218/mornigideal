import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { MODELS } from "@/lib/models";

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

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { goal } = await request.json();

        if (!goal || !goal.title || !goal.type || !goal.category) {
            return NextResponse.json({ error: "Goal data required" }, { status: 400 });
        }

        // 목표 유형에 따른 기간 계산
        const now = new Date();
        const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

        const getDurationInfo = (type: string) => {
            // 이번 주 끝 (토요일)
            const endOfWeek = new Date(kstNow);
            endOfWeek.setDate(kstNow.getDate() + (6 - kstNow.getDay()));

            // 이번 달 끝
            const endOfMonth = new Date(kstNow.getFullYear(), kstNow.getMonth() + 1, 0);

            // 올해 끝
            const endOfYear = new Date(kstNow.getFullYear(), 11, 31);

            switch (type) {
                case "weekly":
                    return { period: "이번 주", weeks: 1, endDate: endOfWeek };
                case "monthly":
                    return { period: "이번 달", weeks: 4, endDate: endOfMonth };
                case "yearly":
                    return { period: "올해", weeks: 52, endDate: endOfYear };
                default:
                    return { period: "이번 주", weeks: 1, endDate: endOfWeek };
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

        // 현재 날짜/시간 정보 (KST 기준) - 이미 위에서 선언됨
        const currentDayOfWeek = kstNow.getDay(); // 0=일, 1=월, ..., 6=토
        const currentHour = kstNow.getHours();
        const currentMinute = kstNow.getMinutes();
        const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        const currentDayName = dayNames[currentDayOfWeek];

        // 오늘 남은 시간이 충분한지 확인 (저녁 10시 이후면 오늘은 제외)
        const isTodayAvailable = currentHour < 22;

        // 목표 기간 내 남은 날짜들 계산
        const endDate = durationInfo.endDate;
        const today = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());

        // 목표 기간 끝까지 남은 일수 계산
        const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // 목표 기간 내 가능한 요일들 수집
        const remainingDays: number[] = [];
        const remainingDates: string[] = []; // 구체적인 날짜들 (월간/연간 목표용)

        for (let i = 0; i <= daysUntilEnd && i < 14; i++) { // 최대 2주까지만 (너무 많으면 복잡)
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + i);

            // 목표 기간 끝을 넘어가면 중단
            if (checkDate > endDate) break;

            const dayOfWeek = checkDate.getDay();

            // 오늘이고 시간이 너무 늦으면 건너뛰기
            if (i === 0 && !isTodayAvailable) continue;

            // 중복 요일 방지 (주간 반복용)
            if (!remainingDays.includes(dayOfWeek)) {
                remainingDays.push(dayOfWeek);
            }

            // 구체적인 날짜 저장 (월간/연간용)
            const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
            remainingDates.push(dateStr);
        }

        const remainingDayNames = remainingDays.map(d => dayNames[d]).join(", ");

        // 목표 기간 정보 문자열
        const endDateStr = `${endDate.getFullYear()}년 ${endDate.getMonth() + 1}월 ${endDate.getDate()}일`;
        const periodInfo = `목표 기간: 오늘부터 ${endDateStr}까지 (${daysUntilEnd}일 남음)`;

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
목표 유형: ${goal.type === 'weekly' ? '주간 목표' : goal.type === 'monthly' ? '월간 목표' : '연간 목표'}
기간: ${durationInfo.period}

**중요! ${periodInfo}**
- 오늘: ${currentDayName}요일 (${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일)
- 현재 시간: ${currentTimeStr} (KST)
- ${timeInfo}
- 목표 마감일: ${endDateStr}
- 남은 기간 내 추천 가능한 요일: ${remainingDayNames}

이 목표를 달성하기 위한 일정 1-2개를 추천해주세요.
**반드시 목표 기간(${endDateStr}까지) 내에서만 일정을 추천하세요!**

**규칙 (반드시 준수!):**
1. 실용적이고 실현 가능한 일정만 추천
2. 각 일정은 30분~2시간 이내
3. **목표 기간 제한 (매우 중요!):**
   - 주간 목표: 반드시 이번 주 토요일(${endDate.getMonth() + 1}월 ${endDate.getDate()}일)까지만 일정 추천
   - 월간 목표: 반드시 이번 달 말(${endDate.getMonth() + 1}월 ${endDate.getDate()}일)까지만 일정 추천
   - 연간 목표: 반드시 올해 말(12월 31일)까지만 일정 추천
   - **기간이 지나면 자동으로 일정이 사라지므로 기간 내에만 추천!**
4. **현재 시간 ${currentTimeStr} 이후의 시간대만 추천**
5. **추천 가능한 요일만 사용: [${remainingDays.join(", ")}]** (다른 요일 절대 불가)
6. 일반적인 생활 패턴 고려 (아침: 6-9시, 저녁: 18-21시)

**JSON 형식으로 응답** (다른 텍스트 없이 JSON만):
{
  "schedules": [
    {
      "text": "일정 이름 (간단명료하게)",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "daysOfWeek": [${remainingDays.length > 0 ? remainingDays.slice(0, Math.min(3, remainingDays.length)).join(", ") : "0"}],
      "reason": "추천 이유 (한 문장)"
    }
  ],
  "tip": "목표 달성을 위한 한 줄 팁",
  "endDate": "${endDate.toISOString().split('T')[0]}"
}

daysOfWeek 코드: 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
**허용된 요일만 사용: [${remainingDays.join(", ")}]**`;

        const completion = await openai.chat.completions.create({
            model: MODELS.GPT_4O_MINI,
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

        // 색상 추가 + 유효하지 않은 요일 필터링 + 기간 제한 추가
        const todayStr = today.toISOString().split('T')[0];
        const endDateStr2 = endDate.toISOString().split('T')[0];

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
                // 목표 기간 내에서만 일정이 표시되도록 startDate와 endDate 추가
                startDate: todayStr,
                endDate: endDateStr2,
            };
        });

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                email,
                MODELS.GPT_4O_MINI,
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
            { error: "일정 추천 생성에 실패했습니다." },
            { status: 500 }
        );
    }
}
