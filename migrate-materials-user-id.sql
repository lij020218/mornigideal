-- Migration script to fix user_id in materials table
-- This updates user_id from email to auth.uid() for existing records

-- Step 1: Update materials where user_id looks like an email (contains @)
-- Match with auth.users table to get the correct UUID
UPDATE materials
SET user_id = auth.users.id::text
FROM auth.users
WHERE materials.user_id = auth.users.email
  AND materials.user_id LIKE '%@%';

-- Step 2: Verify the migration
-- This should return 0 if migration was successful
SELECT COUNT(*) as remaining_email_user_ids
FROM materials
WHERE user_id LIKE '%@%';

-- Step 3: Show sample of updated records
SELECT id, user_id, title, created_at
FROM materials
ORDER BY created_at DESC
LIMIT 10;
