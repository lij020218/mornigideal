-- Add profile column to users table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'profile'
    ) THEN
        ALTER TABLE users ADD COLUMN profile JSONB;
    END IF;
END $$;

-- Add index for profile queries
CREATE INDEX IF NOT EXISTS idx_users_profile ON users USING GIN (profile);

-- Update existing users to have empty profile
UPDATE users SET profile = '{}'::jsonb WHERE profile IS NULL;
