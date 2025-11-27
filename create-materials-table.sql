-- Create materials table for storing uploaded materials and their AI analysis
CREATE TABLE IF NOT EXISTS materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('exam', 'work')),
    analysis JSONB NOT NULL,
    file_url TEXT, -- URL to PDF file in Supabase Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own materials
CREATE POLICY "Users can view their own materials"
    ON materials FOR SELECT
    USING (auth.uid()::text = user_id);

-- Create policy to allow users to insert their own materials
CREATE POLICY "Users can insert their own materials"
    ON materials FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Create policy to allow users to update their own materials
CREATE POLICY "Users can update their own materials"
    ON materials FOR UPDATE
    USING (auth.uid()::text = user_id);

-- Create policy to allow users to delete their own materials
CREATE POLICY "Users can delete their own materials"
    ON materials FOR DELETE
    USING (auth.uid()::text = user_id);
