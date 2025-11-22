-- ==========================================
-- LocalStorage to Supabase Migration
-- Create tables for scalable user data storage
-- ==========================================

-- 1. User Curriculums Table
-- Stores user's active curriculums (replaces localStorage 'user_curriculum')
CREATE TABLE IF NOT EXISTS user_curriculums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    curriculum_id TEXT NOT NULL,
    curriculum_data JSONB NOT NULL, -- Full curriculum structure from API
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, curriculum_id)
);

CREATE INDEX IF NOT EXISTS idx_user_curriculums_user_id ON user_curriculums(user_id);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_user_curriculums_updated_at ON user_curriculums;
CREATE TRIGGER update_user_curriculums_updated_at
    BEFORE UPDATE ON user_curriculums
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Curriculum Progress Table
-- Tracks completion status for each curriculum (replaces localStorage progress tracking)
CREATE TABLE IF NOT EXISTS curriculum_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    curriculum_id TEXT NOT NULL,
    completed_days INTEGER[] DEFAULT '{}', -- Array of completed day numbers [1, 2, 3]
    current_day INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, curriculum_id)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_progress_user_id ON curriculum_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_progress_lookup ON curriculum_progress(user_id, curriculum_id);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_curriculum_progress_updated_at ON curriculum_progress;
CREATE TRIGGER update_curriculum_progress_updated_at
    BEFORE UPDATE ON curriculum_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. Daily Goals Table
-- Tracks daily goal completion and read trends (replaces localStorage daily goals)
CREATE TABLE IF NOT EXISTS daily_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed_goals TEXT[] DEFAULT '{}', -- Array of completed goal IDs
    read_trends TEXT[] DEFAULT '{}', -- Array of read trend IDs
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_goals_user_date ON daily_goals(user_id, date);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_daily_goals_updated_at ON daily_goals;
CREATE TRIGGER update_daily_goals_updated_at
    BEFORE UPDATE ON daily_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable RLS on new tables
ALTER TABLE user_curriculums ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_goals ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies (permissive for custom auth via API layer)
-- user_curriculums policies
DROP POLICY IF EXISTS "Enable access for all users" ON user_curriculums;
CREATE POLICY "Enable access for all users" ON user_curriculums
    FOR ALL USING (true) WITH CHECK (true);

-- curriculum_progress policies
DROP POLICY IF EXISTS "Enable access for all users" ON curriculum_progress;
CREATE POLICY "Enable access for all users" ON curriculum_progress
    FOR ALL USING (true) WITH CHECK (true);

-- daily_goals policies
DROP POLICY IF EXISTS "Enable access for all users" ON daily_goals;
CREATE POLICY "Enable access for all users" ON daily_goals
    FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- Migration Complete
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Create API endpoints to interact with these tables
-- 3. Update frontend components to use APIs instead of localStorage
-- ==========================================
