import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
});

export async function POST(request: Request) {
    try {
        const { userType, major, field, goal, score, level, totalQuestions } = await request.json();

        const percentage = Math.round((score / totalQuestions) * 100);

        const prompt = `당신은 전문 커리어 코치입니다.
다음 사용자의 정보와 퀴즈 결과를 바탕으로 강점과 약점을 분석해주세요.

사용자 정보:
- 유형: ${userType}
${major ? `- 전공: ${major}` : ''}
- 관심/업무 분야: ${field}
- 목표: ${goal}
- 퀴즈 점수: ${score}/${totalQuestions} (${percentage}%)
- 수준: ${level === 'senior' ? '고급' : level === 'mid' ? '중급' : '초급'}

위 정보를 바탕으로:
1. 이 사용자의 강점 3가지를 구체적으로 분석
2. 보완이 필요한 약점 3가지를 구체적으로 분석

JSON 형식으로만 응답하세요:
{
  "strengths": ["강점1", "강점2", "강점3"],
  "weaknesses": ["약점1", "약점2", "약점3"]
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("📊 Raw analysis response:", text.substring(0, 500));

        // Extract JSON from response
        let jsonText = text.trim();
        jsonText = jsonText.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

        const match = jsonText.match(/\{[\s\S]*"strengths"[\s\S]*"weaknesses"[\s\S]*\}/);
        if (match) {
            jsonText = match[0];
        }

        try {
            const data = JSON.parse(jsonText);
            return NextResponse.json(data);
        } catch (parseError) {
            console.error("❌ Failed to parse analysis response:", parseError);

            // Return default analysis
            return NextResponse.json({
                strengths: [
                    `${field} 분야에 대한 관심과 열정`,
                    "명확한 목표 의식",
                    "지속적인 학습 의지"
                ],
                weaknesses: [
                    `${field} 분야의 전문 지식 심화 필요`,
                    "실무 경험 축적 필요",
                    "체계적인 학습 계획 수립 필요"
                ]
            });
        }

    } catch (error) {
        console.error("💥 Error analyzing strengths:", error);
        return NextResponse.json(
            { error: "Failed to analyze strengths" },
            { status: 500 }
        );
    }
}
