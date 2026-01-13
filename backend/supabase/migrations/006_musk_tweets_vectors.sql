-- Migration 006: Add Vector Support to musk_tweets
-- Enables hybrid search combining full-text and vector similarity for tweets

-- ============================================================================
-- Add embedding column to musk_tweets
-- ============================================================================

ALTER TABLE elongoat.musk_tweets
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

COMMENT ON COLUMN elongoat.musk_tweets.embedding IS
  'Vector embedding for semantic search (1536 dimensions, OpenAI compatible)';

-- ============================================================================
-- Create HNSW index for fast vector similarity search
-- ============================================================================

-- Index for tweet embeddings
-- Uses cosine distance (vector_cosine_ops) for semantic similarity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_musk_tweets_embedding
  ON elongoat.musk_tweets
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

COMMENT ON INDEX elongoat.idx_musk_tweets_embedding IS
  'HNSW index for tweet vector similarity search (cosine distance)';

-- ============================================================================
-- Hybrid search function for tweets
-- Combines full-text search (ts_rank) with vector similarity
-- ============================================================================

CREATE OR REPLACE FUNCTION elongoat.search_tweets_hybrid(
  search_query text,
  query_embedding vector(1536),
  full_text_weight float DEFAULT 0.3,
  vector_weight float DEFAULT 0.7,
  match_count int DEFAULT 20,
  min_likes int DEFAULT 0,
  exclude_replies boolean DEFAULT TRUE,
  exclude_retweets boolean DEFAULT TRUE
)
RETURNS table (
  tweet_id text,
  full_text text,
  url text,
  like_count int,
  created_at timestamptz,
  combined_score float,
  text_rank float,
  vector_similarity float
)
LANGUAGE plpgsql
AS $$
DECLARE
  use_vector boolean := query_embedding IS NOT NULL;
BEGIN
  RETURN QUERY
  SELECT
    mt.tweet_id,
    mt.full_text,
    mt.url,
    mt.like_count,
    mt.created_at,
    -- Combined weighted score
    CASE
      WHEN use_vector THEN
        COALESCE(ts_rank_cd(mt.search_vector, plainto_tsquery('english', search_query), 32), 0) * full_text_weight +
        (1 - (mt.embedding <=> query_embedding)) * vector_weight
      ELSE
        COALESCE(ts_rank_cd(mt.search_vector, plainto_tsquery('english', search_query), 32), 0)
    END AS combined_score,
    -- Individual scores for reference
    COALESCE(ts_rank_cd(mt.search_vector, plainto_tsquery('english', search_query), 32), 0) AS text_rank,
    CASE WHEN use_vector THEN (1 - (mt.embedding <=> query_embedding)) ELSE NULL END AS vector_similarity
  FROM elongoat.musk_tweets mt
  WHERE
    -- Always require full-text match
    mt.search_vector @@ plainto_tsquery('english', search_query)
    -- Optional vector filter (when embedding provided)
    AND (NOT use_vector OR mt.embedding IS NOT NULL)
    -- Optional filters
    AND (exclude_retweets IS FALSE OR mt.is_retweet = FALSE)
    AND (exclude_replies IS FALSE OR mt.is_reply = FALSE)
    AND (min_likes = 0 OR mt.like_count >= min_likes)
  ORDER BY combined_score DESC, mt.like_count DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION elongoat.search_tweets_hybrid IS
  'Hybrid search combining full-text and vector similarity for tweets. Returns results ranked by combined score.';

-- ============================================================================
-- Pure vector search function (no full-text requirement)
-- ============================================================================

