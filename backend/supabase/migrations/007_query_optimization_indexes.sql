-- Migration 007: Query Optimization Indexes
-- Additional indexes for optimized RAG queries and content_cache lookups

-- ============================================================================
-- Content Cache Optimization Indexes
-- ============================================================================

-- Composite index for kind + generated_at queries (common in cache warmup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS content_cache_kind_generated_idx
  ON elongoat.content_cache (kind, generated_at DESC)
  WHERE expires_at IS NULL OR expires_at > NOW();

COMMENT ON INDEX elongoat.content_cache_kind_generated_idx IS
  'Index for cache queries by content kind, ordered by generation time';

-- Index for TTL-based cleanup queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS content_cache_expires_at_idx
  ON elongoat.content_cache (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON INDEX elongoat.content_cache_expires_at_idx IS
  'Partial index for expired content cleanup';

-- Covering index for content_cache slug lookups (includes kind for filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS content_cache_slug_kind_idx
  ON elongoat.content_cache (slug, kind)
  WHERE expires_at IS NULL OR expires_at > NOW();

COMMENT ON INDEX elongoat.content_cache_slug_kind_idx IS
  'Covering index for slug lookups with kind filtering';

-- ============================================================================
-- PAA Tree Optimization Indexes
-- ============================================================================

-- Composite index for volume + answer queries (prioritize answered questions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS paa_tree_volume_answer_idx
  ON elongoat.paa_tree (volume DESC)
  WHERE answer IS NOT NULL AND length(answer) > 50;

COMMENT ON INDEX elongoat.paa_tree_volume_answer_idx IS
  'Partial index for high-volume questions with substantial answers';

-- Covering index for slug lookups with volume
CREATE INDEX CONCURRENTLY IF NOT EXISTS paa_tree_slug_volume_idx
  ON elongoat.paa_tree (slug, volume DESC);

COMMENT ON INDEX elongoat.paa_tree_slug_volume_idx IS
  'Covering index for slug lookups, ordered by search volume';

-- ============================================================================
-- Cluster Pages Optimization Indexes
-- ============================================================================

-- Composite index for topic + max_volume (topic hub queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS cluster_pages_topic_volume_idx
  ON elongoat.cluster_pages (topic, max_volume DESC);

COMMENT ON INDEX elongoat.cluster_pages_topic_volume_idx IS
  'Index for topic hub page queries, ordered by volume';

-- Index for seed_keyword lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS cluster_pages_seed_keyword_idx
  ON elongoat.cluster_pages (seed_keyword)
  WHERE seed_keyword IS NOT NULL;

COMMENT ON INDEX elongoat.cluster_pages_seed_keyword_idx IS
  'Partial index for seed keyword filtering';

-- ============================================================================
-- musk_tweets Additional Optimization Indexes
-- ============================================================================

-- Covering index for tweet engagement queries (includes conversation_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS musk_tweets_engagement_conv_idx
  ON elongoat.musk_tweets (like_count DESC, created_at DESC)
  INCLUDE (conversation_id)
  WHERE is_retweet = FALSE AND is_reply = FALSE;

COMMENT ON INDEX elongoat.musk_tweets_engagement_conv_idx IS
  'Covering index for engagement queries with conversation thread access';

-- Index for conversation thread queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS musk_tweets_conversation_idx
  ON elongoat.musk_tweets (conversation_id, created_at ASC)
  WHERE conversation_id IS NOT NULL;

COMMENT ON INDEX elongoat.musk_tweets_conversation_idx IS
  'Index for fetching tweet conversation threads';

-- Index for reply context queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS musk_tweets_reply_to_idx
  ON elongoat.musk_tweets (in_reply_to_id, created_at ASC)
  WHERE in_reply_to_id IS NOT NULL;

COMMENT ON INDEX elongoat.musk_tweets_reply_to_idx IS
  'Index for fetching direct replies to a tweet';

-- Partial index for quote tweets (often missed in general queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS musk_tweets_quotes_idx
  ON elongoat.musk_tweets (created_at DESC, like_count DESC)
  WHERE is_quote = TRUE;

COMMENT ON INDEX elongoat.musk_tweets_quotes_idx IS
  'Partial index for quote tweet queries';

-- ============================================================================
-- Hash Indexes for Equality Lookups
-- ============================================================================

-- Hash index for tweet_id lookups (faster than btree for single column equality)
-- Note: Hash indexes are not WAL-logged, may require REINDEX after crash
CREATE INDEX CONCURRENTLY IF NOT EXISTS musk_tweets_id_hash
  ON elongoat.musk_tweets USING HASH (tweet_id);

COMMENT ON INDEX elongoat.musk_tweets_id_hash IS
  'Hash index for fast tweet_id lookups';

-- Hash index for content_cache id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS content_cache_id_hash
  ON elongoat.content_cache USING HASH (id);

COMMENT ON INDEX elongoat.content_cache_id_hash IS
  'Hash index for fast content_cache id lookups';

-- ============================================================================
-- BRIN Indexes for Time-Series Data
-- ============================================================================

-- BRIN index for content_cache (smaller index size for large tables)
-- More efficient than B-tree for time-series data with temporal correlation
CREATE INDEX CONCURRENTLY IF NOT EXISTS content_cache_generated_brin
  ON elongoat.content_cache USING BRIN (generated_at)
  WITH (pages_per_range = 128);

COMMENT ON INDEX elongoat.content_cache_generated_brin IS
  'BRIN index for content_cache time-series queries (compact size)';

-- BRIN index for tweet timeline queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS musk_tweets_created_brin
  ON elongoat.musk_tweets USING BRIN (created_at)
  WITH (pages_per_range = 128);

COMMENT ON INDEX elongoat.musk_tweets_created_brin IS
  'BRIN index for tweet time-series queries (compact size)';

-- ============================================================================
-- Statistics Update
-- ============================================================================

-- Ensure statistics are collected for query optimization
ANALYZE elongoat.content_cache;
ANALYZE elongoat.paa_tree;
ANALYZE elongoat.cluster_pages;
ANALYZE elongoat.musk_tweets;

-- ============================================================================
-- Index Usage Monitoring Query (for manual use)
-- ============================================================================

-- Save this query for checking index effectiveness later:
/*
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid::regclass)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'elongoat'
ORDER BY idx_scan DESC NULLS LAST, pg_relation_size(indexrelid::regclass) DESC;
*/

-- ============================================================================
-- Unused Index Detection Query (for manual use)
-- ============================================================================

/*
-- Find potentially unused indexes (caution: some indexes are for rare operations)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  pg_size_pretty(pg_relation_size(indexrelid::regclass)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'elongoat'
  AND idx_scan < 50  -- Fewer than 50 scans since last stats reset
  AND indexname NOT LIKE '%_pkey'  -- Exclude primary keys
ORDER BY pg_relation_size(indexrelid::regclass) DESC;
*/
