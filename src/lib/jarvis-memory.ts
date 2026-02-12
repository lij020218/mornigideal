/**
 * 자비스 장기 기억 시스템
 * - 대화, 메모, 인사이트를 벡터 임베딩으로 저장
 * - 맥락에 맞는 기억 검색 (RAG)
 * - 맥스 플랜 전용 기능
 */

import OpenAI from "openai";
import { supabaseAdmin } from "./supabase-admin";
import { isMaxPlan, canUseFeature } from "./user-plan";
import { MODELS } from "@/lib/models";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 메모리 타입
export type MemoryType =
    | "conversation"     // 대화 내용
    | "memo"            // 사용자 메모
    | "insight"         // AI가 발견한 인사이트
    | "preference"      // 사용자 선호도
    | "achievement"     // 성취 기록
    | "schedule_pattern"; // 일정 패턴

// 메모리 항목
export interface Memory {
    id: string;
    memoryType: MemoryType;
    content: string;
    metadata: Record<string, any>;
    importanceScore: number;
    memoryDate: string | null;
    createdAt: string;
}

// 검색 결과
export interface MemorySearchResult extends Memory {
    similarity: number;
}

/**
 * 이메일로 사용자 ID 조회
 */
async function getUserIdByEmail(email: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return data.id;
}

/**
 * 텍스트를 벡터 임베딩으로 변환
 */
async function createEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: MODELS.EMBEDDING_SMALL,
        input: text,
    });

    return response.data[0].embedding;
}

/**
 * 메모리 저장
 * @param email 사용자 이메일
 * @param content 저장할 내용
 * @param type 메모리 타입
 * @param metadata 추가 메타데이터
 * @param importanceScore 중요도 (0-1)
 */
