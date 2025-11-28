-- Create trend_briefings table for storing pre-generated personalized trend briefings
CREATE TABLE IF NOT EXISTS trend_briefings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    date DATE NOT NULL,
    briefing_data JSONB NOT NULL, -- 개인화된 트렌드 브리핑 (인사이트 포함)
    selected_articles JSONB NOT NULL, -- 선택된 뉴스 ID 배열
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(email, date)
);

-- Create index on email and date for faster queries
CREATE INDEX IF NOT EXISTS idx_trend_briefings_email_date ON trend_briefings(email, date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE trend_briefings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own briefings
CREATE POLICY "Users can view their own trend briefings"
    ON trend_briefings FOR SELECT
    USING (auth.uid()::text = email OR email IS NOT NULL);

-- Create policy to allow service role to insert/update briefings
CREATE POLICY "Service role can insert trend briefings"
    ON trend_briefings FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update trend briefings"
    ON trend_briefings FOR UPDATE
    USING (true);
