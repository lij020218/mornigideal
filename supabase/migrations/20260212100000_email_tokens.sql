-- 범용 메일 토큰 테이블 (Gmail, Naver, Kakao, Outlook)
CREATE TABLE IF NOT EXISTS email_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    provider TEXT NOT NULL,  -- 'gmail', 'naver', 'kakao', 'outlook'
    access_token TEXT,
    refresh_token TEXT,
    expires_at BIGINT,
    scope TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_email, provider)
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_email);
CREATE INDEX IF NOT EXISTS idx_email_tokens_provider ON email_tokens(user_email, provider);
