import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Use Gemini 2.0 Flash with Google Search grounding for real-time web data
const searchModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    tools: [{
        googleSearch: {}
    }],
    generationConfig: {
        temperature: 1.0,
    }
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

        console.log(`🔍 Generating achievements for ${job} (${level}) with web search...`);

        // Determine if job is student-like or professional
        const isStudent = /학생|대학생|고등학생|중학생|취준생|수험생/i.test(job);

        const searchPrompt = isStudent
            ? `${job} ${level} 학생들의 최근 성과, 수상 실적, 대회 입상, 우수 사례를 웹에서 검색하여 실제 사례를 찾아주세요.

구체적으로 찾을 내용:
- 대학생 대회 수상자 (해커톤, 공모전, 학술대회 등)
- 학과별 우수 학생 통계 (취업률, 자격증 취득률, 평균 스펙 등)
- 최근 1-2년 이내의 실제 사례
- 실명 또는 구체적인 대학명이 포함된 정보

검색한 실제 사례를 바탕으로 3-5개의 성과를 JSON 형식으로 반환하세요:
[
  { "person": "실제 인물/기관명", "achievement": "구체적인 성과 1-2문장" }
]

중요: 웹 검색 결과에서 찾은 실제 데이터만 사용하세요. 없으면 "검색 결과 없음"이라고 말하세요.`
            : `${job} ${level} 직군의 최근 성과, 업계 트렌드, 수상 실적, 성공 사례를 웹에서 검색하여 실제 사례를 찾아주세요.

구체적으로 찾을 내용:
- 해당 직군의 최근 성과 사례 (프로젝트 성공, 수상, 승진 등)
- 업계 평균 성과 지표
- 최근 1-2년 이내의 실제 사례
- 실명 회사 또는 구체적인 통계가 포함된 정보

검색한 실제 사례를 바탕으로 3-5개의 성과를 JSON 형식으로 반환하세요:
[
  { "person": "실제 회사/인물명", "achievement": "구체적인 성과 1-2문장" }
]

중요: 웹 검색 결과에서 찾은 실제 데이터만 사용하세요. 없으면 "검색 결과 없음"이라고 말하세요.`;

        let achievements: any[] = [];

        try {
            const result = await searchModel.generateContent(searchPrompt);
            const response = await result.response;
            const text = response.text();

            console.log("📡 Web search response:", text);

            // Extract JSON from response
            let jsonText = text.trim();
            jsonText = jsonText.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

            // Try to find JSON array
            const arrayMatch = jsonText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
            if (arrayMatch) {
                jsonText = arrayMatch[0];
                achievements = JSON.parse(jsonText);
            } else if (text.includes("검색 결과 없음")) {
                console.log("⚠️ No web search results found, using fallback");
                throw new Error("No search results");
            }

            if (!Array.isArray(achievements) || achievements.length === 0) {
                throw new Error("Invalid achievements array");
            }

            console.log(`✅ Found ${achievements.length} achievements from web search`);

        } catch (searchError) {
            console.error("⚠️ Web search failed:", searchError);

            // Fallback: Use diverse examples with higher temperature
            const fallbackModel = genAI.getGenerativeModel({
                model: process.env.GEMINI_MODEL || "gemini-3-pro-preview",
                generationConfig: {
                    temperature: 1.5, // High temperature for variety
                }
            });

            const fallbackPrompt = `${job} ${level} 수준의 사람들이 달성한 인상적인 성과 3-5개를 매우 다양하게 생성하세요.

요구사항:
- 매번 다른 내용으로 생성 (이전과 겹치지 않게)
- 구체적이고 측정 가능한 성과
- 실명 인물/기관 또는 통계 데이터
- JSON 배열 형식으로 반환

${isStudent ? `예시 형식:
[
  { "person": "카이스트 전산학과", "achievement": "학부생 평균 2개 이상 오픈소스 기여" },
  { "person": "포스텍 화학과", "achievement": "SCI 논문 게재율 학부생 30%" }
]` : `예시 형식:
[
  { "person": "토스 프로덕트팀", "achievement": "A/B 테스트로 전환율 200% 향상" },
  { "person": "배민 서비스기획", "achievement": "월간 사용자 피드백 500건 이상 분석" }
]`}`;

            const fallbackResult = await fallbackModel.generateContent(fallbackPrompt);
            const fallbackResponse = await fallbackResult.response;
            const fallbackText = fallbackResponse.text();

            let fallbackJson = fallbackText.trim().replace(/```json\s*/gi, "").replace(/```\s*/g, "");
            const fallbackMatch = fallbackJson.match(/\[\s*\{[\s\S]*?\}\s*\]/);

            if (fallbackMatch) {
                achievements = JSON.parse(fallbackMatch[0]);
            } else {
                // Ultimate fallback
                achievements = isStudent
                    ? [
                        { person: `우수 ${job}`, achievement: "체계적인 학습으로 상위 10% 성적 유지" },
                        { person: "전국 대회 입상자", achievement: "전공 관련 공모전 3회 이상 수상" },
                        { person: "선배 졸업생", achievement: "재학 중 인턴 2회 이상 경험" }
                    ]
                    : [
                        { person: `성공하는 ${job}`, achievement: "분기별 목표 120% 달성" },
                        { person: "동료 전문가", achievement: "업계 세미나 연 4회 이상 발표" },
                        { person: "팀 리더", achievement: "프로젝트 성공률 90% 이상" }
                    ];
            }
        }

        return NextResponse.json({
            achievements: achievements
        });

    } catch (error) {
        console.error("💥 Error generating peer achievements:", error);
        return NextResponse.json(
            { error: "Failed to generate achievements" },
            { status: 500 }
        );
    }
}
