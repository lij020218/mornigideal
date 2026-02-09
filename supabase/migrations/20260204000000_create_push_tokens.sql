-- Push notification 토큰 저장 테이블
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, token)
);

-- 이메일로 빠른 조회
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_email ON push_tokens(user_email);
-- 활성 토큰만 조회
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(user_email, active) WHERE active = TRUE;
