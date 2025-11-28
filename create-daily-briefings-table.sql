-- Create daily_briefings table for storing pre-generated morning briefings
CREATE TABLE IF NOT EXISTS daily_briefings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    date DATE NOT NULL,
    briefing_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(email, date)
);

-- Create index on email and date for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_briefings_email_date ON daily_briefings(email, date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE daily_briefings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own briefings
CREATE POLICY "Users can view their own briefings"
    ON daily_briefings FOR SELECT
    USING (auth.uid()::text = email OR email IS NOT NULL);

-- Create policy to allow cron job to insert briefings (service role key)
CREATE POLICY "Service role can insert briefings"
    ON daily_briefings FOR INSERT
    WITH CHECK (true);

-- Create policy to allow cron job to update briefings (service role key)
CREATE POLICY "Service role can update briefings"
    ON daily_briefings FOR UPDATE
    USING (true);
