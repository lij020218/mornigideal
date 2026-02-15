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
import { getPersonaBlock, resolvePersonaStyle, type PersonaStyle } from '@/lib/prompts/persona';
import { MODELS } from "@/lib/models";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
    maxTokens: number;
    provider: LLMProvider;
}> = {
    Free:     { maxIterations: 2, model: MODELS.GPT_5_MINI, maxTokens: 1024, provider: 'openai' },
    Pro:      { maxIterations: 3, model: MODELS.GPT_5_2,    maxTokens: 2048, provider: 'openai' },
    Max:      { maxIterations: 5, model: MODELS.CLAUDE_SONNET_4_5, maxTokens: 2048, provider: 'anthropic' },
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
    private config: { maxIterations: number; model: string; maxTokens: number; provider: LLMProvider };

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

        for (let i = 0; i < this.config.maxIterations; i++) {
            // 1. LLM 호출
            const prompt = this.buildIterationPrompt(userMessage, scratchpad);

            let llmResponse: string;
            try {
                llmResponse = await this.callLLM(systemPrompt, prompt);
                totalLlmCalls++;
            } catch (error) {
                console.error(`[ReActBrain] LLM call failed at step ${i + 1}:`, error);
                wasTerminatedEarly = true;
                break;
            }

            // 2. 응답 파싱
            const parsed = this.parseReActResponse(llmResponse);

            if (!parsed) {
                console.error(`[ReActBrain] Failed to parse response at step ${i + 1}`);
                wasTerminatedEarly = true;
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

            // 4. 도구 실행
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
     * 플랜별 프로바이더에 따라 LLM 호출
     */
    private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
        if (this.config.provider === 'anthropic' && anthropic) {
            const response = await anthropic.messages.create({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                temperature: 0.3,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            });
            const content = response.content[0];
            if (content.type !== 'text' || !content.text) {
                throw new Error('Empty response from Anthropic');
            }
            return content.text;
        }

        // OpenAI (Free, Pro, 또는 Anthropic 폴백)
        const response = await openai.chat.completions.create({
            model: this.config.model,
            max_completion_tokens: this.config.maxTokens,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        });
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
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
매 단계마다 다음 형식으로 응답하세요:

Thought: [현재 상황 분석, 다음에 무엇을 해야 할지 추론]
Action: [사용할 도구 이름]
ActionInput: [JSON 형식 파라미터]

## 규칙:
1. 한 번에 하나의 Action만 수행하세요
2. Observation(도구 실행 결과)을 확인한 후 다음 단계를 결정하세요
3. 충분한 정보를 모았으면 반드시 "respond_to_user" 도구로 최종 응답을 전달하세요
4. respond_to_user의 message는 반드시 한국어로, 사용자에게 직접 말하는 1인칭 형식이어야 합니다
5. respond_to_user의 actions 배열에는 프론트엔드 액션 버튼 정보를 포함할 수 있습니다
   - 일정 추가: { "type": "add_schedule", "label": "일정 추가", "data": { "text": "...", "startTime": "HH:MM", ... } }
   - 일정 삭제: { "type": "delete_schedule", "label": "일정 삭제", "data": { "text": "..." } }
6. 최대 ${this.config.maxIterations}단계 내에 반드시 respond_to_user를 호출해야 합니다
7. 불필요한 도구 호출을 하지 마세요. 이미 알고 있는 정보는 바로 활용하세요

## ActionInput JSON 예시:
Thought: 사용자가 오늘 일정을 물어보고 있으니, 먼저 오늘 일정을 조회해야 한다.
Action: get_today_schedules
ActionInput: {}

Thought: 일정을 확인했고, 사용자에게 결과를 전달할 준비가 됐다.
Action: respond_to_user
ActionInput: {"message": "오늘 일정은 3개가 있어요!", "actions": []}`;
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

        const scratchpadText = scratchpad
            .map((step, i) => {
                return `Thought: ${step.thought}
Action: ${step.action}
ActionInput: ${JSON.stringify(step.actionInput)}
Observation: ${step.observation}`;
            })
            .join('\n\n');

        return `${userMessage}

--- 이전 단계 ---
${scratchpadText}

--- 다음 단계 ---
위 Observation을 참고하여 다음 Thought/Action/ActionInput을 결정하세요.`;
    }

    // ================================================
    // 응답 파싱
    // ================================================

    private parseReActResponse(text: string): {
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
                console.error('[ReActBrain] No Action found in response');
                return null;
            }
            const action = actionMatch[1].trim();

            // ActionInput 추출
            const inputMatch = text.match(/ActionInput:\s*([\s\S]*?)$/);
            if (!inputMatch) {
                console.error('[ReActBrain] No ActionInput found in response');
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
                console.error('[ReActBrain] Failed to parse ActionInput JSON');
                actionInput = {};
            }

            // 도구 유효성 확인
            const validTool = this.availableTools.find(t => t.name === action);
            if (!validTool) {
                console.error(`[ReActBrain] Unknown tool: ${action}`);
                return null;
            }

            return { thought, action, actionInput };
        } catch (error) {
            console.error('[ReActBrain] Parse error:', error);
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
