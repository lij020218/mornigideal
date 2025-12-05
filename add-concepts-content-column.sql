-- Add concepts_content column to materials table
-- This stores AI-generated key concepts summary for exam preparation

-- Add the column to analysis JSONB field (no schema change needed)
-- The concepts_content will be stored as: analysis.concepts_content

-- For future queries, you can access it like:
-- SELECT analysis->'concepts_content' FROM materials WHERE id = 'xxx';

-- No migration needed - JSONB fields are schema-free
-- Just documenting that we're now storing:
-- {
--   "content": "...",           // AI summary
--   "concepts_content": "...",  // Key concepts (generated on demand)
--   "metrics": {...},
--   "status": "completed"
-- }
