-- Multi-Day Trend Analysis: 일일 상태 스냅샷 테이블
-- 매일 저녁 회고 시 자동 저장, 7-14일 트렌드 분석용

CREATE TABLE IF NOT EXISTS daily_state_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    date DATE NOT NULL,
    completion_rate NUMERIC(5,2),       -- 일정 완료율 (0-100)
    mood TEXT,                           -- positive / neutral / negative
    stress_level NUMERIC(5,2),          -- 0-100
    energy_level NUMERIC(5,2),          -- 0-100
    focus_score NUMERIC(5,2),           -- 0-100
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    active_minutes INTEGER DEFAULT 0,   -- 앱 활성 시간 (분)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_email, date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_date
    ON daily_state_snapshots(user_email, date DESC);
