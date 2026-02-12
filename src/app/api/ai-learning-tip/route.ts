import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { MODELS } from "@/lib/models";

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

export async function POST(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
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

        // 언어 학습인지 감지 (영어, 일본어, 중국어 등)
        const topic = learningData.curriculumTopic.toLowerCase();
        const dayTitle = learningData.dayTitle.toLowerCase();
        const isLanguageLearning = /영어|english|일본어|japanese|중국어|chinese|스페인어|spanish|프랑스어|french|외국어|언어/.test(topic + dayTitle);

        // 특정 언어 감지
        let targetLanguage = "";
        if (/영어|english/.test(topic + dayTitle)) targetLanguage = "영어(English)";
        else if (/일본어|japanese/.test(topic + dayTitle)) targetLanguage = "일본어";
        else if (/중국어|chinese/.test(topic + dayTitle)) targetLanguage = "중국어";
        else if (/스페인어|spanish/.test(topic + dayTitle)) targetLanguage = "스페인어";
        else if (/프랑스어|french/.test(topic + dayTitle)) targetLanguage = "프랑스어";

        const languageInstructions = isLanguageLearning && targetLanguage ? `
**중요 - 언어 학습 특별 지침:**
이것은 ${targetLanguage} 학습입니다. 반드시 다음을 지켜주세요:
1. 각 팁에 실제 ${targetLanguage} 표현/문장을 포함하세요
2. 예: 영어라면 "How are you?", "Thank you so much" 같은 실제 표현 제공
3. 발음 팁이나 뉘앙스 차이도 설명해주세요
4. 한국어 번역과 함께 제공하세요
` : "";

        const prompt = `사용자가 오늘 학습할 주제에 대한 유용한 정보를 제공해주세요.

**학습 정보:**
- 전체 주제: ${learningData.curriculumTopic}
- 오늘의 학습: Day ${learningData.dayNumber} - ${learningData.dayTitle}
- 설명: ${learningData.description}
- 학습 목표: ${learningData.objectives.join(", ")}
- 학습자 수준: ${levelLabel}
${languageInstructions}
**요청:**
오늘의 학습 주제에 대한 실용적인 팁과 꿀팁을 3-4개 제공해주세요.

**규칙:**
1. 각 팁은 짧고 실용적으로 (1-2문장)
2. 학습자 수준에 맞게 설명
3. 실제로 적용할 수 있는 구체적인 조언
4. 이모지는 최소한으로 사용 (각 팁당 1개만)
5. 이모지 남용 금지 - 텍스트 중간에 이모지 넣지 말 것

**JSON 형식으로 응답:**
{
    "greeting": "오늘의 학습 주제 소개 (1문장, 이모지 없이)",
    "tips": [
        {
            "emoji": "1개만",
            "title": "팁 제목 (이모지 없이)",
            "content": "팁 내용 (이모지 없이)"
        }
    ],
    "encouragement": "학습 응원 메시지 (1문장, 이모지 없이)"
}`;

        const completion = await openai.chat.completions.create({
            model: MODELS.GPT_4O_MINI,
            messages: [
                {
                    role: "system",
                    content: "당신은 친근하고 유능한 학습 멘토입니다. 학습자에게 실용적이고 도움이 되는 팁을 존댓말로 제공해주세요. 반말 금지. 반드시 유효한 JSON 형식으로만 응답하세요.",
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
                userEmail,
                MODELS.GPT_4O_MINI,
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
