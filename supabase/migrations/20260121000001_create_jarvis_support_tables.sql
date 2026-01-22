-- =============================================
-- Jarvis Mode: Support Tables
-- (알림, 확인 요청, 리소스)
-- =============================================

-- 1. Jarvis Notifications (L2 알림)
CREATE TABLE IF NOT EXISTS jarvis_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,

    type TEXT NOT NULL, -- 'jarvis_suggestion', 'jarvis_auto_action'
    message TEXT NOT NULL,
    action_type TEXT,
    action_payload JSONB DEFAULT '{}',
    result JSONB, -- 실행 결과 (L4에서 사용)

    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Jarvis Confirmation Requests (L3 확인 요청)
CREATE TABLE IF NOT EXISTS jarvis_confirmation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,

    intervention_log_id UUID NOT NULL REFERENCES intervention_logs(id) ON DELETE CASCADE,

    message TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_payload JSONB DEFAULT '{}',

    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    responded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Jarvis Resources (준비된 리소스, 체크리스트, 제안)
CREATE TABLE IF NOT EXISTS jarvis_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,

    resource_type TEXT NOT NULL, -- 'checklist', 'links', 'briefing', 'suggestion'
    title TEXT NOT NULL,
    content JSONB DEFAULT '{}',

    related_schedule_id TEXT, -- customGoals의 ID

    accessed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX idx_jarvis_notifications_email ON jarvis_notifications(user_email);
CREATE INDEX idx_jarvis_notifications_created ON jarvis_notifications(created_at DESC);
CREATE INDEX idx_jarvis_notifications_type ON jarvis_notifications(type);

CREATE INDEX idx_jarvis_confirmation_requests_email ON jarvis_confirmation_requests(user_email);
CREATE INDEX idx_jarvis_confirmation_requests_status ON jarvis_confirmation_requests(status);
CREATE INDEX idx_jarvis_confirmation_requests_created ON jarvis_confirmation_requests(created_at DESC);

CREATE INDEX idx_jarvis_resources_email ON jarvis_resources(user_email);
CREATE INDEX idx_jarvis_resources_type ON jarvis_resources(resource_type);
CREATE INDEX idx_jarvis_resources_schedule ON jarvis_resources(related_schedule_id);
CREATE INDEX idx_jarvis_resources_created ON jarvis_resources(created_at DESC);

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE jarvis_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE jarvis_confirmation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE jarvis_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY jarvis_notifications_policy ON jarvis_notifications
    FOR ALL USING (user_email = current_user);

CREATE POLICY jarvis_confirmation_requests_policy ON jarvis_confirmation_requests
    FOR ALL USING (user_email = current_user);

CREATE POLICY jarvis_resources_policy ON jarvis_resources
    FOR ALL USING (user_email = current_user);
