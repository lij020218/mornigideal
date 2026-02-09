import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateEmbedding, prepareTextForEmbedding, generateContentHash } from "@/lib/embeddings";

// 플랜별 RAG 설정
const RAG_PLAN_CONFIG: Record<string, { threshold: number; limit: number; maxAgeDays: number | null; storageMb: number }> = {
    Free: { threshold: 0.8, limit: 3, maxAgeDays: 30, storageMb: 50 },
    Standard: { threshold: 0.8, limit: 3, maxAgeDays: 30, storageMb: 50 },
    Pro: { threshold: 0.75, limit: 5, maxAgeDays: null, storageMb: 100 },
    Max: { threshold: 0.7, limit: 10, maxAgeDays: null, storageMb: 1000 },
};

export interface MemoryEntry {
    id: string;
    user_id: string;
    content_type: 'chat' | 'schedule' | 'goal' | 'event' | 'pattern';
    content: string;
    embedding: number[];
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface SimilarMemory {
    id: string;
    content: string;
    content_type: string;
    metadata: Record<string, any>;
    similarity: number;
    created_at: string;
}

// POST: Store new memory with embedding
export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { content, contentType, metadata } = await request.json();

        if (!content || !contentType) {
            return NextResponse.json(
                { error: "Missing content or contentType" },
                { status: 400 }
            );
        }

        // Get user ID
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("id, plan")
            .eq("email", email)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 플랜별 용량 한도 체크
        const userPlan = userData.plan || "Free";
        const planConfig = RAG_PLAN_CONFIG[userPlan] || RAG_PLAN_CONFIG.Free;

        const { data: storageData } = await supabaseAdmin.rpc('get_user_memory_size_mb', {
            p_user_id: userData.id,
        }).maybeSingle() as { data: { size_mb: number } | null };

        const currentSizeMb = storageData?.size_mb || 0;
        if (currentSizeMb >= planConfig.storageMb) {
            return NextResponse.json(
                { error: `Storage limit exceeded (${planConfig.storageMb}MB for ${userPlan} plan)` },
                { status: 429 }
            );
        }

        // 중복 체크 (content_hash)
        const contentHash = await generateContentHash(content);
        const { data: existing } = await supabaseAdmin
            .from("user_memory")
            .select("id")
            .eq("user_id", userData.id)
            .eq("content_hash", contentHash)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ success: true, memory: existing, deduplicated: true });
        }

        // Prepare text and generate embedding
        const preparedText = prepareTextForEmbedding(content, contentType, metadata);
        const { embedding } = await generateEmbedding(preparedText);

        // Store in database
        const { data, error } = await supabaseAdmin
            .from("user_memory")
            .insert({
                user_id: userData.id,
                content_type: contentType,
                content: content,
                embedding: JSON.stringify(embedding),
                content_hash: contentHash,
                metadata: metadata || {},
            })
            .select()
            .single();

        if (error) {
            console.error("[Memory] Store error:", error);
            return NextResponse.json(
                { error: "Failed to store memory" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, memory: data });
    } catch (error) {
        console.error("[Memory] POST Error:", error);
        return NextResponse.json(
            { error: "Failed to store memory" },
            { status: 500 }
        );
    }
}

// GET: Retrieve similar memories by semantic search
export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query');
        const threshold = parseFloat(searchParams.get('threshold') || '0.7');
        const limit = parseInt(searchParams.get('limit') || '5');
        const contentType = searchParams.get('contentType'); // Optional filter

        if (!query) {
            return NextResponse.json(
                { error: "Missing query parameter" },
                { status: 400 }
            );
        }

        // Get user ID
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("id, plan")
            .eq("email", email)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 플랜별 차등 검색 설정
        const userPlan = userData.plan || "Free";
        const planConfig = RAG_PLAN_CONFIG[userPlan] || RAG_PLAN_CONFIG.Free;

        // 클라이언트 파라미터 대신 플랜 설정 우선 적용
        const effectiveThreshold = Math.max(threshold, planConfig.threshold);
        const effectiveLimit = Math.min(limit, planConfig.limit);

        // Generate embedding for query
        const { embedding: queryEmbedding } = await generateEmbedding(query);

        // Use the search_similar_memories function
        const { data: memories, error } = await supabaseAdmin.rpc(
            'search_similar_memories',
            {
                query_embedding: JSON.stringify(queryEmbedding),
                match_user_id: userData.id,
                match_threshold: effectiveThreshold,
                match_count: effectiveLimit,
            }
        );

        if (error) {
            console.error("[Memory] Search error:", error);
            return NextResponse.json(
                { error: "Failed to search memories" },
                { status: 500 }
            );
        }

        // Filter by content type if specified
        let filteredMemories = memories || [];
        if (contentType) {
            filteredMemories = filteredMemories.filter(
                (m: SimilarMemory) => m.content_type === contentType
            );
        }

        // 플랜별 기간 필터 (Free/Standard: 최근 30일만)
        if (planConfig.maxAgeDays) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - planConfig.maxAgeDays);
            const cutoffStr = cutoff.toISOString();
            filteredMemories = filteredMemories.filter(
                (m: SimilarMemory) => m.created_at >= cutoffStr
            );
        }

        return NextResponse.json({
            memories: filteredMemories,
            count: filteredMemories.length,
        });
    } catch (error) {
        console.error("[Memory] GET Error:", error);
        return NextResponse.json(
            { error: "Failed to retrieve memories" },
            { status: 500 }
        );
    }
}

// DELETE: Remove old memories (cleanup)
export async function DELETE(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const memoryId = searchParams.get('id');
        const olderThan = searchParams.get('olderThan'); // ISO date string

        // Get user ID
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", email)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (memoryId) {
            // Delete specific memory
            const { error } = await supabaseAdmin
                .from("user_memory")
                .delete()
                .eq("id", memoryId)
                .eq("user_id", userData.id);

            if (error) {
                console.error("[Memory] Delete error:", error);
                return NextResponse.json(
                    { error: "Failed to delete memory" },
                    { status: 500 }
                );
            }

            return NextResponse.json({ success: true });
        }

        if (olderThan) {
            // Delete memories older than date
            const { error, count } = await supabaseAdmin
                .from("user_memory")
                .delete()
                .eq("user_id", userData.id)
                .lt("created_at", olderThan);

            if (error) {
                console.error("[Memory] Cleanup error:", error);
                return NextResponse.json(
                    { error: "Failed to cleanup memories" },
                    { status: 500 }
                );
            }

            return NextResponse.json({ success: true, deleted: count });
        }

        return NextResponse.json(
            { error: "Missing id or olderThan parameter" },
            { status: 400 }
        );
    } catch (error) {
        console.error("[Memory] DELETE Error:", error);
        return NextResponse.json(
            { error: "Failed to delete memories" },
            { status: 500 }
        );
    }
}
