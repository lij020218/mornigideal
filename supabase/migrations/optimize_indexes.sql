-- ========================================
-- Performance Optimization: Database Indexes
-- ========================================
-- Run this in your Supabase SQL Editor to improve query performance

-- Materials table indexes
CREATE INDEX IF NOT EXISTS idx_materials_user_created
ON materials(user_id, created_at DESC);

-- User curriculums table indexes
CREATE INDEX IF NOT EXISTS idx_user_curriculums_user_created
ON user_curriculums(user_id, created_at DESC);

-- Trends cache table indexes
CREATE INDEX IF NOT EXISTS idx_trends_cache_email_date
ON trends_cache(email, date);

-- Users table indexes (if not already exists)
CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

-- ========================================
-- Query Performance Tips
-- ========================================
-- 1. These indexes will dramatically speed up:
--    - Recent materials lookup by user
--    - Latest curriculum fetch
--    - Daily trend briefing retrieval
--
-- 2. Monitor query performance with:
--    EXPLAIN ANALYZE SELECT ...
--
-- 3. Consider adding more indexes if you notice slow queries in production
