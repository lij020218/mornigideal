/**
 * Hybrid Model Switching Service - Clawdbot 스타일
 *
 * 작업 복잡도에 따라 최적의 AI 모델 자동 선택
 * - 복잡한 계획/분석: Claude Opus (고가)
 * - 일반 대화: Claude Sonnet / GPT-4o (중가)
 * - 간단한 작업: Gemini Flash / GPT-4o-mini (저가)
 * - 요약: Claude Haiku (최저가)
 */

export type ModelTier = 'premium' | 'standard' | 'economy' | 'minimal';

export interface ModelConfig {
    id: string;
    name: string;
    tier: ModelTier;
    costPer1kTokens: number; // USD
    maxTokens: number;
    strengths: string[];
}

export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
    // Premium tier - 복잡한 추론, 계획
    'claude-opus': {
        id: 'claude-3-opus-20240229',
        name: 'Claude Opus',
        tier: 'premium',
        costPer1kTokens: 0.015,
        maxTokens: 4096,
        strengths: ['복잡한 추론', '장기 계획', '코드 생성', '창작']
    },
    'gpt-4o': {
        id: 'gpt-4o',
        name: 'GPT-4o',
        tier: 'premium',
        costPer1kTokens: 0.01,
        maxTokens: 4096,
        strengths: ['멀티모달', '빠른 응답', '일반 대화']
    },

    // Standard tier - 일반 작업
    'claude-sonnet': {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude Sonnet',
        tier: 'standard',
        costPer1kTokens: 0.003,
        maxTokens: 4096,
        strengths: ['균형잡힌 성능', '코딩', '분석']
    },
    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        tier: 'standard',
        costPer1kTokens: 0.00015,
        maxTokens: 4096,
        strengths: ['빠른 응답', '간단한 대화', '비용 효율']
    },

    // Economy tier - 간단한 작업
    'gemini-flash': {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini Flash',
        tier: 'economy',
        costPer1kTokens: 0.0001,
        maxTokens: 8192,
        strengths: ['빠른 응답', '긴 컨텍스트', '무료 티어']
    },

    // Minimal tier - 요약, 분류
    'claude-haiku': {
        id: 'claude-3-haiku-20240307',
        name: 'Claude Haiku',
        tier: 'minimal',
        costPer1kTokens: 0.00025,
        maxTokens: 4096,
        strengths: ['빠른 응답', '요약', '분류']
    }
};

export type TaskType =
    | 'complex_planning'    // 복잡한 계획 수립
    | 'code_generation'     // 코드 생성
    | 'analysis'            // 분석
    | 'general_chat'        // 일반 대화
    | 'simple_question'     // 간단한 질문
    | 'summarization'       // 요약
    | 'classification'      // 분류
    | 'schedule_advice'     // 일정 조언
    | 'morning_greeting'    // 아침 인사
    | 'evening_check';      // 저녁 회고

// 작업 유형별 권장 모델 티어
const TASK_TIER_MAPPING: Record<TaskType, ModelTier> = {
    complex_planning: 'premium',
    code_generation: 'premium',
    analysis: 'standard',
    general_chat: 'standard',
    simple_question: 'economy',
    summarization: 'minimal',
    classification: 'minimal',
    schedule_advice: 'economy',
    morning_greeting: 'economy',
    evening_check: 'economy'
};

// 텍스트에서 작업 유형 추론
export function inferTaskType(userMessage: string): TaskType {
    const lowerMsg = userMessage.toLowerCase();

    // 복잡한 계획
    if (lowerMsg.includes('계획') && (lowerMsg.includes('세워') || lowerMsg.includes('짜줘') || lowerMsg.includes('만들어'))) {
        return 'complex_planning';
    }

    // 코드 관련
    if (lowerMsg.includes('코드') || lowerMsg.includes('프로그램') || lowerMsg.includes('함수') || lowerMsg.includes('구현')) {
        return 'code_generation';
    }

    // 분석
    if (lowerMsg.includes('분석') || lowerMsg.includes('비교') || lowerMsg.includes('평가')) {
        return 'analysis';
    }

    // 요약
    if (lowerMsg.includes('요약') || lowerMsg.includes('정리') || lowerMsg.includes('줄여')) {
        return 'summarization';
    }

    // 간단한 질문 (짧은 메시지)
    if (userMessage.length < 30 || lowerMsg.includes('뭐야') || lowerMsg.includes('알려줘')) {
        return 'simple_question';
    }

    // 일정 관련
    if (lowerMsg.includes('일정') || lowerMsg.includes('스케줄') || lowerMsg.includes('추천')) {
        return 'schedule_advice';
    }

    return 'general_chat';
}

