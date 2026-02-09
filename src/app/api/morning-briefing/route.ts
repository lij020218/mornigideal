import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import OpenAI from "openai";
import { generateUserContext } from "@/lib/user-context-service";
import db from "@/lib/db";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Morning Briefing API
 *
 * 매일 오전 5시 반 이후 앱을 처음 열었을 때 호출
 * - 오늘의 날씨 정보
 * - 5개의 AI 추천 일정
 * - 오늘의 목표 설정 유도
 * - 책 추천 1권
 * - 노래 추천 1곡
 * - 개인화된 아침 인사 메시지
 */
export async function POST(request: NextRequest) {
    try {
        console.log("[Morning Briefing] API 호출 시작");

        // 인증 확인
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. 날씨 정보 가져오기
        console.log("[Morning Briefing] 날씨 정보 조회 중...");
        let weatherInfo = {
            temp: 5,
            description: "맑음",
            condition: "clear",
        };

        try {
            const supabase = db.client;
            const { data: cached } = await supabase
                .from('weather_cache')
                .select('weather_data, updated_at')
                .eq('location', 'seoul')
                .single();

            if (cached?.weather_data) {
                weatherInfo = {
                    temp: cached.weather_data.temp,
                    description: cached.weather_data.description,
                    condition: cached.weather_data.condition,
                };
                console.log("[Morning Briefing] 캐시된 날씨 정보 사용:", weatherInfo);
            }
        } catch (weatherError) {
            console.error("[Morning Briefing] 날씨 조회 실패, 기본값 사용:", weatherError);
        }

        // 2. 사용자 컨텍스트 생성 (일정 추천용)
        console.log("[Morning Briefing] User context 생성 중...");
        const context = await generateUserContext(userEmail);

        // 3. AI로 일정 5개 추천 받기
        console.log("[Morning Briefing] AI 일정 추천 생성 중...");

        const today = new Date().toISOString().split('T')[0];
        const existingSchedules = context.profile.customGoals
            ?.filter((goal: any) => goal.specificDate === today)
            .map((goal: any) => goal.text) || [];

        const addedSchedulesText = existingSchedules.length > 0
            ? existingSchedules.join(", ")
            : "없음";

        const now = new Date();
        const hour = now.getHours();
        const dayOfWeek = now.toLocaleDateString('ko-KR', { weekday: 'long' });

        // AI 프롬프트 생성
        const prompt = `당신은 사용자의 하루를 활기차게 시작할 수 있도록 돕는 AI 코치입니다.

**[사용자 프로필]**
- 직업/전공: ${context.profile.job || '미설정'}
- 목표: ${context.profile.goal || '미설정'}
- 현재 시간: 아침 ${hour}시
- 오늘: ${dayOfWeek}

**[오늘 날씨]**
- 온도: ${weatherInfo.temp}°C
- 날씨: ${weatherInfo.description}
- 상태: ${weatherInfo.condition}

**[이미 오늘 계획된 일정]**
${addedSchedulesText}

**[사용자 생활 패턴]**
- 평균 기상 시간: ${context.schedulePattern.wakeUpTime || '데이터 없음'}
- 선호 운동 시간: ${context.preferences.workoutDuration}분
- 이번 주 운동 횟수: ${context.features.thisWeekWorkoutCount}회 (목표: ${context.preferences.workoutFrequency}회)
- 운동 완료율: ${(context.features.workoutCompletionRate * 100).toFixed(0)}%

**[추천 원칙]**
1. **중복 방지 (최우선)**: 위의 "이미 오늘 계획된 일정"과 유사하거나 겹치는 활동은 절대 추천 금지
   - 독서가 있으면 → 독서/학습 추천 금지
   - 운동이 있으면 → 운동 추천 금지
   - 산책이 있으면 → 산책/휴식 추천 금지

2. **사용자 맞춤**: 사용자의 직업(${context.profile.job})과 목표(${context.profile.goal})에 직접 연관된 활동 추천
   - 일반적인 추천이 아닌 이 사용자에게 꼭 필요한 활동

3. **카테고리 다양성**: 5개 추천은 서로 다른 카테고리
   - exercise(운동), learning(학습), productivity(생산성), wellness(휴식), leisure(취미), social(사회활동)
   - 반드시 최소 1개는 운동/휴식/학습 중 하나여야 함

4. **날씨 고려**: 오늘 날씨(${weatherInfo.temp}°C, ${weatherInfo.description})를 고려한 현실적 추천

5. **아침 시간대 적합**: 아침에 시작하기 좋은 활동 우선

**요청**:
1. 정확히 5개의 일정 추천
2. 오늘의 목표 제안 (1~2문장, 사용자 목표에 맞춤)
3. 책 추천 1권 (사용자 직업/목표 관련, 실제 존재하는 책)
4. 노래 추천 1곡 (아침에 듣기 좋은 곡, 실제 존재하는 곡)

**JSON 형식으로 응답** (마크다운 없이):
{
  "todayGoal": {
    "text": "오늘 꼭 달성하고 싶은 목표 1~2문장",
    "motivation": "왜 이 목표가 중요한지 짧은 동기부여"
  },
  "suggestions": [
    {
      "title": "구체적 활동 제목",
      "description": "10-15자 설명",
      "action": "일정에 추가될 텍스트",
      "category": "exercise|learning|productivity|wellness|leisure|social",
      "estimatedTime": "30분|1시간 등",
      "priority": "high|medium|low",
      "icon": "이모지"
    }
  ],
  "bookRecommendation": {
    "title": "책 제목",
    "author": "저자명",
    "reason": "추천 이유 (사용자 맞춤, 20자 이내)",
    "quote": "책에서 인상적인 문구 하나"
  },
  "songRecommendation": {
    "title": "노래 제목",
    "artist": "아티스트명",
    "reason": "추천 이유 (아침에 듣기 좋은 이유, 15자 이내)",
    "mood": "energetic|calm|motivating|peaceful"
  }
}`;

        const aiResponse = await openai.chat.completions.create({
            model: "gpt-5.2-2025-12-11",
            messages: [
                {
                    role: "system",
                    content: "당신은 아침에 사용자의 하루를 계획하는 데 도움을 주는 AI 코치입니다. 순수 JSON만 반환하세요."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const responseText = aiResponse.choices[0]?.message?.content || "{}";

        // Log usage
        const usage = aiResponse.usage;
        if (usage) {
            await logOpenAIUsage(
                userEmail,
                "gpt-5.2-2025-12-11",
                "morning-briefing",
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (e) {
            console.error("[Morning Briefing] JSON 파싱 실패:", responseText);
            throw new Error("Invalid JSON response from OpenAI");
        }

        const suggestions = parsedResponse.suggestions || [];
        const todayGoal = parsedResponse.todayGoal || { text: "오늘의 목표를 세워보세요!", motivation: "작은 목표가 큰 성취로 이어집니다." };
        const bookRecommendation = parsedResponse.bookRecommendation || null;
        const songRecommendation = parsedResponse.songRecommendation || null;

        console.log("[Morning Briefing] 생성된 일정 추천:", suggestions.length);
        console.log("[Morning Briefing] 오늘의 목표:", todayGoal.text);
        console.log("[Morning Briefing] 책 추천:", bookRecommendation?.title);
        console.log("[Morning Briefing] 노래 추천:", songRecommendation?.title);

        // 4. 날씨 이모지 선택
        const weatherEmoji =
            weatherInfo.condition === 'clear' ? '☀️' :
                weatherInfo.condition === 'clouds' ? '☁️' :
                    weatherInfo.condition === 'rain' ? '🌧️' :
                        weatherInfo.condition === 'snow' ? '❄️' : '🌤️';

        // 5. 아침 인사 메시지 생성 (더 풍부하게)
        const morningMessage = `좋은 아침입니다! ${weatherEmoji}

**오늘의 날씨**
${weatherInfo.description}, 기온 ${weatherInfo.temp}°C

---

🎯 **오늘의 목표**
${todayGoal.text}
_${todayGoal.motivation}_

---

📋 **오늘 추천 활동 5가지**
5개 모두 달성하면 성취도 100%! 일정에 추가하고 하나씩 완료해보세요.

${suggestions.map((s: any, i: number) => `${i + 1}. ${s.icon} **${s.title}** (${s.estimatedTime})
   ${s.description}`).join('\n\n')}

---

${bookRecommendation ? `📚 **오늘의 책 추천**
"${bookRecommendation.title}" - ${bookRecommendation.author}
${bookRecommendation.reason}
> "${bookRecommendation.quote}"

---

` : ''}${songRecommendation ? `🎵 **오늘의 노래 추천**
"${songRecommendation.title}" - ${songRecommendation.artist}
${songRecommendation.reason}

---

` : ''}오늘 하루도 당신의 성장을 응원합니다! 작은 실천이 모여 큰 변화를 만듭니다 💪🌟`;

        console.log("[Morning Briefing] 아침 인사 메시지 생성 완료");

        return NextResponse.json({
            success: true,
            message: morningMessage,
            weather: weatherInfo,
            suggestions: suggestions,
            todayGoal: todayGoal,
            bookRecommendation: bookRecommendation,
            songRecommendation: songRecommendation,
        });

    } catch (error: any) {
        console.error("[Morning Briefing] 에러 발생:", error);
        return NextResponse.json(
            {
                error: "Failed to generate morning briefing",
                // Fallback message
                message: "안녕하세요! 좋은 아침입니다 ☀️\n\n오늘 하루를 의미있게 시작해보세요. 오늘 꼭 해야 할 일 5가지를 정해서 일정에 추가해보시는 건 어떨까요?\n\n목표를 명확히 하면 하루가 더 생산적이고 보람차게 느껴질 거예요! 💪"
            },
            { status: 500 }
        );
    }
}
