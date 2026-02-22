/**
 * Context Summarizer
 *
 * 긴 대화에서 오래된 메시지를 2-3문장으로 요약하여 컨텍스트 유지
 * 패턴: [요약, ...최근 N개 메시지]
 *
 * - 메시지 12개 이하: 요약 없이 최근 10개 그대로 사용
 * - 메시지 13개 이상: 오래된 부분을 GPT-5-mini로 요약 + 최근 10개
 */

import OpenAI from 'openai';
import { MODELS } from '@/lib/models';
import { llmCircuit } from '@/lib/circuit-breaker';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const RECENT_WINDOW = 10;
const MIN_MESSAGES_FOR_SUMMARY = 13;
const SUMMARY_TIMEOUT = 8000; // 8초

/**
 * 메시지 배열에서 [요약 + 최근 메시지] 형태로 압축
 *
 * @returns 압축된 메시지 배열 (system summary + recent messages)
 */
export async function compressMessages(
    messages: ChatMessage[]
): Promise<ChatMessage[]> {
    // 메시지가 충분하지 않으면 그대로 반환
    if (messages.length < MIN_MESSAGES_FOR_SUMMARY) {
        return messages.slice(-RECENT_WINDOW);
    }

    const recent = messages.slice(-RECENT_WINDOW);
    const older = messages.slice(0, -RECENT_WINDOW);

    // 오래된 메시지를 텍스트로 변환
    const olderText = older
        .map(m => `[${m.role}]: ${m.content}`)
        .join('\n')
        .slice(0, 4000); // 토큰 절약을 위해 4000자 제한

    try {
        const summary = await summarizeConversation(olderText);
        const summaryMessage: ChatMessage = {
            role: 'system',
            content: `[이전 대화 요약]\n${summary}`,
        };
        return [summaryMessage, ...recent];
    } catch {
        // 요약 실패 시 최근 메시지만 반환 (안전한 폴백)
        return recent;
    }
}

/**
 * 대화 내용을 2-3문장으로 요약
 */
async function summarizeConversation(conversationText: string): Promise<string> {
    const response = await llmCircuit.execute(() =>
        Promise.race([
            openai.chat.completions.create({
                model: MODELS.GPT_5_MINI,
                temperature: 0.3,
                max_tokens: 200,
                messages: [
                    {
                        role: 'system',
                        content: '당신은 대화 요약 전문가입니다. 주어진 대화를 2-3문장의 한국어로 간결하게 요약하세요. 핵심 주제, 사용자 요청, 결정사항만 포함하세요.',
                    },
                    {
                        role: 'user',
                        content: conversationText,
                    },
                ],
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Summary timed out')), SUMMARY_TIMEOUT)
            ),
        ])
    );

    return response.choices[0]?.message?.content || '';
}
