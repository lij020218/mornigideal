import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-3-pro-preview"
});

export async function POST(request: Request) {
    try {
        const { job, level } = await request.json();

        if (!job || !level) {
            return NextResponse.json(
                { error: "Job and level are required" },
                { status: 400 }
            );
        }

        // Determine if job is student-like or professional
        const isStudent = /학생|대학생|고등학생|중학생|취준생|수험생/i.test(job);

        const prompt = `당신은 동기부여 전문가입니다. ${job} 직군의 ${level} 경력자와 비슷한 수준의 사람들이 달성한 인상적인 성과 3-5개를 찾아 JSON 배열로 반환하세요.

요구사항:
1. 구체적이고 측정 가능한 성과 (예: "MVP 수상", "평균 득점 21점", "CPA 시험 응시율 80%")
2. 실명 인물, 구체적인 대학/기관, 또는 신뢰할 수 있는 통계 데이터
3. 경쟁심리와 동기부여를 자극하는 표현
4. 각 성과는 1-2문장으로 간결하게

${isStudent ? `예시 (경영학과 4학년):
[
  { "person": "고려대학교 경영학과 4학년", "achievement": "CPA 시험에 평균 80% 이상 응시합니다" },
  { "person": "연세대학교 4학년 학생", "achievement": "평균 1.5회 이상의 대기업 인턴 경험이 있습니다" },
  { "person": "서울대 경영학과", "achievement": "졸업생의 60%가 졸업 전 창업 경험이 있습니다" },
  { "person": "성균관대 경영학과", "achievement": "평균 TOEIC 점수 900점 이상을 보유하고 있습니다" }
]` : `예시 (마케터 3년차):
[
  { "person": "네이버 마케팅팀", "achievement": "3년차 마케터 평균 ROI 300% 달성" },
  { "person": "카카오 브랜드팀", "achievement": "연간 5개 이상의 성공적인 캠페인 런칭" },
  { "person": "쿠팡 그로스팀", "achievement": "데이터 기반 A/B 테스트로 전환율 150% 향상" }
]`}

직군: ${job}
경력/학년: ${level}

중요: JSON 배열만 반환하세요. 다른 텍스트는 포함하지 마세요.`;

        console.log(`🔍 Generating achievements for ${job} (${level})...`);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("📡 Raw Gemini response:", text);

        // Extract JSON from response
        let jsonText = text.trim();
        jsonText = jsonText.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

        // Try to find JSON array
        const arrayMatch = jsonText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (arrayMatch) {
            jsonText = arrayMatch[0];
        }

        try {
            const achievements = JSON.parse(jsonText);

            if (!Array.isArray(achievements) || achievements.length === 0) {
                throw new Error("Invalid achievements array");
            }

            console.log(`✅ Parsed ${achievements.length} achievements`);

            return NextResponse.json({
                achievements: achievements
            });
        } catch (parseError) {
            console.error("❌ Failed to parse response");
            console.error("Parse error:", parseError);

            // Return fallback achievements
            const fallbackAchievements = isStudent
                ? [
                    { person: `성공하는 ${job}`, achievement: "체계적인 학습 계획으로 목표를 달성하고 있습니다" },
                    { person: "상위 10% 학생", achievement: "온라인 커뮤니티에서 적극적으로 네트워킹하고 있습니다" },
                    { person: "우수 졸업생", achievement: "졸업 전 평균 2개 이상의 프로젝트 경험을 쌓고 있습니다" }
                ]
                : [
                    { person: `성공적인 ${job}`, achievement: "지속적인 학습으로 전문성을 강화하고 있습니다" },
                    { person: `${level} 전문가`, achievement: "업계 트렌드를 선도하는 혁신적인 시도를 하고 있습니다" },
                    { person: "동료 전문가", achievement: "커뮤니티 활동으로 영향력을 확대하고 있습니다" }
                ];

            return NextResponse.json({
                achievements: fallbackAchievements
            });
        }

    } catch (error) {
        console.error("💥 Error generating peer achievements:", error);
        return NextResponse.json(
            { error: "Failed to generate achievements" },
            { status: 500 }
        );
    }
}
