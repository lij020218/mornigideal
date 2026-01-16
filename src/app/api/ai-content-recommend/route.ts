import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { getUserByEmail } from "@/lib/users";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface UserProfile {
    userType?: string;
    major?: string;
    field?: string;
    experience?: string;
    goal?: string;
    interests?: string[];
    job?: string;
    level?: string;
    schedule?: {
        wakeUp?: string;
        workStart?: string;
        workEnd?: string;
        sleep?: string;
    };
    customGoals?: Array<{
        id: string;
        text: string;
        time?: string;
    }>;
}

export async function POST(request: NextRequest) {
    try {
        console.log("[AI Content Recommend] API 호출 시작");

        const session = await auth();
        if (!session?.user?.email) {
            console.error("[AI Content Recommend] Unauthorized access attempt");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { type, context, currentActivity } = await request.json();
        console.log("[AI Content Recommend] 요청 데이터:", { type, context, currentActivity });

        // Get user profile from database
        let userProfile: UserProfile = {};
        try {
            const user = await getUserByEmail(session.user.email);
            if (user?.profile) {
                userProfile = user.profile as UserProfile;
                console.log("[AI Content Recommend] 사용자 프로필 로드:", userProfile);
            }
        } catch (error) {
            console.error("[AI Content Recommend] 프로필 로드 실패:", error);
        }

        // Build user context string
        const userContext = buildUserContext(userProfile);

        // Get current time context
        const now = new Date();
        const hour = now.getHours();
        const timeOfDay = hour < 6 ? "새벽" : hour < 12 ? "오전" : hour < 18 ? "오후" : hour < 22 ? "저녁" : "밤";
        const dayOfWeek = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][now.getDay()];

        let prompt = "";
        let systemPrompt = "";

        if (type === "book") {
            systemPrompt = `당신은 전문 도서 큐레이터입니다. 사용자의 직업, 경력, 목표, 관심사를 고려하여 읽을 만한 책을 추천합니다.
한국에서 구할 수 있는 책 위주로 추천하되, 영어 원서도 함께 추천할 수 있습니다.
반드시 JSON 형식으로 응답하세요.`;

            prompt = `${userContext}

현재 시간: ${timeOfDay} (${dayOfWeek})
${currentActivity ? `현재 활동: ${currentActivity}` : ""}
${context ? `추가 컨텍스트: ${context}` : ""}

이 사용자에게 맞춤형 도서 3권을 추천해주세요.

**추천 기준:**
1. 사용자의 **목표(${userProfile.goal || "미설정"})** 달성에 직접적으로 도움이 되는 책
2. 사용자의 **경력 수준(${userProfile.experience || userProfile.level || "미설정"})**에 적합한 난이도
3. 사용자의 **관심사(${(userProfile.interests || []).join(", ") || "미설정"})**와 연관된 주제
4. 현재 시간대(${timeOfDay})에 읽기 좋은 책 (저녁/밤에는 가벼운 책, 오전에는 집중이 필요한 책)

**응답 형식 (JSON):**
{
  "recommendations": [
    {
      "title": "책 제목",
      "author": "저자",
      "reason": "이 사용자에게 추천하는 구체적인 이유 (1-2문장)",
      "difficulty": "초급/중급/고급",
      "category": "자기계발/경영/기술/인문/과학 등",
      "readingTime": "예상 완독 시간 (예: 3-4시간)"
    }
  ],
  "personalNote": "사용자에게 전하는 짧은 메시지 (1문장, 이모지 1개 포함)"
}`;
        } else if (type === "youtube") {
            systemPrompt = `당신은 전문 유튜브 콘텐츠 큐레이터입니다. 사용자의 직업, 경력, 목표, 관심사를 고려하여 유익한 영상을 추천합니다.
실제로 존재하는 유명 유튜브 채널과 콘텐츠를 추천하세요.
반드시 JSON 형식으로 응답하세요.`;

            prompt = `${userContext}

현재 시간: ${timeOfDay} (${dayOfWeek})
${currentActivity ? `현재 활동: ${currentActivity}` : ""}
${context ? `추가 컨텍스트: ${context}` : ""}

이 사용자에게 맞춤형 유튜브 검색어 3개를 추천해주세요.

**추천 기준:**
1. 사용자의 **직업/분야(${userProfile.job || userProfile.field || "미설정"})**에 실질적으로 도움이 되는 콘텐츠
2. 사용자의 **목표(${userProfile.goal || "미설정"})** 달성에 기여하는 콘텐츠
3. 사용자의 **경력 수준(${userProfile.experience || userProfile.level || "미설정"})**에 적합한 난이도
4. 현재 시간대(${timeOfDay})에 시청하기 좋은 길이
5. **오락성 콘텐츠 제외**: ASMR, 브이로그, 게임, 음악, 리액션 등 제외

**한국어/영어 채널 혼합 추천:**
- 한국어 채널: 체스터챔프, 슈카월드, 노마드코더, 안될과학, 동빈나 등
- 영어 채널: Y Combinator, Lex Fridman, TED, Fireship, 3Blue1Brown 등

**응답 형식 (JSON):**
{
  "recommendations": [
    {
      "searchQuery": "유튜브 검색어 (영어 또는 한국어)",
      "channelSuggestion": "추천 채널명",
      "reason": "이 사용자에게 추천하는 구체적인 이유 (1-2문장)",
      "estimatedDuration": "예상 영상 길이 (예: 15-20분)",
      "category": "교육/기술/비즈니스/자기계발 등"
    }
  ],
  "personalNote": "사용자에게 전하는 짧은 메시지 (1문장, 이모지 1개 포함)"
}`;
        } else if (type === "schedule") {
            systemPrompt = `당신은 일정 관리 전문가입니다. 사용자의 직업, 경력, 목표, 관심사, 현재 일정을 고려하여 최적의 일정을 추천합니다.
반드시 JSON 형식으로 응답하세요.`;

            prompt = `${userContext}

현재 시간: ${timeOfDay} (${dayOfWeek})
${currentActivity ? `현재 활동: ${currentActivity}` : ""}
${context ? `추가 컨텍스트: ${context}` : ""}

**기존 일정:**
${userProfile.customGoals?.map(g => `- ${g.time || "시간 미정"}: ${g.text}`).join("\n") || "등록된 일정 없음"}

**사용자 생활 패턴:**
- 기상: ${userProfile.schedule?.wakeUp || "미설정"}
- 업무 시작: ${userProfile.schedule?.workStart || "미설정"}
- 업무 종료: ${userProfile.schedule?.workEnd || "미설정"}
- 취침: ${userProfile.schedule?.sleep || "미설정"}

이 사용자에게 추가할 만한 일정 3개를 추천해주세요.

**추천 기준:**
1. 사용자의 **목표(${userProfile.goal || "미설정"})** 달성에 도움이 되는 활동
2. 기존 일정과 **겹치지 않는** 시간대
3. 사용자의 **경력 수준**에 맞는 활동
4. 현재 요일(${dayOfWeek})에 적합한 활동

**응답 형식 (JSON):**
{
  "recommendations": [
    {
      "activity": "활동명",
      "suggestedTime": "추천 시간 (예: 오후 7시)",
      "duration": "예상 소요 시간 (예: 30분)",
      "reason": "이 사용자에게 추천하는 구체적인 이유 (1-2문장)",
      "priority": "상/중/하"
    }
  ],
  "personalNote": "사용자에게 전하는 짧은 메시지 (1문장, 이모지 1개 포함)"
}`;
        } else {
            // General recommendation (default)
            systemPrompt = `당신은 개인 성장 전문 어시스턴트입니다. 사용자의 프로필을 분석하여 맞춤형 조언을 제공합니다.
반드시 JSON 형식으로 응답하세요.`;

            prompt = `${userContext}

현재 시간: ${timeOfDay} (${dayOfWeek})
${currentActivity ? `현재 활동: ${currentActivity}` : ""}
${context ? `추가 컨텍스트: ${context}` : ""}

이 사용자에게 지금 할 수 있는 **가장 가치 있는 활동** 3가지를 추천해주세요.

**응답 형식 (JSON):**
{
  "recommendations": [
    {
      "activity": "활동명",
      "type": "학습/운동/휴식/네트워킹/창작 등",
      "reason": "이 사용자에게 추천하는 구체적인 이유 (1-2문장)",
      "actionStep": "바로 시작할 수 있는 첫 번째 행동"
    }
  ],
  "personalNote": "사용자에게 전하는 짧은 메시지 (1문장, 이모지 1개 포함)"
}`;
        }

        console.log("[AI Content Recommend] OpenAI 요청 시작");
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
        });

        console.log("[AI Content Recommend] OpenAI 응답 성공");
        const responseText = completion.choices[0]?.message?.content || "{}";

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                "gpt-4o-mini",
                "ai-content-recommend",
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        try {
            const recommendation = JSON.parse(responseText);
            return NextResponse.json({
                success: true,
                type,
                recommendation,
                userProfile: {
                    job: userProfile.job || userProfile.field,
                    goal: userProfile.goal,
                    experience: userProfile.experience || userProfile.level,
                    interests: userProfile.interests,
                },
            });
        } catch (parseError) {
            console.error("[AI Content Recommend] JSON 파싱 실패:", parseError);
            return NextResponse.json({
                success: false,
                error: "Failed to parse AI response",
                rawResponse: responseText,
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error("[AI Content Recommend] 에러 발생:", error);
        console.error("[AI Content Recommend] 에러 상세:", error.message);
        return NextResponse.json(
            { error: "Failed to generate content recommendation", details: error.message },
            { status: 500 }
        );
    }
}

function buildUserContext(profile: UserProfile): string {
    const parts: string[] = [];

    parts.push("**사용자 프로필:**");

    if (profile.userType) {
        parts.push(`- 유형: ${profile.userType}`);
    }

    if (profile.job || profile.field) {
        parts.push(`- 직업/분야: ${profile.job || profile.field}`);
    }

    if (profile.major) {
        parts.push(`- 전공: ${profile.major}`);
    }

    if (profile.experience || profile.level) {
        const expMap: Record<string, string> = {
            student: "학생/취준생",
            junior: "1-3년차 (주니어)",
            mid: "4-7년차 (미들)",
            senior: "8년차 이상 (시니어)",
            beginner: "입문자",
            intermediate: "중급자",
        };
        const exp = profile.experience || profile.level || "";
        parts.push(`- 경력: ${expMap[exp] || exp}`);
    }

    if (profile.goal) {
        parts.push(`- 목표: ${profile.goal}`);
    }

    if (profile.interests && profile.interests.length > 0) {
        const interestMap: Record<string, string> = {
            ai: "AI/인공지능",
            startup: "스타트업/창업",
            marketing: "마케팅/브랜딩",
            development: "개발/프로그래밍",
            design: "디자인/UX",
            finance: "재테크/투자",
            selfdev: "자기계발",
            health: "건강/운동",
        };
        const interestLabels = profile.interests.map(i => interestMap[i] || i);
        parts.push(`- 관심사: ${interestLabels.join(", ")}`);
    }

    if (parts.length === 1) {
        return "사용자 프로필 정보가 없습니다.";
    }

    return parts.join("\n");
}
