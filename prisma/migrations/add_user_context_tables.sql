-- User Constraints (절대 제약)
CREATE TABLE IF NOT EXISTS user_constraints (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL UNIQUE,

    -- 금지 시간대
    blocked_time_ranges JSONB DEFAULT '[]', -- [{ day: "mon", start: "22:00", end: "06:00" }]

    -- 운동 제약
    workout_restrictions JSONB DEFAULT '{}', -- { maxIntensity: "medium", injuries: ["knee"], avoidTypes: ["running"] }

    -- 이동 시간
    travel_times JSONB DEFAULT '{}', -- { gym: 25, office: 15, home: 0 }

    -- 알림 설정
    notification_limits JSONB DEFAULT '{}', -- { maxPerDay: 5, quietHours: ["22:00-07:00"] }

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

-- User Preferences (명시 선호)
CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL UNIQUE,

    -- 운동 선호
    preferred_workout_types JSONB DEFAULT '[]', -- ["yoga", "walking", "strength"]
    workout_frequency_goal INTEGER DEFAULT 3, -- 주 N회
    preferred_workout_duration INTEGER DEFAULT 30, -- 분

    -- 시간 선호
    chronotype TEXT DEFAULT 'neutral', -- 'morning', 'evening', 'neutral'
    preferred_time_slots JSONB DEFAULT '[]', -- ["morning", "evening"]

    -- 학습 선호
    preferred_learning_format TEXT[], -- ["video", "article", "book"]
    focus_duration INTEGER DEFAULT 25, -- 집중 시간 (분)

    -- 일반 선호
    work_life_balance_mode TEXT DEFAULT 'balanced', -- 'work-focused', 'life-focused', 'balanced'

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

-- User Events (이벤트 로그 - append only)
CREATE TABLE IF NOT EXISTS user_events (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'workout_completed', 'workout_skipped', 'task_done', 'sleep_logged', 'schedule_added', 'schedule_rescheduled'

    start_at TIMESTAMP,
    end_at TIMESTAMP,

    -- 유연한 메타데이터
    metadata JSONB DEFAULT '{}', -- { workoutType: "yoga", intensity: "medium", location: "home", completionRate: 1.0, mood: 4 }

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_events_email_type ON user_events(user_email, event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_email_time ON user_events(user_email, start_at);

-- User Features (집계된 패턴 - 추천 입력용)
CREATE TABLE IF NOT EXISTS user_features_daily (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    date DATE NOT NULL,

    -- 일간 요약
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    workout_count INTEGER DEFAULT 0,
    sleep_hours REAL,
    schedule_density TEXT, -- 'low', 'medium', 'high'

    -- 시간 블록별 활동
    timeblock_activities JSONB DEFAULT '{}', -- { "09-12": ["work"], "18-20": ["workout"] }

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_email, date),
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

-- User Features Weekly (주간 패턴)
CREATE TABLE IF NOT EXISTS user_features_weekly (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    week_start DATE NOT NULL, -- 주의 시작일 (월요일)

    -- 주간 요약
    total_workouts INTEGER DEFAULT 0,
    avg_sleep_hours REAL,
    workout_completion_rate REAL,
    most_productive_timeblock TEXT,

    -- 요일별 패턴
    day_patterns JSONB DEFAULT '{}', -- { "mon": { workoutCount: 2, avgSleep: 7 } }

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_email, week_start),
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

-- Timeblock Success Rate (시간블록별 성공률)
CREATE TABLE IF NOT EXISTS timeblock_success_rate (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,

    day_of_week TEXT NOT NULL, -- 'mon', 'tue', 'wed', ...
    time_block TEXT NOT NULL, -- '09-12', '14-16', '18-20', '20-22'
    activity_type TEXT NOT NULL, -- 'workout', 'learning', 'deep_work'

    total_attempts INTEGER DEFAULT 0,
    successful_completions INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0, -- 0.0 ~ 1.0

    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_email, day_of_week, time_block, activity_type),
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_timeblock_success_email ON timeblock_success_rate(user_email);

-- User Context Cache (AI 입력용 캐시)
CREATE TABLE IF NOT EXISTS user_context_cache (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL UNIQUE,

    -- 구조화된 컨텍스트 (AI 입력)
    context_data JSONB NOT NULL, -- { constraints, preferences, features, freeSlots }

    -- 캐시 메타
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    version INTEGER DEFAULT 1,

    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);
