import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

export async function POST() {
    try {
        // Authenticate user
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userEmail = session.user.email;
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        console.log(`[update-summaries] Updating summaries for ${userEmail} on ${today}`);

        // Fetch existing trend briefing
        const { data, error } = await supabase
            .from('trends_cache')
            .select('trends, last_updated')
            .eq('email', userEmail)
            .eq('date', today)
            .single();

        if (error || !data) {
            console.error('[update-summaries] No briefing found:', error);
            return NextResponse.json({ error: 'No briefing found to update' }, { status: 404 });
        }

        const trends = data.trends || [];

        if (trends.length === 0) {
            return NextResponse.json({ error: 'No trends to update' }, { status: 404 });
        }

        console.log(`[update-summaries] Found ${trends.length} trends to update`);

        // Use Gemini to generate short summaries for all trends
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `You are converting long trend briefing summaries into very short one-line summaries.

TRENDS TO CONVERT:
${JSON.stringify(trends.map((t: any, i: number) => ({
    index: i,
    title: t.title,
    current_summary: t.summary
})), null, 2)}

TASK: For each trend, create a very short one-line summary following this format:

**Format Requirements:**
⚠️ **CRITICAL: 반드시 주어 + 동사가 있는 완전한 문장!**
- 최대 25자 이내
- "~이/가" (주격조사) 필수!
- "~했습니다/~합니다/~했어요/~됩니다" (완전한 서술어) 필수!

✅ 좋은 예:
- "하이포가 AI 세일즈로 전환했습니다. 확인하세요!"
- "메타가 자체 AI 칩 개발을 시작합니다. 확인하세요!"
- "테슬라 주가가 10% 급등했어요. 확인하세요!"
- "현대차가 로봇 사업에 진출합니다. 확인하세요!"

❌ 나쁜 예 (절대 금지):
- "로봇, 현대차 주가↑" (주어+동사 없음 X)
- "하이포, AI 세일즈 전환" (동사 없음 X)
- "메타 AI 칩 개발 추진" (주격조사 없음 X)

2문장 금지! 무조건 1문장만!

OUTPUT JSON:
{
  "updated_summaries": [
    {
      "index": 0,
      "new_summary": "핵심 내용 1줄 요약. 확인하세요!"
    },
    {
      "index": 1,
      "new_summary": "핵심 내용 1줄 요약. 확인하세요!"
    }
  ]
}

Convert all ${trends.length} summaries now.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        let updateData;
        try {
            updateData = JSON.parse(text);
        } catch (parseError) {
            console.error("[update-summaries] Failed to parse Gemini response", parseError);
            return NextResponse.json({ error: "Failed to process summaries" }, { status: 500 });
        }

        const updatedSummaries = updateData.updated_summaries || [];

        // Apply new summaries to trends
        const updatedTrends = trends.map((trend: any, index: number) => {
            const update = updatedSummaries.find((u: any) => u.index === index);
            if (update) {
                return {
                    ...trend,
                    summary: update.new_summary
                };
            }
            return trend;
        });

        console.log('[update-summaries] Updated summaries:', updatedTrends.map((t: any) => t.summary));

        // Save back to database
        const { error: updateError } = await supabase
            .from('trends_cache')
            .update({
                trends: updatedTrends,
                last_updated: new Date().toISOString()
            })
            .eq('email', userEmail)
            .eq('date', today);

        if (updateError) {
            console.error('[update-summaries] Failed to update database:', updateError);
            return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
        }

        console.log(`[update-summaries] Successfully updated ${updatedTrends.length} summaries`);

        return NextResponse.json({
            success: true,
            updated_count: updatedTrends.length,
            trends: updatedTrends
        });

    } catch (error) {
        console.error('[update-summaries] Unexpected error:', error);
        return NextResponse.json({
            error: 'Failed to update summaries',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
