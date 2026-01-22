-- User Memory Table for RAG (Retrieval-Augmented Generation)
-- Stores vector embeddings of conversations, schedules, and goals for Max plan users

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing table if exists
DROP TABLE IF EXISTS user_memory CASCADE;

-- Create table with vector column for embeddings
CREATE TABLE user_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, -- 'chat', 'schedule', 'goal', 'event'
    content TEXT NOT NULL, -- The actual text content
    embedding vector(1536), -- OpenAI ada-002 embedding dimension
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional context (date, tags, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT user_memory_content_type_check CHECK (
        content_type IN ('chat', 'schedule', 'goal', 'event', 'pattern')
    )
);

-- Create indexes for better query performance
CREATE INDEX idx_user_memory_user_id ON user_memory(user_id);
CREATE INDEX idx_user_memory_content_type ON user_memory(content_type);
CREATE INDEX idx_user_memory_created_at ON user_memory(created_at DESC);

-- Create vector similarity search index (HNSW for fast approximate search)
CREATE INDEX idx_user_memory_embedding ON user_memory
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Grant permissions (service role for API access)
GRANT SELECT, INSERT, UPDATE, DELETE ON user_memory TO authenticated;
GRANT ALL ON user_memory TO service_role;
GRANT ALL ON user_memory TO postgres;

-- Helper function: Search similar memories by vector similarity
CREATE OR REPLACE FUNCTION search_similar_memories(
    query_embedding vector(1536),
    match_user_id UUID,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    content_type TEXT,
    metadata JSONB,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        user_memory.id,
        user_memory.content,
        user_memory.content_type,
        user_memory.metadata,
        1 - (user_memory.embedding <=> query_embedding) AS similarity,
        user_memory.created_at
    FROM user_memory
    WHERE user_memory.user_id = match_user_id
        AND 1 - (user_memory.embedding <=> query_embedding) > match_threshold
    ORDER BY user_memory.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION search_similar_memories TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_memories TO service_role;
