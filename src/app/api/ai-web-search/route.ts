import { NextRequest, NextResponse } from "next/server";
import { tavily } from "@tavily/core";
import { withAuth } from "@/lib/api-handler";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || "" });

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { query, activity, context } = await request.json();

    if (!query) {
        return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }


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
});
