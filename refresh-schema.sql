-- Force schema cache reload by altering the table metadata
-- This is a harmless operation that triggers PostgREST to refresh its cache

COMMENT ON TABLE daily_briefings IS 'Daily Briefing Data - Schema Refreshed';

-- Just in case, grant permissions explicitly (sometimes needed for new tables)
GRANT ALL ON daily_briefings TO clean_user, authenticated, service_role;
GRANT ALL ON daily_briefings TO anon;
