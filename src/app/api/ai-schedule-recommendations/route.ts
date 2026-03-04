import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-admin";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { MODELS } from "@/lib/models";
import { getSharedSuggestionPreferences } from "@/lib/shared-context";
import { getUserPlan } from "@/lib/user-plan";

// 플랜별 일일 AI 추천 생성 횟수 제한
const PLAN_REC_LIMITS: Record<string, number> = {
    free: 1,
    pro: 3,
    max: 5,
};

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

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { date, currentSchedules, requestTime } = await request.json();
    const targetDate = date ? new Date(date) : new Date();

    // KST 기준 오늘 날짜
    const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayKey = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;

    // 플랜별 일일 추천 생성 횟수 제한 체크
    const userPlan = await getUserPlan(email);
    const dailyLimit = PLAN_REC_LIMITS[userPlan.plan] || 1;

    const { data: usageData } = await supabaseAdmin
        .from('user_kv_store')
        .select('value')
        .eq('user_email', email)
        .eq('key', `schedule_rec_count_${todayKey}`)
        .maybeSingle();

    const currentCount = usageData?.value?.count || 0;
    if (currentCount >= dailyLimit) {
        return NextResponse.json({
            error: '오늘의 AI 추천 생성 횟수를 모두 사용했습니다.',
            limitReached: true,
            currentCount,
            dailyLimit,
            plan: userPlan.plan,
        }, { status: 429 });
    }

    // Fetch user profile (stored in users.profile JSON)
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, name, email, profile')
        .eq('email', email)
        .maybeSingle();
    const profile = userData ? { ...userData.profile, name: userData.name, email: userData.email } : null;

    // Enhanced profile: 직접 DB 조회 (self-fetch 제거)
    let enhancedProfile = null;
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: activities } = await supabaseAdmin
            .from('user_events')
            .select('*')
            .eq('email', email)
            .gte('created_at', thirtyDaysAgo.toISOString());

        // 간단한 행동 분석
        const exerciseEvents = (activities || []).filter(a => a.event_type === 'workout_completed');
        const sleepEvents = (activities || []).filter(a => a.event_type === 'sleep_end');
        const scheduleCompleted = (activities || []).filter(a => a.event_type === 'schedule_complete');

        const avgWorkoutsPerWeek = exerciseEvents.length / 4;
        const avgSleepDuration = sleepEvents.length > 0
            ? sleepEvents.reduce((sum: number, e: any) => sum + (e.metadata?.durationMinutes || 0), 0) / sleepEvents.length / 60
            : 0;

        enhancedProfile = {
            behavioral_insights: {
                exercise_analytics: {
                    avgWorkoutsPerWeek,
                    mostFrequentExercise: null,
                    preferredExerciseTimes: [],
                },
                sleep_analytics: {
                    avgSleepDuration: avgSleepDuration.toFixed(1),
                    avgBedtime: null,
                    avgWakeTime: null,
                },
                wellness_insights: {
                    exerciseStatus: avgWorkoutsPerWeek >= 3 ? 'good' : avgWorkoutsPerWeek >= 1 ? 'moderate' : 'insufficient',
                    sleepStatus: avgSleepDuration >= 7 ? 'good' : avgSleepDuration >= 5 ? 'moderate' : 'insufficient',
                    recommendations: [],
                },
                time_slot_patterns: {},
                preferred_briefing_categories: [],
                overall_completion_rate: scheduleCompleted.length,
            },
        };
    } catch (error) {
        logger.error('[Schedule Recommendations] Failed to build enhanced profile:', error);
    }

    // Extract past schedule history from customGoals (already fetched above)
    let recentScheduleHistory: any[] = [];
    try {
        const customGoals = userData?.profile?.customGoals || [];
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];

        // 최근 7일간 일회성 일정 + 반복 일정 모두 수집
        recentScheduleHistory = customGoals.filter((g: any) => {
            if (g.specificDate) {
                return g.specificDate >= sevenDaysAgoStr && g.specificDate < todayStr;
            }
            // 반복 일정은 항상 포함
            if (g.daysOfWeek && g.daysOfWeek.length > 0) return true;
            return false;
        });
    } catch (error) {
        logger.error('[Schedule Recommendations] Failed to fetch schedule history:', error);
    }

    // 현재 시간이 22시 이후면 추천 가능 시간대가 없으므로 AI 호출 없이 빈 배열 반환
    const kstHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
    if (kstHour >= 22) {
        return NextResponse.json({
            recommendations: [],
            usage: { current: currentCount, limit: dailyLimit },
            message: '지금은 추천 가능한 시간대가 없어요. 내일 다시 확인해보세요!',
        });
    }

    // Analyze current day's schedule to find idle times
    const scheduleGaps = findScheduleGaps(currentSchedules || [], targetDate);

    // Generate recommendations
    const recommendations = await generateSmartRecommendations(
        profile,
        enhancedProfile,
        scheduleGaps,
        targetDate,
        email,
        recentScheduleHistory,
        currentSchedules || [],
        requestTime
    );

    // 추천 결과를 user_kv_store에 저장 (날짜별)
    if (recommendations.length > 0) {
        try {
            await supabaseAdmin.from('user_kv_store').upsert({
                user_email: email,
                key: `schedule_recs_${todayKey}`,
                value: { recommendations, generatedAt: new Date().toISOString() },
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_email,key' });
        } catch {}
    }

    // 생성 횟수 카운트 증가
    try {
        await supabaseAdmin.from('user_kv_store').upsert({
            user_email: email,
            key: `schedule_rec_count_${todayKey}`,
            value: { count: currentCount + 1 },
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email,key' });
    } catch {}

    return NextResponse.json({
        recommendations,
        usage: { current: currentCount + 1, limit: dailyLimit },
    });
});

// GET: 캐시된 추천 조회 (새로 생성하지 않음)
export const GET = withAuth(async (request: NextRequest, email: string) => {
    const kstToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayKey = `${kstToday.getFullYear()}-${String(kstToday.getMonth() + 1).padStart(2, '0')}-${String(kstToday.getDate()).padStart(2, '0')}`;

    // 사용량 조회
    const userPlan = await getUserPlan(email);
    const dailyLimit = PLAN_REC_LIMITS[userPlan.plan] || 1;
    const { data: usageData } = await supabaseAdmin
        .from('user_kv_store')
        .select('value')
        .eq('user_email', email)
        .eq('key', `schedule_rec_count_${todayKey}`)
        .maybeSingle();
    const currentCount = usageData?.value?.count || 0;

    const { data } = await supabaseAdmin
        .from('user_kv_store')
        .select('value')
        .eq('user_email', email)
        .eq('key', `schedule_recs_${todayKey}`)
        .maybeSingle();

    if (data?.value?.recommendations) {
        return NextResponse.json({
            recommendations: data.value.recommendations,
            cached: true,
            generatedAt: data.value.generatedAt,
            usage: { current: currentCount, limit: dailyLimit },
        });
    }

    return NextResponse.json({ recommendations: [], cached: false, usage: { current: currentCount, limit: dailyLimit } });
});

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
    email: string,
    recentHistory: any[] = [],
    currentSchedules: any[] = [],
    requestTime?: string // 모바일에서 전달한 KST 현재 시간 (HH:MM)
): Promise<any[]> {
    const insights = enhancedProfile?.behavioral_insights;
    const suggestionPrefs = await getSharedSuggestionPreferences(email).catch(() => null) as any;

    // 과거 일정 요약 + 패턴 분석
    const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
    let historySection = '';
    if (recentHistory.length > 0) {
        const recurring = recentHistory.filter((g: any) => g.daysOfWeek?.length > 0);
        const oneTime = recentHistory.filter((g: any) => g.specificDate);
        const allSchedules = [...recurring, ...oneTime];

        // 패턴 분석: 기상/취침 시간, 첫 활동 시간, 활동 시간대 분포
        const wakeKeywords = ['기상', '일어나기', '모닝', '아침'];
        const sleepKeywords = ['취침', '잠자기', '수면', '잠'];
        const wakeTimes: string[] = [];
        const sleepTimes: string[] = [];
        const activityTimes: number[] = []; // 시간(hour) 수집

        allSchedules.forEach((g: any) => {
            if (!g.startTime) return;
            const hour = parseInt(g.startTime.split(':')[0], 10);
            activityTimes.push(hour);
            const textLower = (g.text || '').toLowerCase();
            if (wakeKeywords.some(k => textLower.includes(k))) wakeTimes.push(g.startTime);
            if (sleepKeywords.some(k => textLower.includes(k))) sleepTimes.push(g.startTime);
        });

        // 평균 기상/취침 시간 계산
        const avgTime = (times: string[]): string | null => {
            if (times.length === 0) return null;
            const totalMin = times.reduce((sum, t) => {
                const [h, m] = t.split(':').map(Number);
                return sum + h * 60 + (m || 0);
            }, 0);
            const avg = Math.round(totalMin / times.length);
            return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
        };

        const avgWake = avgTime(wakeTimes);
        const avgSleep = avgTime(sleepTimes);

        // 가장 이른 활동 시간 (기상 제외)
        const nonWakeTimes = allSchedules
            .filter((g: any) => g.startTime && !wakeKeywords.some(k => (g.text || '').toLowerCase().includes(k)))
            .map((g: any) => g.startTime as string)
            .sort();
        const earliestActivity = nonWakeTimes.length > 0 ? nonWakeTimes[0] : null;

        // 활동 시간대 분포
        const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };
        activityTimes.forEach(h => {
            if (h >= 6 && h < 12) timeDistribution.morning++;
            else if (h >= 12 && h < 17) timeDistribution.afternoon++;
            else if (h >= 17 && h < 22) timeDistribution.evening++;
            else timeDistribution.night++;
        });
        const totalAct = activityTimes.length || 1;
        const distStr = [
            timeDistribution.morning > 0 ? `오전(${Math.round(timeDistribution.morning / totalAct * 100)}%)` : null,
            timeDistribution.afternoon > 0 ? `오후(${Math.round(timeDistribution.afternoon / totalAct * 100)}%)` : null,
            timeDistribution.evening > 0 ? `저녁(${Math.round(timeDistribution.evening / totalAct * 100)}%)` : null,
            timeDistribution.night > 0 ? `야간(${Math.round(timeDistribution.night / totalAct * 100)}%)` : null,
        ].filter(Boolean).join(', ');

        // 반복 일정 목록
        const recurringLines = recurring.slice(0, 8).map((g: any) => {
            const days = (g.daysOfWeek || []).map((d: number) => DAY_NAMES[d]).join(',');
            return `- ${g.text} (${g.startTime || '시간미정'}, 매주 ${days})`;
        });

        // 일회성 일정 빈도 집계
        const freq = new Map<string, { count: number; times: string[] }>();
        oneTime.forEach((g: any) => {
            const key = g.text;
            if (!freq.has(key)) freq.set(key, { count: 0, times: [] });
            const entry = freq.get(key)!;
            entry.count++;
            if (g.startTime && !entry.times.includes(g.startTime)) entry.times.push(g.startTime);
        });
        const freqLines = [...freq.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 8)
            .map(([text, info]) => `- ${text}: ${info.count}회 (시간: ${info.times.join(', ') || '다양'})`);

        historySection = `
**🔍 사용자 생활 패턴 분석 (최근 7일 일정 기반 — 반드시 참고!):**
- 평균 기상 시간: ${avgWake || '데이터 없음'}
- 평균 취침 시간: ${avgSleep || '데이터 없음'}
- 가장 이른 활동 시작: ${earliestActivity || '데이터 없음'}
- 활동 시간대 분포: ${distStr || '데이터 없음'}
${recurringLines.length > 0 ? `\n반복 일정:\n${recurringLines.join('\n')}` : ''}
${freqLines.length > 0 ? `\n최근 등록한 일정 (빈도순):\n${freqLines.join('\n')}` : ''}

⚠️ **이 데이터를 무시하면 추천이 무효됩니다:**
→ 기상 시간 이전의 일정은 절대 추천하지 마세요 (기상 ${avgWake || '알 수 없음'} 기준)
→ 사용자의 실제 활동 시간대에 맞춰 추천하세요 (${distStr})
→ 이미 자주 하는 활동과 중복 추천하지 말고, 부족한 영역을 채워주세요
→ 같은 카테고리의 일정을 2개 이상 추천하지 마세요
`;
    }

    // Build context for AI
    const userContext = `
**사용자 프로필:**
- 이름: ${profile?.name || '사용자'}
- 직업: ${profile?.job || 'N/A'}
- 경력 수준: ${profile?.level || 'N/A'}
- 커리어 목표: ${profile?.goal || 'N/A'}
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

${suggestionPrefs ? `**[AI 추천 수락 패턴 - 데이터 기반 선호도] 📊**
- 선호 카테고리: ${suggestionPrefs.topCategories?.length > 0 ? suggestionPrefs.topCategories.join(', ') : '데이터 수집 중'}
- 기피 카테고리: ${suggestionPrefs.avoidCategories?.length > 0 ? suggestionPrefs.avoidCategories.join(', ') : '없음'}
- 카테고리별 가중치: ${Object.entries(suggestionPrefs.categoryWeights || {}).map(([k, v]: [string, any]) => `${k}(${v.toFixed(1)})`).join(', ') || '데이터 부족'}
- 시간대별 선호: ${['morning', 'afternoon', 'evening'].map(block => {
    const scores = suggestionPrefs.timeCategoryScores?.[block] || {};
    const top = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]).slice(0, 2);
    const label = block === 'morning' ? '오전' : block === 'afternoon' ? '오후' : '저녁';
    return top.length > 0 ? `${label}=${top.map(([k, v]: [string, any]) => `${k}(${(v * 100).toFixed(0)}%)`).join(',')}` : null;
}).filter(Boolean).join(' / ') || '데이터 부족'}

