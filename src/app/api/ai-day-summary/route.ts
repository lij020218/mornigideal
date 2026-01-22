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

        const { todaySchedules, completedCount, totalCount, userProfile, tomorrowSchedules, userPlan } = await request.json();

        console.log('[AI Day Summary] Generating day summary and feedback');

        // Build user context
        let userContext = "";
        if (userProfile) {
            userContext = `
사용자 정보:
- 이름: ${userProfile.name || '사용자'}
- 직업: ${userProfile.job || '미설정'}
- 목표: ${userProfile.goal || '미설정'}
- 관심사: ${(userProfile.interests || []).join(', ') || '미설정'}
- 플랜: ${userPlan || 'Free'}
`;
        }

        // Build schedule summary
        let scheduleList = '';
        if (todaySchedules && todaySchedules.length > 0) {
            scheduleList = todaySchedules
                .map((s: any) => `  ${s.completed ? '✅' : '⏸️'} ${s.startTime} - ${s.text}`)
                .join('\n');
        }

        // Build tomorrow's schedule
        let tomorrowScheduleList = '';
        if (tomorrowSchedules && tomorrowSchedules.length > 0) {
            tomorrowScheduleList = tomorrowSchedules
                .map((s: any) => `  ${s.startTime} - ${s.text}`)
                .join('\n');
        }

        const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const isMaxUser = userPlan === 'Max';

        const prompt = isMaxUser ? `당신은 Fi.eri Max 플랜의 AI 비서 Jarvis입니다. 오늘 하루가 모두 끝났고, 내일 일정을 미리 확인하여 사용자를 완벽하게 준비시켜야 합니다.
${userContext}

오늘의 일정:
${scheduleList || '- 일정 없음'}

성과:
- 완료: ${completedCount}/${totalCount}개 (${completionRate}%)

내일의 일정:
${tomorrowScheduleList || '- 일정 없음'}

**Max 플랜 비서 역할:**
1. 오늘과 내일의 일정을 **연결**하여 생각하기
2. 내일 중요 일정이 있다면 **구체적인 준비사항** 제시
3. 사용자의 장기 목표를 고려한 **전략적 조언**
4. 수술, 병원, 중요 미팅 등은 **우선순위 최상**으로 처리
5. 회복 기간 동안의 학습/업무 유지 전략 제안

**응답 형식:**
[하루 마무리 인사] 🌙
[오늘 하루 마무리 + 내일 준비 연결]

오늘의 하이라이트:
[오늘 완료한 핵심 일정 + 내일과의 연관성]

[내일 일정 브리핑 및 준비사항]
- 시간: [내일 첫 일정 시간]
- 일정: [내일 중요 일정]
- 준비사항: [구체적 체크리스트 3-5개]

[장기 목표 관점의 전략적 조언]

**예시 (내일 수술 일정):**
"오늘 하루 모두 마무리하느라 정말 수고 많으셨습니다. 내일 09:00 어깨 수술을 앞두고 계시네요 🏥

오늘의 하이라이트:
17:00 '입원'을 완료하셨습니다. 수술 전 안정을 취하는 것이 최우선이므로 다른 일정을 완료하지 못하셨어도 전혀 문제없습니다.

[내일 수술 준비 체크리스트]
✅ 자정 이후 금식 (물 포함)
✅ 귀중품은 보호자에게 미리 전달
✅ 수술 동의서 및 신분증 확인
✅ 편한 옷 준비 (단추 옷 권장)
✅ 보호자 연락처 재확인

[AI 스타트업 목표 유지 전략]
회복 기간(예상 2-4주)에도 목표를 잃지 않도록:
- 1주차: 침대에서 AI 트렌드 팟캐스트 청취 (손 사용 최소화)
- 2주차: 짧은 아티클 읽기 + 음성 메모로 아이디어 기록
- 3주차: 간단한 시장 조사 재개 (PC 작업 15분씩)

수술 잘 받으시고, 회복에 집중하세요. 건강이 가장 큰 자산입니다 💪"

**중요:**
- 내일 일정을 **반드시** 언급하고 연결 지어 생각
- 수술/병원/중요 미팅은 구체적 준비사항 필수
- 사용자 목표와 현재 상황을 통합적으로 고려`
        : `당신은 Fi.eri 앱의 AI 어시스턴트입니다. 오늘 하루가 모두 끝났습니다.
${userContext}

오늘의 일정:
${scheduleList || '- 일정 없음'}

성과:
- 완료: ${completedCount}/${totalCount}개 (${completionRate}%)

**요청사항:**
1. 따뜻한 하루 마무리 인사 (1-2문장, 존댓말)
2. 오늘의 성과에 대한 긍정적인 피드백 (구체적으로)
3. 개선 제안 또는 내일을 위한 격려 (1-2문장)
4. 사용자의 목표를 고려한 맞춤형 조언
5. 이모지 1-2개 포함

**피드백 가이드:**
- 완료율 80% 이상: 열정적인 칭찬과 격려
- 완료율 50-79%: 긍정적 피드백 + 부드러운 개선 제안
- 완료율 50% 미만: 공감과 위로 + 작은 성공 강조

**응답 형식:**
[하루 마무리 인사] 🌙

오늘의 하이라이트:
[오늘 완료한 일정 중 의미 있는 것 언급]

[피드백 및 내일을 위한 조언]

**중요:** 사용자의 목표와 오늘 완료한 일정을 구체적으로 언급하며, 따뜻하고 격려하는 톤으로 작성하세요.`;

        // Use gpt-5.2 for personalized, empathetic feedback
        const modelName = "gpt-5.2-2025-12-11";
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: "당신은 Fi.eri 앱의 AI 비서입니다. 사용자의 하루를 돌아보며 따뜻한 피드백과 격려를 제공하세요."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.8,
        });

        const summary = completion.choices[0]?.message?.content ||
            `오늘 하루 고생 많으셨어요! 🌙\n\n오늘의 성과: ${completedCount}/${totalCount}개 완료\n\n충분한 휴식 취하시고, 내일 또 만나요!`;

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                modelName,
                '/api/ai-day-summary',
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        return NextResponse.json({ summary });
    } catch (error: any) {
        console.error("[AI Day Summary] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate day summary" },
            { status: 500 }
        );
    }
}
