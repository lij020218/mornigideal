-- ========================================
-- Habit Insights Cache Table
-- ========================================
-- Stores pre-generated AI habit analysis insights for fast loading

CREATE TABLE IF NOT EXISTS habit_insights_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    date DATE NOT NULL,
    insights JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one cache per user per day
    UNIQUE(email, date)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_habit_insights_cache_email_date
ON habit_insights_cache(email, date);

-- Enable Row Level Security
ALTER TABLE habit_insights_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own habit insights
CREATE POLICY "Users can read own habit insights"
ON habit_insights_cache
FOR SELECT
USING (auth.email() = email);

-- Policy: Service role can manage all habit insights (for background generation)
CREATE POLICY "Service role can manage habit insights"
ON habit_insights_cache
FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE habit_insights_cache IS 'Cache for AI-generated habit analysis insights based on user schedules (6-hour cache)';
