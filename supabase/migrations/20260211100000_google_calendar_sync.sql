-- Google Calendar bidirectional sync tables

CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    user_email TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_at BIGINT,
    scope TEXT,
    calendar_id TEXT DEFAULT 'primary',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_sync_mapping (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    local_goal_id TEXT NOT NULL,
    gcal_event_id TEXT NOT NULL,
    sync_direction TEXT DEFAULT 'bidirectional',
    last_synced_at TIMESTAMPTZ,
    etag TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_email, local_goal_id),
    UNIQUE(user_email, gcal_event_id)
);

CREATE INDEX IF NOT EXISTS idx_cal_sync_user ON calendar_sync_mapping(user_email);
