-- Learning Curriculums Table
CREATE TABLE IF NOT EXISTS user_learning_curriculums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    reason TEXT,
    current_level TEXT,
    target_level TEXT,
    duration INTEGER,
    curriculum_data JSONB,
    user_plan TEXT DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning Progress Table
CREATE TABLE IF NOT EXISTS learning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    curriculum_id UUID REFERENCES user_learning_curriculums(id) ON DELETE CASCADE,
    completed_days INTEGER[] DEFAULT '{}',
    current_day INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning Slides Table (for Max plan users)
CREATE TABLE IF NOT EXISTS learning_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID REFERENCES user_learning_curriculums(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    day_title TEXT,
    slides_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add plan field to user profile (run as ALTER if users table exists)
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'standard';

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_learning_curriculums_user_id ON user_learning_curriculums(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_curriculum ON learning_progress(user_id, curriculum_id);
CREATE INDEX IF NOT EXISTS idx_learning_slides_curriculum_day ON learning_slides(curriculum_id, day_number);

-- Comment: User plans
-- standard: Basic plan - AI curriculum only
-- pro: Pro plan - AI curriculum with more features
-- max: Max plan (29,000 KRW/month) - AI curriculum + 15-slide presentations per day
