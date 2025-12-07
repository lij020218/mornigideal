-- Create folders table for organizing materials
CREATE TABLE IF NOT EXISTS folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster queries
CREATE INDEX IF NOT EXISTS idx_folders_email ON folders(email);

-- Add folder_id column to materials table
ALTER TABLE materials ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Create index on folder_id
CREATE INDEX IF NOT EXISTS idx_materials_folder_id ON materials(folder_id);

-- NOTE: Since we're using NextAuth (not Supabase Auth), RLS policies won't work correctly.
-- We handle authorization in the API routes instead.
-- If you want to enable RLS, you'll need to set up Supabase Auth integration.

-- Disable RLS for now (authorization handled in API)
-- ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