// 모델 선택
export function selectModel(
    taskType: TaskType,
    options?: {
        preferredProvider?: 'openai' | 'anthropic' | 'google';
        costSensitive?: boolean;
        userApiKeys?: {
            openai?: string;
            anthropic?: string;
            google?: string;
        };
    }
): ModelConfig {
    const tier = TASK_TIER_MAPPING[taskType];
    const { preferredProvider, costSensitive, userApiKeys } = options || {};

    // 사용 가능한 모델 필터링
    let availableModels = Object.values(AVAILABLE_MODELS).filter(m => {
        if (costSensitive && m.tier === 'premium') return false;
        return true;
    });

    // 선호 제공자가 있으면 해당 모델 우선
    if (preferredProvider) {
        const providerModels: Record<string, string[]> = {
            openai: ['gpt-4o', 'gpt-4o-mini'],
            anthropic: ['claude-opus', 'claude-sonnet', 'claude-haiku'],
            google: ['gemini-flash']
        };

        const preferredModelIds = providerModels[preferredProvider] || [];
        const preferredModels = availableModels.filter(m =>
            preferredModelIds.some(id => m.id.includes(id) || Object.keys(AVAILABLE_MODELS).find(k => AVAILABLE_MODELS[k] === m && preferredModelIds.includes(k)))
        );

        if (preferredModels.length > 0) {
            availableModels = preferredModels;
        }
    }

    // 사용자 API 키가 있는 제공자의 모델만 선택
    if (userApiKeys) {
        const hasOpenAI = !!userApiKeys.openai;
        const hasAnthropic = !!userApiKeys.anthropic;
        const hasGoogle = !!userApiKeys.google;

        availableModels = availableModels.filter(m => {
            if (m.id.includes('gpt')) return hasOpenAI;
            if (m.id.includes('claude')) return hasAnthropic;
            if (m.id.includes('gemini')) return hasGoogle;
            return true;
        });
    }

    // 티어에 맞는 모델 선택
    const tierModels = availableModels.filter(m => m.tier === tier);
    if (tierModels.length > 0) {
        // 비용이 낮은 모델 우선
        return tierModels.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0];
    }

    // 티어에 맞는 모델이 없으면 한 단계 낮은 티어
    const tierOrder: ModelTier[] = ['premium', 'standard', 'economy', 'minimal'];
    const currentTierIndex = tierOrder.indexOf(tier);

    for (let i = currentTierIndex + 1; i < tierOrder.length; i++) {
        const lowerTierModels = availableModels.filter(m => m.tier === tierOrder[i]);
        if (lowerTierModels.length > 0) {
            return lowerTierModels[0];
        }
    }

    // 기본값: Gemini Flash (가장 경제적)
    return AVAILABLE_MODELS['gemini-flash'];
}

// 비용 추정
export function estimateCost(
    model: ModelConfig,
    inputTokens: number,
    outputTokens: number
): number {
    const totalTokens = inputTokens + outputTokens;
    return (totalTokens / 1000) * model.costPer1kTokens;
}

// 월간 비용 추정
export function estimateMonthlyUsage(
    dailyMessages: number,
    avgTokensPerMessage: number,
    model: ModelConfig
): { cost: number; tokens: number } {
    const monthlyMessages = dailyMessages * 30;
    const monthlyTokens = monthlyMessages * avgTokensPerMessage * 2; // input + output
    const cost = (monthlyTokens / 1000) * model.costPer1kTokens;

    return { cost, tokens: monthlyTokens };
}
