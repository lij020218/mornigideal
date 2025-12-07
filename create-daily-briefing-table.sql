-- ==========================================
-- Daily Briefing Table
-- Stores pre-generated daily briefings
-- ==========================================

CREATE TABLE IF NOT EXISTS daily_briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    content JSONB NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    
    -- Ensure one briefing per user per day
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefings_user_date ON daily_briefings(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_briefings_date ON daily_briefings(date);

-- RLS Policies
ALTER TABLE daily_briefings ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own briefings
DROP POLICY IF EXISTS "Users can read own briefings" ON daily_briefings;
CREATE POLICY "Users can read own briefings" ON daily_briefings
    FOR SELECT USING (auth.uid() = user_id);

-- Allow system (service role) to insert/update - handled by bypassing RLS in server code usually, 
-- but we can add policy if needed. For now simplest standard policy:
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON daily_briefings;
CREATE POLICY "Enable all access for authenticated users" ON daily_briefings
    FOR ALL USING (true) WITH CHECK (true);
