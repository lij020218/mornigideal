-- =============================================================================
-- 선제적 알림(proactive_suggestions) 기능을 전 플랜으로 확대
-- 규칙 기반 시스템 (AI 호출 $0) → 전 플랜 제공 가능
-- =============================================================================

-- 1. set_plan_defaults() 함수 업데이트: Standard/Pro proactive_suggestions true
CREATE OR REPLACE FUNCTION set_plan_defaults()
RETURNS TRIGGER AS $$
BEGIN
    CASE NEW.plan
        WHEN 'standard' THEN
            NEW.daily_ai_calls_limit := 50;
            NEW.memory_storage_mb := 50;
            NEW.features := '{"jarvis_memory": false, "risk_alerts": false, "smart_briefing": false, "proactive_suggestions": true}'::jsonb;
        WHEN 'pro' THEN
            NEW.daily_ai_calls_limit := 100;
            NEW.memory_storage_mb := 100;
            NEW.features := '{"jarvis_memory": false, "risk_alerts": true, "smart_briefing": true, "proactive_suggestions": true}'::jsonb;
        WHEN 'max' THEN
            NEW.daily_ai_calls_limit := NULL;  -- 무제한
            NEW.memory_storage_mb := 1000;
            NEW.features := '{"jarvis_memory": true, "risk_alerts": true, "smart_briefing": true, "proactive_suggestions": true}'::jsonb;
    END CASE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 기존 Standard/Pro 사용자 proactive_suggestions 활성화
UPDATE user_subscriptions
SET features = jsonb_set(features, '{proactive_suggestions}', 'true')
WHERE plan IN ('standard', 'pro')
  AND (features->>'proactive_suggestions')::boolean = false;

-- =============================================================================
-- 완료!
-- Standard/Pro 사용자도 선제적 알림 사용 가능
-- 규칙 기반 시스템이므로 추가 AI 비용 $0
-- =============================================================================
