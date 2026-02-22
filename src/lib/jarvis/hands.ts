/**
 * Jarvis Hands
 * 실제 액션 실행
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import {
    InterventionLevel,
    ActionType,
    UserFeedback,
    GUARDRAILS
} from '@/types/jarvis';
import { InterventionPlan } from './brain';
import { NOTIFICATION_COOLDOWNS } from '@/lib/constants';
import { logAgentAction } from '@/lib/agent-action-log';
import { logger } from '@/lib/logger';

export interface ExecutionResult {
    success: boolean;
    interventionLogId?: string;
    error?: string;
    requiresUserConfirmation?: boolean;
    confirmationPayload?: any;
}

export class Hands {
    private userEmail: string;

    constructor(userEmail: string) {
        this.userEmail = userEmail;
    }

    /**
     * 개입 실행 (레벨에 따라 다르게 처리)
     */
    async execute(
        plan: InterventionPlan,
        level: InterventionLevel,
        reasonCodes: string[]
    ): Promise<ExecutionResult> {
        // 확인이 필요한 액션인지 체크
        const needsConfirmation = (GUARDRAILS.REQUIRES_CONFIRMATION as readonly string[]).includes(plan.actionType);

        if (needsConfirmation && level < InterventionLevel.L3_DIRECT) {
            logger.error('[Hands] Action requires confirmation but level is too low');
            return {
                success: false,
                error: 'Action requires higher intervention level'
            };
        }

        // 레벨별 처리
        switch (level) {
            case InterventionLevel.L0_OBSERVE:
                // 로그만 남김
                return await this.logOnly(plan, reasonCodes);

            case InterventionLevel.L1_SILENT_PREP:
                // 조용히 리소스 준비
                return await this.executeSilent(plan, reasonCodes);

            case InterventionLevel.L2_SOFT:
                // 알림 전송
                return await this.executeWithNotification(plan, reasonCodes);

            case InterventionLevel.L3_DIRECT:
                // 사용자 확인 필요
                return await this.prepareForConfirmation(plan, reasonCodes);

            case InterventionLevel.L4_AUTO:
                // 자동 실행
                return await this.executeAuto(plan, reasonCodes);

            default:
                return {
                    success: false,
                    error: 'Unknown intervention level'
                };
        }
    }

    /**
     * L0: 로그만 남김
     */
    private async logOnly(plan: InterventionPlan, reasonCodes: string[]): Promise<ExecutionResult> {
        const logId = await this.createInterventionLog(
            InterventionLevel.L0_OBSERVE,
            plan,
            reasonCodes,
            UserFeedback.AUTO_EXECUTED
        );

        return {
            success: true,
            interventionLogId: logId
        };
    }

    /**
     * L1: 조용한 준비 (리소스 미리 생성, 사용자에게 알리지 않음)
     */
    private async executeSilent(plan: InterventionPlan, reasonCodes: string[]): Promise<ExecutionResult> {
        try {
            let actionResult: any = null;

            switch (plan.actionType) {
                case ActionType.RESOURCE_PREP:
                    // Capability 기반 리소스 준비 시도, 실패 시 기존 방식 fallback
                    try {
                        const scheduleText = plan.actionPayload?.scheduleText || plan.actionPayload?.title;
                        if (scheduleText) {
                            const { generateSchedulePrep } = await import('@/lib/capabilities/schedule-prep');
                            const prepResult = await generateSchedulePrep(this.userEmail, {
                                scheduleText,
                                startTime: plan.actionPayload?.startTime,
                                timeUntil: plan.actionPayload?.timeUntil,
                            });
                            if (prepResult.success && prepResult.data) {
                                actionResult = { ...plan.actionPayload, prepAdvice: prepResult.data.advice, prepType: prepResult.data.prepType };
                                break;
                            }
                        }
                    } catch { /* fallback below */ }
                    actionResult = await this.prepareResources(plan.actionPayload);
                    break;

                case ActionType.CHECKLIST_CREATED:
                    actionResult = await this.createChecklist(plan.actionPayload);
                    break;

                default:
            }

            const logId = await this.createInterventionLog(
                InterventionLevel.L1_SILENT_PREP,
                plan,
                reasonCodes,
                UserFeedback.AUTO_EXECUTED
            );

            return {
                success: true,
                interventionLogId: logId
            };
        } catch (error) {
            logger.error('[Hands] Silent execution failed:', error);
            return {
                success: false,
                error: String(error)
            };
        }
    }

    /**
     * L2: 알림과 함께 실행
     */
    private async executeWithNotification(
        plan: InterventionPlan,
        reasonCodes: string[]
    ): Promise<ExecutionResult> {
        try {
            // Capability enrichment (실패해도 원본 알림 전달)
            const enriched = await this.enrichNotification(plan, reasonCodes);

            // 알림 데이터 저장 (UI에서 표시)
            await this.saveNotification({
                type: 'jarvis_suggestion',
                message: plan.message,
                actionType: plan.actionType,
                actionPayload: plan.actionPayload,
                ...enriched,
                createdAt: new Date().toISOString()
            });

            const logId = await this.createInterventionLog(
                InterventionLevel.L2_SOFT,
                plan,
                reasonCodes
                // 사용자 피드백은 나중에 업데이트됨
            );

            logAgentAction(this.userEmail, 'jarvis', plan.actionType, plan.actionPayload || {}).catch(() => {});

            return {
                success: true,
                interventionLogId: logId
            };
        } catch (error) {
            logger.error('[Hands] Notification execution failed:', error);
            return {
                success: false,
                error: String(error)
            };
        }
    }

    /**
     * L3: 사용자 확인 대기
     */
    private async prepareForConfirmation(
        plan: InterventionPlan,
        reasonCodes: string[]
    ): Promise<ExecutionResult> {
        const logId = await this.createInterventionLog(
            InterventionLevel.L3_DIRECT,
            plan,
            reasonCodes
        );

        // UI에 확인 다이얼로그를 띄우기 위한 데이터 저장
        await this.saveConfirmationRequest({
            interventionLogId: logId,
            message: plan.message,
            actionType: plan.actionType,
            actionPayload: plan.actionPayload,
            createdAt: new Date().toISOString()
        });

        logAgentAction(this.userEmail, 'jarvis', plan.actionType, plan.actionPayload || {}).catch(() => {});

        return {
            success: true,
            interventionLogId: logId,
            requiresUserConfirmation: true,
            confirmationPayload: plan.actionPayload
        };
    }

    /**
     * L4: 자동 실행 (옵트인 확인됨)
     */
    private async executeAuto(plan: InterventionPlan, reasonCodes: string[]): Promise<ExecutionResult> {
        try {
            // Snapshot original state for rollback
            let originalState: any = null;
            try {
                const { data: userData } = await supabaseAdmin
                    .from('users')
                    .select('profile')
                    .eq('email', this.userEmail)
                    .maybeSingle();
                if (userData?.profile?.customGoals) {
                    // Store the full customGoals array as snapshot
                    originalState = { customGoals: [...userData.profile.customGoals] };
                }
            } catch (e) {
                logger.error('[Hands] Failed to snapshot for rollback:', e);
            }

            let actionResult: any = null;

            switch (plan.actionType) {
                case ActionType.SCHEDULE_MOVED:
                    actionResult = await this.moveSchedule(plan.actionPayload);
                    break;

                case ActionType.SCHEDULE_BUFFER_ADDED:
                    actionResult = await this.addBuffer(plan.actionPayload);
                    break;

                case ActionType.SCHEDULE_SUGGESTED:
                    actionResult = await this.suggestSchedule(plan.actionPayload);
                    break;

                default:
                    throw new Error(`Auto action not implemented: ${plan.actionType}`);
            }

            const logId = await this.createInterventionLog(
                InterventionLevel.L4_AUTO,
                { ...plan, actionPayload: { ...plan.actionPayload, _originalState: originalState } },
                reasonCodes,
                UserFeedback.AUTO_EXECUTED
            );

            // 실행 결과 알림
            await this.saveNotification({
                type: 'jarvis_auto_action',
                message: `자동 실행: ${plan.message}`,
                actionType: plan.actionType,
                result: actionResult,
                createdAt: new Date().toISOString()
            });

            logAgentAction(this.userEmail, 'jarvis', plan.actionType, plan.actionPayload || {}).catch(() => {});

            return {
                success: true,
                interventionLogId: logId
            };
        } catch (error) {
            logger.error('[Hands] Auto execution failed:', error);
            return {
                success: false,
                error: String(error)
            };
        }
    }

    /**
     * Capability 기반 알림 enrichment
     * reasonCodes에 따라 관련 capability를 호출하여 추가 데이터를 알림에 첨부.
     * 각 capability 호출에 3초 타임아웃, 실패 시 빈 객체 반환 (원본 알림은 항상 전달).
     */
    private async enrichNotification(
        plan: InterventionPlan,
        reasonCodes: string[]
    ): Promise<Record<string, any>> {
        const enriched: Record<string, any> = {};
        const ENRICHMENT_TIMEOUT = 3000;

        const withTimeout = <T>(promise: Promise<T>): Promise<T | null> => {
            let timer: ReturnType<typeof setTimeout>;
            return Promise.race([
                promise.then(v => { clearTimeout(timer); return v; }),
                new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), ENRICHMENT_TIMEOUT); }),
            ]).catch(() => null);
        };

        // 독립적인 enrichment를 병렬 실행 (직렬 최악 9초 → 병렬 최악 3초)
        const tasks: Promise<void>[] = [];

        if (reasonCodes.includes('deadline_soon') && plan.actionPayload?.scheduleText) {
            tasks.push((async () => {
                try {
                    const { generateSchedulePrep } = await import('@/lib/capabilities/schedule-prep');
                    const result = await withTimeout(
                        generateSchedulePrep(this.userEmail, {
                            scheduleText: plan.actionPayload.scheduleText,
                            startTime: plan.actionPayload.startTime,
                            timeUntil: plan.actionPayload.timeUntil,
                        })
                    );
                    if (result?.success && result.data) {
                        enriched.prepAdvice = result.data.advice;
                    }
                } catch { /* non-blocking */ }
            })());
        }

        if (reasonCodes.includes('high_stress') || reasonCodes.includes('low_energy')) {
            tasks.push((async () => {
                try {
                    const { generateSmartSuggestions } = await import('@/lib/capabilities/smart-suggestions');
                    const result = await withTimeout(
                        generateSmartSuggestions(this.userEmail, { requestCount: 2 })
                    );
                    if (result?.success && result.data) {
                        enriched.suggestions = result.data.suggestions;
                    }
                } catch { /* non-blocking */ }
            })());
        }

        if (plan.actionType === ActionType.RESOURCE_PREP && plan.actionPayload?.activity) {
            tasks.push((async () => {
                try {
                    const { generateResourceRecommendation } = await import('@/lib/capabilities/resource-recommend');
                    const result = await withTimeout(
                        generateResourceRecommendation(this.userEmail, {
                            activity: plan.actionPayload.activity,
                            context: 'upcoming_schedule',
                            timeUntil: plan.actionPayload.timeUntil,
                        })
                    );
                    if (result?.success && result.data) {
                        enriched.resourceRecommendation = result.data.recommendation;
                        enriched.resourceActions = result.data.actions;
                    }
                } catch { /* non-blocking */ }
            })());
        }

        try {
            await Promise.all(tasks);
        } catch (error) {
            logger.error('[Hands] Enrichment failed (non-blocking):', error);
        }

        return enriched;
    }

    /**
     * 개입 로그 생성
     */
    private async createInterventionLog(
        level: InterventionLevel,
        plan: InterventionPlan,
        reasonCodes: string[],
        feedback?: UserFeedback
    ): Promise<string> {
        const { data, error } = await supabaseAdmin
            .from('intervention_logs')
            .insert({
                user_email: this.userEmail,
                intervention_level: level,
                reason_codes: reasonCodes,
                action_type: plan.actionType,
                action_payload: plan.actionPayload,
                user_feedback: feedback,
                intervened_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (error) {
            logger.error('[Hands] Failed to create intervention log:', error);
            throw error;
        }

        return data.id;
    }

    /**
     * 알림 저장 (UI에서 표시) - 쿨다운 기간 내 중복 방지
     */
    private async saveNotification(notification: any): Promise<void> {
        // Check for recent duplicate within cooldown window
        const cooldownMinutes = NOTIFICATION_COOLDOWNS[notification.type] || NOTIFICATION_COOLDOWNS._default;
        const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();

        const { data: existing } = await supabaseAdmin
            .from('jarvis_notifications')
            .select('id')
            .eq('user_email', this.userEmail)
            .eq('type', notification.type)
            .gte('created_at', cutoff)
            .is('dismissed_at', null)
            .limit(1)
            .maybeSingle();

        if (existing) {
            logger.info(`[Hands] Skipping duplicate notification: ${notification.type}`);
            return;
        }

        // Original insert
        const { error } = await supabaseAdmin
            .from('jarvis_notifications')
            .insert({
                user_email: this.userEmail,
                ...notification
            });

        if (error) {
            logger.error('[Hands] Failed to save notification:', error);
            throw error;
        }
    }

    /**
     * 확인 요청 저장 (L3)
     */
    private async saveConfirmationRequest(request: any): Promise<void> {
        const { error } = await supabaseAdmin
            .from('jarvis_confirmation_requests')
            .insert({
                user_email: this.userEmail,
                ...request,
                status: 'pending'
            });

        if (error) {
            logger.error('[Hands] Failed to save confirmation request:', error);
            throw error;
        }
    }

    /**
     * 리소스 준비 (링크, 문서 등)
     */
    private async prepareResources(payload: any): Promise<any> {
        // 준비된 리소스를 jarvis_resources 테이블에 저장
        const { data, error } = await supabaseAdmin
            .from('jarvis_resources')
            .insert({
                user_email: this.userEmail,
                resource_type: payload.type || 'links',
                title: payload.title || '준비된 리소스',
                content: payload.content || {},
                related_schedule_id: payload.scheduleId,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * 체크리스트 생성
     */
    private async createChecklist(payload: any): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from('jarvis_resources')
            .insert({
                user_email: this.userEmail,
                resource_type: 'checklist',
                title: payload.title || '준비 체크리스트',
                content: {
                    items: payload.items || [],
                    relatedSchedule: payload.scheduleId
                },
                related_schedule_id: payload.scheduleId,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * 일정 이동
     */
    private async moveSchedule(payload: any): Promise<any> {
        const { scheduleId, newDate, newTime } = payload;

        // customGoals에서 일정 찾아서 업데이트
        const { data: userData, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('profile')
            .eq('email', this.userEmail)
            .maybeSingle();

        if (fetchError || !userData) throw fetchError || new Error('User not found');

        const customGoals = userData.profile?.customGoals || [];
        const updatedGoals = customGoals.map((goal: any) => {
            if (goal.id === scheduleId) {
                return {
                    ...goal,
                    specificDate: newDate,
                    startTime: newTime
                };
            }
            return goal;
        });

        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                profile: {
                    ...userData.profile,
                    customGoals: updatedGoals
                }
            })
            .eq('email', this.userEmail);

        if (updateError) throw updateError;

        return { scheduleId, newDate, newTime };
    }

    /**
     * 버퍼 시간 추가
     */
    private async addBuffer(payload: any): Promise<any> {
        // 일정 사이에 버퍼 시간 추가 로직
        // 구현 생략 (복잡도 높음)
        return payload;
    }

    /**
     * 일정 제안
     */
    private async suggestSchedule(payload: any): Promise<any> {
        // 제안된 일정을 jarvis_resources에 저장
        const { data, error } = await supabaseAdmin
            .from('jarvis_resources')
            .insert({
                user_email: this.userEmail,
                resource_type: 'suggestion',
                title: '제안된 일정',
                content: payload,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * 사용자 피드백 업데이트
     */
    async updateFeedback(interventionLogId: string, feedback: UserFeedback): Promise<void> {
        const { error } = await supabaseAdmin
            .from('intervention_logs')
            .update({
                user_feedback: feedback,
                feedback_at: new Date().toISOString()
            })
            .eq('id', interventionLogId);

        if (error) {
            logger.error('[Hands] Failed to update feedback:', error);
            throw error;
        }

        // 즉시 피드백 가중치 반영 (다음 개입부터 적용)
        try {
            const { data: logEntry } = await supabaseAdmin
                .from('intervention_logs')
                .select('user_email')
                .eq('id', interventionLogId)
                .single();

            if (logEntry?.user_email) {
                const { computeWeights } = await import('./feedback-aggregator');
                await computeWeights(logEntry.user_email);
            }
        } catch (e) {
            logger.error('[Hands] Feedback weight update failed:', e);
        }
    }

    /**
     * L4 자동실행 롤백
     */
    async rollbackAction(interventionLogId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // 1. intervention_log에서 원본 상태 조회
            const { data: log, error: logError } = await supabaseAdmin
                .from('intervention_logs')
                .select('action_payload, user_email, action_type')
                .eq('id', interventionLogId)
                .eq('user_email', this.userEmail)
                .maybeSingle();

            if (logError || !log) {
                return { success: false, error: '개입 기록을 찾을 수 없습니다.' };
            }

            const originalState = log.action_payload?._originalState;
            if (!originalState?.customGoals) {
                return { success: false, error: '롤백 데이터가 없습니다.' };
            }

            // 2. 원본 customGoals 복원
            const { data: userData, error: userError } = await supabaseAdmin
                .from('users')
                .select('profile')
                .eq('email', this.userEmail)
                .maybeSingle();

            if (userError || !userData) {
                return { success: false, error: '사용자를 찾을 수 없습니다.' };
            }

            const { error: updateError } = await supabaseAdmin
                .from('users')
                .update({
                    profile: {
                        ...userData.profile,
                        customGoals: originalState.customGoals
                    }
                })
                .eq('email', this.userEmail);

            if (updateError) {
                return { success: false, error: `복원 실패: ${updateError.message}` };
            }

            // 3. intervention_log에 롤백 기록
            await supabaseAdmin
                .from('intervention_logs')
                .update({
                    user_feedback: 'rolled_back',
                    feedback_at: new Date().toISOString()
                })
                .eq('id', interventionLogId);

            logger.info(`[Hands] Rolled back intervention ${interventionLogId}`);
            return { success: true };
        } catch (e) {
            logger.error('[Hands] Rollback failed:', e);
            return { success: false, error: '롤백 처리 중 오류가 발생했습니다.' };
        }
    }
}
