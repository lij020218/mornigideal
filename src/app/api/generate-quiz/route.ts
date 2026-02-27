import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from '@/lib/supabase-admin';
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { MODELS } from "@/lib/models";
import { getUserPlan } from "@/lib/user-plan";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});


const MINI_MODEL = MODELS.GPT_5_MINI;

// Increase timeout for quiz generation
export const maxDuration = 60; // 60 seconds
export const dynamic = 'force-dynamic';

// Generate onboarding quiz to assess user's level
async function generateOnboardingQuiz(userType: string, major: string, field: string, goal: string) {
  try {
    const context = userType === "대학생"
      ? `${major} 전공 대학생, ${field} 분야 관심, 목표: ${goal}`
      : `${field} 분야 ${userType}, 목표: ${goal}`;


    const response = await openai.chat.completions.create({
      model: MINI_MODEL,
      messages: [
        {
          role: "system",
          content: "당신은 온보딩 퀴즈 전문가입니다. 사용자의 수준을 파악하기 위한 10문제의 객관식 퀴즈를 출제합니다."
        },
        {
          role: "user",
          content: `다음 정보를 기반으로 사용자의 수준(junior/mid/senior)을 파악하기 위한 10개의 객관식 문제를 출제하세요:

${context}

**요구사항**:
- 10개의 문제 (각 4개 선택지)
- 난이도: 3개는 기초, 4개는 중급, 3개는 고급
- ${field} 분야의 핵심 개념 위주
- 실무/학습 경험 파악 가능한 문제

다음 JSON 형식으로 응답:
{
  "quiz": [
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "answer": 0
    }
  ]
}

**중요**: 정확히 10개의 문제를 포함해야 합니다.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 1.0,
    });

    const data = JSON.parse(response.choices[0].message.content || "{}");
    const quiz = (data.quiz || []).slice(0, 10);

    // Log usage for onboarding quiz
    const usage = response.usage;
    if (usage) {
      // Note: No session available here, use system email
      await logOpenAIUsage(
        "system@onboarding-quiz",
        MINI_MODEL,
        "generate-quiz/onboarding",
        usage.prompt_tokens,
        usage.completion_tokens
      );
    }


    return NextResponse.json({ quiz, success: true });
  } catch (error: any) {
    logger.error("[ONBOARDING QUIZ ERROR]:", error);
    return NextResponse.json(
      { error: "Onboarding quiz generation failed" },
      { status: 500 }
    );
  }
}

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const body = await request.json();
    const { pageAnalyses, type, materialId, userType, major, field, goal } = body;

    // Max → GPT-5.2, Free/Pro → GPT-5-mini (비용 최적화)
    const planInfo = await getUserPlan(email);
    const essayModel = planInfo.plan === 'max' ? MODELS.GPT_5_2 : MODELS.GPT_5_MINI;

    // Check if this is an onboarding quiz request
    if (userType || major || field || goal) {
      return await generateOnboardingQuiz(userType, major, field, goal);
    }

    if (!pageAnalyses || !Array.isArray(pageAnalyses)) {
      return NextResponse.json(
        { error: "Page analyses are required" },
        { status: 400 }
      );
    }

    // Check if quiz already exists in DB
    if (materialId) {
      const { data: material } = await supabaseAdmin
        .from("materials")
        .select("analysis")
        .eq("id", materialId)
        .maybeSingle();

      if (material?.analysis?.quiz) {
        return NextResponse.json({
          quiz: material.analysis.quiz,
          cached: true,
        });
      }
    }

    // Combine all page content for quiz generation
    const allContent = pageAnalyses
      .map((page: any, idx: number) =>
        `[슬라이드 ${idx + 1}: ${page.title}]\n${page.content}\n\nKey Points:\n${page.keyPoints?.join('\n') || 'N/A'}`
      )
      .join("\n\n==========\n\n");


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

      // Essay questions — Max: GPT-5.2, Free/Pro: GPT-5-mini
      openai.chat.completions.create({
        model: essayModel,
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

    // Log usage for all three quiz generations
    if (tfResult.usage) {
      await logOpenAIUsage(
        email,
        MINI_MODEL,
        "generate-quiz/tf",
        tfResult.usage.prompt_tokens,
        tfResult.usage.completion_tokens
      );
    }
    if (mcResult.usage) {
      await logOpenAIUsage(
        email,
        MINI_MODEL,
        "generate-quiz/mc",
        mcResult.usage.prompt_tokens,
        mcResult.usage.completion_tokens
      );
    }
    if (essayResult.usage) {
      await logOpenAIUsage(
        email,
        essayModel,
        "generate-quiz/essay",
        essayResult.usage.prompt_tokens,
        essayResult.usage.completion_tokens
      );
    }

    const quiz = {
      trueFalse: (tfData.questions || []).slice(0, 5),
      multipleChoice: (mcData.questions || []).slice(0, 5),
      essay: (essayData.questions || []).slice(0, 5)
    };


    // Calculate cost (3 API calls: T/F with Mini, MC with Mini, Essay with 5.1)
    const allContentTokens = Math.ceil(allContent.length / 4);
    const tfCost = (allContentTokens / 1_000_000) * 0.15 + (500 / 1_000_000) * 0.60; // Mini cost
    const mcCost = (allContentTokens / 1_000_000) * 0.15 + (500 / 1_000_000) * 0.60; // Mini cost
    const essayCost = (allContentTokens / 1_000_000) * 2.50 + (500 / 1_000_000) * 10.00; // 5.1 cost
    const totalQuizCost = tfCost + mcCost + essayCost;


    // Save quiz to DB if materialId is provided
    if (materialId) {
      const { data: material } = await supabaseAdmin
        .from("materials")
        .select("analysis")
        .eq("id", materialId)
        .maybeSingle();

      if (material) {
        // Add quiz cost to existing metrics
        const updatedMetrics = {
          ...(material.analysis?.metrics || {}),
          quizCost: totalQuizCost,
          totalCost: (material.analysis?.metrics?.estimatedCost || 0) + totalQuizCost,
        };

        await supabaseAdmin
          .from("materials")
          .update({
            analysis: {
              ...material.analysis,
              quiz: quiz,
              metrics: updatedMetrics,
            },
          })
          .eq("id", materialId);

      }
    }

    return NextResponse.json({ quiz, success: true, cached: false, cost: totalQuizCost });
});
