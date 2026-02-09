import { NextRequest, NextResponse } from "next/server";
import { tavily } from "@tavily/core";
import { getUserEmailWithAuth } from "@/lib/auth-utils";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || "" });

export async function POST(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { query, activity, context } = await request.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        console.log("[AI Web Search] Tavily 검색:", { query, activity, context });

        // Tavily 검색 실행
        const searchResult = await tvly.search(query, {
            searchDepth: "basic",
            maxResults: 5,
            includeAnswer: true,
            topic: "general",
        });

        // 응답 포맷팅
        const answer = searchResult.answer || "";
        const results = searchResult.results || [];

        let formattedResponse = "";

        if (answer) {
            formattedResponse += answer + "\n";
        }

        if (results.length > 0) {
            formattedResponse += "\n📚 **검색 결과:**\n";
            results.slice(0, 5).forEach((r: any, i: number) => {
                formattedResponse += `${i + 1}. **${r.title}**\n`;
                if (r.content) {
                    const snippet = r.content.length > 150 ? r.content.substring(0, 150) + '...' : r.content;
                    formattedResponse += `   ${snippet}\n`;
                }
                if (r.url) {
                    formattedResponse += `   🔗 ${r.url}\n`;
                }
            });
        }

        if (!formattedResponse.trim()) {
            formattedResponse = `"${query}"에 대한 검색 결과를 찾지 못했습니다.`;
        }

        return NextResponse.json({
            success: true,
            result: formattedResponse.trim(),
            raw: {
                answer,
                resources: results.map((r: any) => ({
                    title: r.title,
                    url: r.url,
                    description: r.content?.substring(0, 200),
                    source: new URL(r.url).hostname.replace('www.', ''),
                })),
            },
            query,
            activity,
        });

    } catch (error: any) {
        console.error("[AI Web Search] Tavily 에러:", error.message);
        return NextResponse.json({
            success: false,
            result: `검색 중 오류가 발생했습니다. 직접 검색해보세요.\n\n🔍 추천 검색어: "${request.body ? '' : ''}"`,
            error: error.message
        }, { status: 500 });
    }
}
