import { NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface LearningData {
    curriculumId: string;
    curriculumTopic: string;
    dayNumber: number;
    dayTitle: string;
    description: string;
    objectives: string[];
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { learningData, userLevel } = await request.json() as {
            learningData: LearningData;
            userLevel?: string;
        };

        if (!learningData || !learningData.dayTitle) {
            return NextResponse.json({ error: "Missing learning data" }, { status: 400 });
        }

        const levelLabel = userLevel === "junior" ? "초급자" : userLevel === "senior" ? "숙련자" : "중급자";

        const prompt = `사용자가 오늘 학습할 주제에 대한 유용한 정보를 제공해주세요.

**학습 정보:**
- 전체 주제: ${learningData.curriculumTopic}
- 오늘의 학습: Day ${learningData.dayNumber} - ${learningData.dayTitle}
- 설명: ${learningData.description}
- 학습 목표: ${learningData.objectives.join(", ")}
- 학습자 수준: ${levelLabel}

**요청:**
오늘의 학습 주제에 대한 실용적인 팁과 꿀팁을 3-4개 제공해주세요.

**규칙:**
1. 각 팁은 짧고 실용적으로 (1-2문장)
2. 학습자 수준에 맞게 설명
3. 실제로 적용할 수 있는 구체적인 조언
4. 이모지를 적절히 사용해서 친근하게

**JSON 형식으로 응답:**
{
    "greeting": "오늘의 학습 주제 소개 (1문장)",
    "tips": [
        {
            "emoji": "💡",
            "title": "팁 제목",
            "content": "팁 내용"
        }
    ],
    "encouragement": "학습 응원 메시지 (1문장)"
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini-2024-07-18",
            messages: [
                {
                    role: "system",
                    content: "당신은 친근하고 유능한 학습 멘토입니다. 학습자에게 실용적이고 도움이 되는 팁을 제공해주세요. 반드시 유효한 JSON 형식으로만 응답하세요.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 1000,
            response_format: { type: "json_object" },
        });

        const responseText = completion.choices[0]?.message?.content || "{}";

        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            console.error("[AI Learning Tip] Failed to parse response:", responseText);
            return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
        }

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                "gpt-4o-mini-2024-07-18",
                "ai-learning-tip",
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        return NextResponse.json({
            greeting: parsed.greeting || "",
            tips: parsed.tips || [],
            encouragement: parsed.encouragement || "",
        });
    } catch (error: any) {
        console.error("[AI Learning Tip] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate learning tip" },
            { status: 500 }
        );
    }
}
