/**
 * Jarvis ReAct Brain
 * Reason → Act → Observe 에이전트 루프
 *
 * 복합 요청 시 활성화 (전 플랜)
 * - 다단계 추론: 도구를 순차적으로 호출하며 문제 해결
 * - 플랜별 반복 제한: Free=2, Pro=3, Max=5
 * - respond_to_user 호출 시 루프 종료
 *
 * 플랜별 모델:
 * - Free: GPT-5-mini (저비용, 2-step)
 * - Pro:  GPT-5.2 (고성능, 3-step)
 * - Max:  Claude Sonnet 4.5 (에이전트 최강, 5-step)
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { PlanType } from '@/types/jarvis';
import { getAvailableTools, ToolDefinition, ToolCall, ToolResult } from './tools';
import { ToolExecutor } from './tool-executor';
import { llmCircuit } from '@/lib/circuit-breaker';
import { getPersonaBlock, resolvePersonaStyle, type PersonaStyle } from '@/lib/prompts/persona';
import { MODELS } from "@/lib/models";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ================================================
// Error classification for retry logic
// ================================================

function classifyError(error: unknown): 'transient' | 'permanent' | 'unknown' {
    const msg = error instanceof Error ? error.message : String(error);
    const status = (error as any)?.status || (error as any)?.response?.status;

    // Rate limit or timeout → transient
    if (status === 429 || status === 408 || status === 502 || status === 503 || status === 504) return 'transient';
    if (msg.includes('timeout') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('rate_limit')) return 'transient';

    // Auth or model errors → permanent
    if (status === 401 || status === 403 || status === 404) return 'permanent';
    if (msg.includes('invalid_api_key') || msg.includes('model_not_found') || msg.includes('billing')) return 'permanent';

    return 'unknown';
}

// Anthropic은 Max 플랜에서만 사용 — API 키 없으면 null
const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

// ================================================
// 플랜별 설정
// ================================================

type LLMProvider = 'openai' | 'anthropic';

const REACT_PLAN_CONFIGS: Record<string, {
    maxIterations: number;
    model: string;
    provider: LLMProvider;
}> = {
    Free:     { maxIterations: 3, model: MODELS.GPT_5_MINI, provider: 'openai' },
    Pro:      { maxIterations: 3, model: MODELS.GPT_5_2,    provider: 'openai' },
    Max:      { maxIterations: 5, model: MODELS.CLAUDE_SONNET_4_5, provider: 'anthropic' },
};

// ================================================
// Types
// ================================================

export interface ReActInput {
    messages: Array<{ role: string; content: string }>;
    userEmail: string;
    userPlan: PlanType;
    profile: any;
    context: {
        currentDate: string;
        currentTime: string;
        scheduleContext?: string;
        userContext?: string;
    };
}

export interface ReActStep {
    thought: string;
    action: string;
    actionInput: Record<string, any>;
    observation: string;
}

export interface ReActResult {
    message: string;
    actions: any[];
    steps: ReActStep[];
    totalLlmCalls: number;
    wasTerminatedEarly: boolean;
}

// ================================================
// ReAct Brain
// ================================================

export class ReActBrain {
    private userEmail: string;
    private userPlan: PlanType;
    private toolExecutor: ToolExecutor;
    private availableTools: ToolDefinition[];
    private config: { maxIterations: number; model: string; provider: LLMProvider };

    constructor(userEmail: string, userPlan: PlanType) {
        this.userEmail = userEmail;
        this.userPlan = userPlan;
        this.toolExecutor = new ToolExecutor(userEmail, userPlan);
        this.availableTools = getAvailableTools(userPlan);
        this.config = REACT_PLAN_CONFIGS[userPlan] || REACT_PLAN_CONFIGS.Free;

        // Max인데 Anthropic 키 없으면 GPT-5.2로 폴백
        if (this.config.provider === 'anthropic' && !anthropic) {
            this.config = { ...REACT_PLAN_CONFIGS.Pro, maxIterations: 5 };
        }
    }

    /**
     * ReAct 루프 실행
     */
    async run(input: ReActInput): Promise<ReActResult> {
        const systemPrompt = this.buildSystemPrompt(input);
        const userMessage = this.buildUserMessage(input);
        const scratchpad: ReActStep[] = [];
        let totalLlmCalls = 0;
        let wasTerminatedEarly = false;
        const loopStartTime = Date.now();
        const LOOP_TIMEOUT = 60000; // 전체 루프 60초 제한

        for (let i = 0; i < this.config.maxIterations; i++) {
            // 전체 루프 타임아웃 체크
            if (Date.now() - loopStartTime > LOOP_TIMEOUT) {
                console.warn(`[ReActBrain] Loop timeout reached after ${i} iterations (${Date.now() - loopStartTime}ms)`);
                wasTerminatedEarly = true;
                break;
            }
            // 1. LLM 호출 (classified retry with exponential backoff)
            const prompt = this.buildIterationPrompt(userMessage, scratchpad);

            let llmResponse: string | null = null;
            let lastError: unknown = null;
            const MAX_RETRIES = 2;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    llmResponse = await this.callLLM(systemPrompt, prompt);
                    totalLlmCalls++;
                    break;
                } catch (error) {
                    lastError = error;
                    const errorType = classifyError(error);

                    if (errorType === 'permanent') {
                        console.error(`[ReActBrain] Permanent error at step ${i + 1}, aborting:`, error);
                        wasTerminatedEarly = true;
                        break;
                    }

                    if (attempt < MAX_RETRIES) {
                        const backoffMs = Math.min(500 * Math.pow(2, attempt), 4000);
                        console.warn(`[ReActBrain] ${errorType} error at step ${i + 1}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
                        await new Promise(resolve => setTimeout(resolve, backoffMs));
                    } else {
                        console.error(`[ReActBrain] All retries exhausted at step ${i + 1}:`, error);
                        wasTerminatedEarly = true;
                    }
                }
            }

            if (wasTerminatedEarly) break;
            if (!llmResponse) {
                wasTerminatedEarly = true;
                break;
            }

            // 2. 응답 파싱
            const parsed = this.parseReActResponse(llmResponse);

            if (!parsed) {
                console.error(`[ReActBrain] Failed to parse response at step ${i + 1}, generating fallback`);
                wasTerminatedEarly = true;
                // 파싱 실패한 raw 응답을 scratchpad에 기록하여 fallback 생성 시 활용
                scratchpad.push({
                    thought: '(파싱 실패)',
                    action: 'parse_error',
                    actionInput: {},
                    observation: llmResponse.substring(0, 500),
                });
                break;
            }

            // 3. respond_to_user → 루프 종료
            if (parsed.action === 'respond_to_user') {
                const finalActions = parsed.actionInput.actions || [];
                const step: ReActStep = {
                    thought: parsed.thought,
                    action: 'respond_to_user',
                    actionInput: parsed.actionInput,
                    observation: '최종 응답 전달 완료',
                };
                scratchpad.push(step);


                return {
                    message: parsed.actionInput.message || '',
                    actions: finalActions,
                    steps: scratchpad,
                    totalLlmCalls,
                    wasTerminatedEarly: false,
                };
            }

            // 4. 도구 실행 (병렬 지원)
            if (parsed.parallelActions && parsed.parallelActions.length > 1) {
                // 병렬 실행: Promise.all로 독립 도구들 동시 호출
                const results = await Promise.all(
                    parsed.parallelActions.map(async (pa) => {
                        const tc: ToolCall = { toolName: pa.action, arguments: pa.actionInput };
                        try {
                            return await this.toolExecutor.execute(tc);
                        } catch (error) {
                            return {
                                success: false,
                                error: String(error),
                                humanReadableSummary: `도구 실행 실패: ${error instanceof Error ? error.message : String(error)}`,
                            } as ToolResult;
                        }
                    })
                );

                // 각 결과를 개별 스크래치패드 스텝으로 기록
                const observations = parsed.parallelActions.map((pa, idx) =>
                    `[${pa.action}] ${results[idx].humanReadableSummary}`
                ).join('\n');

                const step: ReActStep = {
                    thought: parsed.thought,
                    action: parsed.parallelActions.map(pa => pa.action).join('+'),
                    actionInput: { parallel: parsed.parallelActions },
                    observation: observations,
                };
                scratchpad.push(step);
            } else {
                // 단일 실행 (기존 로직)
                const toolCall: ToolCall = {
                    toolName: parsed.action,
                    arguments: parsed.actionInput,
                };

                let result: ToolResult;
                try {
                    result = await this.toolExecutor.execute(toolCall);
                } catch (error) {
                    result = {
                        success: false,
                        error: String(error),
                        humanReadableSummary: `도구 실행 실패: ${error instanceof Error ? error.message : String(error)}`,
                    };
                }

                // 5. Observation 기록
                const step: ReActStep = {
                    thought: parsed.thought,
                    action: parsed.action,
                    actionInput: parsed.actionInput,
                    observation: result.humanReadableSummary,
                };
                scratchpad.push(step);
            }

        }

        // 반복 제한 초과 또는 에러 → 마지막 scratchpad로 응답 생성
        if (scratchpad.length > 0) {
            const fallbackResult = await this.generateFallbackResponse(
                systemPrompt, userMessage, scratchpad
            );
            totalLlmCalls++;

            return {
                message: fallbackResult.message,
                actions: fallbackResult.actions,
                steps: scratchpad,
                totalLlmCalls,
                wasTerminatedEarly: true,
            };
        }

        // 완전 실패
        return {
            message: '죄송합니다, 요청을 처리하는 중 문제가 발생했습니다. 다시 시도해주세요.',
            actions: [],
            steps: [],
            totalLlmCalls,
            wasTerminatedEarly: true,
        };
    }

    // ================================================
    // LLM 호출 추상화
    // ================================================

    /**
     * 플랜별 프로바이더에 따라 LLM 호출 (타임아웃 포함)
     */
    private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
        const LLM_TIMEOUT = 30000; // 30초 타임아웃

        if (this.config.provider === 'anthropic' && anthropic) {
            const response = await Promise.race([
                anthropic.messages.create({
                    model: this.config.model,
                    max_tokens: 4096,
                    temperature: 1.0,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: userPrompt }],
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('LLM call timed out (Anthropic)')), LLM_TIMEOUT)
                ),
            ]);
            const content = response.content[0];
            if (content.type !== 'text' || !content.text) {
                throw new Error('Empty response from Anthropic');
            }
            return content.text;
        }

        // OpenAI (Free, Pro, 또는 Anthropic 폴백)
        const response = await llmCircuit.execute(() =>
            Promise.race([
                openai.chat.completions.create({
                    model: this.config.model,
                    temperature: 1.0,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    response_format: { type: 'json_object' },
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('LLM call timed out (OpenAI)')), LLM_TIMEOUT)
                ),
            ])
        );
        const choice = response.choices[0];
        const content = choice?.message?.content;
        if (!content) {
            const reason = choice?.finish_reason || 'unknown';
            const refusal = (choice?.message as any)?.refusal;
            console.error(`[ReActBrain] Empty OpenAI response — finish_reason: ${reason}, refusal: ${refusal || 'none'}, model: ${this.config.model}`);
            throw new Error(`Empty response from OpenAI (finish_reason: ${reason})`);
        }
        return content;
    }

    // ================================================
    // 프롬프트 생성
    // ================================================

    private buildSystemPrompt(input: ReActInput): string {
        const personaStyle: PersonaStyle = resolvePersonaStyle(input.profile, input.userPlan);
        const personaBlock = getPersonaBlock({
            style: personaStyle,
            userName: input.profile?.name,
            userJob: input.profile?.job || input.profile?.field,
            plan: input.userPlan.toLowerCase(),
        });

        const toolDescriptions = this.availableTools
            .map(t => {
                const params = t.parameters.length > 0
                    ? `\n    파라미터: ${t.parameters.map(p => `${p.name}(${p.type}${p.required ? ', 필수' : ''}): ${p.description}`).join(', ')}`
                    : '';
                const confirm = t.requiresConfirmation ? ' [확인 필요]' : '';
                return `  - ${t.name}: ${t.description}${confirm}${params}`;
            })
            .join('\n');

        return `${personaBlock}

---

당신은 ReAct (Reason-Act-Observe) 방식으로 사용자 요청을 처리하는 AI 에이전트입니다.

## 사용 가능한 도구:
${toolDescriptions}

## ReAct 프로토콜:
매 단계마다 반드시 다음 JSON 형식으로만 응답하세요:

{"thought": "현재 상황 분석, 다음에 무엇을 해야 할지 추론", "action": "사용할 도구 이름", "actionInput": {파라미터}}

## 규칙:
1. 독립적인 도구 호출이 여러 개 필요하면 "actions" 배열로 병렬 실행할 수 있습니다
2. 이전 도구 결과에 의존하는 도구는 다음 단계에서 순차적으로 호출하세요
3. Observation(도구 실행 결과)을 확인한 후 다음 단계를 결정하세요
4. 충분한 정보를 모았으면 반드시 "respond_to_user" 도구로 최종 응답을 전달하세요
5. respond_to_user의 message는 반드시 한국어로, 사용자에게 직접 말하는 1인칭 형식이어야 합니다
6. respond_to_user의 actions 배열에는 프론트엔드 액션 버튼 정보를 포함할 수 있습니다
   - 일정 추가: { "type": "add_schedule", "label": "일정 추가", "data": { "text": "...", "startTime": "HH:MM", ... } }
   - 일정 삭제: { "type": "delete_schedule", "label": "일정 삭제", "data": { "text": "..." } }
7. 최대 ${this.config.maxIterations}단계 내에 반드시 respond_to_user를 호출해야 합니다
8. 불필요한 도구 호출을 하지 마세요. 이미 알고 있는 정보는 바로 활용하세요
9. 반드시 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요

## 응답 형식:
단일 도구:
{"thought": "...", "action": "도구이름", "actionInput": {...}}

병렬 도구 (독립적인 호출이 여러 개일 때):
{"thought": "...", "actions": [{"action": "도구1", "actionInput": {...}}, {"action": "도구2", "actionInput": {...}}]}

## 예시:
{"thought": "사용자가 오늘 일정을 물어보고 있으니, 먼저 오늘 일정을 조회해야 한다.", "action": "get_today_schedules", "actionInput": {}}

{"thought": "일정을 확인했고, 사용자에게 결과를 전달할 준비가 됐다.", "action": "respond_to_user", "actionInput": {"message": "오늘 일정은 3개가 있어요!", "actions": []}}`;
    }

    private buildUserMessage(input: ReActInput): string {
        const lastMessage = input.messages[input.messages.length - 1];
        const userQuery = lastMessage?.content || '';

        const contextParts: string[] = [];

        if (input.context.currentDate) {
            contextParts.push(`현재 날짜: ${input.context.currentDate}`);
        }
        if (input.context.currentTime) {
            contextParts.push(`현재 시간: ${input.context.currentTime}`);
        }
        if (input.context.userContext) {
            contextParts.push(input.context.userContext);
        }
        if (input.context.scheduleContext) {
            contextParts.push(input.context.scheduleContext);
        }

        // 최근 대화 히스토리 (마지막 메시지 제외, 최대 6개)
        const history = input.messages.slice(-7, -1);
        let historyText = '';
        if (history.length > 0) {
            historyText = '\n\n최근 대화:\n' + history
                .map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
                .join('\n');
        }

        const contextBlock = contextParts.length > 0
            ? `\n\n--- 컨텍스트 ---\n${contextParts.join('\n')}`
            : '';

        return `사용자 요청: ${userQuery}${contextBlock}${historyText}`;
    }

    private buildIterationPrompt(userMessage: string, scratchpad: ReActStep[]): string {
        if (scratchpad.length === 0) {
            return userMessage;
        }

        // Scratchpad 크기 제한: observation을 500자로 잘라 토큰 폭발 방지
        const MAX_OBS_LENGTH = 500;
        const scratchpadJson = scratchpad.map(step => ({
            thought: step.thought,
            action: step.action,
            actionInput: step.actionInput,
            observation: step.observation.length > MAX_OBS_LENGTH
                ? step.observation.substring(0, MAX_OBS_LENGTH) + '...(truncated)'
                : step.observation,
        }));

        return `${userMessage}

--- 이전 단계 ---
${JSON.stringify(scratchpadJson, null, 2)}

--- 다음 단계 ---
위 observation을 참고하여 다음 JSON 응답을 결정하세요. 반드시 {"thought": "...", "action": "...", "actionInput": {...}} 형식으로만 응답하세요.`;
    }

    // ================================================
    // 응답 파싱
    // ================================================

    private parseReActResponse(text: string): {
        thought: string;
        action: string;
        actionInput: Record<string, any>;
        parallelActions?: { action: string; actionInput: Record<string, any> }[];
    } | null {
        // 1차: JSON.parse (OpenAI response_format 사용 시)
        try {
            const parsed = JSON.parse(text);

            // 병렬 액션 형식: {"thought": "...", "actions": [{action, actionInput}, ...]}
            if (Array.isArray(parsed.actions) && parsed.actions.length > 0 && parsed.actions[0]?.action) {
                const validActions = parsed.actions.filter((a: any) =>
                    this.availableTools.find(t => t.name === a.action)
                );
                if (validActions.length === 0) {
                    console.error('[ReActBrain] No valid tools in parallel actions');
                    return null;
                }
                // 첫 번째를 메인으로, 나머지를 parallelActions로
                return {
                    thought: parsed.thought || '',
                    action: validActions[0].action,
                    actionInput: validActions[0].actionInput || {},
                    parallelActions: validActions.length > 1 ? validActions : undefined,
                };
            }

            // 단일 액션 형식: {"thought": "...", "action": "...", "actionInput": {...}}
            if (parsed.action) {
                const validTool = this.availableTools.find(t => t.name === parsed.action);
                if (!validTool) {
                    console.error(`[ReActBrain] Unknown tool: ${parsed.action}`);
                    return null;
                }
                return {
                    thought: parsed.thought || '',
                    action: parsed.action,
                    actionInput: parsed.actionInput || {},
                };
            }
        } catch {
            // JSON 파싱 실패 → 레거시 정규식 파싱 시도 (Anthropic 텍스트 응답용)
        }

        // 2차: 레거시 정규식 파싱 (Anthropic용 fallback)
        return this.parseReActResponseLegacy(text);
    }

    private parseReActResponseLegacy(text: string): {
        thought: string;
        action: string;
        actionInput: Record<string, any>;
    } | null {
        try {
            // Thought 추출
            const thoughtMatch = text.match(/Thought:\s*([\s\S]*?)(?=\nAction:)/);
            const thought = thoughtMatch ? thoughtMatch[1].trim() : '';

            // Action 추출
            const actionMatch = text.match(/Action:\s*(\S+)/);
            if (!actionMatch) {
                console.error('[ReActBrain] No Action found in response (legacy)');
                return null;
            }
            const action = actionMatch[1].trim();

            // ActionInput 추출
            const inputMatch = text.match(/ActionInput:\s*([\s\S]*?)$/);
            if (!inputMatch) {
                console.error('[ReActBrain] No ActionInput found in response (legacy)');
                return null;
            }

            let actionInput: Record<string, any>;
            try {
                // JSON 블록 추출 (코드 블록 제거)
                const inputText = inputMatch[1].trim();
                const jsonMatch = inputText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    actionInput = JSON.parse(jsonMatch[0]);
                } else {
                    actionInput = {};
                }
            } catch {
                console.error('[ReActBrain] Failed to parse ActionInput JSON (legacy)');
                actionInput = {};
            }

            // 도구 유효성 확인
            const validTool = this.availableTools.find(t => t.name === action);
            if (!validTool) {
                console.error(`[ReActBrain] Unknown tool: ${action} (legacy)`);
                return null;
            }

            return { thought, action, actionInput };
        } catch (error) {
            console.error('[ReActBrain] Legacy parse error:', error);
            return null;
        }
    }

    // ================================================
    // 폴백 응답 생성
    // ================================================

    /**
     * 반복 제한 초과 시, 수집된 정보를 바탕으로 최종 응답 생성
     */
    private async generateFallbackResponse(
        systemPrompt: string,
        userMessage: string,
        scratchpad: ReActStep[]
    ): Promise<{ message: string; actions: any[] }> {
        const observations = scratchpad
            .map(s => `[${s.action}] ${s.observation}`)
            .join('\n');

        const fallbackPrompt = `${userMessage}

--- 수집된 정보 ---
${observations}

--- 지시 ---
위 정보를 종합하여 사용자에게 최종 응답을 작성해주세요.
반드시 다음 JSON 형식으로 응답하세요:
{"message": "한국어 응답", "actions": []}`;

        try {
            const content = await this.callLLM(systemPrompt, fallbackPrompt);
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    message: parsed.message || content,
                    actions: parsed.actions || [],
                };
            }
            return { message: content, actions: [] };
        } catch (error) {
            console.error('[ReActBrain] Fallback generation failed:', error);
        }

        // 최후의 폴백
        const lastObservation = scratchpad[scratchpad.length - 1]?.observation || '';
        return {
            message: `요청을 처리하다가 시간이 부족했어요. 지금까지 확인한 내용이에요:\n${lastObservation}`,
            actions: [],
        };
    }
}

// ================================================
// 복잡 요청 감지 유틸리티
// ================================================

/**
 * 복합 요청인지 판단 (ReAct 분기 기준)
 */
export function isComplexRequest(messages: Array<{ role: string; content: string }>): boolean {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') return false;

    const text = lastMessage.content;

    // 15자 미만이면 단순
    if (text.length < 15) return false;

    const complexPatterns = [
        /준비해\s?줘/,
        /분석해\s?줘/,
        /계획\s?세워/,
        /계획\s?짜/,
        /먼저.{2,}그리고/,
        /비교해\s?줘/,
        /정리해\s?줘/,
        /체크리스트/,
        /어떻게.{3,}할까/,
        /뭐.{2,}해야/,
    ];

    return complexPatterns.some(pattern => pattern.test(text));
}

/**
 * 단순 인사/응답인지 판단
 */
export function isSimpleResponse(messages: Array<{ role: string; content: string }>): boolean {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') return false;

    const text = lastMessage.content.trim();

    // 5자 이하 단답
    if (text.length <= 5) return true;

    const simplePatterns = [
        /^안녕/,
        /^네$/,
        /^응$/,
        /^아니/,
        /^고마워/,
        /^감사/,
        /^ㅎㅎ/,
        /^ㅋㅋ/,
        /^오키/,
        /^ㅇㅇ$/,
        /^좋아$/,
        /^그래$/,
        /^알겠어/,
    ];

    return simplePatterns.some(pattern => pattern.test(text));
}
