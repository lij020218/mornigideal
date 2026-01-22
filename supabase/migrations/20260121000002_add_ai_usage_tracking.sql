-- =============================================
-- AI 호출 횟수 추적 (Standard, Pro 플랜용)
-- =============================================

CREATE TABLE IF NOT EXISTS ai_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,

    month TEXT NOT NULL, -- 'YYYY-MM' 형식
    call_count INTEGER DEFAULT 0,

    last_call_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_email, month)
);

-- 인덱스
CREATE INDEX idx_ai_usage_tracking_email ON ai_usage_tracking(user_email);
CREATE INDEX idx_ai_usage_tracking_month ON ai_usage_tracking(month);
CREATE INDEX idx_ai_usage_tracking_email_month ON ai_usage_tracking(user_email, month);

-- RLS
ALTER TABLE ai_usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_tracking_policy ON ai_usage_tracking
    FOR ALL USING (user_email = current_user);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_ai_usage_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ai_usage_tracking_updated
    BEFORE UPDATE ON ai_usage_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_usage_tracking_timestamp();

-- =============================================
-- AI 호출 횟수 증가 함수
-- =============================================

CREATE OR REPLACE FUNCTION increment_ai_usage(p_user_email TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_month TEXT;
    v_new_count INTEGER;
BEGIN
    v_month := TO_CHAR(NOW(), 'YYYY-MM');

    INSERT INTO ai_usage_tracking (user_email, month, call_count, last_call_at)
    VALUES (p_user_email, v_month, 1, NOW())
    ON CONFLICT (user_email, month)
    DO UPDATE SET
        call_count = ai_usage_tracking.call_count + 1,
        last_call_at = NOW()
    RETURNING call_count INTO v_new_count;

    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 현재 월 AI 호출 횟수 조회 함수
-- =============================================

CREATE OR REPLACE FUNCTION get_ai_usage(p_user_email TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_month TEXT;
    v_count INTEGER;
BEGIN
    v_month := TO_CHAR(NOW(), 'YYYY-MM');

    SELECT call_count INTO v_count
    FROM ai_usage_tracking
    WHERE user_email = p_user_email AND month = v_month;

    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;
