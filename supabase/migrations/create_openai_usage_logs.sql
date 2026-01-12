-- Create OpenAI usage logs table
CREATE TABLE IF NOT EXISTS openai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    model TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    estimated_cost DECIMAL(10, 6) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_openai_usage_user_email ON openai_usage_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_openai_usage_timestamp ON openai_usage_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_openai_usage_endpoint ON openai_usage_logs(endpoint);

-- Enable Row Level Security
ALTER TABLE openai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own usage logs
CREATE POLICY "Users can view own usage logs"
    ON openai_usage_logs
    FOR SELECT
    USING (user_email = auth.jwt() ->> 'email');

-- Create policy: System can insert usage logs
CREATE POLICY "System can insert usage logs"
    ON openai_usage_logs
    FOR INSERT
    WITH CHECK (true);

-- Add comment
COMMENT ON TABLE openai_usage_logs IS 'Logs for tracking OpenAI API usage and costs per user';
