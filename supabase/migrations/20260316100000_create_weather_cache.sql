-- weather_cache 테이블 생성
CREATE TABLE IF NOT EXISTS weather_cache (
  location TEXT PRIMARY KEY,
  weather_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
