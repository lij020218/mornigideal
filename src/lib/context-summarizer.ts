/**
 * Context Summarizer
 *
 * 긴 대화에서 오래된 메시지를 잘라 최근 메시지만 유지
 * AI 호출 제거 — 단순 slice로 충분한 컨텍스트 유지
 *
 * - 메시지 12개 이하: 최근 10개 그대로 사용
 * - 메시지 13개 이상: 최근 10개만 유지
 */

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const RECENT_WINDOW = 10;

/**
 * 메시지 배열에서 최근 메시지만 유지
 *
 * @returns 압축된 메시지 배열 (최근 N개)
 */
export async function compressMessages(
    messages: ChatMessage[]
): Promise<ChatMessage[]> {
    return messages.slice(-RECENT_WINDOW);
}
