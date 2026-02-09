/**
 * Escalation Intelligence Service
 *
 * 적응형 알림 에스컬레이션 전략
 * - 기존 3-strike → 7일 완전 차단 방식을 대체
 * - dismiss 횟수에 따라 단계적 전략 적용
 * - 중요 알림(마감 임박, 중요 일정 직전)은 절대 억제하지 않음
 */

import { createClient } from '@supabase/supabase-js';
import { isImportantSchedule } from '@/lib/proactiveNotificationService';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Types
// ============================================

export type EscalationStrategy =
    | 'deliver'            // 정상 전달
    | 'adapt_format'       // 메시지 형식 변경 (짧게)
    | 'reduce_frequency'   // 빈도 줄이기 (격회)
    | 'change_channel'     // 채널 변경 (push 중단, in-app only)
    | 'pause_with_checkin' // 일시 정지 + N일 후 체크인
    | 'full_suppress';     // 완전 억제 (14일)

export interface DismissStreak {
    count: number;
    lastDate: string | null;
    // 격회 전달용: 마지막 전달 여부
    lastDelivered?: boolean;
}

export interface EscalationDecision {
    strategy: EscalationStrategy;
    shouldDeliver: boolean;
    modifyMessage?: (title: string, message: string) => { title: string; message: string };
    pushAllowed: boolean;
    reason: string;
}

// ============================================
// Core Logic
// ============================================

/**
 * 알림 에스컬레이션 결정
 *
 * @param userEmail 사용자 이메일
 * @param notificationType 알림 유형
 * @param priority 알림 우선순위
 * @param context 추가 컨텍스트 (일정 텍스트, 마감 시간 등)
 */
export async function getEscalationDecision(
    userEmail: string,
    notificationType: string,
    priority: 'high' | 'medium' | 'low',
    context?: {
        scheduleText?: string;
        deadlineHours?: number; // 마감까지 남은 시간
    }
): Promise<EscalationDecision> {
    // Critical override: 중요 알림은 절대 억제하지 않음
    if (isCriticalOverride(priority, context)) {
        return {
            strategy: 'deliver',
            shouldDeliver: true,
            pushAllowed: true,
            reason: 'critical_override: 중요 일정/마감 임박',
        };
    }

    // Dismiss streak 조회
    const streak = await getDismissStreak(userEmail, notificationType);

    // streak 없거나 0이면 정상 전달
    if (streak.count === 0) {
        return {
            strategy: 'deliver',
            shouldDeliver: true,
            pushAllowed: true,
            reason: 'no_dismissals',
        };
    }

    // 단계별 전략 결정
    if (streak.count === 1) {
        return {
            strategy: 'adapt_format',
            shouldDeliver: true,
            pushAllowed: true,
            modifyMessage: shortenMessage,
            reason: `dismiss_1: 메시지 축약`,
        };
    }

    if (streak.count === 2) {
        // 격회 전달: 이전에 전달했으면 이번엔 스킵
        const shouldDeliver = !streak.lastDelivered;
        if (shouldDeliver) {
            // 전달 기록 업데이트
            await updateDeliveryFlag(userEmail, notificationType, true);
        }
        return {
            strategy: 'reduce_frequency',
            shouldDeliver,
            pushAllowed: shouldDeliver,
            modifyMessage: shouldDeliver ? shortenMessage : undefined,
            reason: `dismiss_2: 격회 전달 (${shouldDeliver ? '전달' : '스킵'})`,
        };
    }

    if (streak.count === 3) {
        return {
            strategy: 'change_channel',
            shouldDeliver: true,
            pushAllowed: false, // push 중단, in-app only
            modifyMessage: shortenMessage,
            reason: 'dismiss_3: push 중단, in-app only',
        };
    }

    if (streak.count === 4) {
        // 5일 정지 + 체크인
        const pauseDays = 5;
        if (streak.lastDate) {
            const daysSince = Math.floor(
                (Date.now() - new Date(streak.lastDate).getTime()) / 86400000
            );
            if (daysSince < pauseDays) {
                return {
                    strategy: 'pause_with_checkin',
                    shouldDeliver: false,
                    pushAllowed: false,
                    reason: `dismiss_4: 정지 중 (${daysSince}/${pauseDays}일)`,
                };
            }
            // 정지 기간 경과 → 체크인 메시지
            return {
                strategy: 'pause_with_checkin',
                shouldDeliver: true,
                pushAllowed: false,
                modifyMessage: (_title, _message) => ({
                    title: '💬 알림 설정 확인',
                    message: `이 유형의 알림을 계속 받으시겠어요? 설정에서 변경할 수 있어요.`,
                }),
                reason: 'dismiss_4: 체크인 질문',
            };
        }
        return {
            strategy: 'pause_with_checkin',
            shouldDeliver: false,
            pushAllowed: false,
            reason: 'dismiss_4: 정지',
        };
    }

    // 5회 이상: 14일 완전 억제
    const suppressDays = 14;
    if (streak.lastDate) {
        const daysSince = Math.floor(
            (Date.now() - new Date(streak.lastDate).getTime()) / 86400000
        );
        if (daysSince >= suppressDays) {
            // 억제 기간 경과 → streak 리셋
            await resetDismissStreak(userEmail, notificationType);
            return {
                strategy: 'deliver',
                shouldDeliver: true,
                pushAllowed: true,
                reason: 'suppress_expired: 억제 기간 만료, 리셋',
            };
        }
    }

    return {
        strategy: 'full_suppress',
        shouldDeliver: false,
        pushAllowed: false,
        reason: `dismiss_5+: 14일 완전 억제`,
    };
}

