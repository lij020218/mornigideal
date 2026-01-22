import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateEmbedding, prepareTextForEmbedding } from "@/lib/embeddings";

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
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
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
            .eq("email", session.user.email)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // RAG is Max plan only
        if (userData.plan !== "Max") {
            return NextResponse.json(
                { error: "RAG feature is Max plan only" },
                { status: 403 }
            );
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
                embedding: JSON.stringify(embedding), // pgvector accepts array as string
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
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
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
            .eq("email", session.user.email)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // RAG is Max plan only
        if (userData.plan !== "Max") {
            return NextResponse.json(
                { error: "RAG feature is Max plan only" },
                { status: 403 }
            );
        }

        // Generate embedding for query
        const { embedding: queryEmbedding } = await generateEmbedding(query);

        // Use the search_similar_memories function
        const { data: memories, error } = await supabaseAdmin.rpc(
            'search_similar_memories',
            {
                query_embedding: JSON.stringify(queryEmbedding),
                match_user_id: userData.id,
                match_threshold: threshold,
                match_count: limit,
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
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const memoryId = searchParams.get('id');
        const olderThan = searchParams.get('olderThan'); // ISO date string

        // Get user ID
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", session.user.email)
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
