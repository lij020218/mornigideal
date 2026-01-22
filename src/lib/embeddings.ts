/**
 * Embedding Generation Utility for RAG
 * Uses OpenAI Embeddings API to generate vector embeddings
 */

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface EmbeddingResult {
    embedding: number[];
    tokens: number;
}

/**
 * Generate embedding vector for given text
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
            encoding_format: 'float',
        });

        return {
            embedding: response.data[0].embedding,
            tokens: response.usage.total_tokens,
        };
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
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: texts,
            encoding_format: 'float',
        });

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
