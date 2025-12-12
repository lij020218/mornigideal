-- ========================================
-- Recommendations Cache Table
-- ========================================
-- Stores pre-generated personalized recommendations for fast loading

CREATE TABLE IF NOT EXISTS recommendations_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    date DATE NOT NULL,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one cache per user per day
    UNIQUE(email, date)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_recommendations_cache_email_date
ON recommendations_cache(email, date);

-- Enable Row Level Security
ALTER TABLE recommendations_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own recommendations
CREATE POLICY "Users can read own recommendations"
ON recommendations_cache
FOR SELECT
USING (auth.email() = email);

-- Policy: Service role can manage all recommendations (for cron jobs)
CREATE POLICY "Service role can manage recommendations"
ON recommendations_cache
FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE recommendations_cache IS 'Cache for pre-generated daily personalized recommendations (YouTube videos, articles, etc.)';
