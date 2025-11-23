-- ==========================================
-- Trend Briefing Tables Migration
-- Add email column to existing tables for user-specific caching
-- ==========================================

-- Step 1: Add email column to trends_cache
-- (If table has existing data, this might fail. See Step 1b below)
ALTER TABLE trends_cache 
ADD COLUMN email TEXT;

-- Step 2: Add email column to trend_details
ALTER TABLE trend_details 
ADD COLUMN email TEXT;

-- Step 3: Drop old UNIQUE constraints (they don't include email)
ALTER TABLE trends_cache 
DROP CONSTRAINT IF EXISTS trends_cache_date_key;

ALTER TABLE trend_details 
DROP CONSTRAINT IF EXISTS trend_details_trend_id_key;

-- Step 4: Make email NOT NULL (after adding data if needed)
-- If you have existing data, you need to update it first with a default email
-- UPDATE trends_cache SET email = 'admin@example.com' WHERE email IS NULL;
-- UPDATE trend_details SET email = 'admin@example.com' WHERE email IS NULL;

ALTER TABLE trends_cache 
ALTER COLUMN email SET NOT NULL;

ALTER TABLE trend_details 
ALTER COLUMN email SET NOT NULL;

-- Step 5: Add new UNIQUE constraints with email
ALTER TABLE trends_cache 
ADD CONSTRAINT trends_cache_email_date_unique UNIQUE (email, date);

ALTER TABLE trend_details 
ADD CONSTRAINT trend_details_email_trend_id_unique UNIQUE (email, trend_id);

-- Step 6: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trends_cache_email_date ON trends_cache(email, date);
CREATE INDEX IF NOT EXISTS idx_trend_details_email ON trend_details(email);
CREATE INDEX IF NOT EXISTS idx_trend_details_email_trend_id ON trend_details(email, trend_id);

-- Step 7: Ensure RLS is enabled (if not already)
ALTER TABLE trends_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_details ENABLE ROW LEVEL SECURITY;

-- Step 8: Create/Update RLS Policies
DROP POLICY IF EXISTS "Enable access for all users" ON trends_cache;
CREATE POLICY "Enable access for all users" ON trends_cache
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable access for all users" ON trend_details;
CREATE POLICY "Enable access for all users" ON trend_details
    FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- Migration Complete!
-- 
-- IMPORTANT: If you have existing data in the tables:
-- 1. Before Step 4, run these updates:
--    UPDATE trends_cache SET email = 'default@example.com' WHERE email IS NULL;
--    UPDATE trend_details SET email = 'default@example.com' WHERE email IS NULL;
-- 2. Or simply delete old data:
--    DELETE FROM trends_cache;
--    DELETE FROM trend_details;
-- ==========================================
