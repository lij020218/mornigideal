-- Add file_hash column to materials table for caching
ALTER TABLE materials ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_materials_file_hash ON materials(file_hash);
