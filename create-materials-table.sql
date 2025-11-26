-- Materials table for storing analyzed documents
CREATE TABLE IF NOT EXISTS materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('exam', 'work')),
    analysis JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC);

-- Enable Row Level Security
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can only access their own materials" ON materials;

-- Create policy for users to access their own materials
-- This allows authenticated users to insert, update, and select their own records
CREATE POLICY "Users can manage their own materials"
    ON materials
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

-- Allow service role to bypass RLS
ALTER TABLE materials FORCE ROW LEVEL SECURITY;
