/**
 * Session Compaction Service - Clawdbot 스타일
 *
 * 긴 대화를 자동으로 요약하여 토큰 80% 절약
 * - 대화가 임계치를 넘으면 자동 요약
 * - 최근 메시지는 원본 유지
 * - 중요 정보는 메모리에 저장 후 컴팩션
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
    isCompacted?: boolean;
}

export interface CompactionResult {
    compactedMessages: Message[];
    summary: string;
    originalTokenCount: number;
    compactedTokenCount: number;
    savedPercentage: number;
}

// 토큰 수 추정 (대략적인 계산: 한글 1자 = 2토큰, 영어 1단어 = 1토큰)
export function estimateTokenCount(text: string): number {
    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const numbers = (text.match(/\d+/g) || []).length;
    const punctuation = (text.match(/[^\w\s가-힣]/g) || []).length;

    return koreanChars * 2 + englishWords + numbers + Math.ceil(punctuation / 2);
}

// 메시지 배열의 총 토큰 수 계산
export function calculateTotalTokens(messages: Message[]): number {
    return messages.reduce((total, msg) => total + estimateTokenCount(msg.content), 0);
}

// 컴팩션이 필요한지 확인
export function needsCompaction(messages: Message[], threshold: number = 8000): boolean {
    const totalTokens = calculateTotalTokens(messages);
    return totalTokens > threshold;
}

/**
 * 대화 컴팩션 실행
 * - 오래된 메시지들을 요약
 * - 최근 N개 메시지는 원본 유지
 */
export async function compactSession(
    messages: Message[],
    options: {
        keepRecentCount?: number; // 원본 유지할 최근 메시지 수 (기본: 6)
        targetTokens?: number; // 목표 토큰 수 (기본: 2000)
    } = {}
): Promise<CompactionResult> {
    const { keepRecentCount = 6, targetTokens = 2000 } = options;

    const originalTokenCount = calculateTotalTokens(messages);

    // 메시지가 적으면 컴팩션 불필요
    if (messages.length <= keepRecentCount) {
        return {
            compactedMessages: messages,
            summary: '',
            originalTokenCount,
            compactedTokenCount: originalTokenCount,
            savedPercentage: 0
        };
    }

    // 최근 메시지와 이전 메시지 분리
    const recentMessages = messages.slice(-keepRecentCount);
    const olderMessages = messages.slice(0, -keepRecentCount);

    // 이미 컴팩션된 메시지가 있는지 확인
    const existingCompaction = olderMessages.find(m => m.isCompacted);
    const messagesToSummarize = existingCompaction
        ? olderMessages.filter(m => !m.isCompacted)
        : olderMessages;

    if (messagesToSummarize.length === 0) {
        return {
            compactedMessages: messages,
            summary: '',
            originalTokenCount,
            compactedTokenCount: originalTokenCount,
            savedPercentage: 0
        };
    }

    // AI로 요약 생성
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const conversationText = messagesToSummarize
        .map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
        .join('\n\n');

    const prompt = `다음 대화를 간결하게 요약하세요. 핵심 정보만 포함하세요.

대화:
${conversationText}

요약 규칙:
1. 사용자의 주요 요청/질문 포함
2. AI의 핵심 응답/결정 포함
3. 중요한 컨텍스트 (이름, 날짜, 숫자 등) 보존
4. 불필요한 인사말, 중복 내용 제외
5. 300자 이내로 작성

요약:`;

    try {
        const result = await model.generateContent(prompt);
        const summary = result.response.text().trim();

        // 기존 컴팩션과 새 요약 합치기
        let combinedSummary = summary;
        if (existingCompaction) {
            combinedSummary = `[이전 대화 요약]\n${existingCompaction.content}\n\n[추가 대화 요약]\n${summary}`;
        }

        // 컴팩션된 메시지 생성
        const compactionMessage: Message = {
            id: `compaction-${Date.now()}`,
            role: 'system',
            content: `[대화 요약]\n${combinedSummary}`,
            isCompacted: true
        };

        const compactedMessages = [compactionMessage, ...recentMessages];
        const compactedTokenCount = calculateTotalTokens(compactedMessages);
        const savedPercentage = Math.round((1 - compactedTokenCount / originalTokenCount) * 100);

        return {
            compactedMessages,
            summary: combinedSummary,
            originalTokenCount,
            compactedTokenCount,
            savedPercentage
        };
    } catch (error) {
        console.error('[SessionCompaction] Failed to compact:', error);
        // 실패 시 원본 반환
        return {
            compactedMessages: messages,
            summary: '',
            originalTokenCount,
            compactedTokenCount: originalTokenCount,
            savedPercentage: 0
        };
    }
}

/**
 * 자동 컴팩션 체크 및 실행
 * 임계치 초과 시 자동으로 컴팩션 실행
 */
export async function autoCompactIfNeeded(
    messages: Message[],
    threshold: number = 8000
): Promise<{ messages: Message[]; wasCompacted: boolean; stats?: CompactionResult }> {
    if (!needsCompaction(messages, threshold)) {
        return { messages, wasCompacted: false };
    }

    console.log('[SessionCompaction] Threshold exceeded, starting compaction...');
    const result = await compactSession(messages);

    console.log(`[SessionCompaction] Compacted: ${result.originalTokenCount} → ${result.compactedTokenCount} tokens (${result.savedPercentage}% saved)`);

    return {
        messages: result.compactedMessages,
        wasCompacted: true,
        stats: result
    };
}

/**
 * 컴팩션 전 중요 정보 추출 (Memory Flush)
 */
export async function extractImportantInfoBeforeCompaction(
    messages: Message[]
): Promise<{
    decisions: string[];
    actionItems: string[];
    keyFacts: string[];
}> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const conversationText = messages
        .filter(m => !m.isCompacted)
        .map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
        .join('\n\n');

    const prompt = `다음 대화에서 중요한 정보를 추출하세요.

대화:
${conversationText}

JSON 형식으로 응답:
{
    "decisions": ["내린 결정들"],
    "actionItems": ["해야 할 일들"],
    "keyFacts": ["중요한 사실들 (이름, 날짜, 숫자 등)"]
}

발견된 것만 포함하세요.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonStr = responseText.replace(/```json|```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('[SessionCompaction] Failed to extract important info:', error);
        return { decisions: [], actionItems: [], keyFacts: [] };
    }
}
