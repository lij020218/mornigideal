import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { getUserByEmail } from "@/lib/users";

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

        // Fetch weather information
        let weatherInfo = '';
        try {
            const weatherRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/weather`);
            if (weatherRes.ok) {
                const weather = await weatherRes.json();
                const weatherEmoji = weather.condition === 'rain' ? '🌧️' :
                                   weather.condition === 'snow' ? '⛄' :
                                   weather.condition === 'clouds' ? '☁️' : '☀️';
                weatherInfo = `\n현재 날씨: ${weather.description} ${weatherEmoji} (기온: ${weather.temp}°C, 체감: ${weather.feels_like}°C)`;
            }
        } catch (error) {
            console.error('[AI Morning Greeting] Failed to fetch weather:', error);
        }

        const modelName = "gpt-5-mini-2025-08-07";
        console.log('[AI Morning Greeting] Generating personalized morning greeting with model:', modelName);

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
        const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const hour = kstNow.getHours();
        const minute = kstNow.getMinutes();
        const dayOfWeek = kstNow.getDay(); // 0 = Sunday, 1 = Monday
        const weekday = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][dayOfWeek];
        const currentTimeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        // Check for Monday weekly goal reminder
        let weeklyGoalReminder = '';
        const isMonday = dayOfWeek === 1;

        if (isMonday) {
            try {
                const user = await getUserByEmail(session.user.email);
                const weeklyGoals = user?.profile?.longTermGoals?.weekly || [];
                // Filter for active (not completed) weekly goals
                const activeWeeklyGoals = weeklyGoals.filter((g: any) => !g.completed);

                if (activeWeeklyGoals.length === 0) {
                    weeklyGoalReminder = `\n\n📋 **월요일 특별 안내**: 이번 주 목표가 아직 설정되지 않았습니다. 한 주를 효과적으로 보내기 위해 주간 목표를 세워보세요! (대시보드 하단 "이번 주 목표" 섹션에서 설정할 수 있습니다)`;
                }
            } catch (e) {
                console.error('[AI Morning Greeting] Failed to check weekly goals:', e);
            }
        }

        // 새벽 시간대(0시~5시)인지 확인 - 5시부터는 일정 추천
        const isLateNight = hour >= 0 && hour < 5;
        // 일정 추천 최소 시작 시간: 8시 이후부터
        const minRecommendHour = Math.max(hour, 8);
        const minRecommendTime = `${minRecommendHour.toString().padStart(2, '0')}:00`;

        const timeGuidance = isLateNight
            ? `현재 새벽 ${currentTimeStr}입니다. 지금은 수면이 가장 중요한 시간입니다. 일정 추천 대신 숙면을 권장하세요.`
            : `현재 시간은 ${currentTimeStr}입니다. 추천 활동은 반드시 ${minRecommendTime} 이후 시간대만 추천하세요. (최소 8시 이후)`;

        const prompt = `당신은 Fi.eri 앱의 AI 어시스턴트입니다.

현재 시간: ${kstNow.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (${weekday})${weatherInfo}

**중요: ${timeGuidance}**

사용자 프로필:
- 이름: ${userProfile?.name || '사용자'}
- 직업: ${userProfile?.job || '미설정'}
- 목표: ${userProfile?.goal || '미설정'}
- 관심 분야: ${(userProfile?.interests || []).join(', ') || '미설정'}

오늘의 일정:
${todaySchedules?.length > 0 ? todaySchedules.map((s: any) => `- ${s.startTime}: ${s.text}`).join('\n') : '- 등록된 일정 없음'}

**요청사항:**
1. 시간대에 맞는 인사 (새벽이면 "늦은 밤", 아침이면 "좋은 아침" 등, 2-3문장, 존댓말, 이모지 1개)
2. 날씨를 고려한 조언 (비가 오면 우산, 추우면 따뜻하게 등)
3. 오늘 일정에 대한 간단한 코멘트
${weeklyGoalReminder ? `4. **월요일 주간 목표 안내**: 사용자가 아직 이번 주 목표를 설정하지 않았습니다. 새로운 한 주의 시작을 맞아 주간 목표를 세워보라고 권유하세요. (대시보드 하단 "이번 주 목표"에서 설정 가능)
5.` : '4.'} ${isLateNight
    ? '**새벽 0시~5시 사이이므로 일정 추천 대신 충분한 휴식과 수면의 중요성을 강조하세요. 내일을 위해 지금 잠자리에 드시길 권유하세요.**'
    : `사용자의 직업, 목표, 관심사를 고려한 **오늘 추천 활동 5개**:
   - **반드시 ${minRecommendTime} 이후 시간대만 추천** (최소 8시 이후, 현재 시간보다 이후)
   - **업무/학습 3개 + 휴식/취미/여가 2개** 균형 있게 추천 (일만 하는 기계가 아님!)
   - 휴식 예시: 산책, 스트레칭, 좋아하는 음악 듣기, 커피 타임, 친구와 대화, 게임, 영화 등
   - 각 활동은 간결하게 (예: "• 10:00 - 영어 단어 암기 30분")
   - 사용자의 레벨과 목표에 맞게 조정`}

**응답 형식:**
[인사 및 날씨 조언]

[일정 코멘트]
${weeklyGoalReminder ? `
📋 **이번 주 목표 설정하기**
새로운 한 주가 시작됐어요! 이번 주 달성하고 싶은 목표를 설정해보세요. 대시보드 하단 "이번 주 목표" 섹션에서 설정할 수 있습니다.
` : ''}
${isLateNight
    ? '[휴식 권유]\n지금은 충분한 수면이 가장 중요합니다. 내일 상쾌하게 시작하기 위해 지금 잠자리에 드세요.'
    : `오늘 추천 활동:
• [${minRecommendTime} 이후 시간] - [활동명 및 간단한 설명]
• [시간] - [활동명 및 간단한 설명]
• [시간] - [활동명 및 간단한 설명]
• [시간] - [활동명 및 간단한 설명]
• [시간] - [활동명 및 간단한 설명]`}`;

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
            // gpt-5-mini-2025-08-07 모델은 temperature 파라미터를 지원하지 않음 (기본값 1만 지원)
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
        console.error("[AI Morning Greeting] Error:", error?.message || error);
        console.error("[AI Morning Greeting] Error details:", JSON.stringify({
            name: error?.name,
            message: error?.message,
            status: error?.status,
            code: error?.code,
        }));
        return NextResponse.json(
            { error: error?.message || "Failed to generate morning greeting" },
            { status: 500 }
        );
    }
}