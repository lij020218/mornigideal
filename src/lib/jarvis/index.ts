/**
 * Jarvis Main Orchestrator
 * Observer → State → Brain → Hands 전체 루프 관리
 */

import { JarvisObserver } from './observer';
import { StateUpdater } from './state-updater';
import { PolicyEngine } from './policy-engine';
import { Brain, InterventionContext } from './brain';
import { Hands } from './hands';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { InterventionLevel } from '@/types/jarvis';

export class JarvisOrchestrator {
    private userEmail: string;
    private observer: JarvisObserver;
    private stateUpdater: StateUpdater;
    private policyEngine: PolicyEngine;
    private brain: Brain;
    private hands: Hands;

    constructor(userEmail: string) {
        this.userEmail = userEmail;
        this.observer = new JarvisObserver(userEmail);
        this.stateUpdater = new StateUpdater(userEmail);
        this.policyEngine = new PolicyEngine(userEmail);
        this.brain = new Brain();
        this.hands = new Hands(userEmail);
    }

    /**
     * 메인 루프 실행
     * 1. 상태 업데이트
     * 2. 개입 필요성 판단
     * 3. LLM 호출 (필요시)
     * 4. 액션 실행
     */
    async run(): Promise<void> {

        try {
            // 1. 상태 업데이트 (Observer → State)
            await this.stateUpdater.updateAllStates();

            // 2. 개입 필요성 판단 (State → Policy)
            const decision = await this.policyEngine.shouldIntervene();

            if (!decision.shouldIntervene) {
                return;
            }


            // 3. 컨텍스트 수집
            const context = await this.buildContext(decision);

            // 4. LLM 호출 (Policy → Brain)
            const plan = await this.brain.planIntervention(context);

            if (!plan) {
                return;
            }


            // 5. 액션 실행 (Brain → Hands)
            const result = await this.hands.execute(
                plan,
                decision.level,
                decision.reasonCodes
            );

            if (!result.success) {
                console.error('[Jarvis] Execution failed:', result.error);
                return;
            }


            // 6. Last intervention 시간 업데이트
            await this.updateLastIntervention();
        } catch (error) {
            console.error('[Jarvis] Run failed:', error);
            // 에러가 나도 계속 실행되어야 함 (다음 주기에 재시도)
        }
    }

    /**
     * 컨텍스트 수집 (LLM에 전달할 데이터)
     */
    private async buildContext(decision: any): Promise<InterventionContext> {
        // 현재 상태
        const currentState = await this.stateUpdater.getCurrentState();

        // 최근 이벤트
        const recentEvents = await this.observer.getRecentEvents(24);

        // 다가오는 일정
        const upcomingSchedules = await this.getUpcomingSchedules();

        // 사용자 프로필
        const userProfile = await this.getUserProfile();

        // 사용자 설정
        const preferences = await this.getPreferences();

        return {
            userEmail: this.userEmail,
            currentState,
            recentEvents,
            upcomingSchedules,
            userProfile,
            preferences,
            decision
        };
    }

    /**
     * 다가오는 일정 조회
     */
    private async getUpcomingSchedules(): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('profile')
            .eq('email', this.userEmail)
            .maybeSingle();

        if (error || !data) {
            console.error('[Jarvis] Failed to get user profile:', error);
            return [];
        }

        const customGoals = data.profile?.customGoals || [];
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // 오늘과 내일 일정만 필터링
        const todayStr = this.formatDate(now);
        const tomorrowStr = this.formatDate(tomorrow);

        const upcomingSchedules = customGoals.filter((goal: any) => {
            if (goal.specificDate) {
                return goal.specificDate === todayStr || goal.specificDate === tomorrowStr;
            }

            const todayDay = now.getDay();
            const tomorrowDay = tomorrow.getDay();

            if (goal.daysOfWeek?.includes(todayDay) || goal.daysOfWeek?.includes(tomorrowDay)) {
                return true;
            }

            return false;
        });

        // 시간순 정렬
        return upcomingSchedules.sort((a: any, b: any) => {
            const aTime = a.startTime || '00:00';
            const bTime = b.startTime || '00:00';
            return aTime.localeCompare(bTime);
        });
    }

    /**
     * 사용자 프로필 조회
     */
    private async getUserProfile(): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('profile')
            .eq('email', this.userEmail)
            .maybeSingle();

        if (error || !data) {
            console.error('[Jarvis] Failed to get user profile:', error);
            return {};
        }

        return data.profile || {};
    }

    /**
     * 사용자 설정 조회
     */
    private async getPreferences(): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from('jarvis_preferences')
            .select('*')
            .eq('user_email', this.userEmail)
            .maybeSingle();

        if (error || !data) {
            console.error('[Jarvis] Failed to get preferences:', error);
            return {
                enabled: false,
                maxInterventionLevel: InterventionLevel.L2_SOFT,
                notificationStyle: 'friendly'
            };
        }

        return data;
    }

    /**
     * Last intervention 시간 업데이트
     */
    private async updateLastIntervention(): Promise<void> {
        const { error } = await supabaseAdmin
            .from('user_states')
            .update({
                last_intervention_at: new Date().toISOString()
            })
            .eq('user_email', this.userEmail);

        if (error) {
            console.error('[Jarvis] Failed to update last intervention:', error);
        }
    }

    /**
     * 날짜 포맷 (YYYY-MM-DD)
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

/**
 * Standard, Pro, Max 사용자에 대해 Jarvis 실행
 */
export async function runJarvisForAllMaxUsers(): Promise<void> {

    try {
        // Standard, Pro, Max 플랜 사용자 조회
        const { data: users, error } = await supabaseAdmin
            .from('users')
            .select('email, profile')
            .in('profile->>plan', ['Standard', 'Pro', 'Max']);

        if (error) {
            console.error('[Jarvis] Failed to fetch users:', error);
            return;
        }

        if (!users || users.length === 0) {
            return;
        }


        // 각 사용자에 대해 병렬 실행
        const promises = users.map(async (user) => {
            try {
                const orchestrator = new JarvisOrchestrator(user.email);
                await orchestrator.run();
            } catch (error) {
                console.error(`[Jarvis] Failed for user ${user.email}:`, error);
                // 한 사용자 실패해도 계속 진행
            }
        });

        await Promise.all(promises);

    } catch (error) {
        console.error('[Jarvis] Critical error in runJarvisForAllMaxUsers:', error);
    }
}
