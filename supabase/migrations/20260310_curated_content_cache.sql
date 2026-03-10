CREATE TABLE IF NOT EXISTS curated_content_cache (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    category TEXT NOT NULL,  -- 'github', 'books', 'arxiv', 'hackernews'
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, category)
);

CREATE INDEX IF NOT EXISTS idx_curated_content_date ON curated_content_cache(date);
