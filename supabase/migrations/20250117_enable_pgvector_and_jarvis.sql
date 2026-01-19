-- =============================================================================
-- Fi.eri "자비스" 기능을 위한 Supabase 설정
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행
-- =============================================================================

-- 1. pgvector 확장 활성화 (벡터 임베딩 저장용)
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 2. 사용자 플랜 시스템
-- =============================================================================
-- 플랜 구조:
-- - Standard (₩4,900): 일일 AI 50회
-- - Pro (₩9,900): 일일 AI 100회 + 리스크 알림, 스마트 브리핑
-- - Max (₩21,900): 무제한 + 장기 기억, 선제적 제안
-- =============================================================================

-- 플랜 타입 ENUM
DO $$ BEGIN
    CREATE TYPE user_plan_type AS ENUM ('standard', 'pro', 'max');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 사용자 구독 테이블
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan user_plan_type NOT NULL DEFAULT 'standard',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    expires_at TIMESTAMP WITH TIME ZONE,  -- NULL = 무기한
    is_active BOOLEAN DEFAULT true,
    -- 플랜별 제한
    daily_ai_calls_limit INTEGER DEFAULT 50,   -- standard: 50, pro: 100, max: NULL (무제한)
    memory_storage_mb INTEGER DEFAULT 0,       -- standard: 0, pro: 100, max: 1000
    features JSONB DEFAULT '{}'::jsonb,        -- 기능 플래그
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT user_subscriptions_user_unique UNIQUE (user_id)
);

-- 플랜별 기본값 설정 함수
CREATE OR REPLACE FUNCTION set_plan_defaults()
RETURNS TRIGGER AS $$
BEGIN
    CASE NEW.plan
        WHEN 'standard' THEN
            NEW.daily_ai_calls_limit := 50;
            NEW.memory_storage_mb := 0;
            NEW.features := '{"jarvis_memory": false, "risk_alerts": false, "smart_briefing": false, "proactive_suggestions": false}'::jsonb;
        WHEN 'pro' THEN
            NEW.daily_ai_calls_limit := 100;
            NEW.memory_storage_mb := 100;
            NEW.features := '{"jarvis_memory": false, "risk_alerts": true, "smart_briefing": true, "proactive_suggestions": false}'::jsonb;
        WHEN 'max' THEN
            NEW.daily_ai_calls_limit := NULL;  -- 무제한
            NEW.memory_storage_mb := 1000;
            NEW.features := '{"jarvis_memory": true, "risk_alerts": true, "smart_briefing": true, "proactive_suggestions": true}'::jsonb;
    END CASE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 플랜 변경 시 기본값 자동 설정
DROP TRIGGER IF EXISTS set_plan_defaults_trigger ON user_subscriptions;
CREATE TRIGGER set_plan_defaults_trigger
    BEFORE INSERT OR UPDATE OF plan ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION set_plan_defaults();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON user_subscriptions(plan);

-- =============================================================================
-- 3. 장기 기억 시스템 (Vector Memory) - Max 플랜 전용
-- =============================================================================

