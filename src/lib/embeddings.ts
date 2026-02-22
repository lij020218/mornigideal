/**
 * Embedding Generation Utility for RAG
 * Uses OpenAI Embeddings API to generate vector embeddings
 */

import OpenAI from 'openai';
import { MODELS } from "@/lib/models";
import { embeddingCircuit } from '@/lib/circuit-breaker';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface EmbeddingResult {
    embedding: number[];
    tokens: number;
}

// --- LRU Embedding Cache ---
const CACHE_MAX = 100;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
    embedding: number[];
    tokens: number;
    createdAt: number;
}

const embeddingCache = new Map<string, CacheEntry>();

function evictStale(): void {
    const now = Date.now();
    for (const [key, entry] of embeddingCache) {
        if (now - entry.createdAt > CACHE_TTL_MS) {
            embeddingCache.delete(key);
        }
    }
    // LRU eviction: Map iteration order is insertion order, so first key is oldest
    while (embeddingCache.size > CACHE_MAX) {
        const oldest = embeddingCache.keys().next().value;
        if (oldest) embeddingCache.delete(oldest);
    }
}

/**
 * Clear the embedding cache (useful for testing)
 */
export function clearEmbeddingCache(): void {
    embeddingCache.clear();
}

/**
 * Generate embedding vector for given text
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions)
 * Results are cached in-memory (LRU, max 100 entries, 30 min TTL)
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
        const cacheKey = await generateContentHash(text);

        // Check cache
        const cached = embeddingCache.get(cacheKey);
        if (cached && (Date.now() - cached.createdAt) < CACHE_TTL_MS) {
            // Move to end for LRU freshness (delete + re-insert)
            embeddingCache.delete(cacheKey);
            embeddingCache.set(cacheKey, cached);
            return { embedding: cached.embedding, tokens: cached.tokens };
        }

        const response = await embeddingCircuit.execute(() =>
            openai.embeddings.create({
                model: MODELS.EMBEDDING_SMALL,
                input: text,
                encoding_format: 'float',
            })
        );

        const result: EmbeddingResult = {
            embedding: response.data[0].embedding,
            tokens: response.usage.total_tokens,
        };

        // Store in cache
        embeddingCache.set(cacheKey, {
            embedding: result.embedding,
            tokens: result.tokens,
            createdAt: Date.now(),
        });

        evictStale();

        return result;
    } catch (error) {
        console.error('[Embeddings] Failed to generate embedding:', error);
        throw new Error('Failed to generate embedding');
    }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
    try {
        const response = await embeddingCircuit.execute(() =>
            openai.embeddings.create({
                model: MODELS.EMBEDDING_SMALL,
                input: texts,
                encoding_format: 'float',
            })
        );

        return response.data.map((item) => ({
            embedding: item.embedding,
            tokens: response.usage.total_tokens / texts.length, // Approximate per-text
        }));
    } catch (error) {
        console.error('[Embeddings] Failed to generate embeddings batch:', error);
        throw new Error('Failed to generate embeddings batch');
    }
}

/**
 * Prepare text content for embedding
 * Truncates if too long, adds context metadata
 */
export function prepareTextForEmbedding(
    content: string,
    contentType: 'chat' | 'schedule' | 'goal' | 'event' | 'pattern',
    metadata?: Record<string, any>
): string {
    const MAX_LENGTH = 8000; // Roughly 2000 tokens, safe limit for embeddings

    let preparedText = content;

    // Add content type context
    switch (contentType) {
        case 'chat':
            preparedText = `대화 내용: ${content}`;
            break;
        case 'schedule':
            preparedText = `일정: ${content}`;
            if (metadata?.startTime) {
                preparedText += ` (시작: ${metadata.startTime})`;
            }
            break;
        case 'goal':
            preparedText = `목표: ${content}`;
            break;
        case 'event':
            preparedText = `이벤트: ${content}`;
            break;
        case 'pattern':
            preparedText = `패턴 분석: ${content}`;
            break;
    }

    // Add date context if available
    if (metadata?.date) {
        preparedText = `[${metadata.date}] ${preparedText}`;
    }

    // Truncate if too long
    if (preparedText.length > MAX_LENGTH) {
        preparedText = preparedText.substring(0, MAX_LENGTH) + '...';
    }

    return preparedText;
}

/**
 * Check if a message is meaningful enough to embed
 * Filters out short/trivial messages to save embedding costs
 */
export function isMessageMeaningful(content: string): boolean {
    const trimmed = content.trim();

    // Too short
    if (trimmed.length < 5) return false;

    // Korean filler / trivial responses
    const trivialPatterns = [
        /^[ㅋㅎㅠㅜㅡ]+$/,           // ㅋㅋㅋ, ㅎㅎ, ㅠㅠ
        /^[ㅇㅂㄱㄴㄷㅈㅊㅁ]+$/,      // ㅇㅇ, ㅂㅂ
        /^(네|넵|넹|응|ㅇㅇ|ㅇㅋ|ㄴㄴ|ㄱㅊ|ㄱㄱ|ㅎㅇ)$/,
        /^(ok|okay|yes|no|ㅇㅋ|ㅇ|nope)$/i,
        /^(ㅇㅋ|알겠|그래|좋아|됐어|감사|고마워|ㅅㄱ|수고)$/,
        /^(안녕|하이|헬로|hi|hello|hey)$/i,
        /^\.+$/,                      // ...
        /^!+$/,                       // !!!
        /^[?？]+$/,                   // ???
    ];

    for (const pattern of trivialPatterns) {
        if (pattern.test(trimmed)) return false;
    }

    // Pure emoji only
    const emojiStripped = trimmed.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
    if (emojiStripped.length === 0) return false;

    return true;
}

/**
 * Generate SHA-256 content hash for deduplication
 */
export async function generateContentHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (higher = more similar)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
