-- Performance Indexes Migration for ElonGoat
-- This migration adds indexes to improve query performance
-- Uses CONCURRENTLY for non-blocking creation on production

-- ============================================================================
-- Chat Question Stats Indexes
-- ============================================================================

-- Composite index for sorting by count and last_seen_at
-- Used by: admin chat questions listing, popular questions queries
CREATE INDEX IF NOT EXISTS CONCURRENTLY chat_question_stats_count_last_seen_idx
  ON elongoat.chat_question_stats (count DESC, last_seen_at DESC)
  WHERE count > 0;

-- Index for promoted questions filtering
CREATE INDEX IF NOT EXISTS CONCURRENTLY chat_question_stats_promoted_idx
  ON elongoat.chat_question_stats (promoted_at DESC)
  WHERE promoted_slug IS NOT NULL;

-- Partial index for active questions (seen recently)
CREATE INDEX IF NOT EXISTS CONCURRENTLY chat_question_stats_active_idx
  ON elongoat.chat_question_stats (last_seen_at DESC)
  WHERE last_seen_at > NOW() - INTERVAL '30 days';

-- ============================================================================
-- Content Cache Indexes
-- ============================================================================

-- Composite index for content lookups by kind and slug
-- Used by: getContentCache queries
CREATE INDEX IF NOT EXISTS CONCURRENTLY content_cache_kind_slug_updated_idx
  ON elongoat.content_cache (kind, slug, updated_at DESC);

-- Index for expired content cleanup
CREATE INDEX IF NOT EXISTS CONCURRENTLY content_cache_expires_at_idx
  ON elongoat.content_cache (expires_at)
  WHERE expires_at IS NOT NULL;

-- Partial index for non-expired content (most queries)
CREATE INDEX IF NOT EXISTS CONCURRENTLY content_cache_valid_idx
  ON elongoat.content_cache (kind, slug, generated_at DESC)
  WHERE expires_at IS NULL OR expires_at > NOW();

-- Index for content by model (analytics/billing)
CREATE INDEX IF NOT EXISTS CONCURRENTLY content_cache_model_idx
  ON elongoat.content_cache (model, generated_at DESC)
  WHERE model IS NOT NULL;

-- ============================================================================
-- Variables Indexes
-- ============================================================================

-- Index for sorting variables by update time
-- Used by: variable caching, admin variables API
CREATE INDEX IF NOT EXISTS CONCURRENTLY variables_updated_at_idx
  ON elongoat.variables (updated_at DESC);

-- ============================================================================
-- PAA Tree Indexes (Additional)
-- ============================================================================

-- Composite index for volume-based queries with level
CREATE INDEX IF NOT EXISTS CONCURRENTLY paa_tree_volume_level_idx
  ON elongoat.chat_question_stats (volume DESC, level ASC)
  WHERE volume > 0;

-- Index for searching questions by text (if needed)
-- CREATE INDEX IF NOT EXISTS CONCURRENTLY paa_tree_question_gin_idx
--   ON elongoat.paa_tree USING gin (question gin_trgm_ops)
--   WHERE question IS NOT NULL;

-- ============================================================================
-- Cluster Pages Indexes (Additional)
-- ============================================================================

-- Composite index for topic + page slug lookups
CREATE INDEX IF NOT EXISTS CONCURRENTLY cluster_pages_topic_page_idx
  ON elongoat.cluster_pages (topic_slug, page_slug);

-- Index for sorting by total_volume within topics
CREATE INDEX IF NOT EXISTS CONCURRENTLY cluster_pages_topic_volume_idx
  ON elongoat.cluster_pages (topic_slug, total_volume DESC)
  WHERE total_volume > 0;

-- ============================================================================
-- YouTube Videos Indexes (Additional)
-- ============================================================================

-- Index for video source queries
CREATE INDEX IF NOT EXISTS CONCURRENTLY youtube_videos_source_query_idx
  ON elongoat.youtube_videos (source_query)
  WHERE source_query IS NOT NULL;

-- Index for published date sorting
CREATE INDEX IF NOT EXISTS CONCURRENTLY youtube_videos_published_idx
  ON elongoat.youtube_videos (published_at DESC)
  WHERE published_at IS NOT NULL;

-- ============================================================================
-- X Tweets Indexes (Additional)
-- ============================================================================

-- Index for handle + time queries
CREATE INDEX IF NOT EXISTS CONCURRENTLY x_tweets_handle_posted_idx
  ON elongoat.x_tweets (handle, posted_at DESC);

-- Index for recent tweets across all handles
CREATE INDEX IF NOT EXISTS CONCURRENTLY x_tweets_recent_idx
  ON elongoat.x_tweets (posted_at DESC)
  WHERE posted_at > NOW() - INTERVAL '7 days';

-- ============================================================================
-- Custom Q&A Indexes
-- ============================================================================

-- Full-text search index for Q&A (optional, for search functionality)
-- CREATE INDEX IF NOT EXISTS CONCURRENTLY custom_qas_question_gin_idx
--   ON elongoat.custom_qas USING gin (question gin_trgm_ops);

-- Index for recently updated Q&A
CREATE INDEX IF NOT EXISTS CONCURRENTLY custom_qas_updated_idx
  ON elongoat.custom_qas (updated_at DESC)
  WHERE updated_at > NOW() - INTERVAL '30 days';

-- ============================================================================
-- Cluster Keywords Indexes (Additional)
-- ============================================================================

-- Covering index for keyword lookups with volume
CREATE INDEX IF NOT EXISTS CONCURRENTLY cluster_keywords_page_volume_idx
  ON elongoat.cluster_keywords (page_id, volume DESC)
  INCLUDE (keyword, difficulty);

-- ============================================================================
-- Maintenance Comments
-- ============================================================================

-- To analyze index usage:
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'elongoat';
--
-- To find missing indexes:
-- SELECT * FROM pg_stat_user_tables WHERE schemaname = 'elongoat';
--
-- To rebuild indexes (if needed):
-- REINDEX INDEX CONCURRENTLY elongoat.index_name;
--
-- To clean up stale statistics:
-- ANALYZE elongoat.table_name;

COMMENT ON INDEX elongoat.chat_question_stats_count_last_seen_idx IS
  'Optimizes queries for popular questions sorted by count and recency';

COMMENT ON INDEX elongoat.content_cache_kind_slug_updated_idx IS
  'Optimizes content cache lookups by kind and slug with recency';

COMMENT ON INDEX elongoat.variables_updated_at_idx IS
  'Optimizes variable queries sorted by update time';

COMMENT ON INDEX elongoat.content_cache_valid_idx IS
  'Partial index for valid (non-expired) content cache entries';
