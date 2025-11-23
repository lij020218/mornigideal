-- ==========================================
-- Trend Briefing Cache Tables
-- Store daily trend briefings and detailed analysis per user
-- ==========================================

-- 1. Trends Cache Table
-- Stores daily trend briefings for each user
CREATE TABLE IF NOT EXISTS trends_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    date DATE NOT NULL,
    trends JSONB NOT NULL, -- Array of trend objects
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(email, date)
);

CREATE INDEX IF NOT EXISTS idx_trends_cache_user_date ON trends_cache(email, date);

-- 2. Trend Details Table
-- Stores detailed analysis for individual trends
CREATE TABLE IF NOT EXISTS trend_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    trend_id TEXT NOT NULL,
    detail_data JSONB NOT NULL, -- Full detail object
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(email, trend_id)
);

CREATE INDEX IF NOT EXISTS idx_trend_details_user ON trend_details(email);
CREATE INDEX IF NOT EXISTS idx_trend_details_lookup ON trend_details(email, trend_id);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_trend_details_updated_at ON trend_details;
CREATE TRIGGER update_trend_details_updated_at
    BEFORE UPDATE ON trend_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. Enable RLS
ALTER TABLE trends_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_details ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies (permissive for now)
DROP POLICY IF EXISTS "Enable access for all users" ON trends_cache;
CREATE POLICY "Enable access for all users" ON trends_cache
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable access for all users" ON trend_details;
CREATE POLICY "Enable access for all users" ON trend_details
    FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- Migration Complete
-- Next: Run in Supabase SQL Editor
-- ==========================================
