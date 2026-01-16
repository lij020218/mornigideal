import { NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { logOpenAIUsage } from "@/lib/openai-usage";

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

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user has Max plan
        const { data: userData } = await supabase
            .from("users")
            .select("id, profile")
            .eq("email", session.user.email)
            .single();

        if (!userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const userPlan = userData.profile?.plan || "standard";
        if (userPlan !== "max") {
            return NextResponse.json(
                { error: "Slide generation is only available for Max plan users" },
                { status: 403 }
            );
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

        // Check if slides already exist
        const { data: existingSlides } = await supabase
            .from("learning_slides")
            .select("*")
            .eq("curriculum_id", curriculumId)
            .eq("day_number", dayNumber)
            .single();

        if (existingSlides) {
            return NextResponse.json({ slides: existingSlides.slides_data });
        }

        const currentLevelLabel = LEVEL_LABELS[currentLevel] || currentLevel;
        const targetLevelLabel = LEVEL_LABELS[targetLevel] || targetLevel;

        const prompt = `당신은 전문 교육 콘텐츠 제작자입니다. 다음 학습 내용에 대한 15쪽 분량의 교육용 슬라이드를 만들어주세요.

**학습 정보:**
- 주제: ${topic}
- 일차: Day ${dayNumber}
- 제목: ${dayTitle}
- 설명: ${dayDescription}
- 학습 목표: ${objectives.join(", ")}
- 학습자 현재 수준: ${currentLevelLabel}
- 목표 수준: ${targetLevelLabel}

**슬라이드 구성 규칙:**
1. 총 15장의 슬라이드를 만드세요
2. 슬라이드 1: 표지 (제목, 일차, 학습 목표 요약)
3. 슬라이드 2: 오늘의 학습 개요
4. 슬라이드 3-12: 본문 내용 (개념 설명, 예시, 실습 가이드 등)
5. 슬라이드 13: 핵심 정리
6. 슬라이드 14: 실습 과제/퀴즈
7. 슬라이드 15: 다음 학습 예고 및 마무리

**각 슬라이드 작성 규칙:**
- 제목은 명확하고 간결하게
- 내용은 3-5개의 핵심 포인트로 구성
- 학습자 수준(${currentLevelLabel})에 맞는 용어와 설명 사용
- 실제 예시와 사례를 포함
- 시각 자료 제안(차트, 다이어그램, 이미지 등)도 포함

**JSON 형식으로 응답** (다른 텍스트 없이 JSON만):
{
    "slides": [
        {
            "slideNumber": 1,
            "title": "슬라이드 제목",
            "content": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
            "notes": "발표자 노트 또는 추가 설명",
            "visualSuggestion": "이 슬라이드에 어울리는 시각 자료 제안"
        },
        ... (총 15개)
    ]
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-2024-11-20",
            messages: [
                {
                    role: "system",
                    content: "당신은 교육 콘텐츠 전문가입니다. 학습자가 쉽게 이해할 수 있는 체계적인 슬라이드를 만들어주세요. 반드시 유효한 JSON 형식으로만 응답하세요.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 8000,
            response_format: { type: "json_object" },
        });

        const responseText = completion.choices[0]?.message?.content || "{}";

        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            console.error("[AI Learning Slides] Failed to parse response:", responseText);
            return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
        }

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                "gpt-4o-2024-11-20",
                "ai-learning-slides",
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        // Save slides to database
        await supabase
            .from("learning_slides")
            .insert({
                curriculum_id: curriculumId,
                user_id: userData.id,
                day_number: dayNumber,
                day_title: dayTitle,
                slides_data: parsed.slides || [],
                created_at: new Date().toISOString(),
            });

        return NextResponse.json({
            slides: parsed.slides || [],
        });
    } catch (error: any) {
        console.error("[AI Learning Slides] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate learning slides" },
            { status: 500 }
        );
    }
}

// GET endpoint to fetch slides for a specific day
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const curriculumId = searchParams.get("curriculumId");
        const dayNumber = searchParams.get("dayNumber");

        if (!curriculumId || !dayNumber) {
            return NextResponse.json({ error: "Missing curriculumId or dayNumber" }, { status: 400 });
        }

        const { data: slides } = await supabase
            .from("learning_slides")
            .select("*")
            .eq("curriculum_id", curriculumId)
            .eq("day_number", parseInt(dayNumber))
            .single();

        if (!slides) {
            return NextResponse.json({ slides: null });
        }

        return NextResponse.json({ slides: slides.slides_data });
    } catch (error: any) {
        console.error("[AI Learning Slides] GET Error:", error);
        return NextResponse.json({ error: "Failed to fetch slides" }, { status: 500 });
    }
}
