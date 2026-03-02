import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { MODELS } from "@/lib/models";
import { getUserPlan } from "@/lib/user-plan";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface QuizResult {
  question: string;
  userAnswer: any;
  correctAnswer: any;
  isCorrect: boolean;
  explanation: string;
  page: number;
}

interface EssayResult {
  question: string;
  userAnswer: string;
  score: number;
  feedback: string;
  modelAnswer: string;
  page: number;
}

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { quiz, answers, type } = await request.json();

    // Max → GPT-5.2, Free/Pro → GPT-5-mini (비용 최적화)
    const planInfo = await getUserPlan(email);
    const gradingModel = planInfo.plan === 'max' ? MODELS.GPT_5_2 : MODELS.GPT_5_MINI;


    // Grade T/F (straightforward)
    let tfCorrect = 0;
    const tfResults = quiz.trueFalse.map((q: any, idx: number) => {
      const isCorrect = answers.trueFalse[idx] === q.answer;
      if (isCorrect) tfCorrect++;
      return {
        question: q.question,
        userAnswer: answers.trueFalse[idx],
        correctAnswer: q.answer,
        isCorrect,
        explanation: q.explanation,
        page: q.page
      };
    });

    // Grade Multiple Choice (straightforward)
    let mcCorrect = 0;
    const mcResults = quiz.multipleChoice.map((q: any, idx: number) => {
      const isCorrect = answers.multipleChoice[idx] === q.answer;
      if (isCorrect) mcCorrect++;
      return {
        question: q.question,
        userAnswer: answers.multipleChoice[idx],
        correctAnswer: q.answer,
        isCorrect,
        explanation: q.explanation,
        page: q.page
      };
    });

    // Grade Essay Questions with GPT-5.1

    const essayGradingPromises = quiz.essay.map(async (q: any, idx: number) => {
      const userAnswer = answers.essay[idx];

      const gradingPrompt = `다음 서술형 문제의 답변을 채점하세요.

**문제**: ${q.question}

**학생 답변**: ${userAnswer}

**모범 답안**: ${q.modelAnswer}

**채점 기준 (핵심 키워드)**:
${q.keyPoints.map((kp: string, i: number) => `${i + 1}. ${kp}`).join('\n')}

**채점 방식**:
1. 학생 답변이 핵심 키워드를 얼마나 포함하고 있는지 평가
2. 개념의 정확성과 설명의 논리성 평가
3. 100점 만점으로 점수 부여 (0-100)
4. 부분 점수 허용 (핵심 개념을 일부만 포함한 경우)

다음 JSON 형식으로 응답:

{
  "score": 85,
  "feedback": "핵심 개념을 잘 이해하고 있으나, X 부분에 대한 설명이 부족합니다.",
  "missingPoints": ["부족한 핵심 키워드1", "부족한 핵심 키워드2"]
}`;

      const grading = await openai.chat.completions.create({
        model: gradingModel,
        messages: [
          {
            role: "system",
            content: type === "exam"
              ? "당신은 공정하고 정확한 채점을 하는 대학 교수입니다."
              : "당신은 실무 지식을 정확히 평가하는 시니어 전문가입니다."
          },
          { role: "user", content: gradingPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 1.0,
      });

      const result = JSON.parse(grading.choices[0].message.content || "{}");

      // Log usage for each essay grading
      const usage = grading.usage;
      if (usage) {
        await logOpenAIUsage(
          email,
          gradingModel,
          "grade-quiz/essay",
          usage.prompt_tokens,
          usage.completion_tokens
        );
      }

      return {
        question: q.question,
        userAnswer,
        modelAnswer: q.modelAnswer,
        score: result.score || 0,
        feedback: result.feedback || "",
        missingPoints: result.missingPoints || [],
        page: q.page
      };
    });

    const essayResults = await Promise.all(essayGradingPromises);
    const essayTotalScore = essayResults.reduce((sum, r) => sum + r.score, 0);


    // Calculate total score
    const totalScore = tfCorrect + mcCorrect + (essayTotalScore / 100) * 5;
    const percentage = (totalScore / 15) * 100;

    // Analyze strengths and weaknesses
    const incorrectTF = tfResults.filter((r: QuizResult) => !r.isCorrect);
    const incorrectMC = mcResults.filter((r: QuizResult) => !r.isCorrect);
    const weakEssays = essayResults.filter((r: EssayResult) => r.score < 70);

    const strengths: string[] = [];
    if (tfCorrect >= 4) strengths.push("참/거짓 문제에서 정확한 개념 이해 보유");
    if (mcCorrect >= 4) strengths.push("객관식 문제에서 우수한 응용 능력 발휘");
    if (essayTotalScore / 5 >= 75) strengths.push("서술형 답변에서 깊이 있는 이해도 표현");

    const weaknesses: Array<{ concept: string; pages: number[] }> = [];
    const weakPages = new Set<number>();

    [...incorrectTF, ...incorrectMC].forEach((r: QuizResult) => {
      weakPages.add(r.page);
    });

    weakEssays.forEach((r: any) => {
      if (r.missingPoints.length > 0) {
        weaknesses.push({
          concept: `${r.question.substring(0, 40)}... - ${r.missingPoints.join(', ')}`,
          pages: [r.page]
        });
      }
    });

    // Generate AI advice

    const advicePrompt = `학생의 퀴즈 결과를 분석하여 맞춤형 학습 조언을 제공하세요.

**점수**: ${percentage.toFixed(0)}%
**강점**: ${strengths.join(', ') || '없음'}
**약점**: ${weaknesses.map(w => w.concept).join(', ') || '없음'}

**오답 세부사항**:
- 참/거짓 오답: ${incorrectTF.length}개
- 객관식 오답: ${incorrectMC.length}개
- 서술형 낮은 점수: ${weakEssays.length}개

2-3문장으로 구체적이고 실행 가능한 학습 조언을 제공하세요.`;

    const adviceResult = await openai.chat.completions.create({
      model: gradingModel,
      messages: [
        {
          role: "system",
          content: "당신은 학생들의 학습을 돕는 멘토입니다. 구체적이고 실행 가능한 조언을 제공합니다."
        },
        { role: "user", content: advicePrompt }
      ],
      temperature: 1.0,
    });

    const advice = adviceResult.choices[0].message.content || "계속해서 학습을 이어가세요!";

    // Log usage for advice generation
    const adviceUsage = adviceResult.usage;
    if (adviceUsage) {
      await logOpenAIUsage(
        email,
        gradingModel,
        "grade-quiz/advice",
        adviceUsage.prompt_tokens,
        adviceUsage.completion_tokens
      );
    }

    const result = {
      score: Math.round(totalScore * 10) / 10,
      totalScore: 15,
      percentage: Math.round(percentage * 10) / 10,
      strengths,
      weaknesses,
      advice,
      breakdown: {
        trueFalse: { correct: tfCorrect, total: 5 },
        multipleChoice: { correct: mcCorrect, total: 5 },
        essay: { score: essayTotalScore / 20, total: 5 } // Convert to /5 scale
      },
      details: {
        trueFalse: tfResults,
        multipleChoice: mcResults,
        essay: essayResults
      }
    };


    return NextResponse.json({ result, success: true });
});
