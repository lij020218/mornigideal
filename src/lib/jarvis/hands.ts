/**
 * Jarvis Hands
 * 실제 액션 실행
 */

import { supabase } from '@/lib/supabase';
import {
    InterventionLevel,
    ActionType,
    UserFeedback,
    GUARDRAILS
} from '@/types/jarvis';
import { InterventionPlan } from './brain';

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
            console.error('[Hands] Action requires confirmation but level is too low');
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
                    actionResult = await this.prepareResources(plan.actionPayload);
                    break;

                case ActionType.CHECKLIST_CREATED:
                    actionResult = await this.createChecklist(plan.actionPayload);
                    break;

                default:
                    console.log('[Hands] Silent action type not implemented:', plan.actionType);
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
            console.error('[Hands] Silent execution failed:', error);
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
            // 알림 데이터 저장 (UI에서 표시)
            await this.saveNotification({
                type: 'jarvis_suggestion',
                message: plan.message,
                actionType: plan.actionType,
                actionPayload: plan.actionPayload,
                createdAt: new Date().toISOString()
            });

            const logId = await this.createInterventionLog(
                InterventionLevel.L2_SOFT,
                plan,
                reasonCodes
                // 사용자 피드백은 나중에 업데이트됨
            );

            return {
                success: true,
                interventionLogId: logId
            };
        } catch (error) {
            console.error('[Hands] Notification execution failed:', error);
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
                plan,
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

            return {
                success: true,
                interventionLogId: logId
            };
        } catch (error) {
            console.error('[Hands] Auto execution failed:', error);
            return {
                success: false,
                error: String(error)
            };
        }
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
        const { data, error } = await supabase
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
            console.error('[Hands] Failed to create intervention log:', error);
            throw error;
        }

        return data.id;
    }

    /**
     * 알림 저장 (UI에서 표시)
     */
    private async saveNotification(notification: any): Promise<void> {
        const { error } = await supabase
            .from('jarvis_notifications')
            .insert({
                user_email: this.userEmail,
                ...notification
            });

        if (error) {
            console.error('[Hands] Failed to save notification:', error);
            throw error;
        }
    }

    /**
     * 확인 요청 저장 (L3)
     */
    private async saveConfirmationRequest(request: any): Promise<void> {
        const { error } = await supabase
            .from('jarvis_confirmation_requests')
            .insert({
                user_email: this.userEmail,
                ...request,
                status: 'pending'
            });

        if (error) {
            console.error('[Hands] Failed to save confirmation request:', error);
            throw error;
        }
    }

    /**
     * 리소스 준비 (링크, 문서 등)
     */
    private async prepareResources(payload: any): Promise<any> {
        // 준비된 리소스를 jarvis_resources 테이블에 저장
        const { data, error } = await supabase
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
        const { data, error } = await supabase
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
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('profile')
            .eq('email', this.userEmail)
            .single();

        if (fetchError) throw fetchError;

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

        const { error: updateError } = await supabase
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
        console.log('[Hands] Add buffer not fully implemented:', payload);
        return payload;
    }

    /**
     * 일정 제안
     */
    private async suggestSchedule(payload: any): Promise<any> {
        // 제안된 일정을 jarvis_resources에 저장
        const { data, error } = await supabase
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
        const { error } = await supabase
            .from('intervention_logs')
            .update({
                user_feedback: feedback,
                feedback_at: new Date().toISOString()
            })
            .eq('id', interventionLogId);

        if (error) {
            console.error('[Hands] Failed to update feedback:', error);
            throw error;
        }
    }
}
