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
     * - 일정 과밀이면 UP (0-40점)
     * - 연속 미완료가 많으면 UP (0-30점)
     * - 미달성 목표가 있으면 UP (0-30점)
     */
    private async calculateStressLevel(): Promise<number> {
        const { data: userData } = await supabase
            .from('users')
            .select('profile')
            .eq('email', this.userEmail)
            .single();

        const customGoals = userData?.profile?.customGoals || [];
        const now = new Date();
        const todayStr = this.formatDate(now);
        const dayOfWeek = now.getDay();

        // 1. 일정 밀도 (0-40점): 예약 시간 / 16시간(활동시간)
        const todaySchedules = customGoals.filter((g: any) =>
            g.specificDate === todayStr ||
            (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
        );

        let totalBookedMinutes = 0;
        todaySchedules.forEach((s: any) => {
            if (s.startTime && s.endTime) {
                const [sh, sm] = s.startTime.split(':').map(Number);
                const [eh, em] = s.endTime.split(':').map(Number);
                const diff = (eh * 60 + em) - (sh * 60 + sm);
                if (diff > 0) totalBookedMinutes += diff;
            } else if (s.startTime) {
                totalBookedMinutes += 60; // endTime 없으면 1시간 기본
            }
        });
        const hoursBooked = totalBookedMinutes / 60;
        const densityScore = Math.min(40, (hoursBooked / 16) * 40);

        // 2. 연속 미완료 (0-30점): 최근 48시간 미완료 × 10
        const missedEvents = await this.observer.getRecentEvents(48, [
            EventType.SCHEDULE_MISSED,
            EventType.SCHEDULE_SNOOZED
        ]);
        const missedScore = Math.min(30, missedEvents.length * 10);

        // 3. 미달성 목표 (0-30점): 마감 지난 목표 × 15
        const longTermGoals = userData?.profile?.longTermGoals || {};
        let overdueCount = 0;
        ['weekly', 'monthly', 'yearly'].forEach(type => {
            (longTermGoals[type] || []).forEach((g: any) => {
                if (g.dueDate && !g.completed && new Date(g.dueDate) < now) {
                    overdueCount++;
                }
            });
        });
        const overdueScore = Math.min(30, overdueCount * 15);

        return Math.max(0, Math.min(100, Math.round(densityScore + missedScore + overdueScore)));
    }

    /**
     * 집중 가능 시간대 점수
     * - 긴 빈 시간 블록이 있으면 UP (0-50점)
     * - 사용자의 최적 시간대와 현재 시각이 맞으면 UP (0-30점)
     * - 잦은 컨텍스트 전환이 있으면 DOWN (0-20점 감점)
     */
    private async calculateFocusWindowScore(): Promise<number> {
        const { data: userData } = await supabase
            .from('users')
            .select('profile')
            .eq('email', this.userEmail)
            .single();

        const customGoals = userData?.profile?.customGoals || [];
        const now = new Date();
        const todayStr = this.formatDate(now);
        const dayOfWeek = now.getDay();

        const todaySchedules = customGoals
            .filter((g: any) =>
                g.specificDate === todayStr ||
                (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
            )
            .filter((g: any) => g.startTime)
            .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

        if (todaySchedules.length === 0) {
            return 90; // 일정 없음 = 최대 집중 가능
        }

        // 1. 일정 간 빈 시간 분석 (0-50점)
        const gaps: number[] = [];
        for (let i = 0; i < todaySchedules.length - 1; i++) {
            const currentEnd = todaySchedules[i].endTime || this.addOneHour(todaySchedules[i].startTime);
            const nextStart = todaySchedules[i + 1].startTime;

            const [ceH, ceM] = currentEnd.split(':').map(Number);
            const [nsH, nsM] = nextStart.split(':').map(Number);
            const gapMinutes = (nsH * 60 + nsM) - (ceH * 60 + ceM);

            if (gapMinutes > 0) gaps.push(gapMinutes);
        }

        const longestGap = gaps.length > 0 ? Math.max(...gaps) : 120;
        const gapScore = longestGap >= 120 ? 50
                       : longestGap >= 60 ? 30
                       : longestGap >= 30 ? 15
                       : 5;

        // 2. 사용자 최적 시간대 보너스 (0-30점)
        const completionEvents = await this.observer.getRecentEvents(168, [
            EventType.SCHEDULE_COMPLETED
        ]);

        const hourCounts: Record<number, number> = {};
        completionEvents.forEach((e: any) => {
            const time = e.payload?.startTime;
            if (time) {
                const hour = parseInt(time.split(':')[0]);
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            }
        });

        const currentHour = now.getHours();
        const sortedHours = Object.entries(hourCounts)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3)
            .map(([h]) => parseInt(h));

        const timeBonus = sortedHours.includes(currentHour) ? 30
                        : sortedHours.some(h => Math.abs(h - currentHour) <= 1) ? 20
                        : 10;

        // 3. 컨텍스트 전환 패널티 (0-20점 감점)
        const shortGaps = gaps.filter(g => g < 15).length;
        const interruptionPenalty = Math.min(20, shortGaps * 7);

        return Math.max(0, Math.min(100, Math.round(gapScore + timeBonus - interruptionPenalty)));
    }

    private addOneHour(time: string): string {
        const [h, m] = time.split(':').map(Number);
        const newH = Math.min(23, h + 1);
        return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
     * - 목표 마감 근접도에 따라 UP
     * - 진행률이 낮으면 추가 UP
     * - 중요 일정 키워드(마감/발표/면접 등) 감지
     */
    private async calculateDeadlinePressure(): Promise<number> {
        const { data: userData } = await supabase
            .from('users')
            .select('profile')
            .eq('email', this.userEmail)
            .single();

        const longTermGoals = userData?.profile?.longTermGoals || {};
        const now = new Date();
        let totalPressure = 0;

        // 1. 목표별 마감 근접도 (proximity weighting)
        ['weekly', 'monthly', 'yearly'].forEach(type => {
            (longTermGoals[type] || []).forEach((g: any) => {
                if (!g.dueDate || g.completed) return;

                const dueDate = new Date(g.dueDate);
                const daysUntilDue = Math.ceil(
                    (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                );

                if (daysUntilDue < 0) totalPressure += 30;       // 마감 초과
                else if (daysUntilDue === 0) totalPressure += 25; // 오늘 마감
                else if (daysUntilDue <= 1) totalPressure += 20;  // 내일
                else if (daysUntilDue <= 3) totalPressure += 15;  // 3일 이내
                else if (daysUntilDue <= 7) totalPressure += 8;   // 7일 이내
                else if (daysUntilDue <= 14) totalPressure += 3;  // 14일 이내

                // 진행률 50% 미만 + 7일 이내 → 추가 압박
                const progress = g.progress || 0;
                if (daysUntilDue <= 7 && progress < 50) {
                    totalPressure += 10;
                }
            });
        });

        // 2. 중요 일정 키워드 감지
        const customGoals = userData?.profile?.customGoals || [];
        const importantKeywords = ['마감', '발표', '면접', '시험', '미팅', '회의', '데드라인', '제출'];
        const todayStr = this.formatDate(now);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = this.formatDate(tomorrow);

        customGoals.forEach((g: any) => {
            const isToday = g.specificDate === todayStr;
            const isTomorrow = g.specificDate === tomorrowStr;
            if (!isToday && !isTomorrow) return;

            const text = (g.text || '').toLowerCase();
            const isImportant = importantKeywords.some(kw => text.includes(kw));
            if (isImportant) {
                totalPressure += isToday ? 15 : 8;
            }
        });

        return Math.max(0, Math.min(100, Math.round(totalPressure)));
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
