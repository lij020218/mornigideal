-- User Events Table for Focus Mode and Sleep Mode tracking
-- This table stores mode-related events for analytics and weekly reports

-- Drop existing table and policies if they exist
DROP TABLE IF EXISTS user_events CASCADE;

-- Create table
CREATE TABLE user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT user_events_event_type_check CHECK (
        event_type IN (
            'focus_start',
            'focus_end',
            'focus_interrupted',
            'focus_paused',
            'focus_resumed',
            'sleep_start',
            'sleep_end'
        )
    )
);

-- Create indexes for better query performance
CREATE INDEX idx_user_events_email ON user_events(email);
CREATE INDEX idx_user_events_event_type ON user_events(event_type);
CREATE INDEX idx_user_events_created_at ON user_events(created_at DESC);
CREATE INDEX idx_user_events_email_created_at ON user_events(email, created_at DESC);

-- Grant permissions (no RLS since we use service role in API)
GRANT SELECT, INSERT ON user_events TO authenticated;
GRANT ALL ON user_events TO service_role;
GRANT ALL ON user_events TO postgres;
