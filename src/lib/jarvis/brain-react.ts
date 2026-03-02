/**
 * Jarvis ReAct Brain
 * Reason → Act → Observe 에이전트 루프
 *
 * 복합 요청 시 활성화 (전 플랜)
 * - 다단계 추론: 도구를 순차적으로 호출하며 문제 해결
 * - 플랜별 반복 제한: Free=3, Pro=3, Max=5
 * - respond_to_user 호출 시 루프 종료
 *
 * 플랜별 모델 (비용 최적화):
 * - Free: GPT-5-mini (저비용)
 * - Pro:  GPT-5-mini (구조화 프롬프트 + 코드 검증으로 품질 보정)
 * - Max:  Claude Sonnet 4.5 (에이전트 최강, input $3으로 GPT-5.2 $5보다 저렴)
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { PlanType } from '@/types/jarvis';
import { getAvailableTools, ToolDefinition, ToolCall, ToolResult } from './tools';
import { ToolExecutor } from './tool-executor';
import { reactCircuit } from '@/lib/circuit-breaker';
import { getPersonaBlock, resolvePersonaStyle, type PersonaStyle } from '@/lib/prompts/persona';
import { MODELS } from "@/lib/models";
import { logger } from '@/lib/logger';
import { SAFETY_SYSTEM_RULES } from '@/lib/content-safety';

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
    Pro:      { maxIterations: 3, model: MODELS.GPT_5_MINI, provider: 'openai' },
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
    private complexity: ComplexityLevel = 2; // 기본값: 복합

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
     * @param input - 입력 데이터
     * @param complexityOverride - 복잡도 레벨 (1=중간, 2=복합). 지정 시 maxIterations 동적 조정
     */
    async run(input: ReActInput, complexityOverride?: ComplexityLevel): Promise<ReActResult> {
        // 복잡도 기반 동적 반복 제한
        if (complexityOverride !== undefined) {
            this.complexity = complexityOverride;
        }
        const effectiveMaxIterations = this.complexity === 1
            ? Math.min(this.config.maxIterations, 2) // 중간 복잡도: 최대 2회
            : this.config.maxIterations;              // 복합: 플랜 기본값

        const systemPrompt = this.buildSystemPrompt(input);
        const userMessage = this.buildUserMessage(input);
        const scratchpad: ReActStep[] = [];
        let totalLlmCalls = 0;
        let wasTerminatedEarly = false;
        const loopStartTime = Date.now();
        const LOOP_TIMEOUT = 50000; // 전체 루프 50초 제한 (Vercel 60s 내에 응답 필수)

        for (let i = 0; i < effectiveMaxIterations; i++) {
            // 전체 루프 타임아웃 체크 (남은 시간이 LLM 1회 호출 불가능하면 종료)
            const elapsed = Date.now() - loopStartTime;
            if (elapsed > LOOP_TIMEOUT) {
                logger.warn(`[ReActBrain] Loop timeout reached after ${i} iterations (${elapsed}ms)`);
                wasTerminatedEarly = true;
                break;
            }
            // 1. LLM 호출 (1회 재시도, 남은 시간 기반 동적 타임아웃)
            const prompt = this.buildIterationPrompt(userMessage, scratchpad);

            let llmResponse: string | null = null;
            let lastError: unknown = null;
            const MAX_RETRIES = 1; // 2→1: 타임아웃 캐스케이드 방지

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                // 남은 시간 기반 동적 타임아웃 (최소 8초, 최대 20초)
                const remainingMs = LOOP_TIMEOUT - (Date.now() - loopStartTime);
                if (remainingMs < 5000) {
                    logger.warn(`[ReActBrain] Not enough time for LLM call (${remainingMs}ms remaining)`);
                    wasTerminatedEarly = true;
                    break;
                }
                const dynamicTimeout = Math.min(Math.max(remainingMs - 3000, 8000), 20000);

                try {
                    llmResponse = await this.callLLM(systemPrompt, prompt, dynamicTimeout);
                    totalLlmCalls++;
                    break;
                } catch (error) {
                    lastError = error;
                    const errorType = classifyError(error);

                    if (errorType === 'permanent') {
                        logger.error(`[ReActBrain] Permanent error at step ${i + 1}, aborting:`, error);
                        wasTerminatedEarly = true;
                        break;
                    }

                    if (attempt < MAX_RETRIES) {
                        const backoffMs = 500;
                        logger.warn(`[ReActBrain] ${errorType} error at step ${i + 1}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
                        await new Promise(resolve => setTimeout(resolve, backoffMs));
                    } else {
                        logger.error(`[ReActBrain] All retries exhausted at step ${i + 1}:`, error);
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
                logger.error(`[ReActBrain] Failed to parse response at step ${i + 1}, generating fallback`);
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

            // 2.5. LLM 출력 검증 & 자동 수정
            const context = { currentDate: input.context.currentDate, currentTime: input.context.currentTime };
            parsed.actionInput = this.validateAndFixActionInput(parsed.action, parsed.actionInput, context);
            if (parsed.parallelActions) {
                parsed.parallelActions = parsed.parallelActions.map(pa => ({
                    ...pa,
                    actionInput: this.validateAndFixActionInput(pa.action, pa.actionInput, context),
                }));
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

            // 4. 도구 실행 (병렬 지원, 타임아웃 포함)
            const TOOL_TIMEOUT = 15000; // 도구 실행 15초 제한
            const executeWithTimeout = async (tc: ToolCall): Promise<ToolResult> => {
                try {
                    return await Promise.race([
                        this.toolExecutor.execute(tc),
                        new Promise<ToolResult>((_, reject) =>
                            setTimeout(() => reject(new Error(`Tool "${tc.toolName}" timed out (${TOOL_TIMEOUT / 1000}s)`)), TOOL_TIMEOUT)
                        ),
                    ]);
                } catch (error) {
                    return {
                        success: false,
                        error: String(error),
                        humanReadableSummary: `도구 실행 실패: ${error instanceof Error ? error.message : String(error)}`,
                    };
                }
            };

            if (parsed.parallelActions && parsed.parallelActions.length > 0) {
                // 메인 액션 + 병렬 액션 모두 동시 실행
                const allActions = [
                    { action: parsed.action, actionInput: parsed.actionInput },
                    ...parsed.parallelActions,
                ];
                const results = await Promise.all(
                    allActions.map(pa => executeWithTimeout({ toolName: pa.action, arguments: pa.actionInput }))
                );

                const observations = allActions.map((pa, idx) =>
                    `[${pa.action}] ${results[idx].humanReadableSummary}`
                ).join('\n');

                const step: ReActStep = {
                    thought: parsed.thought,
                    action: allActions.map(pa => pa.action).join('+'),
                    actionInput: { parallel: allActions },
                    observation: observations,
                };
                scratchpad.push(step);
            } else {
                // 단일 실행
                const toolCall: ToolCall = {
                    toolName: parsed.action,
                    arguments: parsed.actionInput,
                };

                const result = await executeWithTimeout(toolCall);

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
            const remainingForFallback = LOOP_TIMEOUT - (Date.now() - loopStartTime);
            if (remainingForFallback > 5000) {
                // 남은 시간이 충분하면 LLM fallback 생성
                const fallbackResult = await this.generateFallbackResponse(
                    systemPrompt, userMessage, scratchpad, Math.min(remainingForFallback - 2000, 15000)
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

            // 남은 시간 부족 → scratchpad에서 직접 응답 조립
            const lastStep = scratchpad[scratchpad.length - 1];
            return {
                message: lastStep.observation || '요청을 처리하다가 시간이 부족했어요. 다시 시도해주세요.',
                actions: [],
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
    private async callLLM(systemPrompt: string, userPrompt: string, timeoutMs?: number): Promise<string> {
        const LLM_TIMEOUT = timeoutMs || 20000; // 동적 타임아웃 (기본 20초)

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
        const response = await reactCircuit.execute(() =>
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
            logger.error(`[ReActBrain] Empty OpenAI response — finish_reason: ${reason}, refusal: ${refusal || 'none'}, model: ${this.config.model}`);
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

        // 도구 설명 압축: 필수 파라미터만 표시, 설명 간결화
        const toolDescriptions = this.availableTools
            .map(t => {
                const requiredParams = t.parameters.filter(p => p.required);
                const params = requiredParams.length > 0
                    ? ` (${requiredParams.map(p => `${p.name}: ${p.type}`).join(', ')})`
                    : '';
                return `  - ${t.name}${params}: ${t.description}`;
            })
            .join('\n');

        const maxSteps = this.complexity === 1 ? Math.min(this.config.maxIterations, 2) : this.config.maxIterations;
        const simpleHint = this.complexity === 1 ? '\n⚡ 이 요청은 단순합니다. 1단계에서 도구 실행 후 바로 respond_to_user하세요.' : '';

        // 내일/모레 날짜 계산
        const [cy, cm, cd] = input.context.currentDate.split('-').map(Number);
        const tomorrowD = new Date(cy, cm - 1, cd + 1);
        const tomorrowStr = `${tomorrowD.getFullYear()}-${String(tomorrowD.getMonth() + 1).padStart(2, '0')}-${String(tomorrowD.getDate()).padStart(2, '0')}`;
        const dayAfterD = new Date(cy, cm - 1, cd + 2);
        const dayAfterStr = `${dayAfterD.getFullYear()}-${String(dayAfterD.getMonth() + 1).padStart(2, '0')}-${String(dayAfterD.getDate()).padStart(2, '0')}`;

        return `${personaBlock}

---

당신은 ReAct 에이전트입니다. JSON으로만 응답하세요.${simpleHint}

## 도구 목록
${toolDescriptions}

## 📅 날짜 매핑 (specificDate에 반드시 이 값을 사용)
- 오늘 → "${input.context.currentDate}"
- 내일 → "${tomorrowStr}"
- 모레 → "${dayAfterStr}"

## 의사결정 트리 (이 순서대로 판단)

1. 사용자가 일정 추가를 요청? (잡아줘/등록해줘/추가해줘/넣어줘)
   → action: "add_schedule", actionInput: {text, startTime, endTime, specificDate: "해당 날짜"}
   → "내일"이면 specificDate: "${tomorrowStr}", "모레"면 specificDate: "${dayAfterStr}", 기본은 "${input.context.currentDate}"
   → endTime 없으면 startTime + 1시간

2. 사용자가 일정 삭제를 요청? (삭제해줘/지워줘/취소해줘/빼줘)
   → action: "delete_schedule", actionInput: {text, startTime}

3. 사용자가 일정 수정을 요청? (바꿔줘/옮겨줘/변경해줘)
   → action: "update_schedule", actionInput: {originalText, originalTime, newText?, newStartTime?}

4. 사용자가 일정 조회를 요청? (보여줘/알려줘/뭐 있어)
   → action: "get_today_schedules" 또는 "get_schedule_by_date"

5. 사용자가 목표 관련 요청?
   → 추가: "add_goal", 조회: "get_goals", 업데이트: "update_goal"

6. 사용자가 분석/추천/준비 등 복합 요청?
   → 적절한 도구 사용 (get_smart_suggestions, get_prep_advice, get_habit_insights 등)

7. 도구 실행 후 또는 정보가 충분하면?
   → action: "respond_to_user", actionInput: {message: "한국어 완료형 메시지", actions: []}

## JSON 형식

단일 도구: {"thought": "판단", "action": "도구명", "actionInput": {파라미터}}
병렬 도구: {"thought": "판단", "actions": [{"action": "도구1", "actionInput": {}}, {"action": "도구2", "actionInput": {}}]}

## 필수 규칙

- **즉시 실행**: 추가/삭제/수정 요청은 조회 없이 바로 도구 호출
- **최대 ${maxSteps}단계** 내에 respond_to_user 필수
- **완료형 어미**: "추가했어요" (O) / "추가해드릴게요" (X)
- **간결 응답**: 2-3문장. 묻지 않은 추천/조언 금지
- **일정 이름 정규화**: 아침→"아침 식사", 점심→"점심 식사", 저녁→"저녁 식사", 잠→"취침", 일어나→"기상", 헬스→"운동"
- **반복 일정**: 매일=[0,1,2,3,4,5,6], 평일=[1,2,3,4,5], 주말=[0,6]. specificDate와 daysOfWeek 중 하나만
- **시간 추론**: 사용자가 "5시", "3시"처럼 오전/오후 없이 시간만 말하면 **24시간 형식(HH:MM)**으로 변환할 때 현재 시각 기준으로 추론하세요:
  - 해당 시각이 현재 시간보다 과거라면 → 12시간을 더해서 오후로 해석 (예: 현재 11:00, "5시" → "17:00")
  - 해당 시각이 현재 시간보다 미래라면 → 그대로 사용 (예: 현재 03:00, "5시" → "05:00")
  - 내일/미래 날짜 일정이면 상식적으로 판단 (예: "내일 7시 기상" → "07:00", "내일 6시 저녁" → "18:00")
- **삭제/수정**: text+startTime 필수 (update는 originalText+originalTime)
- **존재하지 않는 일정을 "이미 있다"고 하지 마세요**
- **respond_to_user의 actions**: [{type: "add_schedule", label: "일정 추가", data: {text, startTime, ...}}]

${SAFETY_SYSTEM_RULES}

## 예시

입력: "오후 3시에 운동 잡아줘"
출력: {"thought": "운동 일정 추가", "action": "add_schedule", "actionInput": {"text": "운동", "startTime": "15:00", "endTime": "16:00", "specificDate": "${input.context.currentDate}"}}

(Observation: "운동" 일정을 15:00에 추가했습니다.)
출력: {"thought": "완료", "action": "respond_to_user", "actionInput": {"message": "오후 3시 운동 추가했어요! 💪", "actions": []}}

입력: "내일 5시에 기상 잡아줘"
출력: {"thought": "내일 기상 일정 추가. 기상은 아침이므로 05:00", "action": "add_schedule", "actionInput": {"text": "기상", "startTime": "05:00", "endTime": "06:00", "specificDate": "${tomorrowStr}"}}

입력: "아침 루틴 삭제해줘"
출력: {"thought": "삭제", "action": "delete_schedule", "actionInput": {"text": "아침 루틴", "startTime": "07:00"}}

입력: "오늘 일정 보여줘"
출력: {"thought": "조회", "action": "get_today_schedules", "actionInput": {}}

입력: "이번 주 목표로 운동 3회 추가해줘"
출력: {"thought": "목표 추가", "action": "add_goal", "actionInput": {"title": "운동 3회", "type": "weekly", "category": "health"}}`;
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
    // LLM 출력 검증 & 자동 수정 (GPT-5-mini 품질 보정)
    // ================================================

    /**
     * GPT-5-mini가 자주 누락하는 파라미터를 코드로 보정
     */
    private validateAndFixActionInput(
        action: string,
        actionInput: Record<string, any>,
        context: { currentDate: string; currentTime: string }
    ): Record<string, any> {
        const fixed = { ...actionInput };

        if (action === 'add_schedule') {
            // specificDate 누락 → 오늘 날짜
            if (!fixed.specificDate && !fixed.daysOfWeek) {
                fixed.specificDate = context.currentDate;
            }

            // 내일/미래 일정이면 AM/PM 추론 스킵 (LLM이 활동명으로 판단)
            const isNotToday = fixed.specificDate && fixed.specificDate !== context.currentDate;

            // startTime 포맷 수정 (예: "3시" → "15:00", "15" → "15:00")
            if (fixed.startTime) {
                fixed.startTime = this.normalizeTime(fixed.startTime, context.currentTime, isNotToday);
            }

            // endTime 누락 → startTime + 1시간
            if (fixed.startTime && !fixed.endTime) {
                const [h, m] = fixed.startTime.split(':').map(Number);
                fixed.endTime = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }

            // 일정 이름 정규화
            if (fixed.text) {
                fixed.text = this.normalizeScheduleName(fixed.text);
            }
        }

        if (action === 'delete_schedule' || action === 'update_schedule') {
            // 삭제/수정은 기존 일정 시간 참조 → AM/PM 추론 스킵
            if (fixed.startTime) {
                fixed.startTime = this.normalizeTime(fixed.startTime, context.currentTime, true);
            }
            if (fixed.originalTime) {
                fixed.originalTime = this.normalizeTime(fixed.originalTime, context.currentTime, true);
            }
            if (fixed.newStartTime) {
                fixed.newStartTime = this.normalizeTime(fixed.newStartTime, context.currentTime, true);
            }
            // 텍스트 정규화
            if (fixed.text) fixed.text = this.normalizeScheduleName(fixed.text);
            if (fixed.originalText) fixed.originalText = this.normalizeScheduleName(fixed.originalText);
            if (fixed.newText) fixed.newText = this.normalizeScheduleName(fixed.newText);
        }

        if (action === 'get_schedule_by_date') {
            // 날짜 포맷 검증 (YYYY-MM-DD)
            if (fixed.date && !/^\d{4}-\d{2}-\d{2}$/.test(fixed.date)) {
                fixed.date = context.currentDate;
            }
        }

        if (action === 'add_goal') {
            // type 검증
            if (!['weekly', 'monthly', 'yearly'].includes(fixed.type)) {
                fixed.type = 'weekly'; // 기본값
            }
        }

        return fixed;
    }

    /**
     * 시간 문자열 정규화 → HH:MM
     * @param skipInference true면 AM/PM 추론 스킵 (삭제/수정/내일 일정)
     */
    private normalizeTime(time: string, currentTime: string, skipInference = false): string {
        // 이미 HH:MM 형식 → 범위 검증 후 반환
        if (/^\d{2}:\d{2}$/.test(time)) {
            const [h, m] = time.split(':').map(Number);
            if (h > 23 || m > 59) return '09:00'; // 범위 초과 → 기본값
            return skipInference ? time : this.inferAmPm(time, currentTime);
        }

        // "15:0" → "15:00"
        const colonMatch = time.match(/^(\d{1,2}):(\d{1,2})$/);
        if (colonMatch) {
            const h = parseInt(colonMatch[1]);
            const m = parseInt(colonMatch[2]);
            if (h > 23 || m > 59) return '09:00'; // 범위 초과 → 기본값
            const result = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            return skipInference ? result : this.inferAmPm(result, currentTime);
        }

        // "15" → "15:00"
        const hourOnly = time.match(/^(\d{1,2})$/);
        if (hourOnly) {
            const h = parseInt(hourOnly[1]);
            if (h > 23) return '09:00'; // 범위 초과 → 기본값
            const result = `${String(h).padStart(2, '0')}:00`;
            return skipInference ? result : this.inferAmPm(result, currentTime);
        }

        // "오후 3시" → "15:00" (명시적 오전/오후 → 추론 불필요)
        const koreanMatch = time.match(/(오전|오후)\s*(\d{1,2})시?\s*(\d{1,2})?분?/);
        if (koreanMatch) {
            let h = parseInt(koreanMatch[2]);
            if (koreanMatch[1] === '오후' && h < 12) h += 12;
            if (koreanMatch[1] === '오전' && h === 12) h = 0;
            const m = koreanMatch[3] ? parseInt(koreanMatch[3]) : 0;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        return time; // 수정 불가 → 그대로 반환
    }

    /**
     * 오전/오후 미지정 시간 추론: 1-12시 범위이고 현재 시간보다 과거면 +12시간
     * 예: 현재 11:00, "05:00" → "17:00" (이미 지난 시간이므로 오후로 추론)
     * 예: 현재 03:00, "05:00" → "05:00" (아직 안 지난 시간이므로 그대로)
     * 13시 이상이면 이미 24시간 형식이므로 추론 불필요
     */
    private inferAmPm(time: string, currentTime: string): string {
        const [h, m] = time.split(':').map(Number);

        // 13시 이상이면 이미 명확한 24시간 형식
        if (h >= 13) return time;
        // 0시는 자정이므로 추론하지 않음
        if (h === 0) return time;

        const [currentH] = currentTime.split(':').map(Number);
        const timeMinutes = h * 60 + (m || 0);
        const currentMinutes = currentH * 60;

        // 현재 시간보다 과거(이미 지남)이고 +12시간이 23시 이하면 오후로 추론
        if (timeMinutes < currentMinutes && (h + 12) <= 23) {
            return `${String(h + 12).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        return time;
    }

    /**
     * 일정 이름 정규화
     */
    private normalizeScheduleName(name: string): string {
        const map: Record<string, string> = {
            '아침': '아침 식사', '점심': '점심 식사', '저녁': '저녁 식사',
            '잠': '취침', '자기': '취침', '수면': '취침',
            '일어나기': '기상', '기상하기': '기상',
            '헬스': '운동',
        };
        const trimmed = name.trim();
        return map[trimmed] || trimmed;
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
                    logger.error('[ReActBrain] No valid tools in parallel actions');
                    return null;
                }
                // 첫 번째를 메인으로, 2번째부터를 parallelActions로
                return {
                    thought: parsed.thought || '',
                    action: validActions[0].action,
                    actionInput: validActions[0].actionInput || {},
                    parallelActions: validActions.length > 1 ? validActions.slice(1) : undefined,
                };
            }

            // 단일 액션 형식: {"thought": "...", "action": "...", "actionInput": {...}}
            if (parsed.action) {
                const validTool = this.availableTools.find(t => t.name === parsed.action);
                if (!validTool) {
                    logger.error(`[ReActBrain] Unknown tool: ${parsed.action}`);
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
                logger.error('[ReActBrain] No Action found in response (legacy)');
                return null;
            }
            const action = actionMatch[1].trim();

            // ActionInput 추출
            const inputMatch = text.match(/ActionInput:\s*([\s\S]*?)$/);
            if (!inputMatch) {
                logger.error('[ReActBrain] No ActionInput found in response (legacy)');
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
                logger.error('[ReActBrain] Failed to parse ActionInput JSON (legacy)');
                actionInput = {};
            }

            // 도구 유효성 확인
            const validTool = this.availableTools.find(t => t.name === action);
            if (!validTool) {
                logger.error(`[ReActBrain] Unknown tool: ${action} (legacy)`);
                return null;
            }

            return { thought, action, actionInput };
        } catch (error) {
            logger.error('[ReActBrain] Legacy parse error:', error);
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
        scratchpad: ReActStep[],
        timeoutMs?: number
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
            const content = await this.callLLM(systemPrompt, fallbackPrompt, timeoutMs);
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
            logger.error('[ReActBrain] Fallback generation failed:', error);
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
 * 요청 복잡도 수준 (ReAct 반복 제한에 사용)
 * - 0: 단순 (ReAct 미사용)
 * - 1: 중간 (일정 추가/삭제/조회 등 단일 도구 호출) → 최대 2회 반복
 * - 2: 복합 (분석, 계획 수립, 다단계 추론 필요) → 플랜 기본 maxIterations 사용
 */
export type ComplexityLevel = 0 | 1 | 2;

/**
 * 복합 요청인지 판단 (ReAct 분기 기준)
 */
export function isComplexRequest(messages: Array<{ role: string; content: string }>): boolean {
    return getRequestComplexity(messages) > 0;
}

/**
 * 요청 복잡도 수준 반환
 */
export function getRequestComplexity(messages: Array<{ role: string; content: string }>): ComplexityLevel {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') return 0;

    const text = lastMessage.content;

    // 10자 미만이면 단순
    if (text.length < 10) return 0;

    // 복합 키워드가 포함되면 단순 CRUD 아님
    const hasCompoundKeyword = /먼저|그리고|다음에|그런 다음|그 후에/.test(text);

    // 단순 일정 CRUD는 단발 GPT가 더 빠르고 정확 → complexity 0
    // 복합 키워드 없이 CRUD 접미사로 끝나면 단순 요청
    if (!hasCompoundKeyword) {
        const simpleCrudPatterns = [
            /(잡아|추가해?|등록해?|넣어|만들어)\s*(줘|줘요|주세요|줄래)?$/,
            /(삭제해?|지워|취소해?|빼)\s*(줘|줘요|주세요|줄래)?$/,
            /(바꿔|옮겨|변경해)\s*(줘|줘요|주세요|줄래)?$/,
            /(완료|했어|끝났어|끝|다 했어)$/,
        ];
        if (simpleCrudPatterns.some(pattern => pattern.test(text)) && text.length < 80) return 0;
    }

    // 레벨 2: 다단계 추론/분석이 필요한 복합 요청
    const highComplexPatterns = [
        






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

    if (highComplexPatterns.some(pattern => pattern.test(text))) return 2;

    // 레벨 1: 단일 도구 호출이 필요한 중간 복잡도 (조회 후 응답 등)
    const midComplexPatterns = [
        /보여\s?줘/,
        /알려\s?줘/,
        /어때/,
        /확인해/,
        /검색해/,
        /찾아/,
        /추천해/,
        /일정.{0,5}(추가|잡아|등록|넣어|만들어)/,
        /일정.{0,5}(삭제|지워|취소|빼)/,
        /일정.{0,5}(변경|수정|바꿔|옮겨)/,
        /목표.{0,5}(추가|세워|만들어)/,
    ];

    if (midComplexPatterns.some(pattern => pattern.test(text))) return 1;

    return 0;
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