export async function saveMemory(
    email: string,
    content: string,
    type: MemoryType,
    metadata: Record<string, any> = {},
    importanceScore: number = 0.5
): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        // 맥스 플랜 체크
        const hasAccess = await canUseFeature(email, "jarvis_memory");
        if (!hasAccess) {
            return {
                success: false,
                error: "장기 기억 기능은 맥스 플랜에서만 사용 가능합니다.",
            };
        }

        const userId = await getUserIdByEmail(email);
        if (!userId) {
            return { success: false, error: "사용자를 찾을 수 없습니다." };
        }

        // 임베딩 생성
        const embedding = await createEmbedding(content);

        // DB에 저장
        const { data, error } = await supabaseAdmin
            .from("user_memories")
            .insert({
                user_id: userId,
                memory_type: type,
                content,
                embedding: JSON.stringify(embedding),  // pgvector는 JSON 배열도 받음
                metadata,
                importance_score: importanceScore,
                memory_date: metadata.date || new Date().toISOString().split("T")[0],
            })
            .select("id")
            .single();

        if (error) {
            console.error("[JarvisMemory] Error saving memory:", error);
            return { success: false, error: error.message };
        }

        return { success: true, id: data.id };
    } catch (error: any) {
        console.error("[JarvisMemory] Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * 관련 기억 검색
 * @param email 사용자 이메일
 * @param query 검색 쿼리
 * @param options 검색 옵션
 */
export async function searchMemories(
    email: string,
    query: string,
    options: {
        limit?: number;
        memoryTypes?: MemoryType[];
        minSimilarity?: number;
    } = {}
): Promise<{ success: boolean; memories?: MemorySearchResult[]; error?: string }> {
    try {
        // 맥스 플랜 체크
        const hasAccess = await canUseFeature(email, "jarvis_memory");
        if (!hasAccess) {
            return {
                success: false,
                error: "장기 기억 기능은 맥스 플랜에서만 사용 가능합니다.",
            };
        }

        const userId = await getUserIdByEmail(email);
        if (!userId) {
            return { success: false, error: "사용자를 찾을 수 없습니다." };
        }

        const { limit = 5, memoryTypes, minSimilarity = 0.7 } = options;

        // 쿼리 임베딩 생성
        const queryEmbedding = await createEmbedding(query);

        // Supabase RPC 호출 (벡터 검색)
        const { data, error } = await supabaseAdmin.rpc("search_memories", {
            p_user_id: userId,
            p_query_embedding: JSON.stringify(queryEmbedding),
            p_limit: limit,
            p_memory_types: memoryTypes || null,
            p_min_similarity: minSimilarity,
        });

        if (error) {
            console.error("[JarvisMemory] Search error:", error);
            return { success: false, error: error.message };
        }

        const memories: MemorySearchResult[] = (data || []).map((m: any) => ({
            id: m.id,
            memoryType: m.memory_type,
            content: m.content,
            metadata: m.metadata,
            importanceScore: m.importance_score,
            memoryDate: m.memory_date,
            similarity: m.similarity,
            createdAt: m.created_at,
        }));

        return { success: true, memories };
    } catch (error: any) {
        console.error("[JarvisMemory] Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * 대화에서 중요한 정보 추출 및 저장
 * @param email 사용자 이메일
 * @param conversation 대화 내용
 */
export async function extractAndSaveInsights(
    email: string,
    conversation: { role: string; content: string }[]
): Promise<void> {
    try {
        const hasAccess = await canUseFeature(email, "jarvis_memory");
        if (!hasAccess) return;

        // GPT로 중요 정보 추출
        const response = await openai.chat.completions.create({
            model: MODELS.GPT_4O_MINI,
            messages: [
                {
                    role: "system",
                    content: `대화에서 나중에 기억해야 할 중요한 정보를 추출하세요.

추출 대상:
1. 사용자의 선호도, 취향
2. 중요한 계획이나 목표
3. 개인적인 사정이나 제약
4. 반복되는 패턴
5. 특별한 이벤트나 기념일

JSON 형식으로 응답:
{
  "insights": [
    {
      "type": "preference" | "goal" | "constraint" | "pattern" | "event",
      "content": "추출된 정보",
      "importance": 0.1-1.0
    }
  ]
}

추출할 정보가 없으면 빈 배열 반환: {"insights": []}`
                },
                {
                    role: "user",
                    content: JSON.stringify(conversation.slice(-10)),  // 최근 10개 메시지
                },
            ],
            temperature: 0.3,
        });

        const result = response.choices[0]?.message?.content;
        if (!result) return;

        try {
            const { insights } = JSON.parse(result);

            for (const insight of insights) {
                const memoryType: MemoryType =
                    insight.type === "preference" ? "preference" :
                    insight.type === "pattern" ? "schedule_pattern" : "insight";

                await saveMemory(
                    email,
                    insight.content,
                    memoryType,
                    { extractedFrom: "conversation", originalType: insight.type },
                    insight.importance
                );
            }

        } catch (parseError) {
            console.error("[JarvisMemory] Failed to parse insights:", parseError);
        }
    } catch (error) {
        console.error("[JarvisMemory] Error extracting insights:", error);
    }
}

/**
 * 컨텍스트 생성 - 현재 대화에 관련된 기억 가져오기
 * @param email 사용자 이메일
 * @param currentContext 현재 대화 컨텍스트
 */
export async function getRelevantContext(
    email: string,
    currentContext: string
): Promise<string> {
    const result = await searchMemories(email, currentContext, {
        limit: 3,
        minSimilarity: 0.75,
    });

    if (!result.success || !result.memories?.length) {
        return "";
    }

    const contextParts = result.memories.map((m, i) => {
        const date = m.memoryDate ? `(${m.memoryDate})` : "";
        return `${i + 1}. ${m.content} ${date}`;
    });

    return `
[관련 기억]
${contextParts.join("\n")}
`;
}

/**
 * 메모리 삭제
 */
export async function deleteMemory(
    email: string,
    memoryId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const userId = await getUserIdByEmail(email);
        if (!userId) {
            return { success: false, error: "사용자를 찾을 수 없습니다." };
        }

        const { error } = await supabaseAdmin
            .from("user_memories")
            .delete()
            .eq("id", memoryId)
            .eq("user_id", userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * 최근 메모리 목록 조회
 */
export async function getRecentMemories(
    email: string,
    limit: number = 10
): Promise<{ success: boolean; memories?: Memory[]; error?: string }> {
    try {
        const userId = await getUserIdByEmail(email);
        if (!userId) {
            return { success: false, error: "사용자를 찾을 수 없습니다." };
        }

        const { data, error } = await supabaseAdmin
            .from("user_memories")
            .select("id, memory_type, content, metadata, importance_score, memory_date, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            return { success: false, error: error.message };
        }

        const memories: Memory[] = (data || []).map((m: any) => ({
            id: m.id,
            memoryType: m.memory_type,
            content: m.content,
            metadata: m.metadata,
            importanceScore: m.importance_score,
            memoryDate: m.memory_date,
            createdAt: m.created_at,
        }));

        return { success: true, memories };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
