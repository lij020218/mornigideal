/**
 * Agent Capability Registry
 *
 * 특화 에이전트 핵심 로직을 callable capability로 등록.
 * API 라우트, ReAct 도구, Jarvis Hands에서 공유 호출 가능.
 */

export type CostTier = 'free' | 'cheap' | 'moderate' | 'expensive';

export interface CapabilityResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    costTier: CostTier;
    cachedHit: boolean;
}

export interface CapabilityDefinition<TParams = unknown, TResult = unknown> {
    name: string;
    description: string;
    costTier: CostTier;
    execute: (email: string, params: TParams) => Promise<CapabilityResult<TResult>>;
}

// === Registry ===

const registry = new Map<string, CapabilityDefinition>();

export function registerCapability<TParams, TResult>(
    def: CapabilityDefinition<TParams, TResult>
): void {
    registry.set(def.name, def as CapabilityDefinition);
}

export async function executeCapability<T = unknown>(
    name: string,
    email: string,
    params: unknown
): Promise<CapabilityResult<T>> {
    const cap = registry.get(name);
    if (!cap) {
        return { success: false, error: `Unknown capability: ${name}`, costTier: 'free', cachedHit: false };
    }
    return cap.execute(email, params) as Promise<CapabilityResult<T>>;
}

export function getRegisteredCapabilities(): string[] {
    return Array.from(registry.keys());
}

// === Capability Parameter/Result Types ===

export interface SmartSuggestionsParams {
    requestCount?: number;
    currentHour?: number;
}

export interface ScheduleSuggestion {
    id?: string;
    title: string;
    description: string;
    action: string;
    category: string;
    estimatedTime: string;
    priority: string;
    icon: string;
}

export interface SmartSuggestionsResult {
    suggestions: ScheduleSuggestion[];
}

export interface SchedulePrepParams {
    scheduleText: string;
    startTime?: string;
    timeUntil?: number;
}

export interface SchedulePrepResult {
    advice: string;
    prepType: string;
}

export interface HabitInsightsParams {
    // no params needed
}

export interface HabitInsightsResult {
    insight: string;
    suggestion: string;
    emoji: string;
    category: string;
}

export interface ResourceRecommendParams {
    activity: string;
    category?: string;
    context?: string;
    timeUntil?: number;
}

export interface ResourceRecommendResult {
    recommendation: string;
    actions: unknown[];
    activity: string;
}
