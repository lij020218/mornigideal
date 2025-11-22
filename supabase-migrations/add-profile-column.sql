-- Add profile column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB;

-- Add index for profile queries
CREATE INDEX IF NOT EXISTS idx_users_profile ON users USING GIN (profile);

-- Update existing users to have empty profile
UPDATE users SET profile = '{}'::jsonb WHERE profile IS NULL;