CREATE OR REPLACE FUNCTION elongoat.search_tweets_vector(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 20,
  min_likes int DEFAULT 0,
  exclude_replies boolean DEFAULT TRUE,
  exclude_retweets boolean DEFAULT TRUE
)
RETURNS table (
  tweet_id text,
  full_text text,
  url text,
  like_count int,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.tweet_id,
    mt.full_text,
    mt.url,
    mt.like_count,
    mt.created_at,
    (1 - (mt.embedding <=> query_embedding))::float AS similarity
  FROM elongoat.musk_tweets mt
  WHERE
    mt.embedding IS NOT NULL
    AND (1 - (mt.embedding <=> query_embedding)) > match_threshold
    AND (exclude_retweets IS FALSE OR mt.is_retweet = FALSE)
    AND (exclude_replies IS FALSE OR mt.is_reply = FALSE)
    AND (min_likes = 0 OR mt.like_count >= min_likes)
  ORDER BY mt.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION elongoat.search_tweets_vector IS
  'Pure vector similarity search for tweets. Finds semantically similar tweets without keyword matching.';

-- ============================================================================
-- Additional performance indexes for common RAG query patterns
-- ============================================================================

-- Composite index for RAG queries: original tweets with good content
-- Filters on is_retweet, is_reply, and has minimum length check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_musk_tweets_rag
  ON elongoat.musk_tweets (like_count DESC, created_at DESC)
  WHERE is_retweet = FALSE AND is_reply = FALSE AND length(full_text) > 50;

COMMENT ON INDEX elongoat.idx_musk_tweets_rag IS
  'Partial index for RAG queries - high-quality original tweets';

-- Composite index for time-range queries with engagement
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_musk_tweets_timerange_engagement
  ON elongoat.musk_tweets (created_at DESC, like_count DESC)
  WHERE is_retweet = FALSE;

COMMENT ON INDEX elongoat.idx_musk_tweets_timerange_engagement IS
  'Composite index for timeline queries sorted by engagement';

-- ============================================================================
-- Helper function: find tweets by keywords with ranking
-- ============================================================================

CREATE OR REPLACE FUNCTION elongoat.find_tweets_by_keywords(
  keywords text[],
  match_count int DEFAULT 10,
  min_likes int DEFAULT 1000,
  exclude_replies boolean DEFAULT TRUE
)
RETURNS table (
  tweet_id text,
  full_text text,
  url text,
  like_count int,
  created_at timestamptz,
  rank float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.tweet_id,
    mt.full_text,
    mt.url,
    mt.like_count,
    mt.created_at,
    ts_rank_cd(mt.search_vector, to_tsquery('english', array_to_string(keywords, ' | ')), 32) +
    (mt.like_count::float / 1000000) AS rank
  FROM elongoat.musk_tweets mt
  WHERE
    mt.search_vector @@ to_tsquery('english', array_to_string(keywords, ' | '))
    AND (exclude_replies IS FALSE OR mt.is_reply = FALSE)
    AND mt.is_retweet = FALSE
    AND mt.like_count >= min_likes
  ORDER BY rank DESC, mt.like_count DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION elongoat.find_tweets_by_keywords IS
  'Find tweets matching any of the provided keywords, ranked by relevance and engagement';

-- ============================================================================
-- Statistics view for embedding coverage
-- ============================================================================

CREATE OR REPLACE VIEW elongoat.musk_tweets_embedding_stats AS
SELECT
  COUNT(*) as total_tweets,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as tweets_with_embedding,
  COUNT(*) FILTER (WHERE embedding IS NULL) as tweets_without_embedding,
  ROUND(
    (COUNT(*) FILTER (WHERE embedding IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) as embedding_coverage_percent
FROM elongoat.musk_tweets;

COMMENT ON VIEW elongoat.musk_tweets_embedding_stats IS
  'Statistics on tweet embedding generation coverage';

-- ============================================================================
-- Grant permissions
-- ============================================================================

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON elongoat.musk_tweets_embedding_stats TO anon;
    GRANT EXECUTE ON FUNCTION elongoat.search_tweets_hybrid TO anon;
    GRANT EXECUTE ON FUNCTION elongoat.search_tweets_vector TO anon;
    GRANT EXECUTE ON FUNCTION elongoat.find_tweets_by_keywords TO anon;
  END IF;

  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON elongoat.musk_tweets_embedding_stats TO authenticated;
    GRANT EXECUTE ON FUNCTION elongoat.search_tweets_hybrid TO authenticated;
    GRANT EXECUTE ON FUNCTION elongoat.search_tweets_vector TO authenticated;
    GRANT EXECUTE ON FUNCTION elongoat.find_tweets_by_keywords TO authenticated;
  END IF;

  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT ON elongoat.musk_tweets_embedding_stats TO service_role;
    GRANT EXECUTE ON FUNCTION elongoat.search_tweets_hybrid TO service_role;
    GRANT EXECUTE ON FUNCTION elongoat.search_tweets_vector TO service_role;
    GRANT EXECUTE ON FUNCTION elongoat.find_tweets_by_keywords TO service_role;
  END IF;

  GRANT SELECT ON elongoat.musk_tweets_embedding_stats TO postgres;
  GRANT EXECUTE ON FUNCTION elongoat.search_tweets_hybrid TO postgres;
  GRANT EXECUTE ON FUNCTION elongoat.search_tweets_vector TO postgres;
  GRANT EXECUTE ON FUNCTION elongoat.find_tweets_by_keywords TO postgres;
END $$;
