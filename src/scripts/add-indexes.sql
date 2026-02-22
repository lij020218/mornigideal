-- ============================================
-- Performance indexes for frequently queried columns
-- Run in Supabase SQL editor
-- ============================================

-- event_logs: ai-chat fetches by user_email + occurred_at
CREATE INDEX IF NOT EXISTS idx_event_logs_user_date
  ON event_logs(user_email, occurred_at DESC);

-- user_activity_logs: enhanced-profile, schedule-analytics, activity-log
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_type_time
  ON user_activity_logs(user_email, activity_type, timestamp DESC);

-- user_memory: proactiveNotificationService fetches by user_id + created_at
CREATE INDEX IF NOT EXISTS idx_user_memory_user_created
  ON user_memory(user_id, created_at DESC);

-- calendar_sync_mapping: tool-executor looks up by user_email + local_goal_id
CREATE INDEX IF NOT EXISTS idx_cal_sync_user_goal
  ON calendar_sync_mapping(user_email, local_goal_id);

-- user_events: mode-events filters by email + event_type + created_at
CREATE INDEX IF NOT EXISTS idx_user_events_email_type
  ON user_events(email, event_type, created_at DESC);

-- schedules: schedule routes filter by user_id + specific_date
CREATE INDEX IF NOT EXISTS idx_schedules_user_date
  ON schedules(user_id, specific_date);

-- custom_goals: schedule-analytics fetches by user_email + created_at
CREATE INDEX IF NOT EXISTS idx_custom_goals_user_created
  ON custom_goals(user_email, created_at);

-- jarvis_notifications: notification routes query by user_email + created_at
CREATE INDEX IF NOT EXISTS idx_jarvis_notif_user_created
  ON jarvis_notifications(user_email, created_at DESC);
