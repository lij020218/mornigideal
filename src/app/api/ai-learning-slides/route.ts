import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { isProOrAbove } from "@/lib/user-plan";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { MODELS } from "@/lib/models";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 120; // 2 minutes for slide generation

interface Slide {
    slideNumber: number;
    title: string;
    content: string[];
    notes?: string;
    visualSuggestion?: string;
}

interface SlideGenerationRequest {
    curriculumId: string;
    dayNumber: number;
    dayTitle: string;
    dayDescription: string;
    objectives: string[];
    topic: string;
    currentLevel: string;
    targetLevel: string;
}

const LEVEL_LABELS: Record<string, string> = {
    beginner: "입문",
    basic: "기초",
    intermediate: "중급",
    advanced: "고급",
    expert: "전문가",
};

export const POST = withAuth(async (request: NextRequest, email: string) => {
    // Check if user has Pro plan or above
    const hasPro = await isProOrAbove(email);
    if (!hasPro) {
        return NextResponse.json(
            { error: "Slide generation is only available for Pro plan users" },
            { status: 403 }
        );
    }

    // Get user ID for later use
    const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (!userData) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const {
        curriculumId,
        dayNumber,
        dayTitle,
        dayDescription,
        objectives,
        topic,
        currentLevel,
        targetLevel,
    }: SlideGenerationRequest = await request.json();

    if (!curriculumId || !dayNumber || !dayTitle || !topic) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if slides already exist for this user

    const { data: existingSlides, error: checkError } = await supabaseAdmin
        .from("learning_slides")
        .select("*")
        .eq("curriculum_id", curriculumId)
        .eq("day_number", dayNumber)
        .eq("user_id", userData.id)
        .maybeSingle();


    if (existingSlides) {
        return NextResponse.json({ slides: existingSlides.slides_data });
    }


    const currentLevelLabel = LEVEL_LABELS[currentLevel] || currentLevel;
    const targetLevelLabel = LEVEL_LABELS[targetLevel] || targetLevel;

    const prompt = `"${dayTitle}" 주제로 교육용 슬라이드 12-15장을 만들어주세요.

**학습 정보:**
- 대주제: ${topic}
- Day ${dayNumber}: ${dayTitle}
- 설명: ${dayDescription}
- 학습 목표: ${objectives.join(", ")}
- 수준: ${currentLevelLabel} → ${targetLevelLabel}

**🚨 핵심 규칙:**
- 각 슬라이드는 content 2-3개
- 각 content는 2-3문장으로 충실하게 설명
- 핵심 개념 소개 시: "**핵심 개념** 용어: 정의" 형식 사용
- 예시, 비유, 실제 상황을 적극 활용

**슬라이드 구성 (총 12-15장):**

📌 **슬라이드 1: 복습 & 오늘의 연결**
- 지난 시간에 배운 핵심 내용 1-2줄 요약
- 그것이 오늘 배울 내용과 어떻게 연결되는지 설명
- "지난 시간에는 ~를 배웠습니다. 오늘은 이를 바탕으로 ~를 알아봅니다."

📌 **슬라이드 2: 오늘의 학습 목표**
- 오늘 배울 핵심 내용 3가지를 명확하게 제시
- 학습 후 할 수 있게 될 것을 구체적으로 설명

📌 **슬라이드 3-5: 핵심 개념 1 심층 설명** (각 2-3 content)
📌 **슬라이드 6-8: 핵심 개념 2 심층 설명** (각 2-3 content)
📌 **슬라이드 9-10: 실전 적용 & 예시** (각 2-3 content)
📌 **슬라이드 11: 흔한 실수 & 프로 팁** (2-3 content)
📌 **슬라이드 12: 핵심 정리** (2-3 content)

📌 **슬라이드 13-15: 퀴즈 (3문제)**
- 각 슬라이드에 퀴즈 1문제씩
- type: "quiz" 로 표시
- 4지선다 객관식
- 정답과 해설 포함

**퀴즈 슬라이드 형식:**
{
    "slideNumber": 13,
    "title": "퀴즈 1",
    "type": "quiz",
    "content": ["오늘 배운 내용을 확인해볼까요?"],
    "quiz": {
        "question": "이동평균선이 주가 위에 있을 때 의미하는 것은?",
        "options": ["상승 추세", "하락 추세", "횡보 추세", "변동성 증가"],
        "answer": 1,
        "explanation": "이동평균선이 주가 아래에 있으면 상승 추세, 위에 있으면 하락 추세를 의미합니다."
    }
}

**JSON 형식으로 응답:**
{
    "slides": [
        {
            "slideNumber": 1,
            "title": "슬라이드 제목",
            "content": ["2-3문장의 설명"],
            "notes": "강사 노트",
            "visualSuggestion": "시각 자료 제안"
        }
    ]
}`;

    const completion = await openai.chat.completions.create({
        model: MODELS.GPT_5_2,
        messages: [
            {
                role: "system",
                content: `교육 콘텐츠 전문가입니다. 깊이 있으면서도 읽기 쉬운 슬라이드를 존댓말로 작성합니다.

**핵심 원칙:**
- 각 content는 2-3문장으로 충실하게 설명
- 슬라이드당 content 2-3개 (많아야 3개)
- 핵심 개념: "**핵심 개념** 용어: 정의" 형식
- 예시, 비유, 실제 상황으로 이해를 도움

**금지사항:**
- "1. 2. 3." 같은 단순 나열
- 한 content에 5문장 이상
- 같은 내용 반복

반드시 유효한 JSON으로만 응답하세요.`,
            },
            {
                role: "user",
                content: prompt,
            },
        ],
        temperature: 1,
        response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content || "{}";

    let parsed;
    try {
        parsed = JSON.parse(responseText);
    } catch {
        logger.error("[AI Learning Slides] Failed to parse response:", responseText);
        return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Log usage
    const usage = completion.usage;
    if (usage) {
        await logOpenAIUsage(
            email,
            MODELS.GPT_5_2,
            "ai-learning-slides",
            usage.prompt_tokens,
            usage.completion_tokens
        );
    }

    // Save slides to database
    const { error: insertError } = await supabaseAdmin
        .from("learning_slides")
        .insert({
            curriculum_id: curriculumId,
            user_id: userData.id,
            day_number: dayNumber,
            day_title: dayTitle,
            slides_data: parsed.slides || [],
            created_at: new Date().toISOString(),
        });

    if (insertError) {
        logger.error("[AI Learning Slides] Insert error:", insertError);
    } else {
    }

    return NextResponse.json({
        slides: parsed.slides || [],
    });
});

// GET endpoint to fetch slides for a specific day
export const GET = withAuth(async (request: NextRequest, email: string) => {
    // Get user ID
    const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (!userData) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const curriculumId = searchParams.get("curriculumId");
    const dayNumber = searchParams.get("dayNumber");

    if (!curriculumId || !dayNumber) {
        return NextResponse.json({ error: "Missing curriculumId or dayNumber" }, { status: 400 });
    }

    const { data: slides, error: slidesError } = await supabaseAdmin
        .from("learning_slides")
        .select("*")
        .eq("curriculum_id", curriculumId)
        .eq("day_number", parseInt(dayNumber))
        .eq("user_id", userData.id)
        .maybeSingle();


    if (!slides) {
        return NextResponse.json({ slides: null });
    }

    return NextResponse.json({ slides: slides.slides_data });
});