→ 선호 카테고리에서 최소 1개 추천 포함
→ 기피 카테고리는 우선순위 낮춤 (완전 제외는 아님)
` : ''}
${historySection}
**📋 오늘 이미 등록된 일정:**
${currentSchedules.length > 0
    ? currentSchedules.map((s: any) => {
        const text = s.text || s.title || '(제목 없음)';
        const start = s.startTime || s.start_time?.split('T')[1]?.substring(0, 5) || '시간미정';
        const end = s.endTime || s.end_time?.split('T')[1]?.substring(0, 5) || '';
        return `- ${start}${end ? '~' + end : ''} ${text}`;
    }).join('\n')
    : '- 등록된 일정 없음'}
→ 위 일정과 시간이 겹치지 않도록 추천하세요.
→ 이미 등록된 활동과 같은 내용은 추천하지 마세요.

**오늘 비어있는 시간대:**
${gaps.length > 0
    ? gaps.map(gap => {
        const start = gap.startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        const end = gap.endTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `- ${start} ~ ${end} (${gap.duration.toFixed(1)}시간, ${gap.timeOfDay})`;
    }).join('\n')
    : '- 비어있는 시간 없음'}
`;

    // Get current time in KST (모바일에서 전달한 시간 우선, 없으면 서버에서 계산)
    let currentTimeStr: string;
    if (requestTime && /^\d{2}:\d{2}$/.test(requestTime)) {
        currentTimeStr = requestTime;
    } else {
        const now = new Date();
        const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        currentTimeStr = `${String(kstNow.getHours()).padStart(2, '0')}:${String(kstNow.getMinutes()).padStart(2, '0')}`;
    }

    // 기상 시간 감지: currentSchedules에서 기상 일정 찾기
    const wakeKeywords = ['기상', '일어나기', '모닝콜', '알람'];
    const wakeSchedule = (currentSchedules || []).find((s: any) =>
        wakeKeywords.some(k => (s.text || s.title || '').includes(k))
    );
    const wakeTime = wakeSchedule?.startTime || wakeSchedule?.start_time?.split('T')[1]?.substring(0, 5) || null;
    // 가장 이른 추천 가능 시간: 기상시간 vs 현재시간 중 더 늦은 것
    let earliestAllowedTime = currentTimeStr;
    if (wakeTime && wakeTime > currentTimeStr) {
        earliestAllowedTime = wakeTime;
    }

    const prompt = `당신은 Fi.eri 앱의 스마트 일정 추천 AI입니다. 사용자의 행동 패턴과 건강 데이터를 분석하여, 오늘 비어있는 시간대에 맞춤형 일정을 추천하세요.

${userContext}

🚨🚨🚨 **현재 시간(KST): ${currentTimeStr}** | **기상 시간: ${wakeTime || '알 수 없음'}** | **추천 가능 시작: ${earliestAllowedTime}** 🚨🚨🚨

**⚠️ 가장 중요한 규칙 - 반드시 준수:**
- 현재 시간(한국시간): ${currentTimeStr}
- 사용자 기상 시간: ${wakeTime || '알 수 없음'}
- 추천 가능 시간대: ${earliestAllowedTime} ~ 23:00
- ${earliestAllowedTime} 이전의 일정은 절대 추천하지 마세요!

**추천 원칙:**
1. **🚨 시간 제약 (최우선! 위반 시 추천 무효!)**:
   - ❌ 절대 금지: ${earliestAllowedTime} 이전의 모든 시간
   - ✅ 허용: ${earliestAllowedTime} ~ 23:00 사이만
   - 기상(${wakeTime || 'N/A'}) 이전 시간은 사용자가 자고 있으므로 절대 추천 금지!
2. **생활 패턴 존중 (매우 중요!)**: 위의 "사용자 생활 패턴 분석"을 반드시 참고하세요. 사용자의 실제 기상/취침 시간, 활동 시간대에 맞춰 추천하세요. 기상 시간 이전이나 취침 시간 이후의 일정은 절대 추천하지 마세요.
3. **건강 우선**: 운동이나 수면이 부족하면 이를 개선할 수 있는 일정을 우선 추천
4. **시간대 맞춤**: 사용자가 평소 해당 활동을 하는 시간대에 추천
5. **실현 가능성**: 비어있는 시간의 길이에 맞는 현실적인 활동만 추천
6. **목표/직업/경력 수준 연결 (필수!)**: 반드시 1개 이상은 사용자의 직업("${profile?.job || 'N/A'}"), 경력 수준("${profile?.level || 'N/A'}"), 목표("${profile?.goal || 'N/A'}")와 직접 관련된 생산적 활동을 추천하세요. 경력 수준에 맞는 난이도로 추천하세요 (주니어면 기초 학습/멘토링, 시니어면 리더십/아키텍처 등). 예: 개발자면 코딩/사이드프로젝트/기술문서 읽기, 학생이면 공부/과제, 디자이너면 포트폴리오 등

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
- 사용자의 최근 일정 이력을 참고하여, 자주 하는 활동은 비슷한 시간대에 추천하세요
- 같은 scheduleType(카테고리)의 일정을 2개 이상 추천하지 마세요. 다양한 카테고리로 추천하세요
- 이미 오늘 등록된 일정과 중복되는 내용은 추천하지 마세요
- **시간 분산 (필수!)**: 추천 일정들의 시간이 오전/오후/저녁에 골고루 분산되어야 합니다. 연속 2시간 이내에 2개 이상 추천하지 마세요. 최소 2시간 간격을 유지하세요.

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
            model: MODELS.GPT_5_MINI,
            messages: [
                {
                    role: "system",
                    content: `You are a smart schedule recommendation AI. Timezone: KST (Asia/Seoul). Current time: ${currentTimeStr}. User wake time: ${wakeTime || 'unknown'}. CRITICAL: You MUST ONLY recommend times between ${earliestAllowedTime} and 23:00. NEVER recommend times before ${earliestAllowedTime}. Spread recommendations across the day with at least 2-hour gaps.`
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            response_format: { type: "json_object" },
        });

        const response = completion.choices[0]?.message?.content || '{"recommendations": []}';
        const result = JSON.parse(response);

        // Log usage
        await logOpenAIUsage(
            email,
            completion.model,
            '/api/ai-schedule-recommendations',
            completion.usage?.prompt_tokens || 0,
            completion.usage?.completion_tokens || 0
        );

        // 가장 이른 허용 시간 (기상시간 or 현재시간)을 분 단위로 변환
        const [earliestH, earliestM] = earliestAllowedTime.split(':').map(Number);
        const earliestMinutes = earliestH * 60 + (earliestM || 0);

        // Filter: 기상 시간 이전 제거, 시간 보정, 시간 분산 강제
        const filteredRecs = (result.recommendations || [])
            .map((rec: any) => {
                if (!rec.suggestedStartTime) return rec;

                const [recHour, recMinute] = rec.suggestedStartTime.split(':').map(Number);
                const recTimeMinutes = recHour * 60 + (recMinute || 0);

                // 허용 시간 이전이면 제거 (보정하지 않고 그냥 제거)
                if (recTimeMinutes < earliestMinutes) return null;
                // 23시 이후면 제거
                if (recHour >= 23) return null;

                return rec;
            })
            .filter(Boolean);

        // 시간 분산 강제: 2시간 이내 중복 제거
        const validatedRecommendations: any[] = [];
        for (const rec of filteredRecs) {
            const [rH, rM] = (rec.suggestedStartTime || '00:00').split(':').map(Number);
            const recMin = rH * 60 + (rM || 0);
            const tooClose = validatedRecommendations.some((existing: any) => {
                const [eH, eM] = (existing.suggestedStartTime || '00:00').split(':').map(Number);
                return Math.abs(recMin - (eH * 60 + (eM || 0))) < 120; // 2시간 미만
            });
            if (!tooClose) {
                validatedRecommendations.push(rec);
            }
        }

        return validatedRecommendations;
    } catch (error: any) {
        logger.error('[Schedule Recommendations] OpenAI error:', error);
        return [];
    }
}
