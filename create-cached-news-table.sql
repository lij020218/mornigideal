-- 분야별 캐시된 뉴스 테이블
CREATE TABLE IF NOT EXISTS cached_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 뉴스 기본 정보
  title TEXT NOT NULL,
  title_korean TEXT NOT NULL,
  original_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  pub_date TIMESTAMP WITH TIME ZONE NOT NULL,

  -- 분야 및 카테고리
  category TEXT NOT NULL, -- AI, Business, Tech, Finance, Sports 등
  interests TEXT[] DEFAULT '{}', -- 관심사 태그 배열

  -- AI 요약 (GPT-5-mini로 미리 생성)
  summary_korean TEXT NOT NULL, -- 기본 요약
  content_snippet TEXT, -- 원본 스니펫

  -- 직업별 relevance (사전 계산)
  relevance_data JSONB DEFAULT '{}'::jsonb, -- {"Marketer": "...", "Developer": "..."}

  -- 메타데이터
  relevance_score INTEGER DEFAULT 5, -- 1-10
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  batch_id TEXT, -- 어떤 배치 작업에서 생성되었는지

  -- 인덱스를 위한 필드
  is_active BOOLEAN DEFAULT TRUE -- 오래된 뉴스는 비활성화
);

-- 인덱스 생성
CREATE INDEX idx_cached_news_category ON cached_news(category);
CREATE INDEX idx_cached_news_interests ON cached_news USING GIN(interests);
CREATE INDEX idx_cached_news_pub_date ON cached_news(pub_date DESC);
CREATE INDEX idx_cached_news_active ON cached_news(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_cached_news_batch ON cached_news(batch_id);

-- 배치 작업 메타데이터 테이블
CREATE TABLE IF NOT EXISTS news_batch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT UNIQUE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  articles_processed INTEGER DEFAULT 0,
  articles_cached INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running', -- running, completed, failed
  error_message TEXT
);

-- 오래된 뉴스 자동 비활성화 (7일 이상)
CREATE OR REPLACE FUNCTION deactivate_old_news()
RETURNS void AS $$
BEGIN
  UPDATE cached_news
  SET is_active = FALSE
  WHERE pub_date < NOW() - INTERVAL '7 days'
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE cached_news IS '분야별로 미리 요약된 뉴스 캐시. 배치 작업으로 1시간마다 갱신.';
COMMENT ON TABLE news_batch_runs IS '뉴스 배치 작업 실행 기록';
