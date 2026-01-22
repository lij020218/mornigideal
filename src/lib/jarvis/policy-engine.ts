/**
 * Jarvis Policy Engine
 * "지금 개입할 가치가 있나?" 판단
 */

import { supabase } from '@/lib/supabase';
import { StateUpdater } from './state-updater';
import {
    InterventionLevel,
    InterventionDecision,
    GUARDRAILS,
    REASON_CODES,
    PLAN_CONFIGS,
    PlanType
} from '@/types/jarvis';

export class PolicyEngine {
    private userEmail: string;
    private stateUpdater: StateUpdater;

    constructor(userEmail: string) {
        this.userEmail = userEmail;
        this.stateUpdater = new StateUpdater(userEmail);
    }

    /**
     * 개입 필요성 판단 (핵심 로직)
     */
    async shouldIntervene(): Promise<InterventionDecision> {
        // 1. 사용자 플랜 확인
        const userPlan = await this.getUserPlan();
        const planConfig = PLAN_CONFIGS[userPlan as PlanType];

        if (!planConfig.enabled) {
            return { shouldIntervene: false, level: InterventionLevel.L0_OBSERVE, reasonCodes: ['plan_not_supported'], score: 0 };
        }

        // 2. AI 호출 횟수 체크 (Standard, Pro만)
        if (planConfig.aiCallsPerMonth > 0) {
            const canUseAI = await this.checkAIUsageLimit(userPlan, planConfig.aiCallsPerMonth);
            if (!canUseAI) {
                console.log('[PolicyEngine] AI usage limit exceeded');
                return { shouldIntervene: false, level: InterventionLevel.L0_OBSERVE, reasonCodes: ['ai_limit_exceeded'], score: 0 };
            }
        }

        // 3. 현재 상태 조회
        const state = await this.stateUpdater.getCurrentState();
        if (!state) {
            return { shouldIntervene: false, level: InterventionLevel.L0_OBSERVE, reasonCodes: [], score: 0 };
        }

        // 4. 사용자 설정 조회
        const preferences = await this.getUserPreferences();
        if (!preferences?.enabled) {
            return { shouldIntervene: false, level: InterventionLevel.L0_OBSERVE, reasonCodes: [], score: 0 };
        }

        // 5. Quiet Hours 체크
        if (this.isQuietHours(preferences)) {
            console.log('[PolicyEngine] Quiet hours - skipping intervention');
            return { shouldIntervene: false, level: InterventionLevel.L0_OBSERVE, reasonCodes: ['quiet_hours'], score: 0 };
        }

        // 6. 최근 개입 쿨다운 체크
        if (await this.isInCooldown(preferences.interventionCooldownMinutes)) {
            console.log('[PolicyEngine] Still in cooldown');
            return { shouldIntervene: false, level: InterventionLevel.L0_OBSERVE, reasonCodes: ['cooldown'], score: 0 };
        }

        // 7. 개입 점수 계산 (규칙 기반)
        const { score, reasonCodes } = this.calculateInterventionScore(state);

        console.log('[PolicyEngine] Intervention score:', score, reasonCodes);

        // 8. 임계치 비교
        if (score < GUARDRAILS.THRESHOLDS.INTERVENTION_SCORE) {
            return { shouldIntervene: false, level: InterventionLevel.L0_OBSERVE, reasonCodes, score };
        }

        // 9. 개입 레벨 결정 (플랜 제한 적용)
        const level = this.determineLevel(score, reasonCodes, preferences);
        const limitedLevel = Math.min(level, planConfig.maxInterventionLevel);

        return {
            shouldIntervene: true,
            level: limitedLevel,
            reasonCodes,
            score
        };
    }

