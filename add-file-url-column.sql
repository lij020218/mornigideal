-- Add file_url column to existing materials table if it doesn't exist
ALTER TABLE materials ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Add page_analyses column for storing per-page analysis
ALTER TABLE materials ADD COLUMN IF NOT EXISTS page_analyses JSONB;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'materials';
