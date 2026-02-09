-- =============================================================================
-- RAG(user_memory) 기능을 전 플랜으로 확대
-- Standard: 50MB, Pro: 100MB (기존), Max: 1000MB (기존)
-- =============================================================================

-- 1. set_plan_defaults() 함수 업데이트: Standard memory_storage_mb 0 → 50
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

-- 2. 기존 Standard 사용자 memory_storage_mb 업데이트
UPDATE user_subscriptions
SET memory_storage_mb = 50
WHERE plan = 'standard' AND memory_storage_mb = 0;

-- 3. user_memory 테이블에 content_hash 컬럼 추가 (중복 방지용)
ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 4. content_hash 유니크 인덱스 (동일 사용자 + 동일 해시 = 중복)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memory_content_hash
    ON user_memory (user_id, content_hash)
    WHERE content_hash IS NOT NULL;

-- 5. cleanup용 복합 인덱스 (사용자별 오래된 메모리 정리)
CREATE INDEX IF NOT EXISTS idx_user_memory_user_created
    ON user_memory (user_id, created_at);

-- 6. 사용자 메모리 용량 조회 함수 (MB)
-- embedding(1536 floats * 4bytes = ~6KB) + content + metadata per row
CREATE OR REPLACE FUNCTION get_user_memory_size_mb(p_user_id UUID)
RETURNS TABLE (size_mb FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT COALESCE(
        SUM(
            octet_length(m.content) +
            octet_length(m.metadata::text) +
            6144  -- embedding vector ~6KB
        )::float / (1024 * 1024),
        0
    ) AS size_mb
    FROM user_memory m
    WHERE m.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 완료!
-- Standard 사용자도 RAG(user_memory) 사용 가능 (50MB 한도)
-- user_memories (Jarvis 장기 기억)는 Max 전용 유지 (변경 없음)
-- =============================================================================