    /**
     * 개입 점수 계산 (규칙 기반 - LLM 없이)
     */
    private calculateInterventionScore(state: any): { score: number; reasonCodes: string[] } {
        let score = 0;
        const reasonCodes: string[] = [];

        // 스트레스 높음
        if (state.stress_level > GUARDRAILS.THRESHOLDS.HIGH_STRESS) {
            score += state.stress_level * 0.3;
            reasonCodes.push(REASON_CODES.HIGH_STRESS);
        }

        // 루틴 이탈
        if (state.routine_deviation_score > GUARDRAILS.THRESHOLDS.HIGH_ROUTINE_DEVIATION) {
            score += state.routine_deviation_score * 0.2;
            reasonCodes.push(REASON_CODES.ROUTINE_BREAK);
        }

        // 마감 압박
        if (state.deadline_pressure_score > GUARDRAILS.THRESHOLDS.HIGH_DEADLINE_PRESSURE) {
            score += state.deadline_pressure_score * 0.4;
            reasonCodes.push(REASON_CODES.DEADLINE_SOON);
        }

        // 에너지 낮음
        if (state.energy_level < GUARDRAILS.THRESHOLDS.LOW_ENERGY) {
            score += (100 - state.energy_level) * 0.2;
            reasonCodes.push(REASON_CODES.LOW_ENERGY);
        }

        return { score: Math.min(100, score), reasonCodes };
    }

    /**
     * 개입 레벨 결정
     */
    private determineLevel(
        score: number,
        reasonCodes: string[],
        preferences: any
    ): InterventionLevel {
        // 긴급 상황 (마감 임박 + 스트레스 높음)
        if (
            reasonCodes.includes(REASON_CODES.DEADLINE_SOON) &&
            reasonCodes.includes(REASON_CODES.HIGH_STRESS) &&
            score > 90
        ) {
            return Math.min(InterventionLevel.L3_DIRECT, preferences.maxInterventionLevel);
        }

        // 중간 상황
        if (score > 85) {
            return Math.min(InterventionLevel.L2_SOFT, preferences.maxInterventionLevel);
        }

        // 낮은 우선순위
        return InterventionLevel.L1_SILENT_PREP;
    }

    /**
     * Quiet Hours 체크
     */
    private isQuietHours(preferences: any): boolean {
        const now = new Date();
        const currentHour = now.getHours();
        const { quietHoursStart, quietHoursEnd } = preferences;

        if (quietHoursStart < quietHoursEnd) {
            return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
        } else {
            return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
        }
    }

    /**
     * 쿨다운 체크
     */
    private async isInCooldown(cooldownMinutes: number): Promise<boolean> {
        const { data, error } = await supabase
            .from('intervention_logs')
            .select('intervened_at')
            .eq('user_email', this.userEmail)
            .order('intervened_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return false;

        const lastIntervention = new Date(data.intervened_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastIntervention.getTime()) / (1000 * 60);

        return diffMinutes < cooldownMinutes;
    }

    /**
     * 사용자 설정 조회
     */
    private async getUserPreferences(): Promise<any> {
        const { data, error } = await supabase
            .from('jarvis_preferences')
            .select('*')
            .eq('user_email', this.userEmail)
            .single();

        if (error) {
            console.error('[PolicyEngine] Failed to get preferences:', error);
            return null;
        }

        return data;
    }

    /**
     * 사용자 플랜 조회
     */
    private async getUserPlan(): Promise<string> {
        const { data, error } = await supabase
            .from('users')
            .select('profile')
            .eq('email', this.userEmail)
            .single();

        if (error || !data) {
            console.error('[PolicyEngine] Failed to get user plan:', error);
            return 'Free';
        }

        return data.profile?.plan || 'Free';
    }

    /**
     * AI 호출 횟수 제한 체크
     */
    private async checkAIUsageLimit(userPlan: string, limit: number): Promise<boolean> {
        const { data, error } = await supabase.rpc('get_ai_usage', {
            p_user_email: this.userEmail
        });

        if (error) {
            console.error('[PolicyEngine] Failed to check AI usage:', error);
            return true; // 에러나면 허용 (안전한 방향)
        }

        const currentUsage = data || 0;
        console.log(`[PolicyEngine] ${userPlan} plan - AI usage: ${currentUsage}/${limit}`);

        return currentUsage < limit;
    }
}
