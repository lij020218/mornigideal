import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Use service role key for server-side operations to bypass RLS
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(request: NextRequest) {
    try {
        console.log("[analyze-material] Starting analysis...");
        const session = await auth();
        console.log("[analyze-material] Session:", session?.user?.email);

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const type = formData.get("type") as string;

        console.log("[analyze-material] File:", file?.name, "Type:", type);

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const content = await file.text();
        console.log("[analyze-material] Content length:", content.length);

        const modelName = "gemini-2.0-flash-thinking-exp-01-21";
        const model = genAI.getGenerativeModel({ model: modelName });
        console.log("[analyze-material] Calling Gemini with model:", modelName);

        const isExam = type === "exam";
        const prompt = isExam
            ? `당신은 학습 자료 분석 전문가입니다. 다음 시험 준비 자료를 매우 상세히 분석해주세요.

자료:
${content}

다음 형식의 JSON으로 응답해주세요:
{
  "summary": "자료의 매우 상세한 요약 (최소 800자 이상, 핵심 개념과 맥락을 모두 포함)",
  "keyPoints": ["핵심 내용 1 (구체적인 설명 포함)", "핵심 내용 2", ...] (최소 12개),
  "insights": ["인사이트 1 (왜 중요한지 설명)", "인사이트 2", ...] (최소 6개),
  "examPoints": [
    {
      "point": "시험 출제 가능 포인트",
      "importance": "상/중/하",
      "reason": "출제 가능성이 높은 이유",
      "difficulty": "이 내용의 난이도와 이해하기 어려운 부분"
    }
  ] (최소 15개),
  "difficultConcepts": [
    {
      "concept": "어려운 개념 이름",
      "explanation": "쉽게 풀어쓴 설명 (비유나 예시 포함)"
    }
  ] (최소 5개)
}`
            : `당신은 업무 자료 분석 전문가입니다. 다음 업무 자료를 매우 상세히 분석해주세요.

자료:
${content}

다음 형식의 JSON으로 응답해주세요:
{
  "summary": "자료의 매우 상세한 요약 (최소 800자 이상, 배경과 맥락 포함)",
  "keyPoints": ["핵심 내용 1 (구체적인 설명 포함)", "핵심 내용 2", ...] (최소 12개),
  "insights": [
    {
      "insight": "핵심 인사이트",
      "why": "왜 중요한지",
      "impact": "어떤 영향이 있는지"
    }
  ] (최소 8개),
  "importantPoints": [
    {
      "point": "중요한 포인트",
      "reason": "왜 중요한지",
      "application": "어떻게 활용할 수 있는지"
    }
  ] (최소 10개),
  "actionItems": ["실행 가능한 조언 1", "실행 가능한 조언 2", ...] (최소 8개)
}`;

        const result = await model.generateContent(prompt);
        console.log("[analyze-material] Gemini responded");

        const responseText = result.response.text();
        console.log("[analyze-material] Response text length:", responseText.length);

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
        console.log("[analyze-material] Parsed analysis successfully");

        console.log("[analyze-material] Inserting into Supabase...");
        const { data: material, error } = await supabase
            .from("materials")
            .insert({
                user_id: session.user.email,
                title: file.name,
                content: content,
                type: type,
                analysis: analysis,
            })
            .select()
            .single();

        if (error) {
            console.error("[analyze-material] Supabase error:", error);
            return NextResponse.json({
                error: "Failed to save material",
                details: error.message
            }, { status: 500 });
        }

        console.log("[analyze-material] Success! Material ID:", material.id);
        return NextResponse.json({ id: material.id });
    } catch (error: any) {
        console.error("[analyze-material] ERROR:", error);
        console.error("[analyze-material] Error stack:", error.stack);
        return NextResponse.json({
            error: "Analysis failed",
            details: error.message
        }, { status: 500 });
    }
}
