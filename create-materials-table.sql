-- Materials table for storing analyzed documents
CREATE TABLE IF NOT EXISTS materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    key_points JSONB,
    insights JSONB,
    exam_points JSONB,
    type TEXT NOT NULL CHECK (type IN ('exam', 'work')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC);

-- Enable Row Level Security
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only see their own materials
CREATE POLICY "Users can only access their own materials"
    ON materials
    FOR ALL
    USING (user_id = current_setting('request.jwt.claim.sub', true));
