/**
 * Jarvis Brain
 * LLM 기반 복잡한 판단 (20%)
 */

import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
    InterventionLevel,
    InterventionDecision,
    ActionType,
    GUARDRAILS,
    REASON_CODES
} from '@/types/jarvis';
import { resolvePersonaStyle, getPersonaBlock, type PersonaStyle } from '@/lib/prompts/persona';
import { MODELS } from "@/lib/models";
import { logger } from '@/lib/logger';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface InterventionContext {
    userEmail: string;
    currentState: any;
    recentEvents: any[];
    upcomingSchedules: any[];
    userProfile: any;
    preferences: any;
    decision: InterventionDecision;
}

export interface InterventionPlan {
    actionType: ActionType;
    actionPayload: Record<string, any>;
    message: string;
    reasoning: string;
}

export class Brain {
    /**
     * LLM을 사용하여 구체적인 개입 계획 생성
     */
    async planIntervention(context: InterventionContext): Promise<InterventionPlan | null> {
        // 가드레일 체크: LLM 호출 전 확인
        if (!this.passesGuardrails(context)) {
            return null;
        }

        const prompt = this.buildPrompt(context);

        try {
            const response = await openai.chat.completions.create({
                model: MODELS.GPT_5_MINI,
                temperature: 1,
                max_tokens: 1024,
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'intervention_plan',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                actionType: {
                                    type: 'string',
                                    enum: ['notification_sent', 'schedule_moved', 'resource_prep', 'checklist_created', 'schedule_suggested', 'learning_suggested'],
                                },
                                actionPayload: { type: 'object' },
                                message: { type: 'string' },
                                reasoning: { type: 'string' },
                            },
                            required: ['actionType', 'actionPayload', 'message', 'reasoning'],
                            additionalProperties: false,
                        },
                    },
                },
                messages: [
                    { role: 'system', content: this.getSystemPrompt(context.preferences) },
                    { role: 'user', content: prompt },
                ],
            });

            // AI 호출 횟수 증가 (API 호출 성공 후에만 차감)
            await this.incrementAIUsage(context.userEmail);

            const text = response.choices[0]?.message?.content;
            if (!text) {
                throw new Error('Empty response from LLM');
            }

            const plan = this.parseResponse(text, context);

            // 응답 검증
            if (!this.validatePlan(plan, context)) {
                logger.error('[Brain] Generated plan failed validation');
                return null;
            }

            return plan;
        } catch (error) {
            logger.error('[Brain] LLM call failed:', error);
            return null;
        }
    }

    /**
     * 시스템 프롬프트 (자비스 페르소나 + 가드레일)
     */
    private getSystemPrompt(preferences: any): string {
        const notifStyle = preferences.notificationStyle || 'friendly';

        // 페르소나 시스템에서 스타일 매핑
        let personaStyle: PersonaStyle = 'friendly';
        if (notifStyle === 'jarvis_tone') personaStyle = 'professional';
        else if (notifStyle === 'brief') personaStyle = 'brief';

        const personaBlock = getPersonaBlock({
            style: personaStyle,
            plan: 'max',
        });

        return `${personaBlock}

당신은 사용자의 일정과 루틴을 24시간 모니터링하며, 필요한 순간에 적절히 개입하여 도움을 줍니다.

## 판단 절차 (반드시 순서대로 따르세요)
1. 현재 상태 수치(에너지/스트레스/루틴이탈/마감압박)에서 가장 심각한 지표를 식별하세요.
2. 개입 이유(reasonCodes)와 다가오는 일정을 교차 확인하여, 지금 개입해야 하는 구체적 근거를 확정하세요.
3. 아래 actionType 중 가장 적합한 하나만 선택하세요:
   - notification_sent: 단순 알림/격려
   - schedule_moved: 일정 이동 제안
   - resource_prep: 다가오는 일정 준비물/리소스 사전 준비
   - checklist_created: 체크리스트 생성
   - schedule_suggested: 새 일정 추천
   - learning_suggested: 학습 콘텐츠 추천
4. message는 한국어 1-2문장, 사용자에게 직접 말하는 톤으로 작성하세요.
5. reasoning에 위 1-3단계 판단 근거를 한 문장으로 요약하세요.

## 제약사항
- 다음 단어/표현을 절대 사용하지 마세요: ${GUARDRAILS.FORBIDDEN_PATTERNS.join(', ')}
- 다음 액션은 반드시 사용자 확인이 필요합니다: ${GUARDRAILS.REQUIRES_CONFIRMATION.join(', ')}
- 의학적/정신과적 진단이나 조언을 하지 마세요
- 사용자의 감정 상태를 추측하되, 레이블을 붙이지 마세요`;
    }

    /**
     * 사용자 프롬프트 생성
     */
    private buildPrompt(context: InterventionContext): string {
        const { currentState, recentEvents, upcomingSchedules, decision } = context;

        const reasonsText = decision.reasonCodes
            .map(code => this.translateReasonCode(code))
            .join(', ');

        const eventsText = recentEvents
            .slice(0, 10)
            .map(e => `- ${e.event_type}: ${JSON.stringify(e.payload)}`)
            .join('\n');

        const schedulesText = upcomingSchedules
            .slice(0, 5)
            .map(s => `- ${s.text} (${s.startTime || '시간 미정'})`)
            .join('\n');

        return `현재 사용자 상태:
- 에너지 레벨: ${currentState.energy_level}/100
- 스트레스 레벨: ${currentState.stress_level}/100
- 루틴 이탈 점수: ${currentState.routine_deviation_score}/100
- 마감 압박 점수: ${currentState.deadline_pressure_score}/100

개입이 필요한 이유: ${reasonsText}
개입 점수: ${decision.score}/100

최근 활동 (10개):
${eventsText}

다가오는 일정 (5개):
${schedulesText}

위 상황을 고려하여, 사용자에게 가장 도움이 될 개입 방법을 제안해주세요.
개입 레벨: L${decision.level} (${this.getLevelDescription(decision.level)})`;
    }

    /**
     * LLM 응답 파싱
     */
    private parseResponse(text: string, context: InterventionContext): InterventionPlan {
        // JSON 추출 (코드 블록 제거)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            actionType: parsed.actionType as ActionType,
            actionPayload: parsed.actionPayload || {},
            message: parsed.message || '',
            reasoning: parsed.reasoning || ''
        };
    }

    /**
     * 가드레일 체크
     */
    private passesGuardrails(context: InterventionContext): boolean {
        // 확인 필요 액션인지 체크 (L3 이상에서만 허용)
        const requiresConfirmation = context.decision.reasonCodes.some(code =>
            (GUARDRAILS.REQUIRES_CONFIRMATION as readonly string[]).includes(code)
        );

        if (requiresConfirmation && context.decision.level < InterventionLevel.L3_DIRECT) {
            return false;
        }

        // L4 자동 실행은 옵트인 필요
        if (context.decision.level === InterventionLevel.L4_AUTO && !context.preferences.autoActionOptIn) {
            return false;
        }

        return true;
    }

    /**
     * 생성된 계획 검증
     */
    private validatePlan(plan: InterventionPlan, context: InterventionContext): boolean {
        // 메시지에 금지된 패턴이 있는지 확인
        const hasForbiddenPattern = GUARDRAILS.FORBIDDEN_PATTERNS.some(pattern =>
            plan.message.includes(pattern)
        );

        if (hasForbiddenPattern) {
            logger.error('[Brain] Plan contains forbidden pattern');
            return false;
        }

        // 액션 타입이 유효한지 확인
        const validActionTypes = Object.values(ActionType);
        if (!validActionTypes.includes(plan.actionType)) {
            logger.error('[Brain] Invalid action type:', plan.actionType);
            return false;
        }

        // L4 자동 실행인데 확인 필요한 액션이면 거부
        if (
            context.decision.level === InterventionLevel.L4_AUTO &&
            (GUARDRAILS.REQUIRES_CONFIRMATION as readonly string[]).includes(plan.actionType)
        ) {
            logger.error('[Brain] Cannot auto-execute action that requires confirmation');
            return false;
        }

        return true;
    }

    /**
     * 이유 코드 한글 번역
     */
    private translateReasonCode(code: string): string {
        const translations: Record<string, string> = {
            [REASON_CODES.ROUTINE_BREAK]: '루틴 붕괴',
            [REASON_CODES.CONSECUTIVE_SKIPS]: '연속 스킵',
            [REASON_CODES.OVERBOOKED]: '일정 과밀',
            [REASON_CODES.DEADLINE_SOON]: '마감 임박',
            [REASON_CODES.HIGH_STRESS]: '스트레스 높음',
            [REASON_CODES.LOW_ENERGY]: '에너지 낮음',
            [REASON_CODES.LEARNING_OPPORTUNITY]: '학습 기회'
        };

        return translations[code] || code;
    }

    /**
     * 레벨 설명
     */
    private getLevelDescription(level: InterventionLevel): string {
        const descriptions = {
            [InterventionLevel.L0_OBSERVE]: '관찰만',
            [InterventionLevel.L1_SILENT_PREP]: '조용한 준비',
            [InterventionLevel.L2_SOFT]: '제안 알림',
            [InterventionLevel.L3_DIRECT]: '확인 후 실행',
            [InterventionLevel.L4_AUTO]: '자동 실행'
        };

        return descriptions[level] || '알 수 없음';
    }

    /**
     * AI 사용 횟수 증가
     */
    private async incrementAIUsage(userEmail: string): Promise<void> {
        try {
            const { data, error } = await supabaseAdmin.rpc('increment_ai_usage', {
                p_user_email: userEmail
            });

            if (error) {
                logger.error('[Brain] Failed to increment AI usage:', error);
            } else {
            }
        } catch (error) {
            logger.error('[Brain] Exception while incrementing AI usage:', error);
        }
    }
}
