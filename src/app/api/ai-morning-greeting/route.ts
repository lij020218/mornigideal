import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { getUserByEmail } from "@/lib/users";
import { getTrendsCache } from "@/lib/newsCache";
import { isSlackConnected, getUnreadSummary } from "@/lib/slackService";
import { resolvePersonaStyle, getPersonaBlock } from "@/lib/prompts/persona";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { getTrendInsightsForAI } from "@/lib/multiDayTrendService";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { MODELS } from "@/lib/models";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


export async function POST(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 클라이언트가 보낸 데이터 (fallback용)
        let clientData: any = {};
        try {
            clientData = await request.json();
        } catch {}

        // 서버에서 사용자 프로필 + 일정 직접 조회
        const user = await getUserByEmail(userEmail);
        const profile = user?.profile || {};
        const customGoals = profile.customGoals || [];

        // KST 기준 오늘 날짜/시간
        const now = new Date();
        const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const hour = kstNow.getHours();
        const minute = kstNow.getMinutes();
        const dayOfWeek = kstNow.getDay();
        const weekday = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][dayOfWeek];
        const todayStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;
        const currentTimeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        // 오늘 일정 필터링
        const todaySchedules = customGoals.filter((goal: any) => {
            if (goal.specificDate === todayStr) return true;
            if (goal.daysOfWeek?.includes(dayOfWeek)) {
                if (goal.startDate && todayStr < goal.startDate) return false;
                if (goal.endDate && todayStr > goal.endDate) return false;
                return true;
            }
            return false;
        }).sort((a: any, b: any) => {
            const timeA = a.startTime || '00:00';
            const timeB = b.startTime || '00:00';
            return timeA.localeCompare(timeB);
        });

        // 중요 일정 식별
        const importantKeywords = ['회의', '미팅', 'meeting', '면접', '발표', '마감', '데드라인', 'deadline', '시험', '약속', '상담', '진료', '예약', '인터뷰'];
        const importantSchedules = todaySchedules.filter((s: any) => {
            const text = (s.text || '').toLowerCase();
            return importantKeywords.some(kw => text.includes(kw));
        });

        // 날씨 정보
        let weatherInfo = '';
        try {
            const weatherRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/weather`);
            if (weatherRes.ok) {
                const weather = await weatherRes.json();
                const weatherEmoji = weather.condition === 'rain' ? '🌧️' :
                                   weather.condition === 'snow' ? '⛄' :
                                   weather.condition === 'clouds' ? '☁️' : '☀️';
                weatherInfo = `현재 날씨: ${weather.description} ${weatherEmoji} (기온: ${weather.temp}°C, 체감: ${weather.feels_like}°C)`;
            }
        } catch (error) {
            console.error('[AI Morning Greeting] Failed to fetch weather:', error);
        }

        // 트렌드 브리핑 캐시 조회
        let trendContext = '';
        try {
            const trendsCache = await getTrendsCache(userEmail);
            if (trendsCache?.trends && trendsCache.trends.length > 0) {
                const topTrends = trendsCache.trends.slice(0, 3);
                trendContext = `\n오늘의 트렌드 브리핑 (상위 3개):\n${topTrends.map((t: any, i: number) =>
                    `${i + 1}. [${t.category}] ${t.title}${t.summary ? ` - ${t.summary}` : ''}`
                ).join('\n')}`;
            }
        } catch (e) {
        }

        // 멀티데이 트렌드 인사이트
        let multiDayTrendContext = '';
        try {
            multiDayTrendContext = await getTrendInsightsForAI(userEmail);
        } catch (e) {
        }

        // 주간 목표 체크 (월요일)
        let weeklyGoalReminder = '';
        if (dayOfWeek === 1) {
            const weeklyGoals = profile.longTermGoals?.weekly || [];
            const activeWeeklyGoals = weeklyGoals.filter((g: any) => !g.completed);
            if (activeWeeklyGoals.length === 0) {
                weeklyGoalReminder = '\n\n[월요일 특별 안내] 이번 주 목표가 아직 설정되지 않았습니다. 한 주의 시작을 맞아 주간 목표를 세워보라고 권유하세요.';
            }
        }

        // 슬랙 미확인 메시지 요약
        let slackContext = '';
        try {
            if (await isSlackConnected(userEmail)) {
                const summary = await getUnreadSummary(userEmail);
                if (summary.totalUnread > 0) {
                    slackContext = `\n슬랙 미확인 메시지: 총 ${summary.totalUnread}건`;
                    if (summary.dms.length > 0) {
                        slackContext += `\n- DM: ${summary.dms.map(d => `${d.from}(${d.unread}건)`).join(', ')}`;
                    }
                    if (summary.channels.length > 0) {
                        slackContext += `\n- 채널: ${summary.channels.map(c => `#${c.name}(${c.unread}건)`).join(', ')}`;
                    }
                }
            }
        } catch (e) {
        }

        // 새벽 시간대 체크
        const isLateNight = hour >= 0 && hour < 5;
        const minRecommendHour = Math.max(hour + 1, 8);
        const minRecommendTime = `${minRecommendHour.toString().padStart(2, '0')}:00`;

        const timeGuidance = isLateNight
            ? `현재 새벽 ${currentTimeStr}입니다. 지금은 수면이 가장 중요한 시간입니다. 일정 추천이나 활동 제안 대신 숙면을 권장하세요.`
            : `현재 시간은 ${currentTimeStr}입니다. 추천 활동은 반드시 ${minRecommendTime} 이후 시간대만 추천하세요.`;

        const scheduleListStr = todaySchedules.length > 0
            ? todaySchedules.map((s: any) => `- ${s.startTime || '00:00'}: ${s.text}${s.endTime ? ` (~${s.endTime})` : ''}`).join('\n')
            : '- 등록된 일정 없음';

        const importantListStr = importantSchedules.length > 0
            ? `\n⚠️ 중요 일정:\n${importantSchedules.map((s: any) => `- ${s.startTime}: ${s.text}`).join('\n')}`
            : '';

        // 시간대별 인사 가이드
        const timeOfDay = hour < 5 ? '새벽' : hour < 12 ? '아침' : hour < 18 ? '오후' : '저녁';
        const greetingGuide = hour < 5
            ? '새벽에 접속한 사용자입니다. "아직 늦은 시간이네요" 또는 "일찍 일어나셨군요" 등 상황에 맞는 인사를 하세요.'
            : hour < 12
            ? '"좋은 아침이에요" 등 아침 인사를 하세요.'
            : hour < 14
            ? '"좋은 오후에요" 또는 점심 관련 인사를 하세요.'
            : hour < 18
            ? '"오후도 힘내세요" 등 오후 인사를 하세요.'
            : '"좋은 저녁이에요" 등 저녁 인사를 하세요.';

        const prompt = `당신은 Fi.eri 앱의 AI 어시스턴트입니다. 사용자가 오늘 처음 앱을 열었을 때 보여줄 인사 메시지를 생성하세요.

현재 시간: ${kstNow.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (${weekday}) — ${timeOfDay} 시간대
${weatherInfo}

**중요: ${timeGuidance}**

사용자 프로필:
- 이름: ${profile.name || '사용자'}
- 직업: ${profile.job || '미설정'}
- 목표: ${profile.goal || '미설정'}
- 관심 분야: ${(profile.interests || []).join(', ') || '미설정'}

오늘의 일정 (${todaySchedules.length}개):
${scheduleListStr}
${importantListStr}
${trendContext}
${slackContext}
${multiDayTrendContext ? `\n최근 행동 패턴 분석:\n${multiDayTrendContext}` : ''}
${weeklyGoalReminder}

**필수 포함 내용:**
1. **인사**: ${greetingGuide} (2문장, 존댓말, 이모지 1개). 날씨 조언 포함. 절대 "좋은 아침"을 ${timeOfDay !== '아침' ? '사용하지 마세요' : '사용하세요'}.

2. **오늘 일정 요약**: 오늘 총 ${todaySchedules.length}개 일정이 있다고 간결하게 요약.
   - 시간순으로 주요 일정 나열 (모든 일정을 나열하지 말고, 핵심만 3-4개)
   - 일정이 없으면 "오늘은 등록된 일정이 없어요. 오늘 할 일을 추가해보시는 건 어떨까요?"

3. **중요 일정 강조**: ${importantSchedules.length > 0
    ? `오늘 중요한 일정이 ${importantSchedules.length}개 있습니다. ⚡ 이모지와 함께 눈에 띄게 강조하세요.`
    : '중요 일정이 없으면 이 섹션은 생략하세요.'}

4. **트렌드 브리핑 추천**: ${trendContext
    ? '오늘의 트렌드 브리핑 중 사용자 관심사와 가장 관련 있는 1개를 간단히 언급하고, "인사이트 탭에서 확인해보세요" 라고 안내하세요.'
    : '트렌드 브리핑이 아직 준비 중이라면 이 섹션은 생략하세요.'}

5. **슬랙 알림**: ${slackContext
    ? `슬랙에 미확인 메시지가 있습니다. 건수와 주요 채널/DM을 간단히 언급하고 "슬랙에서 확인해보세요" 안내하세요.`
    : '슬랙 연동이 안 되어있거나 미확인 메시지가 없으면 이 섹션은 생략하세요.'}

6. **행동 패턴 인사이트**: ${multiDayTrendContext
    ? '최근 7일 행동 패턴 분석 결과가 있습니다. 완료율 추세나 번아웃 위험 등 핵심 인사이트 1개를 자연스럽게 언급하세요.'
    : '행동 패턴 데이터가 부족하면 이 섹션은 생략하세요.'}

7. **마무리**: 하루를 응원하는 한마디 (1문장)

${isLateNight ? '**새벽 시간이므로: 일정 요약만 간단히 하고, 휴식과 수면을 권장하세요. 추천 활동은 생략하세요.**' : ''}

**응답 형식 규칙:**
- 전체 길이: 150-250자 내외 (너무 길지 않게)
- 자연스러운 대화체, 존댓말
- 불필요한 서론 없이 바로 인사부터 시작
- 마크다운 **볼드** 사용 가능
- 각 섹션을 줄바꿈으로 구분`;

        const modelName = MODELS.GPT_5_MINI;

        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: getPersonaBlock({
                        style: resolvePersonaStyle(profile, profile?.plan),
                        userName: profile?.name,
                        userJob: profile?.job,
                        plan: profile?.plan,
                    }) + `\n\n사용자에게 개인화된 ${timeOfDay} 인사와 함께 오늘 하루의 핵심 정보를 전달하세요. 현재 ${timeOfDay} 시간대이므로 그에 맞는 톤으로 응답하세요.`
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        const greeting = completion.choices[0]?.message?.content || "좋은 아침이에요! ☀️";

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                userEmail,
                modelName,
                '/api/ai-morning-greeting',
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        return NextResponse.json({ greeting });
    } catch (error: any) {
        console.error("[AI Morning Greeting] Error:", error?.message || error);
        return NextResponse.json(
            { error: "Failed to generate morning greeting" },
            { status: 500 }
        );
    }
}
