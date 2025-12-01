-- Gmail Tokens Table for Account Linking
-- This table stores Gmail OAuth tokens linked to user accounts

CREATE TABLE IF NOT EXISTS gmail_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL UNIQUE,
    gmail_email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_at BIGINT NOT NULL,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by user email
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_email ON gmail_tokens(user_email);

-- Enable Row Level Security
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tokens
CREATE POLICY "Users can access own gmail tokens"
    ON gmail_tokens
    FOR ALL
    USING (user_email = current_setting('request.jwt.claim.email', true));

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gmail_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER gmail_tokens_updated_at
    BEFORE UPDATE ON gmail_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_gmail_tokens_updated_at();
