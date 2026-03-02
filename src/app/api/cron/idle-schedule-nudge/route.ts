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

// 시간대별 인사말 템플릿
const SLOT_GREETINGS: Record<string, string[]> = {
    '아침': ['상쾌한 아침이에요!', '좋은 아침이에요!', '아침 시간을 알차게 보내볼까요?'],
    '오전': ['오전 시간이 여유롭네요!', '오전에 할 수 있는 활동을 추천드려요!'],
    '점심': ['점심 이후 여유 시간이 있으시네요!', '오후를 준비하는 시간이에요!'],
    '오후': ['오후 시간이 비어있어요!', '오후를 알차게 보내볼까요?'],
    '저녁': ['저녁 시간을 활용해볼까요?', '하루를 마무리하며 할 수 있는 활동이에요!'],
    '밤': ['밤 시간을 활용해볼까요?'],
};

// AI 추천 생성 — JSON 항목만 받고 코드가 조립
async function generateRecommendation(
    profile: any,
    currentHour: number,
    slotLabel: string,
    recentCompletedTexts: string[]
): Promise<{ title: string; message: string; suggestions: string[] } | null> {
    const job = profile?.onboarding?.userType === '대학생'
        ? `${profile?.onboarding?.major || ''} 대학생`
        : profile?.onboarding?.field || profile?.job || '직장인';
    const interests = (profile?.onboarding?.interests || []).join(', ');
    const userName = profile?.name || '';
    const exclude = recentCompletedTexts.length > 0
        ? ` 제외:${recentCompletedTexts.slice(0, 3).join(',')}`
        : '';

    try {
        // AI에게 추천 항목 JSON만 요청
        const completion = await openai.chat.completions.create({
            model: MODELS.GPT_5_MINI,
            messages: [
                {
                    role: 'system',
                    content: `${job}, 관심사:${interests || '없음'}, ${slotLabel} ${currentHour}시.${exclude} 활동 2개 추천. JSON만: {"s":[{"t":"활동명","d":"시간","r":"이유"}]}`
                },
            ],
            temperature: 1.0,
            response_format: { type: 'json_object' },
        });

        const text = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(text);
        const items = parsed.s || parsed.suggestions || [];
        if (!items || items.length === 0) return null;

        // 코드가 템플릿 조립
        const suggestionTexts = items.map(
            (s: any) => `${s.t || s.text} (${s.d || s.duration})`
        );
        const suggestionList = items.map(
            (s: any, i: number) => `${i + 1}. ${s.t || s.text} — ${s.d || s.duration}\n${s.r || s.reason}`
        ).join('\n\n');

        const greetings = SLOT_GREETINGS[slotLabel] || SLOT_GREETINGS['오후'];
        const greeting = userName
            ? `${userName}님, ${greetings[Math.floor(Math.random() * greetings.length)]}`
            : greetings[Math.floor(Math.random() * greetings.length)];

        return {
            title: `${slotLabel} 시간이 비어있어요`,
            message: `${greeting}\n\n추천 활동:\n${suggestionList}\n\n채팅에서 \"일정 추가\"라고 말하면 바로 등록할 수 있어요.`,
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

            // 채팅 기록에도 저장 (웹/모바일 채팅 히스토리에 남도록)
            try {
                const { data: userData } = await supabaseAdmin
                    .from('users')
                    .select('id')
                    .eq('email', user.email)
                    .maybeSingle();

                if (userData) {
                    const chatMessage = {
                        id: `idle-nudge-${todayStr}-${slotLabel}-${Date.now()}`,
                        role: 'assistant',
                        content: `**${recommendation.title}**\n\n${recommendation.message}`,
                        timestamp: new Date().toISOString(),
                    };

                    // 기존 채팅 기록 가져오기
                    const { data: existingChat } = await supabaseAdmin
                        .from('chat_history')
                        .select('messages')
                        .eq('user_id', userData.id)
                        .eq('date', todayStr)
                        .maybeSingle();

                    const existingMessages = existingChat?.messages || [];
                    const updatedMessages = [...existingMessages, chatMessage];

                    await supabaseAdmin
                        .from('chat_history')
                        .upsert({
                            user_id: userData.id,
                            date: todayStr,
                            messages: updatedMessages,
                            title: existingChat ? undefined : todayStr,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id,date' });
                }
            } catch (chatError) {
                logger.error(`[IdleNudge] Chat history save failed for ${user.email}:`, chatError instanceof Error ? chatError.message : chatError);
            }

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
