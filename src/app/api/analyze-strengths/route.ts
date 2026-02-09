import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-3-pro-preview",
});

export async function POST(request: Request) {
    try {
        console.log('[analyze-strengths] Starting analysis');
        console.log('[analyze-strengths] API Key present:', !!process.env.GEMINI_API_KEY);

        if (!process.env.GEMINI_API_KEY) {
            console.error("[analyze-strengths] GEMINI_API_KEY is missing");
            return NextResponse.json({
                error: "Server configuration error: Missing API Key",
                hint: "Please set GEMINI_API_KEY environment variable in Vercel"
            }, { status: 500 });
        }

        const { userType, major, field, goal, score, level, totalQuestions } = await request.json();
        console.log('[analyze-strengths] Request params:', { userType, field, goal, score, totalQuestions });

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

        console.log('[analyze-strengths] Calling Gemini API...');

        let result;
        try {
            result = await model.generateContent(prompt);
        } catch (apiError: any) {
            console.error("[analyze-strengths] Gemini API call failed:", {
                message: apiError.message,
                status: apiError.status,
                error: apiError
            });
            return NextResponse.json({
                error: "Gemini API call failed",
                details: apiError.message,
                hint: "Check if GEMINI_API_KEY is valid and model is accessible"
            }, { status: 500 });
        }

        const response = await result.response;
        const text = response.text();

        console.log("[analyze-strengths] Raw analysis response:", text.substring(0, 500));

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

    } catch (error: any) {
        console.error("[analyze-strengths] Error:", error);
        return NextResponse.json({
            error: "Failed to analyze strengths"
        }, { status: 500 });
    }
}
