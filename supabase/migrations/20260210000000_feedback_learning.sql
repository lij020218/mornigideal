-- =============================================
-- Feedback Learning: 개입 피드백 통계 및 자동 가중치 조정
-- =============================================

-- 1. 사용자별/액션별 피드백 통계 테이블
CREATE TABLE IF NOT EXISTS intervention_feedback_stats (
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    action_type TEXT NOT NULL,

    -- 카운트
    total_count INTEGER DEFAULT 0,
    accepted_count INTEGER DEFAULT 0,
    dismissed_count INTEGER DEFAULT 0,
    ignored_count INTEGER DEFAULT 0,

    -- 계산된 값
    acceptance_rate NUMERIC(5,4) DEFAULT 0.5000,
    weight_multiplier NUMERIC(5,4) DEFAULT 1.0000,

    -- 타임스탬프
    last_feedback_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_email, action_type)
);

-- 인덱스
CREATE INDEX idx_feedback_stats_email ON intervention_feedback_stats(user_email);
CREATE INDEX idx_feedback_stats_action ON intervention_feedback_stats(action_type);

-- RLS
ALTER TABLE intervention_feedback_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_stats_policy ON intervention_feedback_stats
    FOR ALL USING (user_email = current_user);

-- =============================================
-- 2. 피드백 업데이트 시 통계 자동 재계산 함수
-- =============================================

CREATE OR REPLACE FUNCTION recalculate_feedback_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email TEXT;
    v_action_type TEXT;
    v_total INTEGER;
    v_accepted INTEGER;
    v_dismissed INTEGER;
    v_ignored INTEGER;
    v_rate NUMERIC(5,4);
    v_weight NUMERIC(5,4);
BEGIN
    -- user_feedback가 업데이트된 경우만 처리
    IF NEW.user_feedback IS NULL OR NEW.user_feedback = OLD.user_feedback THEN
        RETURN NEW;
    END IF;

    v_user_email := NEW.user_email;
    v_action_type := NEW.action_type;

    -- 최근 90일 데이터로 통계 계산
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE user_feedback = 'accepted'),
        COUNT(*) FILTER (WHERE user_feedback = 'dismissed'),
        COUNT(*) FILTER (WHERE user_feedback = 'ignored')
    INTO v_total, v_accepted, v_dismissed, v_ignored
    FROM intervention_logs
    WHERE user_email = v_user_email
      AND action_type = v_action_type
      AND user_feedback IS NOT NULL
      AND intervened_at >= NOW() - INTERVAL '90 days';

    -- acceptance_rate 계산
    IF v_total > 0 THEN
        v_rate := v_accepted::NUMERIC / v_total::NUMERIC;
    ELSE
        v_rate := 0.5000;
    END IF;

    -- weight_multiplier 결정 (5회 미만이면 기본값 1.0)
    IF v_total < 5 THEN
        v_weight := 1.0000;
    ELSIF v_rate < 0.20 THEN
        v_weight := 0.3000;  -- 강한 억제
    ELSIF v_rate < 0.40 THEN
        v_weight := 0.6000;  -- 약한 억제
    ELSIF v_rate < 0.70 THEN
        v_weight := 1.0000;  -- 기본
    ELSIF v_rate < 0.85 THEN
        v_weight := 1.3000;  -- 약한 촉진
    ELSE
        v_weight := 1.6000;  -- 강한 촉진
    END IF;

    -- UPSERT
    INSERT INTO intervention_feedback_stats (
        user_email, action_type,
        total_count, accepted_count, dismissed_count, ignored_count,
        acceptance_rate, weight_multiplier,
        last_feedback_at, updated_at
    ) VALUES (
        v_user_email, v_action_type,
        v_total, v_accepted, v_dismissed, v_ignored,
        v_rate, v_weight,
        NOW(), NOW()
    )
    ON CONFLICT (user_email, action_type)
    DO UPDATE SET
        total_count = EXCLUDED.total_count,
        accepted_count = EXCLUDED.accepted_count,
        dismissed_count = EXCLUDED.dismissed_count,
        ignored_count = EXCLUDED.ignored_count,
        acceptance_rate = EXCLUDED.acceptance_rate,
        weight_multiplier = EXCLUDED.weight_multiplier,
        last_feedback_at = EXCLUDED.last_feedback_at,
        updated_at = EXCLUDED.updated_at;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 3. intervention_logs의 user_feedback UPDATE 트리거
-- =============================================

CREATE TRIGGER trigger_feedback_stats_update
    AFTER UPDATE OF user_feedback ON intervention_logs
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_feedback_stats();
