import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_FAST_MODEL || "gemini-2.0-flash",
    generationConfig: {
        temperature: 0.3,
    }
});

// Category definitions
const CATEGORIES = {
    work: { emoji: "💼", label: "업무", color: "#8B5CF6" },
    study: { emoji: "📚", label: "학습", color: "#3B82F6" },
    exercise: { emoji: "🏃", label: "운동", color: "#10B981" },
    wellness: { emoji: "🧘", label: "웰빙", color: "#F59E0B" },
    other: { emoji: "✨", label: "기타", color: "#6B7280" },
};

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { goalText } = await request.json();

        if (!goalText || goalText.trim().length === 0) {
            return NextResponse.json({ error: "Goal text is required" }, { status: 400 });
        }

        console.log(`[GoalClassify] Classifying: "${goalText}"`);

        const prompt = `사용자가 입력한 목표를 분류해주세요.

목표: "${goalText}"

카테고리 옵션:
- work: 업무 관련 (회의, 프로젝트, 보고서, 출근, 미팅, 업무, 일, 직장 등)
- study: 학습 관련 (공부, 영어, 코딩, 독서, 자격증, 강의, 배우기, 학습 등)
- exercise: 운동 관련 (헬스, 러닝, 요가, 산책, 수영, 운동, 스포츠 등)
- wellness: 웰빙 관련 (명상, 수면, 휴식, 취미, 여가, 힐링, 자기관리 등)
- other: 위에 해당하지 않는 것

반드시 아래 JSON 형식으로만 응답하세요:
{
  "category": "카테고리 키 (work/study/exercise/wellness/other 중 하나)",
  "refinedGoal": "다듬어진 목표 텍스트 (원본이 괜찮으면 그대로)",
  "suggestedSchedule": {
    "frequency": "daily/weekly/once 중 하나",
    "duration": 추천 소요 시간(분 단위, 숫자만),
    "bestTime": "추천 시간대 (예: 아침, 오후, 저녁)"
  }
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("[GoalClassify] Raw response:", text);

        // Parse JSON
        let jsonText = text.trim().replace(/```json\s*/gi, "").replace(/```\s*/g, "");
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error("Failed to parse AI response");
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const category = parsed.category || "other";
        const categoryInfo = CATEGORIES[category as keyof typeof CATEGORIES] || CATEGORIES.other;

        return NextResponse.json({
            success: true,
            original: goalText,
            category: category,
            categoryInfo: categoryInfo,
            refinedGoal: parsed.refinedGoal || goalText,
            suggestedSchedule: parsed.suggestedSchedule || null,
        });

    } catch (error: any) {
        console.error("[GoalClassify] Error:", error);
        return NextResponse.json(
            { error: "Failed to classify goal" },
            { status: 500 }
        );
    }
}
