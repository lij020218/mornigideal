import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Use Gemini Flash with Google Search grounding for real-time web search
const getSearchModel = () => genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL_2 || "gemini-3-flash-preview",
    tools: [{ googleSearch: {} } as any],
    generationConfig: {
        temperature: 0.7,
    }
});

export async function POST(request: NextRequest) {
    try {
        console.log("[AI Web Search] API 호출 시작");

        // Check authentication
        const session = await auth();
        if (!session?.user?.email) {
            console.error("[AI Web Search] Unauthorized access attempt");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { query, activity, context, userProfile } = await request.json();
        console.log("[AI Web Search] 요청 데이터:", { query, activity, context });

        if (!query) {
            return NextResponse.json(
                { error: "Query is required" },
                { status: 400 }
            );
        }

        // Build user context for personalized search
        let userContext = "";
        if (userProfile) {
            userContext = `
사용자 정보:
- 직업: ${userProfile.job || '미설정'}
- 목표: ${userProfile.goal || '미설정'}
- 레벨: ${userProfile.level || 'intermediate'}
- 관심사: ${(userProfile.interests || []).join(', ') || '미설정'}
`;
        }

        // Build search prompt based on context
        let searchPrompt = "";

        if (context === "schedule_material") {
            // Material search for schedule preparation
            searchPrompt = `${userContext}

사용자가 "${activity}" 일정을 준비하면서 다음 자료를 찾고 있습니다: "${query}"

웹에서 실제로 도움이 될 자료를 검색해주세요.

찾아야 할 것:
- 관련 기사, 블로그, 튜토리얼
- 유튜브 영상 또는 강의 자료
- 공식 문서 또는 가이드
- 최신 정보 (가능하면 최근 1년 이내)

검색 결과를 다음 JSON 형식으로 정리해주세요:
{
  "summary": "검색 결과 요약 (2-3문장)",
  "resources": [
    {
      "title": "자료 제목",
      "type": "article|video|document|guide",
      "url": "URL (있으면)",
      "description": "간단한 설명 (1-2문장)",
      "source": "출처"
    }
  ],
  "tips": ["관련 팁이나 추가 조언 1-2개"]
}

중요:
- 실제 검색된 결과만 포함하세요
- URL이 확실하지 않으면 검색어를 제안하세요
- 한국어 자료를 우선하되, 영어 자료도 포함하세요`;
        } else {
            // General web search
            searchPrompt = `${userContext}

사용자 질문: "${query}"

웹에서 관련 정보를 검색하여 답변해주세요.

검색 결과를 다음 JSON 형식으로 정리해주세요:
{
  "summary": "검색 결과 기반 답변 (3-5문장)",
  "resources": [
    {
      "title": "자료 제목",
      "type": "article|video|document|news",
      "url": "URL (있으면)",
      "description": "간단한 설명",
      "source": "출처"
    }
  ],
  "tips": ["추가 조언 1-2개"]
}

중요:
- 실제 검색된 결과만 포함하세요
- 정확한 정보를 제공하세요
- 최신 정보를 우선하세요`;
        }

        console.log("[AI Web Search] Gemini 웹 검색 요청 시작");

        const searchModel = getSearchModel();
        const result = await searchModel.generateContent(searchPrompt);
        const response = await result.response;
        const text = response.text();

        console.log("[AI Web Search] Gemini 응답 수신");

        // Parse JSON from response
        let parsedResult;
        try {
            // Try to extract JSON from the response
            let jsonText = text.trim();
            jsonText = jsonText.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

            // Find JSON object
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedResult = JSON.parse(jsonMatch[0]);
            } else {
                // Fallback: create structured response from text
                parsedResult = {
                    summary: text.substring(0, 500),
                    resources: [],
                    tips: []
                };
            }
        } catch (parseError) {
            console.error("[AI Web Search] JSON 파싱 실패:", parseError);
            parsedResult = {
                summary: text.substring(0, 500),
                resources: [],
                tips: []
            };
        }

        // Format the response for chat display
        let formattedResponse = parsedResult.summary || "검색 결과를 찾았습니다.";

        if (parsedResult.resources && parsedResult.resources.length > 0) {
            formattedResponse += "\n\n📚 **관련 자료:**\n";
            parsedResult.resources.slice(0, 5).forEach((resource: any, index: number) => {
                const icon = resource.type === 'video' ? '🎬' :
                            resource.type === 'document' ? '📄' :
                            resource.type === 'guide' ? '📖' : '📰';
                formattedResponse += `${index + 1}. ${icon} **${resource.title}**`;
                if (resource.source) formattedResponse += ` (${resource.source})`;
                formattedResponse += `\n   ${resource.description || ''}`;
                if (resource.url && resource.url.startsWith('http')) {
                    formattedResponse += `\n   🔗 ${resource.url}`;
                }
                formattedResponse += '\n';
            });
        }

        if (parsedResult.tips && parsedResult.tips.length > 0) {
            formattedResponse += "\n💡 **팁:**\n";
            parsedResult.tips.forEach((tip: string) => {
                formattedResponse += `• ${tip}\n`;
            });
        }

        return NextResponse.json({
            success: true,
            result: formattedResponse,
            raw: parsedResult,
            query,
            activity,
            model: process.env.GEMINI_MODEL_2 || "gemini-3-flash-preview"
        });

    } catch (error: any) {
        console.error("[AI Web Search] 에러 발생:", error);
        console.error("[AI Web Search] 에러 상세:", error.message);

        // Fallback response
        return NextResponse.json({
            success: false,
            result: `죄송합니다, 웹 검색 중 오류가 발생했습니다. 직접 검색해보시겠어요?\n\n🔍 추천 검색어: "${error.query || '관련 키워드'}"`,
            error: error.message
        }, { status: 500 });
    }
}
