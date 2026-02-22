-- 범용 캘린더 토큰 테이블 (Apple, Google, Naver, Kakao)
CREATE TABLE IF NOT EXISTS calendar_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    provider TEXT NOT NULL,  -- 'google', 'naver', 'kakao', 'apple'
    access_token TEXT,
    refresh_token TEXT,
    expires_at BIGINT,
    scope TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_email, provider)
);

CREATE INDEX IF NOT EXISTS idx_calendar_tokens_user ON calendar_tokens(user_email);
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_provider ON calendar_tokens(user_email, provider);
