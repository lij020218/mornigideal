-- Add profile column to users table (skip if already exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB;

-- Add index for profile queries (skip if already exists)
CREATE INDEX IF NOT EXISTS idx_users_profile ON users USING GIN (profile);

-- Update existing users to have empty profile
UPDATE users SET profile = '{}'::jsonb WHERE profile IS NULL;
