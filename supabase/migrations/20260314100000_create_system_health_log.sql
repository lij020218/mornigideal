-- system_health_log: CRON 실행 이력 + 시스템 모니터링 로그
CREATE TABLE IF NOT EXISTS system_health_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cron_name TEXT NOT NULL,
  status TEXT NOT NULL,          -- 'success', 'failure', 'partial', 'skipped'
  duration_ms INTEGER,
  details JSONB DEFAULT '{}',    -- { error?, affected_count?, metrics?, self_heal? }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_log_cron ON system_health_log(cron_name, created_at DESC);
CREATE INDEX idx_health_log_status ON system_health_log(status, created_at DESC);
CREATE INDEX idx_health_log_cleanup ON system_health_log(created_at);
