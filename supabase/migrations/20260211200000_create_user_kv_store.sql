-- Generic key-value store for per-user runtime data
-- (dismiss streaks, sent notification IDs, shown types, etc.)
-- user_preferences 테이블은 구조화된 선호 데이터 전용이므로 별도 KV 테이블 사용

CREATE TABLE IF NOT EXISTS user_kv_store (
    user_email TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_email, key)
);

CREATE INDEX IF NOT EXISTS idx_user_kv_email ON user_kv_store(user_email);
