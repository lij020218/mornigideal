/**
 * Jarvis State Updater
 * EventLog를 기반으로 UserState 수치를 갱신
 */

import { supabase } from '@/lib/supabase';
import { JarvisObserver } from './observer';
import { EventType, GUARDRAILS, PLAN_CONFIGS, PlanType } from '@/types/jarvis';

export class StateUpdater {
    private userEmail: string;
    private observer: JarvisObserver;

    constructor(userEmail: string) {
        this.userEmail = userEmail;
        this.observer = new JarvisObserver(userEmail);
    }

    /**
     * 전체 상태 업데이트 (플랜별 차등)
     */
    async updateAllStates(): Promise<void> {
        // 사용자 플랜 확인
        const userPlan = await this.getUserPlan();
        const planConfig = PLAN_CONFIGS[userPlan as PlanType];

        if (!planConfig.features.stateMonitoring) {
            console.log(`[StateUpdater] State monitoring disabled for ${userPlan} plan`);
            return;
        }

        const energyLevel = await this.calculateEnergyLevel();
        const stressLevel = await this.calculateStressLevel();

        // Standard: 에너지, 스트레스만
        // Pro/Max: 전체
        const updates: Record<string, any> = {
            energy_level: energyLevel,
            stress_level: stressLevel,
            last_active_at: new Date().toISOString(),
            state_updated_at: new Date().toISOString()
        };

        if (userPlan === 'Pro' || userPlan === 'Max') {
            const focusWindowScore = await this.calculateFocusWindowScore();
            const routineDeviationScore = await this.calculateRoutineDeviation();
            const deadlinePressureScore = await this.calculateDeadlinePressure();

            updates.focus_window_score = focusWindowScore;
            updates.routine_deviation_score = routineDeviationScore;
            updates.deadline_pressure_score = deadlinePressureScore;

            console.log(`[StateUpdater] ✅ ${userPlan} - All states updated:`, {
                energyLevel,
                stressLevel,
                focusWindowScore,
                routineDeviationScore,
                deadlinePressureScore
            });
        } else {
            console.log(`[StateUpdater] ✅ ${userPlan} - Basic states updated:`, {
                energyLevel,
                stressLevel
            });
        }

        await this.saveState(updates);
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
            return 'Free';
        }

        return data.profile?.plan || 'Free';
    }

    /**
     * 에너지 레벨 계산
     * - 완료한 일정이 많으면 UP
     * - 스킵/미완료가 많으면 DOWN
     */
    private async calculateEnergyLevel(): Promise<number> {
        const events = await this.observer.getRecentEvents(24);

        const completed = events.filter((e: any) =>
            e.event_type === EventType.SCHEDULE_COMPLETED
        ).length;

        const missed = events.filter((e: any) =>
            e.event_type === EventType.SCHEDULE_MISSED ||
            e.event_type === EventType.SCHEDULE_SNOOZED
        ).length;

        // 기본 70에서 시작
        let score = 70;
        score += completed * 5; // 완료당 +5
        score -= missed * 10;   // 미완료당 -10

        return Math.max(0, Math.min(100, score));
    }

    /**
     * 스트레스 레벨 계산
     * - 일정 과밀이면 UP
     * - 마감 임박하면 UP
     */
    private async calculateStressLevel(): Promise<number> {
        // TODO: 실제 일정 데이터를 기반으로 계산
        // 지금은 간단히 기본값
        return 30;
    }

    /**
     * 집중 가능 시간대 점수
     * - 최근 집중 세션이 있었으면 UP
     */
    private async calculateFocusWindowScore(): Promise<number> {
        // TODO: 실제 집중 세션 데이터 기반 계산
        return 70;
    }

    /**
     * 루틴 이탈 점수
     * - 연속으로 루틴을 스킵하면 UP
     * - 규칙적이면 DOWN
     */
    private async calculateRoutineDeviation(): Promise<number> {
        const exerciseSkips = await this.observer.detectConsecutiveSkips('운동', 3);
        const sleepSkips = await this.observer.detectConsecutiveSkips('취침', 3);

        let score = 0;
        if (exerciseSkips) score += 40;
        if (sleepSkips) score += 40;

        return Math.min(100, score);
    }

    /**
     * 마감 압박 점수
     * - 내일/모레 중요 일정이 있으면 UP
     */
    private async calculateDeadlinePressure(): Promise<number> {
        // TODO: 실제 일정 데이터 기반 계산
        return 20;
    }

    /**
     * 상태 저장
     */
    private async saveState(updates: Record<string, any>): Promise<void> {
        const { error } = await supabase
            .from('user_states')
            .upsert({
                user_email: this.userEmail,
                ...updates
            }, {
                onConflict: 'user_email'
            });

        if (error) {
            console.error('[StateUpdater] Failed to save state:', error);
        }
    }

    /**
     * 현재 상태 조회
     */
    async getCurrentState(): Promise<any> {
        const { data, error } = await supabase
            .from('user_states')
            .select('*')
            .eq('user_email', this.userEmail)
            .single();

        if (error) {
            console.error('[StateUpdater] Failed to get state:', error);
            return null;
        }

        return data;
    }
}
