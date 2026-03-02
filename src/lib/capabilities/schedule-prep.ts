/**
 * Schedule Prep Capability
 *
 * ai-schedule-prep API 라우트에서 추출한 핵심 로직.
 * 카테고리 라우팅: 식사/휴식/여가 → 하드코딩, 운동/업무/공부 → AI.
 */

import OpenAI from 'openai';
import { logOpenAIUsage } from '@/lib/openai-usage';
import { MODELS } from '@/lib/models';
import {
    registerCapability,
    type CapabilityResult,
    type SchedulePrepParams,
    type SchedulePrepResult,
} from '@/lib/agent-capabilities';
import { logger } from '@/lib/logger';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 일정 준비 조언 핵심 로직
 */
export async function generateSchedulePrep(
    email: string,
    params: SchedulePrepParams
): Promise<CapabilityResult<SchedulePrepResult>> {
    try {
        const { scheduleText, startTime, timeUntil } = params;
        const scheduleName = scheduleText.toLowerCase();
        const displayTimeUntil = timeUntil ?? 30;

        // 일정 유형 판별
        const isMealTime = /식사|점심|저녁|아침|밥|브런치|런치|디너|야식|간식/.test(scheduleName);
        const isRestTime = /휴식|쉬는|낮잠|수면|취침|잠|기상|일어나/.test(scheduleName);
        const isLeisure = /게임|영화|드라마|유튜브|넷플릭스|독서|음악|산책/.test(scheduleName);
        const isExercise = /운동|헬스|요가|필라테스|러닝|조깅|수영|등산/.test(scheduleName);
        const isWork = /업무|출근|퇴근|회의|미팅|프레젠테이션|발표|면접/.test(scheduleName);
        const isStudy = /공부|학습|강의|수업|시험|과제/.test(scheduleName);

        // === 식사: 하드코딩 ===
        if (isMealTime) {
            const mealEmojis: Record<string, string> = {
                '아침': '🍳', '점심': '🍚', '저녁': '🍽️',
                '야식': '🌙', '브런치': '🥐', '간식': '🍪'
            };
            let emoji = '🍽️';
            for (const [key, val] of Object.entries(mealEmojis)) {
                if (scheduleName.includes(key)) { emoji = val; break; }
            }
            const mealMessages = ['맛있게 드세요!', '든든하게 드세요!', '맛있는 식사 되세요!'];
            const randomMsg = mealMessages[Math.floor(Math.random() * mealMessages.length)];
            return {
                success: true,
                data: {
                    advice: `${displayTimeUntil}분 후 "${scheduleText}" 시간이에요 ${emoji}\n\n${randomMsg}`,
                    prepType: 'meal',
                },
                costTier: 'free',
                cachedHit: false,
            };
        }

        // === 휴식/수면: 하드코딩 ===
        if (isRestTime) {
            const isSleepTime = /취침|잠|수면/.test(scheduleName);
            if (isSleepTime) {
                const sleepPrepTips = [
                    '핸드폰 무음 모드로 전환하기', '방 조명 어둡게 하기',
                    '알람 설정 확인하기', '내일 준비물 미리 챙겨두기',
                    '가벼운 스트레칭하기', '따뜻한 물 한 잔 마시기',
                ];
                const shuffled = sleepPrepTips.sort(() => Math.random() - 0.5);
                const selectedTips = shuffled.slice(0, 3);
                return {
                    success: true,
                    data: {
                        advice: `${displayTimeUntil}분 후 "${scheduleText}" 시간이에요 🌙\n\n수면 준비 체크:\n${selectedTips.map(tip => `• ${tip}`).join('\n')}\n\n좋은 꿈 꾸세요! 😴`,
                        prepType: 'sleep',
                    },
                    costTier: 'free',
                    cachedHit: false,
                };
            }

            const restMessages: Record<string, { emoji: string; msg: string }> = {
                '기상': { emoji: '☀️', msg: '상쾌한 아침 되세요!' },
                '일어나': { emoji: '🌅', msg: '좋은 아침이에요!' },
                '휴식': { emoji: '☕', msg: '편하게 쉬세요!' },
                '낮잠': { emoji: '😌', msg: '달콤한 낮잠 되세요!' },
            };
            let emoji = '☕';
            let msg = '편하게 쉬세요!';
            for (const [key, val] of Object.entries(restMessages)) {
                if (scheduleName.includes(key)) { emoji = val.emoji; msg = val.msg; break; }
            }
            return {
                success: true,
                data: {
                    advice: `${displayTimeUntil}분 후 "${scheduleText}" 시간이에요 ${emoji}\n\n${msg}`,
                    prepType: 'rest',
                },
                costTier: 'free',
                cachedHit: false,
            };
        }

        // === 여가: 하드코딩 ===
        if (isLeisure) {
            const leisureMessages: Record<string, { emoji: string; msg: string }> = {
                '게임': { emoji: '🎮', msg: '즐거운 시간 보내세요!' },
                '영화': { emoji: '🎬', msg: '재미있게 보세요!' },
                '드라마': { emoji: '📺', msg: '재미있게 보세요!' },
                '유튜브': { emoji: '📱', msg: '즐거운 시청 되세요!' },
                '넷플릭스': { emoji: '🍿', msg: '재미있게 보세요!' },
                '독서': { emoji: '📚', msg: '즐거운 독서 시간 되세요!' },
                '음악': { emoji: '🎵', msg: '좋은 음악과 함께하세요!' },
                '산책': { emoji: '🚶', msg: '상쾌한 산책 되세요!' },
            };
            let emoji = '🎉';
            let msg = '즐거운 시간 보내세요!';
            for (const [key, val] of Object.entries(leisureMessages)) {
                if (scheduleName.includes(key)) { emoji = val.emoji; msg = val.msg; break; }
            }
            return {
                success: true,
                data: {
                    advice: `${displayTimeUntil}분 후 "${scheduleText}" 시간이에요 ${emoji}\n\n${msg}`,
                    prepType: 'leisure',
                },
                costTier: 'free',
                cachedHit: false,
            };
        }

        // === 운동/업무/공부: AI에게 체크 항목 JSON만 요청, 코드가 조립 ===
        const activityType = isExercise ? '운동' : isWork ? '업무/회의' : isStudy ? '공부' : '활동';
        const prepType = isExercise ? 'exercise' : isWork ? 'work' : isStudy ? 'study' : 'activity';
        const typeEmojis: Record<string, string> = {
            exercise: '💪', work: '💼', study: '📖', activity: '🕐',
        };
        const emoji = typeEmojis[prepType];

        const modelName = MODELS.GPT_5_MINI;
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: `"${scheduleText}" (${activityType}) 준비 체크 항목 3개를 JSON 배열로만 응답. 예: {"items":["항목1","항목2","항목3"]}`
                },
            ],
            temperature: 1.0,
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content || '{}';
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(email, modelName, '/api/ai-schedule-prep', usage.prompt_tokens, usage.completion_tokens);
        }

        let items: string[];
        try {
            const parsed = JSON.parse(content);
            items = Array.isArray(parsed.items) ? parsed.items.slice(0, 3) : [];
        } catch {
            items = [];
        }

        // 코드가 최종 텍스트 조립
        const advice = items.length > 0
            ? `${displayTimeUntil}분 후 "${scheduleText}" 시간이에요 ${emoji}\n\n준비 체크:\n${items.map(t => `• ${t}`).join('\n')}`
            : `${displayTimeUntil}분 후 "${scheduleText}" 시간이에요 ${emoji}\n\n준비하세요!`;

        return {
            success: true,
            data: { advice, prepType },
            costTier: 'cheap',
            cachedHit: false,
        };
    } catch (error) {
        logger.error('[SchedulePrep] Error:', error);
        return { success: false, error: 'Failed to generate prep advice', costTier: 'cheap', cachedHit: false };
    }
}

// Register capability
registerCapability<SchedulePrepParams, SchedulePrepResult>({
    name: 'schedule_prep',
    description: '일정 준비 조언 + 체크리스트',
    costTier: 'cheap',
    execute: generateSchedulePrep,
});
