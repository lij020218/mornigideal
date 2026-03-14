-- 사용자 피드백 테이블
-- 사용자가 앱에서 문제를 신고하거나 개선 사항을 제안할 수 있는 피드백 시스템

CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES users(email),
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  screenshot_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user ON user_feedback(user_email, created_at DESC);
