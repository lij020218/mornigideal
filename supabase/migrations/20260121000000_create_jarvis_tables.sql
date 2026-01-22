-- =============================================
-- Jarvis Mode: Core Tables for Max Plan
-- =============================================

-- 1. UserState (자비스가 실시간으로 관리하는 사용자 상태)
CREATE TABLE IF NOT EXISTS user_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,

    -- 상태 점수 (0-100)
    energy_level INTEGER DEFAULT 70 CHECK (energy_level BETWEEN 0 AND 100),
    stress_level INTEGER DEFAULT 30 CHECK (stress_level BETWEEN 0 AND 100),
    focus_window_score INTEGER DEFAULT 70 CHECK (focus_window_score BETWEEN 0 AND 100),
    routine_deviation_score INTEGER DEFAULT 0 CHECK (routine_deviation_score BETWEEN 0 AND 100),
    deadline_pressure_score INTEGER DEFAULT 20 CHECK (deadline_pressure_score BETWEEN 0 AND 100),

    -- 타임스탬프
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    last_intervention_at TIMESTAMPTZ,
    state_updated_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_email)
);

-- 2. EventLog (모든 사용자 활동 기록)
CREATE TABLE IF NOT EXISTS event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,

    -- 이벤트 정보
    event_type TEXT NOT NULL, -- 'schedule_created', 'schedule_completed', 'schedule_snoozed', 'app_opened', etc.
    payload JSONB DEFAULT '{}', -- 이벤트 상세 데이터

    -- 메타데이터
    source TEXT, -- 'gcal', 'manual', 'device', 'auto'
    occurred_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. InterventionLog (자비스 개입 기록)
CREATE TABLE IF NOT EXISTS intervention_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,

    -- 개입 정보
    intervention_level INTEGER NOT NULL CHECK (intervention_level BETWEEN 0 AND 4), -- L0~L4
    reason_codes TEXT[] DEFAULT '{}', -- ['routine_break', 'overbooked', 'deadline_soon']

    -- 액션 정보
    action_type TEXT NOT NULL, -- 'schedule_prep', 'schedule_move', 'notification', 'resource_prep'
    action_payload JSONB DEFAULT '{}',

    -- 사용자 반응
    user_feedback TEXT, -- 'accepted', 'ignored', 'dismissed', 'auto_executed'
    outcome_score INTEGER CHECK (outcome_score BETWEEN 0 AND 100), -- 나중에 계산

    -- 타임스탬프
    intervened_at TIMESTAMPTZ DEFAULT NOW(),
    feedback_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. JarvisPreferences (사용자별 자비스 설정)
CREATE TABLE IF NOT EXISTS jarvis_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,

    -- 자비스 활성화 여부
    enabled BOOLEAN DEFAULT TRUE,

    -- 개입 레벨 설정
    max_intervention_level INTEGER DEFAULT 2 CHECK (max_intervention_level BETWEEN 0 AND 4), -- 사용자가 허용하는 최대 레벨
    auto_action_opt_in BOOLEAN DEFAULT FALSE, -- L4 자동 실행 허용 여부

    -- 알림 선호
    notification_style TEXT DEFAULT 'friendly', -- 'brief', 'friendly', 'jarvis_tone'
    quiet_hours_start INTEGER DEFAULT 23 CHECK (quiet_hours_start BETWEEN 0 AND 23),
    quiet_hours_end INTEGER DEFAULT 7 CHECK (quiet_hours_end BETWEEN 0 AND 23),

    -- 도메인별 활성화
    schedule_coaching_enabled BOOLEAN DEFAULT TRUE,
    routine_monitoring_enabled BOOLEAN DEFAULT TRUE,
    resource_preparation_enabled BOOLEAN DEFAULT TRUE,

    -- 쿨다운 설정 (분 단위)
    intervention_cooldown_minutes INTEGER DEFAULT 360, -- 6시간

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_email)
);

-- =============================================
-- Indexes for Performance
-- =============================================

-- UserState 인덱스
CREATE INDEX idx_user_states_email ON user_states(user_email);
CREATE INDEX idx_user_states_last_active ON user_states(last_active_at);

-- EventLog 인덱스
CREATE INDEX idx_event_logs_email ON event_logs(user_email);
CREATE INDEX idx_event_logs_type ON event_logs(event_type);
CREATE INDEX idx_event_logs_occurred ON event_logs(occurred_at DESC);
CREATE INDEX idx_event_logs_email_occurred ON event_logs(user_email, occurred_at DESC);

-- InterventionLog 인덱스
CREATE INDEX idx_intervention_logs_email ON intervention_logs(user_email);
CREATE INDEX idx_intervention_logs_level ON intervention_logs(intervention_level);
CREATE INDEX idx_intervention_logs_intervened ON intervention_logs(intervened_at DESC);
CREATE INDEX idx_intervention_logs_feedback ON intervention_logs(user_feedback);

-- JarvisPreferences 인덱스
CREATE INDEX idx_jarvis_preferences_email ON jarvis_preferences(user_email);

-- =============================================
-- Functions & Triggers
-- =============================================

-- UserState updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_user_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_state_updated
    BEFORE UPDATE ON user_states
    FOR EACH ROW
    EXECUTE FUNCTION update_user_state_timestamp();

-- JarvisPreferences updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_jarvis_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_jarvis_preferences_updated
    BEFORE UPDATE ON jarvis_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_jarvis_preferences_timestamp();

-- =============================================
-- Initial Data for Existing Max Users
-- =============================================

-- 기존 Max 플랜 사용자들에게 기본 설정 생성
INSERT INTO user_states (user_email)
SELECT email FROM users
WHERE profile->>'plan' = 'Max'
ON CONFLICT (user_email) DO NOTHING;

INSERT INTO jarvis_preferences (user_email)
SELECT email FROM users
WHERE profile->>'plan' = 'Max'
ON CONFLICT (user_email) DO NOTHING;

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jarvis_preferences ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 데이터만 볼 수 있음
CREATE POLICY user_states_policy ON user_states
    FOR ALL USING (user_email = current_user);

CREATE POLICY event_logs_policy ON event_logs
    FOR ALL USING (user_email = current_user);

CREATE POLICY intervention_logs_policy ON intervention_logs
    FOR ALL USING (user_email = current_user);

CREATE POLICY jarvis_preferences_policy ON jarvis_preferences
    FOR ALL USING (user_email = current_user);
