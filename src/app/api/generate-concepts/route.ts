import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const MINI_MODEL = "gpt-5-mini-2025-08-07";

// Increase timeout for large content processing
export const maxDuration = 60; // 60 seconds
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { materialId } = await request.json();

    if (!materialId) {
      return NextResponse.json({ error: "Material ID required" }, { status: 400 });
    }

    // Fetch material from DB
    const { data: material, error: fetchError } = await supabase
      .from("materials")
      .select("*")
      .eq("id", materialId)
      .single();

    if (fetchError || !material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    // Check if concepts already exist
    if (material.analysis?.concepts_content) {
      return NextResponse.json({
        concepts: material.analysis.concepts_content,
        cached: true,
      });
    }

    const fullContent = material.analysis?.content || "";

    if (!fullContent) {
      return NextResponse.json({ error: "No content to analyze" }, { status: 400 });
    }

    // Generate key concepts with GPT-5 Mini
    console.log(`[GPT-5 Mini] Generating key concepts for material ${materialId}...`);

    const conceptsPrompt = `당신은 학습 자료에서 핵심 개념을 추출하는 전문가입니다.

아래 학습 자료를 분석하고, **시험에 나올 만한 핵심 개념들만** 정리하세요.

**슬라이드 구성 원칙**:
- **슬라이드 개수**: 내용에 따라 유동적 (2-8개 권장, 고정 X)
- **슬라이드당 개념 개수**:
  - 복잡한 개념: 1개만 (자세한 설명 필요 시)
  - 간단한 개념: 3-6개 묶음 (관련 있는 것끼리)
  - 예: "## 기본 통계 개념들" 슬라이드에 평균, 분산, 표준편차 등 여러 개념 포함
- **큰 주제 단위로 묶기**: 관련 개념들을 하나의 슬라이드로 통합

**출력 형식**:
- 슬라이드는 \`## 슬라이드 제목\` 형식으로 시작
- 슬라이드 안에서 개별 개념은 \`### 개념명\`으로 구분
- 각 개념마다 2-4문장으로 간결하게 설명
- 수식이 있으면 LaTeX 문법 사용 ($...$)

**예시 1 (복잡한 개념 - 1개만)**:
\`\`\`
## Gradient Descent
손실 함수를 최소화하기 위해 기울기의 반대 방향으로 파라미터를 업데이트하는 최적화 알고리즘입니다. 학습률 $\\alpha$에 따라 수렴 속도가 달라지며, $\\theta_{t+1} = \\theta_t - \\alpha \\nabla J(\\theta)$ 공식을 사용합니다. SGD, Adam, RMSprop 등 다양한 변형이 있습니다.
\`\`\`

**예시 2 (간단한 개념들 - 여러 개 묶음)**:
\`\`\`
## 기본 통계 개념들

### 평균 (Mean)
데이터의 중심 경향을 나타내는 값으로, 모든 값의 합을 개수로 나눈 것입니다. $\\bar{x} = \\frac{1}{n}\\sum_{i=1}^n x_i$

### 분산 (Variance)
데이터의 흩어진 정도를 나타내는 값으로, 평균으로부터의 편차 제곱의 평균입니다. $\\sigma^2 = \\frac{1}{n}\\sum_{i=1}^n (x_i - \\bar{x})^2$

### 표준편차 (Standard Deviation)
분산의 제곱근으로, 원래 데이터와 같은 단위를 가집니다. $\\sigma = \\sqrt{\\text{Var}(X)}$
\`\`\`

**학습 자료**:
${fullContent}`;

    const response = await openai.chat.completions.create({
      model: MINI_MODEL,
      messages: [{ role: "user", content: conceptsPrompt }],
      temperature: 1.0,
    });

    let conceptsContent = response.choices[0].message.content!.trim();

    // Log usage
    const usage = response.usage;
    if (usage) {
      await logOpenAIUsage(
        session.user.email,
        MINI_MODEL,
        "generate-concepts",
        usage.prompt_tokens,
        usage.completion_tokens
      );
    }

    // 백틱 코드 블록 제거
    conceptsContent = conceptsContent
      .replace(/^```[a-z]*\n/gm, '')
      .replace(/\n```$/gm, '')
      .trim();

    console.log(`[GPT-5 Mini] Key concepts generated: ${conceptsContent.length} chars`);

    // Calculate cost (Mini model)
    const inputTokens = Math.ceil(fullContent.length / 4);
    const outputTokens = Math.ceil(conceptsContent.length / 4);
    const conceptsCost = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;

    console.log(`[CONCEPTS] Estimated cost: $${conceptsCost.toFixed(4)}`);

    // Update DB with concepts and cost
    const updatedMetrics = {
      ...(material.analysis?.metrics || {}),
      conceptsCost: conceptsCost,
      totalCost: (material.analysis?.metrics?.estimatedCost || 0) +
                 (material.analysis?.metrics?.quizCost || 0) +
                 conceptsCost,
    };

    await supabase
      .from("materials")
      .update({
        analysis: {
          ...material.analysis,
          concepts_content: conceptsContent,
          metrics: updatedMetrics,
        },
      })
      .eq("id", materialId);

    console.log("[CONCEPTS] Saved to DB with cost tracking");

    return NextResponse.json({
      concepts: conceptsContent,
      cached: false,
      cost: conceptsCost,
    });
  } catch (error) {
    console.error("[generate-concepts] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate concepts" },
      { status: 500 }
    );
  }
}
