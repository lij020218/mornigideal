-- Add quality rating column to materials table
-- Users can rate analysis quality as "poor" (별로임) or "good" (좋음)

ALTER TABLE materials
ADD COLUMN IF NOT EXISTS quality_rating TEXT CHECK (quality_rating IN ('poor', 'good', NULL));

-- Create index for analytics
CREATE INDEX IF NOT EXISTS idx_materials_quality_rating ON materials(quality_rating) WHERE quality_rating IS NOT NULL;

-- Add comment
COMMENT ON COLUMN materials.quality_rating IS 'User quality rating: poor (별로임) or good (좋음)';
