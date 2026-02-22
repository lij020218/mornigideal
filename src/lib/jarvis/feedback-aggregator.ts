/**
 * Jarvis Feedback Aggregator
 *
 * intervention_logs의 사용자 피드백을 집계하여
 * intervention_feedback_stats 테이블의 weight_multiplier를 업데이트.
 * PolicyEngine이 이 가중치를 읽어 개입 점수에 반영함.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

interface FeedbackCount {
    action_type: string;
    accepted: number;
    dismissed: number;
    ignored: number;
    total: number;
}

/**
 * 특정 사용자의 피드백 가중치 재계산
 * - intervention_logs에서 action_type별 피드백 집계
 * - weight_multiplier = acceptRate / (dismissRate + 0.1), [0.1, 2.0] 클램프
 * - intervention_feedback_stats에 upsert
 */
export async function computeWeights(userEmail: string): Promise<void> {
    // 1. 피드백이 있는 로그 조회
    const { data: logs, error } = await supabaseAdmin
        .from('intervention_logs')
        .select('action_type, user_feedback')
        .eq('user_email', userEmail)
        .not('feedback_at', 'is', null);

    if (error) {
        console.error('[FeedbackAggregator] Failed to query logs:', error);
        throw error;
    }

    if (!logs || logs.length === 0) {
        return;
    }

    // 2. action_type별 피드백 집계
    const counts = new Map<string, FeedbackCount>();

    for (const log of logs) {
        const actionType = log.action_type;
        if (!actionType) continue;

        if (!counts.has(actionType)) {
            counts.set(actionType, {
                action_type: actionType,
                accepted: 0,
                dismissed: 0,
                ignored: 0,
                total: 0,
            });
        }

        const count = counts.get(actionType)!;
        count.total++;

        switch (log.user_feedback) {
            case 'accepted':
                count.accepted++;
                break;
            case 'dismissed':
                count.dismissed++;
                break;
            case 'ignored':
                count.ignored++;
                break;
        }
    }

    // 3. weight_multiplier 계산 및 upsert
    for (const [, count] of counts) {
        const acceptRate = count.total > 0 ? count.accepted / count.total : 0;
        const dismissRate = count.total > 0 ? count.dismissed / count.total : 0;

        // acceptRate / (dismissRate + 0.1), [0.1, 2.0] 클램프
        const rawWeight = acceptRate / (dismissRate + 0.1);
        const weightMultiplier = Math.min(2.0, Math.max(0.1, rawWeight));

        const { error: upsertError } = await supabaseAdmin
            .from('intervention_feedback_stats')
            .upsert(
                {
                    user_email: userEmail,
                    action_type: count.action_type,
                    weight_multiplier: weightMultiplier,
                    total_count: count.total,
                    accepted_count: count.accepted,
                    dismissed_count: count.dismissed,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_email,action_type' }
            );

        if (upsertError) {
            console.error(
                `[FeedbackAggregator] Failed to upsert stats for ${userEmail}/${count.action_type}:`,
                upsertError
            );
        }
    }

    console.log(
        `[FeedbackAggregator] Updated weights for ${userEmail}: ${counts.size} action types`
    );
}

/**
 * 모든 사용자의 피드백 가중치 일괄 재계산
 * - intervention_logs에서 피드백이 있는 사용자 목록 조회
 * - 각 사용자별 computeWeights 호출
 */
export async function computeWeightsForAllUsers(): Promise<{
    processed: number;
    errors: number;
}> {
    // 피드백이 있는 고유 사용자 목록 조회
    const { data: users, error } = await supabaseAdmin
        .from('intervention_logs')
        .select('user_email')
        .not('feedback_at', 'is', null);

    if (error) {
        console.error('[FeedbackAggregator] Failed to query users:', error);
        throw error;
    }

    if (!users || users.length === 0) {
        console.log('[FeedbackAggregator] No users with feedback found');
        return { processed: 0, errors: 0 };
    }

    // 중복 제거
    const uniqueEmails = [...new Set(users.map((u: any) => u.user_email))];

    let processed = 0;
    let errors = 0;

    for (const email of uniqueEmails) {
        try {
            await computeWeights(email);
            processed++;
        } catch (e) {
            console.error(`[FeedbackAggregator] Failed for ${email}:`, e);
            errors++;
        }
    }

    console.log(
        `[FeedbackAggregator] Batch complete: ${processed} processed, ${errors} errors`
    );
    return { processed, errors };
}
