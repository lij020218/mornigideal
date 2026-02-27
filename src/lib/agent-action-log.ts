/**
 * Agent Action Log
 *
 * 에이전트 간 최근 액션을 공유하여 중복 개입 방지.
 * user_kv_store 테이블에 agent_actions_{date} 키로 저장.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

export type AgentType = 'jarvis' | 'react' | 'proactive';

export interface AgentAction {
    agent: AgentType;
    actionType: string;      // e.g. 'add_schedule', 'update_schedule', 'delete_schedule', 'notification_sent'
    payload: Record<string, any>;  // key fields for dedup (scheduleId, text, etc.)
    timestamp: string;       // ISO string
}

/**
 * 에이전트 액션 기록
 */
export async function logAgentAction(
    userEmail: string,
    agent: AgentType,
    actionType: string,
    payload: Record<string, any> = {}
): Promise<void> {
    try {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const key = `agent_actions_${todayStr}`;

        const { data } = await supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', userEmail)
            .eq('key', key)
            .maybeSingle();

        const actions: AgentAction[] = data?.value || [];
        actions.push({
            agent,
            actionType,
            payload,
            timestamp: new Date().toISOString()
        });

        // Keep only last 50 actions per day
        const trimmed = actions.slice(-50);

        await supabaseAdmin.from('user_kv_store').upsert({
            user_email: userEmail,
            key,
            value: trimmed,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_email,key' });
    } catch (e) {
        logger.error('[AgentActionLog] Failed to log action:', e);
    }
}

/**
 * 최근 N분 내 에이전트 액션 조회
 */
export async function getRecentActions(
    userEmail: string,
    windowMinutes: number = 30
): Promise<AgentAction[]> {
    try {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const key = `agent_actions_${todayStr}`;

        const { data } = await supabaseAdmin
            .from('user_kv_store')
            .select('value')
            .eq('user_email', userEmail)
            .eq('key', key)
            .maybeSingle();

        if (!data?.value) return [];

        const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
        return (data.value as AgentAction[]).filter(
            a => new Date(a.timestamp) > cutoff
        );
    } catch (e) {
        logger.error('[AgentActionLog] Failed to get recent actions:', e);
        return [];
    }
}

/**
 * 특정 스케줄에 대해 최근 동일 액션이 있었는지 확인
 */
export function hasRecentActionOnSchedule(
    actions: AgentAction[],
    scheduleText: string,
    actionTypes: string[] = ['add_schedule', 'update_schedule', 'delete_schedule', 'suggest_schedule']
): boolean {
    return actions.some(a =>
        actionTypes.includes(a.actionType) &&
        (a.payload?.text === scheduleText || a.payload?.scheduleText === scheduleText)
    );
}
