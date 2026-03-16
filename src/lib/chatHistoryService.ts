/**
 * 서버에서 채팅 메시지를 직접 저장하는 유틸
 *
 * 앱이 꺼져있어도 일정 알림, 하루 마무리 등 메시지를
 * chat_history에 저장하여 앱 열었을 때 채팅에 표시
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    type?: string;
}

/**
 * 서버에서 채팅 메시지를 chat_history에 직접 추가
 * 기존 메시지에 append하는 방식 (중복 ID 체크)
 */
export async function appendChatMessage(
    userEmail: string,
    message: ChatMessage,
    date?: string,
): Promise<boolean> {
    try {
        // 날짜 기본값: KST 오늘
        const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const targetDate = date || `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;

        // user_id 조회
        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', userEmail)
            .maybeSingle();

        if (!userData) return false;

        // 기존 채팅 조회
        const { data: existing } = await supabaseAdmin
            .from('chat_history')
            .select('messages')
            .eq('user_id', userData.id)
            .eq('date', targetDate)
            .maybeSingle();

        const messages: ChatMessage[] = existing?.messages || [];

        // 중복 ID 체크
        if (messages.some(m => m.id === message.id)) return true;

        messages.push(message);

        // upsert
        const { error } = await supabaseAdmin
            .from('chat_history')
            .upsert({
                user_id: userData.id,
                date: targetDate,
                messages,
                title: targetDate,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,date' });

        if (error) {
            logger.error('[ChatHistoryService] Save error:', error);
            return false;
        }

        return true;
    } catch (error) {
        logger.error('[ChatHistoryService] appendChatMessage error:', error);
        return false;
    }
}

/**
 * 여러 사용자에게 동일한 메시지를 일괄 저장
 */
export async function appendChatMessageBulk(
    userEmails: string[],
    messageFactory: (email: string) => ChatMessage,
    date?: string,
): Promise<{ saved: number; failed: number }> {
    let saved = 0;
    let failed = 0;

    for (const email of userEmails) {
        const result = await appendChatMessage(email, messageFactory(email), date);
        if (result) saved++;
        else failed++;
    }

    return { saved, failed };
}
