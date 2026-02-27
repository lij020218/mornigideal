/**
 * Habit Insights Capability
 *
 * habit-analysis API 라우트에서 추출한 핵심 로직.
 * 7일 패턴 분석 + GPT-5-MINI, 6시간 Supabase 캐시.
 */

import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logOpenAIUsage } from '@/lib/openai-usage';
import { MODELS } from '@/lib/models';
import {
    registerCapability,
    type CapabilityResult,
    type HabitInsightsParams,
    type HabitInsightsResult,
} from '@/lib/agent-capabilities';
import { logger } from '@/lib/logger';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 습관 인사이트 핵심 로직
 */
export async function generateHabitInsights(
    email: string,
    _params: HabitInsightsParams
): Promise<CapabilityResult<HabitInsightsResult>> {
    try {
        // 6시간 Supabase 캐시 확인
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const { data: cachedData, error: cacheError } = await supabaseAdmin
            .from('habit_insights_cache')
            .select('insights, created_at')
            .eq('email', email)
            .eq('date', today)
            .maybeSingle();

        if (cachedData && !cacheError) {
            const cacheAge = Date.now() - new Date(cachedData.created_at).getTime();
            const SIX_HOURS = 6 * 60 * 60 * 1000;
            if (cacheAge < SIX_HOURS) {
                return { success: true, data: cachedData.insights, costTier: 'free', cachedHit: true };
            }
        }

        // 사용자 프로필 조회
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('profile')
            .eq('email', email)
            .maybeSingle();

        const profile = user?.profile || {};
        const customGoals = profile.customGoals || [];

        if (customGoals.length === 0) {
            const emptyResult: HabitInsightsResult = {
                insight: '아직 등록된 일정이 없어요',
                suggestion: '일정을 추가하고 패턴을 분석해보세요!',
                emoji: '📝',
                category: 'consistency',
            };
            return { success: true, data: emptyResult, costTier: 'free', cachedHit: false };
        }

        // 최근 7일 일정 분석
        const now = new Date();
        const dayOfWeek = now.getDay();

        const recentSchedules = customGoals.filter((g: any) => {
            if (g.specificDate) {
                const scheduleDate = new Date(g.specificDate);
                const diff = (now.getTime() - scheduleDate.getTime()) / (1000 * 60 * 60 * 24);
                return diff >= 0 && diff <= 7;
            }
            return g.daysOfWeek?.includes(dayOfWeek);
        });

        // 카테고리별 분류
        const categories: Record<string, number> = {
            exercise: 0, study: 0, work: 0, rest: 0, hobby: 0,
        };

        recentSchedules.forEach((s: any) => {
            const text = s.text?.toLowerCase() || '';
            if (text.includes('운동') || text.includes('헬스') || text.includes('조깅') || text.includes('스트레칭')) {
                categories.exercise++;
            } else if (text.includes('공부') || text.includes('독서') || text.includes('학습') || text.includes('강의')) {
                categories.study++;
            } else if (text.includes('업무') || text.includes('회의') || text.includes('미팅')) {
                categories.work++;
            } else if (text.includes('휴식') || text.includes('취침') || text.includes('명상')) {
                categories.rest++;
            } else {
                categories.hobby++;
            }
        });

        // GPT로 인사이트 생성
        const schedulesSummary = recentSchedules.map((s: any) =>
            `${s.text} (${s.startTime || '시간없음'})`
        ).join(', ');

        const prompt = `사용자의 최근 7일 일정을 분석하여 전문 비서처럼 인사이트를 제공해주세요.

사용자 정보:
- 직업: ${profile.job || '직장인'}
- 목표: ${profile.goal || '자기계발'}

최근 일정 목록: ${schedulesSummary || '없음'}

카테고리별 일정 수:
- 운동: ${categories.exercise}개
- 공부/학습: ${categories.study}개
- 업무/회의: ${categories.work}개
- 휴식: ${categories.rest}개

중요한 규칙:
1. insight와 suggestion은 논리적으로 일관성이 있어야 합니다.
2. 부족한 것을 지적했으면, 그것을 보완하는 제안을 해주세요.
3. 전문 비서처럼 정중하고 격식있는 말투를 사용하세요.
4. insight는 현재 상황을 간결하게, suggestion은 구체적인 행동을 제안하세요.

다음 JSON 형식으로만 응답해주세요:
{
  "insight": "현재 상태 분석 (15자 이내, 명사형)",
  "suggestion": "정중한 제안 (25자 이내, ~하시는 건 어떨까요 형식)",
  "emoji": "관련 이모지 1개",
  "category": "exercise/productivity/balance/consistency 중 하나"
}`;

        const response = await openai.chat.completions.create({
            model: MODELS.GPT_5_MINI,
            messages: [
                { role: 'system', content: '당신은 전문 개인 비서입니다. 정중하고 격식있는 말투로 사용자의 일정을 분석합니다. 항상 JSON 형식으로만 응답하세요.' },
                { role: 'user', content: prompt }
            ],
            temperature: 1.0,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || '';

        const usage = response.usage;
        if (usage) {
            await logOpenAIUsage(email, MODELS.GPT_5_MINI, 'habit-analysis', usage.prompt_tokens, usage.completion_tokens);
        }

        let result: HabitInsightsResult;

        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON in response');
            }
        } catch {
            // Fallback
            if (categories.exercise === 0 && recentSchedules.length > 0) {
                result = { insight: '이번 주 운동 일정이 없어요', suggestion: '가벼운 스트레칭부터 시작해보세요!', emoji: '💪', category: 'exercise' };
            } else if (categories.study > categories.rest) {
                result = { insight: '열심히 공부 중이시네요!', suggestion: '충분한 휴식도 잊지 마세요', emoji: '📚', category: 'balance' };
            } else if (recentSchedules.length >= 5) {
                result = { insight: '꾸준히 일정을 관리 중!', suggestion: '이 페이스 유지하면 목표 달성!', emoji: '🔥', category: 'consistency' };
            } else {
                result = { insight: '일정을 더 채워보세요', suggestion: '작은 목표부터 시작해봐요', emoji: '✨', category: 'productivity' };
            }
        }

        // Supabase 캐시 저장
        await supabaseAdmin
            .from('habit_insights_cache')
            .upsert({
                email,
                date: today,
                insights: result,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'email,date'
            });

        return { success: true, data: result, costTier: 'cheap', cachedHit: false };
    } catch (error) {
        logger.error('[HabitInsights] Error:', error);
        return {
            success: false,
            error: 'Failed to generate habit insights',
            data: { insight: '분석 준비 중', suggestion: '잠시 후 다시 확인해주세요', emoji: '⏳', category: 'consistency' },
            costTier: 'cheap',
            cachedHit: false,
        };
    }
}

// Register capability
registerCapability<HabitInsightsParams, HabitInsightsResult>({
    name: 'habit_insights',
    description: '7일 습관 패턴 분석',
    costTier: 'cheap',
    execute: generateHabitInsights,
});
