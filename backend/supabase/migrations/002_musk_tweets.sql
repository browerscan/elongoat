-- Migration: musk_tweets table for Elon Musk Twitter archive (2010-2025)
-- 67,977 tweets with full metadata

-- Create musk_tweets table (separate from x_tweets which is for live scraping)
CREATE TABLE IF NOT EXISTS elongoat.musk_tweets (
  -- Primary identifier
  tweet_id TEXT PRIMARY KEY,

  -- Content
  full_text TEXT NOT NULL,
  url TEXT,
  twitter_url TEXT,

  -- Engagement metrics
  retweet_count INT DEFAULT 0,
  reply_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  quote_count INT DEFAULT 0,
  view_count BIGINT DEFAULT 0,
  bookmark_count INT DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL,
  is_reply BOOLEAN DEFAULT FALSE,
  is_retweet BOOLEAN DEFAULT FALSE,
  is_quote BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  possibly_sensitive BOOLEAN DEFAULT FALSE,

  -- Reply context
  in_reply_to_id TEXT,
  in_reply_to_username TEXT,
  conversation_id TEXT,

  -- Quote/Retweet content (JSON for rich data)
  quote_data JSONB,
  retweet_data JSONB,

  -- Full-text search vector (auto-generated)
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(full_text, '')), 'A')
  ) STORED,

  -- Import tracking
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_musk_tweets_created_at ON elongoat.musk_tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_musk_tweets_like_count ON elongoat.musk_tweets(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_musk_tweets_view_count ON elongoat.musk_tweets(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_musk_tweets_is_reply ON elongoat.musk_tweets(is_reply) WHERE is_reply = FALSE;
CREATE INDEX IF NOT EXISTS idx_musk_tweets_is_retweet ON elongoat.musk_tweets(is_retweet) WHERE is_retweet = FALSE;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_musk_tweets_search ON elongoat.musk_tweets USING GIN(search_vector);

-- Composite index for timeline queries (original posts only, by date)
CREATE INDEX IF NOT EXISTS idx_musk_tweets_timeline ON elongoat.musk_tweets(created_at DESC)
  WHERE is_retweet = FALSE;

-- Composite index for popular posts
CREATE INDEX IF NOT EXISTS idx_musk_tweets_popular ON elongoat.musk_tweets(like_count DESC, created_at DESC)
  WHERE is_retweet = FALSE AND is_reply = FALSE;

-- Stats view for quick analytics
CREATE OR REPLACE VIEW elongoat.musk_tweets_stats AS
SELECT
  COUNT(*) as total_tweets,
  COUNT(*) FILTER (WHERE is_retweet = FALSE AND is_reply = FALSE) as original_tweets,
  COUNT(*) FILTER (WHERE is_reply = TRUE) as replies,
  COUNT(*) FILTER (WHERE is_retweet = TRUE) as retweets,
  COUNT(*) FILTER (WHERE is_quote = TRUE) as quote_tweets,
  MIN(created_at) as earliest_tweet,
  MAX(created_at) as latest_tweet,
  SUM(like_count) as total_likes,
  SUM(retweet_count) as total_retweets,
  SUM(view_count) as total_views,
  AVG(like_count)::INT as avg_likes,
  MAX(like_count) as max_likes
FROM elongoat.musk_tweets;

-- Topic classification table (for AI-generated categories)
CREATE TABLE IF NOT EXISTS elongoat.musk_tweet_topics (
  tweet_id TEXT PRIMARY KEY REFERENCES elongoat.musk_tweets(tweet_id) ON DELETE CASCADE,
  topics TEXT[] NOT NULL DEFAULT '{}',
  primary_topic TEXT,
  sentiment TEXT, -- positive, negative, neutral
  classified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_musk_tweet_topics_primary ON elongoat.musk_tweet_topics(primary_topic);
CREATE INDEX IF NOT EXISTS idx_musk_tweet_topics_gin ON elongoat.musk_tweet_topics USING GIN(topics);

-- Grants
GRANT SELECT ON elongoat.musk_tweets TO postgres, anon, authenticated, service_role;
GRANT SELECT ON elongoat.musk_tweets_stats TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON elongoat.musk_tweet_topics TO postgres, anon, authenticated, service_role;
