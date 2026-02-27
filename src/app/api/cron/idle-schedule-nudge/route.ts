/**
 * 빈 일정 AI 추천 CRON
 *
 * 4시간 간격 (10:00, 14:00, 18:00 KST)
 * 향후 4시간 동안 일정이 없는 사용자에게 AI 기반 맞춤 일정 추천 푸시
 *
 * 흐름:
 * 1. 전체 사용자 순회
 * 2. 향후 4시간 일정 유무 체크
 * 3. 빈 시간대인 경우 → AI로 패턴 + 시간대 기반 추천 생성
 * 4. proactive notification으로 저장 → 모바일이 2분 간격 폴링으로 수신
 * 5. 푸시 알림도 함께 전송
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendPushNotification } from '@/lib/pushService';
import { saveProactiveNotification } from '@/lib/proactiveNotificationService';
import { kvGet } from '@/lib/kv-store';
import { withCron } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import { MODELS } from '@/lib/models';
import type { CustomGoal } from '@/lib/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const maxDuration = 120;

// 시간대 라벨
function getTimeSlotLabel(hour: number): string {
    if (hour >= 6 && hour < 10) return '아침';
    if (hour >= 10 && hour < 12) return '오전';
    if (hour >= 12 && hour < 14) return '점심';
    if (hour >= 14 && hour < 18) return '오후';
    if (hour >= 18 && hour < 21) return '저녁';
    return '밤';
}

// 향후 N시간 내 일정 체크
function getUpcomingSchedules(
    customGoals: CustomGoal[],
    todayStr: string,
    dayOfWeek: number,
    currentHour: number,
    windowHours: number
): CustomGoal[] {
    const endHour = currentHour + windowHours;

    return customGoals.filter((goal: CustomGoal) => {
        // 오늘 일정인지 체크
        const isToday =
            goal.specificDate === todayStr ||
            (goal.daysOfWeek?.includes(dayOfWeek) && !goal.specificDate);
        if (!isToday) return false;

        // 시간이 없는 일정은 포함
        if (!goal.startTime) return true;

        // 향후 windowHours 내에 있는지 체크
        const [h] = goal.startTime.split(':').map(Number);
        return h >= currentHour && h < endHour;
    });
}

// 오늘 이미 nudge를 보냈는지 체크 (시간대별)
async function hasNudgeBeenSent(email: string, todayStr: string, slotLabel: string): Promise<boolean> {
    const key = `idle_nudge_${todayStr}_${slotLabel}`;
    const val = await kvGet<boolean>(email, key);
    return val === true;
}

// nudge 전송 기록
async function markNudgeSent(email: string, todayStr: string, slotLabel: string): Promise<void> {
    await supabaseAdmin.from('user_kv_store').upsert({
        user_email: email,
        key: `idle_nudge_${todayStr}_${slotLabel}`,
        value: true,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_email,key' });
}

// AI 추천 생성
async function generateRecommendation(
    profile: any,
    currentHour: number,
    slotLabel: string,
    recentCompletedTexts: string[]
): Promise<{ title: string; message: string; suggestions: string[] } | null> {
    const job = profile?.onboarding?.userType === '대학생'
        ? `${profile?.onboarding?.major || ''} 대학생`
        : profile?.onboarding?.field || profile?.job || '직장인';
    const goal = profile?.onboarding?.goal || '';
    const interests = (profile?.onboarding?.interests || []).join(', ');
    const userName = profile?.name || '';

    const recentText = recentCompletedTexts.length > 0
        ? `\n최근 완료한 활동: ${recentCompletedTexts.slice(0, 5).join(', ')}`
        : '';

    const prompt = `당신은 한국어로 대화하는 AI 일정 비서입니다.

사용자 정보:
- 직업/신분: ${job}
- 목표: ${goal}
- 관심사: ${interests}
- 현재 시간대: ${slotLabel} (${currentHour}시)${recentText}

현재 향후 4시간 동안 일정이 비어있습니다. 이 시간대에 적합한 활동 2-3개를 추천해주세요.

규칙:
1. ${slotLabel} 시간대에 현실적으로 할 수 있는 활동만 추천
2. 사용자의 직업, 목표, 관심사를 고려
3. 최근 완료한 활동과 겹치지 않게
4. 구체적인 활동명 (예: "30분 스트레칭", "영어 뉴스 읽기 20분")
5. 반드시 JSON만 출력 (다른 텍스트 없이)

JSON 형식:
{
  "greeting": "사용자에게 보내는 자연스러운 한 문장 인사 (${userName ? userName + '님' : ''}에게)",
  "suggestions": [
    { "text": "구체적 활동명", "duration": "소요 시간", "reason": "추천 이유 한 줄" }
  ]
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: MODELS.GPT_5_MINI,
            messages: [
                { role: 'system', content: '일정 추천 AI입니다. 반드시 유효한 JSON만 응답하세요.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.8,
            max_tokens: 500,
            response_format: { type: 'json_object' },
        });

        const text = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(text);

        if (!parsed.suggestions || parsed.suggestions.length === 0) return null;

        const suggestionTexts = parsed.suggestions.map(
            (s: any) => `${s.text} (${s.duration})`
        );
        const suggestionList = parsed.suggestions.map(
            (s: any, i: number) => `${i + 1}. ${s.text} — ${s.duration}\n   ${s.reason}`
        ).join('\n');

        return {
            title: `${slotLabel} 시간이 비어있어요`,
            message: `${parsed.greeting || '지금 여유 시간이 있으시네요!'}\n\n추천 활동:\n${suggestionList}\n\n채팅에서 \"일정 추가\"라고 말하면 바로 등록할 수 있어요.`,
            suggestions: suggestionTexts,
        };
    } catch (error) {
        logger.error('[IdleNudge] AI generation failed:', error);
        return null;
    }
}

export const GET = withCron(async (_request: NextRequest) => {
    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const currentHour = kst.getHours();

    // 활동 시간대만 (9시 ~ 21시)
    if (currentHour < 9 || currentHour >= 21) {
        return NextResponse.json({ message: 'Outside active hours', skipped: true });
    }

    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    const dayOfWeek = kst.getDay();
    const slotLabel = getTimeSlotLabel(currentHour);

    // 전체 사용자 조회
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('email, profile');

    if (!users || users.length === 0) {
        return NextResponse.json({ message: 'No users', processed: 0 });
    }

    let sent = 0;
    let skipped = 0;

    for (const user of users) {
        try {
            // 이미 이 시간대에 nudge 보냈으면 스킵
            if (await hasNudgeBeenSent(user.email, todayStr, slotLabel)) {
                skipped++;
                continue;
            }

            const profile = user.profile || {};
            const customGoals: CustomGoal[] = profile.customGoals || [];

            // 향후 4시간 일정 체크
            const upcoming = getUpcomingSchedules(customGoals, todayStr, dayOfWeek, currentHour, 4);

            // 일정이 있으면 스킵
            if (upcoming.length > 0) {
                skipped++;
                continue;
            }

            // 최근 완료한 일정 텍스트 (패턴 참고용)
            const recentCompleted = customGoals
                .filter((g: CustomGoal) => g.completed && g.specificDate && g.specificDate >= todayStr.slice(0, 8))
                .map((g: CustomGoal) => g.text)
                .slice(0, 10);

            // AI 추천 생성
            const recommendation = await generateRecommendation(
                profile,
                currentHour,
                slotLabel,
                recentCompleted
            );

            if (!recommendation) {
                skipped++;
                continue;
            }

            // proactive notification 저장 (모바일이 폴링으로 수신)
            await saveProactiveNotification(user.email, {
                id: `idle-nudge-${todayStr}-${slotLabel}`,
                type: 'context_suggestion',
                priority: 'low',
                title: recommendation.title,
                message: recommendation.message,
                actionType: 'open_add_schedule',
                actionPayload: { suggestions: recommendation.suggestions, timeSlot: slotLabel },
            });

            // 푸시 알림 전송
            await sendPushNotification(user.email, {
                title: recommendation.title,
                body: recommendation.suggestions[0] || '일정을 추가해보세요',
                data: {
                    type: 'idle_schedule_nudge',
                    deepLink: 'fieri://dashboard',
                    suggestions: recommendation.suggestions,
                },
            });

            // 전송 기록
            await markNudgeSent(user.email, todayStr, slotLabel);
            sent++;
        } catch (error) {
            logger.error(`[IdleNudge] Error for ${user.email}:`, error instanceof Error ? error.message : error);
        }
    }

    return NextResponse.json({
        success: true,
        date: todayStr,
        timeSlot: slotLabel,
        hour: currentHour,
        sent,
        skipped,
        total: users.length,
    });
});