-- 메모리 타입 ENUM
DO $$ BEGIN
    CREATE TYPE memory_type AS ENUM (
        'conversation',    -- 대화 내용
        'memo',           -- 사용자 메모
        'insight',        -- AI가 발견한 인사이트
        'preference',     -- 사용자 선호도
        'achievement',    -- 성취 기록
        'schedule_pattern' -- 일정 패턴
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 벡터 메모리 테이블
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 메모리 내용
    memory_type memory_type NOT NULL,
    content TEXT NOT NULL,                    -- 원본 텍스트
    embedding vector(1536),                   -- OpenAI text-embedding-3-small 차원

    -- 메타데이터
    metadata JSONB DEFAULT '{}'::jsonb,       -- 추가 정보 (날짜, 관련 일정 ID 등)
    importance_score FLOAT DEFAULT 0.5,       -- 중요도 (0-1)
    access_count INTEGER DEFAULT 0,           -- 접근 횟수
    last_accessed_at TIMESTAMP WITH TIME ZONE,

    -- 시간 정보
    memory_date DATE,                         -- 메모리가 참조하는 날짜
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 벡터 검색을 위한 인덱스 (IVFFlat - 빠른 근사 검색)
CREATE INDEX IF NOT EXISTS idx_user_memories_embedding
    ON user_memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 일반 인덱스
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_type ON user_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memories_date ON user_memories(memory_date);
CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON user_memories(importance_score DESC);

-- =============================================================================
-- 4. AI 사용량 추적 (통계용 - 제한 없음)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- 사용량 카운트 (통계 목적)
    total_calls INTEGER DEFAULT 0,
    morning_greeting_calls INTEGER DEFAULT 0,
    schedule_prep_calls INTEGER DEFAULT 0,
    resource_recommend_calls INTEGER DEFAULT 0,
    suggest_schedules_calls INTEGER DEFAULT 0,
    memory_search_calls INTEGER DEFAULT 0,
    jarvis_calls INTEGER DEFAULT 0,           -- 자비스 고급 기능 호출

    -- 토큰 사용량
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT ai_usage_daily_unique UNIQUE (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_user_date ON ai_usage_daily(user_id, usage_date);

-- =============================================================================
-- 5. 리스크 알림 기록 - Pro/Max 플랜
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE risk_alert_type AS ENUM (
        'schedule_conflict',     -- 일정 충돌
        'preparation_shortage',  -- 준비 시간 부족
        'overwork_warning',      -- 과로 경고
        'deadline_risk',         -- 마감일 위험
        'health_concern'         -- 건강 우려 (수면 부족 등)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS risk_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    alert_type risk_alert_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity INTEGER DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),  -- 1=낮음, 5=매우높음

    -- 관련 일정
    related_schedule_ids JSONB DEFAULT '[]'::jsonb,
    suggested_action TEXT,

    -- 상태
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    action_taken TEXT,

    alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_risk_alerts_user_id ON risk_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_date ON risk_alerts(alert_date);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_unread ON risk_alerts(user_id, is_read) WHERE NOT is_read;

-- =============================================================================
-- 6. Row Level Security (RLS)
-- =============================================================================

-- user_subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
CREATE POLICY "Users can view own subscription" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON user_subscriptions;
CREATE POLICY "Service role can manage subscriptions" ON user_subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- user_memories
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own memories" ON user_memories;
CREATE POLICY "Users can manage own memories" ON user_memories
    FOR ALL USING (auth.uid() = user_id);

-- ai_usage_daily
ALTER TABLE ai_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage" ON ai_usage_daily;
CREATE POLICY "Users can view own usage" ON ai_usage_daily
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage usage" ON ai_usage_daily;
CREATE POLICY "Service role can manage usage" ON ai_usage_daily
    FOR ALL USING (auth.role() = 'service_role');

-- risk_alerts
ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own alerts" ON risk_alerts;
CREATE POLICY "Users can manage own alerts" ON risk_alerts
    FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 7. 유틸리티 함수
-- =============================================================================

-- 벡터 유사도 검색 함수
CREATE OR REPLACE FUNCTION search_memories(
    p_user_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 5,
    p_memory_types memory_type[] DEFAULT NULL,
    p_min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    memory_type memory_type,
    content TEXT,
    metadata JSONB,
    importance_score FLOAT,
    similarity FLOAT,
    memory_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.memory_type,
        m.content,
        m.metadata,
        m.importance_score,
        1 - (m.embedding <=> p_query_embedding) AS similarity,
        m.memory_date
    FROM user_memories m
    WHERE m.user_id = p_user_id
        AND (p_memory_types IS NULL OR m.memory_type = ANY(p_memory_types))
        AND 1 - (m.embedding <=> p_query_embedding) >= p_min_similarity
    ORDER BY m.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 사용자 플랜 조회 함수
CREATE OR REPLACE FUNCTION get_user_plan(p_user_id UUID)
RETURNS TABLE (
    plan user_plan_type,
    is_active BOOLEAN,
    memory_storage_mb INTEGER,
    features JSONB,
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(s.plan, 'standard'::user_plan_type),
        COALESCE(s.is_active, true),
        COALESCE(s.memory_storage_mb, 0),
        COALESCE(s.features, '{"jarvis_memory": false, "risk_alerts": false, "smart_briefing": false, "proactive_suggestions": false}'::jsonb),
        s.expires_at
    FROM users u
    LEFT JOIN user_subscriptions s ON u.id = s.user_id
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. 기존 사용자에게 스탠다드 플랜 자동 부여
-- =============================================================================

INSERT INTO user_subscriptions (user_id, plan)
SELECT id, 'standard'::user_plan_type
FROM users
WHERE id NOT IN (SELECT user_id FROM user_subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- 완료!
-- =============================================================================
-- 이 마이그레이션이 성공하면 다음 기능이 활성화됩니다:
-- 1. pgvector 벡터 검색
-- 2. 사용자 플랜 시스템 (standard/pro/max)
-- 3. 장기 기억 저장소 (user_memories) - Max 전용
-- 4. AI 사용량 통계 추적
-- 5. 리스크 알림 시스템 - Pro/Max
--
-- 플랜별 가격:
-- - Standard: ₩4,900/월
-- - Pro: ₩9,900/월
-- - Max: ₩21,900/월
-- =============================================================================
