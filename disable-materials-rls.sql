-- Temporary solution: Disable RLS on materials table
-- This allows the API to query materials using service role key
-- Security is maintained by filtering user_id in the API code

ALTER TABLE materials DISABLE ROW LEVEL SECURITY;

-- Note: You can re-enable RLS later if needed:
-- ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
