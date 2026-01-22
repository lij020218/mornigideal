-- Chat History Table
-- Stores user chat conversations by date

CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    title TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_date ON chat_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_date ON chat_history(user_id, date DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_history TO authenticated;
GRANT ALL ON chat_history TO service_role;
GRANT ALL ON chat_history TO postgres;
