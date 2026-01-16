import { NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60;

interface CurriculumDay {
    day: number;
    title: string;
    description: string;
    objectives: string[];
    estimatedMinutes: number;
}

interface GeneratedCurriculum {
    id: string;
    topic: string;
    reason: string;
    targetLevel: string;
    currentLevel: string;
    duration: number;
    days: CurriculumDay[];
    createdAt: string;
    hasSlides: boolean;
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

        const { topic, reason, currentLevel, targetLevel, duration, userPlan } = await request.json();

        if (!topic || !reason || !currentLevel || !targetLevel || !duration) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const currentLevelLabel = LEVEL_LABELS[currentLevel] || currentLevel;
        const targetLevelLabel = LEVEL_LABELS[targetLevel] || targetLevel;

        const prompt = `당신은 전문 교육 커리큘럼 설계자입니다. 다음 정보를 바탕으로 ${duration}일 분량의 맞춤형 학습 커리큘럼을 만들어주세요.

**학습자 정보:**
- 학습 주제: ${topic}
- 학습 동기: ${reason}
- 현재 수준: ${currentLevelLabel}
- 목표 수준: ${targetLevelLabel}
- 학습 기간: ${duration}일

**규칙:**
1. 총 ${duration}일의 일별 학습 계획을 세워주세요
2. 현재 수준(${currentLevelLabel})에서 목표 수준(${targetLevelLabel})까지 단계적으로 성장할 수 있도록 구성
3. 학습자의 동기(${reason})를 고려하여 실용적인 내용 포함
4. 각 일차별 학습 시간은 30분~60분 정도로 설정
5. 주제가 점진적으로 심화되도록 구성
6. 실습이나 프로젝트도 적절히 포함

**JSON 형식으로 응답** (다른 텍스트 없이 JSON만):
{
    "days": [
        {
            "day": 1,
            "title": "일차 제목 (예: OO의 기초 개념 이해)",
            "description": "오늘 학습할 내용에 대한 간단한 설명",
            "objectives": ["학습 목표 1", "학습 목표 2", "학습 목표 3"],
            "estimatedMinutes": 45
        },
        ...전체 ${duration}일 분량
    ],
    "summary": "전체 커리큘럼에 대한 한 줄 요약"
}

**중요:**
- 반드시 ${duration}일치 전체를 생성하세요
- 각 일차는 이전 일차의 내용을 기반으로 발전해야 합니다
- 주말(7일마다)에는 복습/프로젝트 일정을 넣어주세요`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini-2024-07-18",
            messages: [
                {
                    role: "system",
                    content: "당신은 체계적인 교육 커리큘럼을 설계하는 전문가입니다. 학습자의 수준과 목표에 맞는 실용적인 커리큘럼을 만들어주세요. 반드시 유효한 JSON 형식으로만 응답하세요.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 4000,
            response_format: { type: "json_object" },
        });

        const responseText = completion.choices[0]?.message?.content || "{}";

        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            console.error("[AI Learning Curriculum] Failed to parse response:", responseText);
            return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
        }

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                "gpt-4o-mini-2024-07-18",
                "ai-learning-curriculum",
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        // Create curriculum object
        const curriculumId = uuidv4();
        const curriculum: GeneratedCurriculum = {
            id: curriculumId,
            topic,
            reason,
            targetLevel,
            currentLevel,
            duration,
            days: parsed.days || [],
            createdAt: new Date().toISOString(),
            hasSlides: userPlan === "max",
        };

        // Save to database
        const { data: userData } = await supabase
            .from("users")
            .select("id")
            .eq("email", session.user.email)
            .single();

        if (userData) {
            await supabase
                .from("user_learning_curriculums")
                .insert({
                    id: curriculumId,
                    user_id: userData.id,
                    topic,
                    reason,
                    current_level: currentLevel,
                    target_level: targetLevel,
                    duration,
                    curriculum_data: curriculum,
                    user_plan: userPlan,
                    created_at: new Date().toISOString(),
                });
        }

        return NextResponse.json({
            curriculum,
            summary: parsed.summary || "",
        });
    } catch (error: any) {
        console.error("[AI Learning Curriculum] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate learning curriculum" },
            { status: 500 }
        );
    }
}

// GET endpoint to fetch user's curriculums
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: userData } = await supabase
            .from("users")
            .select("id")
            .eq("email", session.user.email)
            .single();

        if (!userData) {
            return NextResponse.json({ curriculums: [] });
        }

        const { data: curriculums } = await supabase
            .from("user_learning_curriculums")
            .select("*")
            .eq("user_id", userData.id)
            .order("created_at", { ascending: false });

        return NextResponse.json({ curriculums: curriculums || [] });
    } catch (error: any) {
        console.error("[AI Learning Curriculum] GET Error:", error);
        return NextResponse.json({ error: "Failed to fetch curriculums" }, { status: 500 });
    }
}
