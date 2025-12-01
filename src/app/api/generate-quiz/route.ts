import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const MINI_MODEL = "gpt-5-mini-2025-08-07";
const FINAL_MODEL = "gpt-5.1-2025-11-13";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pageAnalyses, type } = await request.json();

    if (!pageAnalyses || !Array.isArray(pageAnalyses)) {
      return NextResponse.json(
        { error: "Page analyses are required" },
        { status: 400 }
      );
    }

    // Combine all page content for quiz generation
    const allContent = pageAnalyses
      .map((page: any, idx: number) =>
        `[슬라이드 ${idx + 1}: ${page.title}]\n${page.content}\n\nKey Points:\n${page.keyPoints?.join('\n') || 'N/A'}`
      )
      .join("\n\n==========\n\n");

    console.log("[QUIZ] Generating T/F and MC with gpt-5-mini (parallel), Essay with gpt-5.1...");

    // Generate T/F and Multiple Choice with gpt-5-mini in parallel
    const [tfResult, mcResult, essayResult] = await Promise.all([
      // T/F questions with mini model
      openai.chat.completions.create({
        model: MINI_MODEL,
        messages: [
          {
            role: "system",
            content: type === "exam"
              ? "당신은 시험 출제 전문가입니다. 정확하고 명확한 참/거짓 문제를 출제합니다."
              : "당신은 업무 교육 전문가입니다. 실무 중심의 참/거짓 문제를 출제합니다."
          },
          {
            role: "user",
            content: `다음 학습 자료를 기반으로 5개의 참/거짓 문제를 출제하세요.

${allContent}

다음 JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "명확한 진술문",
      "answer": true,
      "explanation": "정답에 대한 설명",
      "page": 1
    }
  ]
}

**중요**: 정확히 5개의 문제를 포함해야 합니다.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 1.0,
      }),

      // Multiple Choice questions with mini model
      openai.chat.completions.create({
        model: MINI_MODEL,
        messages: [
          {
            role: "system",
            content: type === "exam"
              ? "당신은 시험 출제 전문가입니다. 정확한 객관식 문제를 출제합니다."
              : "당신은 업무 교육 전문가입니다. 실무 중심의 객관식 문제를 출제합니다."
          },
          {
            role: "user",
            content: `다음 학습 자료를 기반으로 5개의 객관식 문제를 출제하세요. 각 문제는 4개의 선택지를 가집니다.

${allContent}

다음 JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "answer": 0,
      "explanation": "정답 설명",
      "page": 1
    }
  ]
}

**중요**: 정확히 5개의 문제를 포함해야 합니다.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 1.0,
      }),

      // Essay questions with GPT-5.1
      openai.chat.completions.create({
        model: FINAL_MODEL,
        messages: [
          {
            role: "system",
            content: type === "exam"
              ? "당신은 시험 출제 전문가입니다. 깊이 있는 이해를 평가하는 서술형 문제를 출제합니다."
              : "당신은 업무 교육 전문가입니다. 실무 적용 능력을 평가하는 서술형 문제를 출제합니다."
          },
          {
            role: "user",
            content: `다음 학습 자료를 기반으로 5개의 서술형 문제를 출제하세요. 각 문제는 2-4 문장으로 답변 가능한 수준입니다.

${allContent}

다음 JSON 형식으로 응답:
{
  "questions": [
    {
      "question": "서술형 문제",
      "modelAnswer": "모범 답안 (2-4 문장)",
      "keyPoints": ["핵심 키워드1", "핵심 키워드2", "핵심 키워드3"],
      "page": 1
    }
  ]
}

**중요**: 정확히 5개의 문제를 포함해야 합니다.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 1.0,
      })
    ]);

    // Parse results
    const tfData = JSON.parse(tfResult.choices[0].message.content || "{}");
    const mcData = JSON.parse(mcResult.choices[0].message.content || "{}");
    const essayData = JSON.parse(essayResult.choices[0].message.content || "{}");

    const quiz = {
      trueFalse: (tfData.questions || []).slice(0, 5),
      multipleChoice: (mcData.questions || []).slice(0, 5),
      essay: (essayData.questions || []).slice(0, 5)
    };

    console.log(`[QUIZ] Generated: ${quiz.trueFalse.length} T/F, ${quiz.multipleChoice.length} MC, ${quiz.essay.length} Essay`);

    return NextResponse.json({ quiz, success: true });
  } catch (error: any) {
    console.error("[QUIZ ERROR] Full error:", error);
    console.error("[QUIZ ERROR] Error message:", error.message);
    console.error("[QUIZ ERROR] Stack trace:", error.stack);
    if (error.response) {
      console.error("[QUIZ ERROR] API Response:", error.response.data);
      console.error("[QUIZ ERROR] API Status:", error.response.status);
    }
    return NextResponse.json(
      {
        error: "Quiz generation failed",
        details: error.message,
        stack: error.stack,
        apiError: error.response?.data || null
      },
      { status: 500 }
    );
  }
}
