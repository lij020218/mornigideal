import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { todaySchedules, userProfile } = await request.json();

        console.log('[AI Morning Greeting] Generating personalized morning greeting');

        // Build context from user profile
        let userContext = "";
        if (userProfile) {
            userContext = `
사용자 정보:
- 이름: ${userProfile.name || '사용자'}
- 직업: ${userProfile.job || '미설정'}
- 목표: ${userProfile.goal || '미설정'}
- 레벨: ${userProfile.level || 'intermediate'}
- 관심 분야: ${(userProfile.interests || []).join(', ') || '미설정'}
`;
        }

        let scheduleContext = '';
        if (todaySchedules && todaySchedules.length > 0) {
            scheduleContext = `\n오늘의 일정:\n${todaySchedules.map((s: any) => `- ${s.startTime}: ${s.text}`).join('\n')}`;
        }

        const now = new Date();
        const hour = now.getHours();
        const weekday = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][now.getDay()];

        const prompt = `당신은 Fi.eri 앱의 AI 어시스턴트입니다.

현재 시간: ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}

사용자 프로필:
- 이름: ${userProfile?.name || '사용자'}
- 직업: ${userProfile?.job || '미설정'}
- 목표: ${userProfile?.goal || '미설정'}
- 관심 분야: ${(userProfile?.interests || []).join(', ') || '미설정'}

오늘의 일정:
${todaySchedules?.length > 0 ? todaySchedules.map((s: any) => `- ${s.startTime}: ${s.text}`).join('\n') : '- 등록된 일정 없음'}

**요청사항:**
1. 따뜻하고 개인화된 아침 인사 (2-3문장, 존댓말, 이모지 1개)
2. 오늘 일정에 대한 간단한 코멘트
3. 사용자의 직업, 목표, 관심사를 고려한 **오늘 추천 활동 5개**:
   - 빈 시간대에 할 수 있는 생산적인 활동
   - 각 활동은 간결하게 (예: "• 10:00 - 영어 단어 암기 30분")
   - 사용자의 레벨과 목표에 맞게 조정

**응답 형식:**
[인사 및 일정 코멘트]

오늘 추천 활동:
• [시간] - [활동명 및 간단한 설명]
• [시간] - [활동명 및 간단한 설명]
• [시간] - [활동명 및 간단한 설명]
• [시간] - [활동명 및 간단한 설명]
• [시간] - [활동명 및 간단한 설명]`;

        const modelName = "gpt-5-mini-2025-08-07";
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: "당신은 Fi.eri 앱의 AI 비서입니다. 사용자에게 개인화된 아침 인사와 함께 오늘 하루를 더 생산적으로 만들 수 있는 맞춤형 활동을 추천하세요."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.8,
        });

        const greeting = completion.choices[0]?.message?.content || "좋은 아침이에요! ☀️";

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                modelName,
                '/api/ai-morning-greeting',
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        return NextResponse.json({ greeting });
    } catch (error: any) {
        console.error("[AI Morning Greeting] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate morning greeting" },
            { status: 500 }
        );
    }
}