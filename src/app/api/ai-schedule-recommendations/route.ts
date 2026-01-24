import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Smart Schedule Recommendations
 *
 * Analyzes user's daily patterns and suggests schedules based on:
 * - Exercise frequency and preferences
 * - Sleep patterns and duration
 * - Activity time slot patterns
 * - Idle time gaps in the calendar
 * - User goals and interests
 */

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { date, currentSchedules } = await request.json();
        const targetDate = date ? new Date(date) : new Date();

        // Fetch user profile
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('email', session.user.email)
            .single();

        // Fetch enhanced profile with behavioral insights
        let enhancedProfile = null;
        try {
            const profileResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/user/enhanced-profile`, {
                headers: {
                    'Cookie': request.headers.get('Cookie') || '',
                },
            });
            if (profileResponse.ok) {
                const data = await profileResponse.json();
                enhancedProfile = data.profile;
            }
        } catch (error) {
            console.error('[Schedule Recommendations] Failed to fetch enhanced profile:', error);
        }

        // Analyze current day's schedule to find idle times
        const scheduleGaps = findScheduleGaps(currentSchedules || [], targetDate);

        // Generate recommendations
        const recommendations = await generateSmartRecommendations(
            profile,
            enhancedProfile,
            scheduleGaps,
            targetDate,
            session.user.email
        );

        return NextResponse.json({ recommendations });
    } catch (error: any) {
        console.error('[Schedule Recommendations] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

interface ScheduleGap {
    startTime: Date;
    endTime: Date;
    duration: number; // in hours
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

function findScheduleGaps(schedules: any[], targetDate: Date): ScheduleGap[] {
    const gaps: ScheduleGap[] = [];

    // Current time - only recommend FUTURE times
    const now = new Date();

    // Define day boundaries (6am to 11pm)
    const dayStart = new Date(targetDate);
    dayStart.setHours(6, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 0, 0, 0);

    // IMPORTANT: Start from current time if today, not from 6am
    // This ensures we only recommend future times, not past times
    const effectiveStart = now > dayStart ? new Date(Math.max(now.getTime(), dayStart.getTime())) : dayStart;

    // Sort schedules by start time
    const sortedSchedules = schedules
        .map(s => ({
            start: new Date(s.start_time || s.startTime),
            end: new Date(s.end_time || s.endTime),
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    // Find gaps (starting from current time, not 6am)
    let currentTime = effectiveStart;

    for (const schedule of sortedSchedules) {
        if (schedule.start > currentTime) {
            const duration = (schedule.start.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

            // Only consider gaps of 30 minutes or more
            if (duration >= 0.5) {
                gaps.push({
                    startTime: new Date(currentTime),
                    endTime: new Date(schedule.start),
                    duration,
                    timeOfDay: getTimeOfDay(currentTime),
                });
            }
        }

        if (schedule.end > currentTime) {
            currentTime = schedule.end;
        }
    }

    // Check for gap at end of day
    if (currentTime < dayEnd) {
        const duration = (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
        if (duration >= 0.5) {
            gaps.push({
                startTime: new Date(currentTime),
                endTime: new Date(dayEnd),
                duration,
                timeOfDay: getTimeOfDay(currentTime),
            });
        }
    }

    return gaps;
}

function getTimeOfDay(date: Date): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = date.getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
}

async function generateSmartRecommendations(
    profile: any,
    enhancedProfile: any,
    gaps: ScheduleGap[],
    targetDate: Date,
    userEmail: string
): Promise<any[]> {
    const insights = enhancedProfile?.behavioral_insights;

    // Build context for AI
    const userContext = `
**사용자 프로필:**
- 이름: ${profile?.name || '사용자'}
- 목표: ${profile?.goal || 'N/A'}
- 직업: ${profile?.job || 'N/A'}
- 관심사: ${(profile?.interests || []).join(', ') || 'N/A'}

**운동 패턴:**
- 주당 평균 운동 횟수: ${insights?.exercise_analytics?.avgWorkoutsPerWeek?.toFixed(1) || 0}회
- 선호 운동 시간대: ${insights?.exercise_analytics?.preferredExerciseTimes?.join(', ') || 'N/A'}
- 가장 자주 하는 운동: ${insights?.exercise_analytics?.mostFrequentExercise || 'N/A'}
- 운동 상태: ${insights?.wellness_insights?.exerciseStatus || 'N/A'}

**수면 패턴:**
- 평균 수면 시간: ${insights?.sleep_analytics?.avgSleepDuration || 0}시간
- 평균 취침 시간: ${insights?.sleep_analytics?.avgBedtime || 'N/A'}
- 평균 기상 시간: ${insights?.sleep_analytics?.avgWakeTime || 'N/A'}
- 수면 상태: ${insights?.wellness_insights?.sleepStatus || 'N/A'}

**활동 패턴:**
${Object.entries(insights?.time_slot_patterns || {})
    .slice(0, 5)
    .map(([activity, pattern]: [string, any]) =>
        `- ${activity}: 주로 ${pattern.timeSlots.join(', ')}에 ${pattern.frequency}회`
    ).join('\n') || '- 데이터 없음'}

**AI 추천사항:**
${insights?.wellness_insights?.recommendations?.join('\n- ') || '- 없음'}

**오늘 비어있는 시간대:**
${gaps.length > 0
    ? gaps.map(gap => {
        const start = gap.startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        const end = gap.endTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `- ${start} ~ ${end} (${gap.duration.toFixed(1)}시간, ${gap.timeOfDay})`;
    }).join('\n')
    : '- 비어있는 시간 없음'}
`;

    // Get current time for context
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    const prompt = `당신은 Fi.eri 앱의 스마트 일정 추천 AI입니다. 사용자의 행동 패턴과 건강 데이터를 분석하여, 오늘 비어있는 시간대에 맞춤형 일정을 추천하세요.

${userContext}

🚨 **현재 시간: ${currentTimeStr}** (${currentHour >= 18 ? '저녁' : currentHour >= 12 ? '오후' : '오전'} ${currentHour}시)

**추천 원칙:**
1. **🚨 시간 제약 (최우선!)**: 현재 시간 ${currentTimeStr} 이후의 시간만 추천하세요!
   - ❌ 절대 금지: ${currentHour}시 이전 시간 추천 (예: 06:00, 09:00 등 과거 시간)
   - ✅ 가능: ${currentHour}시 이후만 (예: ${String(Math.min(currentHour + 1, 23)).padStart(2, '0')}:00 이후)
2. **데이터 기반**: 사용자의 실제 행동 패턴을 반영하세요
3. **건강 우선**: 운동이나 수면이 부족하면 이를 개선할 수 있는 일정을 우선 추천
4. **시간대 맞춤**: 사용자가 평소 해당 활동을 하는 시간대에 추천
5. **실현 가능성**: 비어있는 시간의 길이에 맞는 현실적인 활동만 추천
6. **목표 연결**: 사용자의 목표("${profile?.goal}")와 관련된 활동 포함

**추천 형식:**
각 추천은 다음 정보를 포함하세요:
- scheduleType: "운동", "학습", "휴식", "취미", "업무", "자기계발" 등
- scheduleText: 구체적인 일정 이름 (예: "러닝", "업무 시작", "명상")
- suggestedStartTime: "HH:MM" 형식
- suggestedDuration: 분 단위 (예: 30, 60, 90)
- reason: 왜 이 일정을 추천하는지 간단히 설명 (1-2문장)
- priority: "high", "medium", "low"

**중요:**
- 비어있는 시간이 없으면 빈 배열을 반환하세요
- 최대 3-5개의 추천만 제공하세요
- 운동 부족이나 수면 부족 같은 건강 문제가 있으면 관련 일정을 우선 추천하세요
- 이미 사용자가 자주 하는 활동은 비슷한 시간대에 추천하세요

JSON 형식으로만 응답하세요:
{
  "recommendations": [
    {
      "scheduleType": "string",
      "scheduleText": "string",
      "suggestedStartTime": "HH:MM",
      "suggestedDuration": number,
      "reason": "string",
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini-2024-07-18",
            messages: [
                {
                    role: "system",
                    content: "You are a smart schedule recommendation AI that analyzes user behavior patterns and suggests personalized activities."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
        });

        const response = completion.choices[0]?.message?.content || '{"recommendations": []}';
        const result = JSON.parse(response);

        // Log usage
        await logOpenAIUsage(
            userEmail,
            completion.model,
            '/api/ai-schedule-recommendations',
            completion.usage?.prompt_tokens || 0,
            completion.usage?.completion_tokens || 0
        );

        return result.recommendations || [];
    } catch (error: any) {
        console.error('[Schedule Recommendations] OpenAI error:', error);
        return [];
    }
}
