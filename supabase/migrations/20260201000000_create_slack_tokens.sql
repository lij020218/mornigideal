-- Slack OAuth 토큰 저장 테이블
CREATE TABLE IF NOT EXISTS slack_tokens (
  user_email TEXT PRIMARY KEY,
  slack_user_id TEXT NOT NULL,
  slack_team_id TEXT NOT NULL,
  slack_team_name TEXT,
  access_token TEXT NOT NULL,
  scope TEXT,
  default_channel_id TEXT,
  default_channel_name TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
