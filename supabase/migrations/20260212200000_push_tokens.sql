-- 푸시 토큰 테이블 (모바일 알림용)
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL,  -- 'ios', 'android'
    device_name TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_email, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_email);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(user_email, active);