/**
 * 알림에 에스컬레이션 결정 적용
 * null 반환 시 알림 전달하지 않음
 */
export function applyEscalation<T extends { title: string; message: string; priority: string }>(
    notification: T,
    decision: EscalationDecision
): (T & { pushAllowed: boolean }) | null {
    if (!decision.shouldDeliver) return null;

    let result = { ...notification, pushAllowed: decision.pushAllowed };

    if (decision.modifyMessage) {
        const modified = decision.modifyMessage(notification.title, notification.message);
        result = { ...result, title: modified.title, message: modified.message };
    }

    return result;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Critical override 판단
 * 중요 일정 직전 또는 마감 24시간 이내면 절대 억제하지 않음
 */
function isCriticalOverride(
    priority: string,
    context?: { scheduleText?: string; deadlineHours?: number }
): boolean {
    if (priority === 'high') {
        // 마감 24시간 이내
        if (context?.deadlineHours !== undefined && context.deadlineHours <= 24) {
            return true;
        }
        // 중요 일정 키워드
        if (context?.scheduleText && isImportantSchedule(context.scheduleText)) {
            return true;
        }
    }
    return false;
}

/**
 * Dismiss streak 조회
 */
async function getDismissStreak(
    userEmail: string,
    notificationType: string
): Promise<DismissStreak> {
    const streakKey = `dismiss_streak_${notificationType}`;
    const { data } = await supabase
        .from('user_kv_store')
        .select('value')
        .eq('user_email', userEmail)
        .eq('key', streakKey)
        .single();

    if (!data?.value) {
        return { count: 0, lastDate: null };
    }

    return data.value as DismissStreak;
}

/**
 * 격회 전달 플래그 업데이트
 */
async function updateDeliveryFlag(
    userEmail: string,
    notificationType: string,
    delivered: boolean
): Promise<void> {
    const streakKey = `dismiss_streak_${notificationType}`;
    const { data } = await supabase
        .from('user_kv_store')
        .select('value')
        .eq('user_email', userEmail)
        .eq('key', streakKey)
        .single();

    if (data?.value) {
        const streak = data.value as DismissStreak;
        streak.lastDelivered = delivered;

        await supabase.from('user_kv_store').upsert({
            user_email: userEmail,
            key: streakKey,
            value: streak,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email,key' });
    }
}

/**
 * Dismiss streak 리셋
 */
async function resetDismissStreak(
    userEmail: string,
    notificationType: string
): Promise<void> {
    const streakKey = `dismiss_streak_${notificationType}`;
    await supabase.from('user_kv_store').upsert({
        user_email: userEmail,
        key: streakKey,
        value: { count: 0, lastDate: null },
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_email,key' });
}

/**
 * 메시지 축약 함수
 */
function shortenMessage(title: string, message: string): { title: string; message: string } {
    // 이모지 제거 + 메시지 50자 이내로 축약
    const cleanTitle = title.replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
    const shortMessage = message.length > 50 ? message.substring(0, 47) + '...' : message;

    return { title: cleanTitle || title, message: shortMessage };
}
