-- Migration 005: Additional Performance Indexes
-- Adds compound indexes for cache queries and compression support columns

-- ============================================================================
-- Content Cache Compound Indexes
-- ============================================================================

-- Compound index for kind + expires_at lookups (cleanup queries)
-- Used by: content expiration cleanup, valid content queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS content_cache_kind_expires_at_idx
  ON elongoat.content_cache (kind, expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON INDEX elongoat.content_cache_kind_expires_at_idx IS
  'Compound index for content cache queries by kind and expiration time';

-- ============================================================================
-- Compression Support Columns
-- ============================================================================

-- Add compression tracking columns to content_cache
ALTER TABLE elongoat.content_cache
  ADD COLUMN IF NOT EXISTS compressed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS compression_method TEXT;

COMMENT ON COLUMN elongoat.content_cache.compressed IS
  'Whether content_md is compressed (base64 encoded gzip/deflate)';
COMMENT ON COLUMN elongoat.content_cache.compression_method IS
  'Compression method used: gzip or deflate';

-- ============================================================================
-- Performance Notes
-- ============================================================================

-- To verify compression is working:
-- SELECT
--   kind,
--   COUNT(*) FILTER (WHERE compressed = TRUE) AS compressed_count,
--   COUNT(*) FILTER (WHERE compressed = FALSE) AS uncompressed_count,
--   AVG(LENGTH(content_md)) FILTER (WHERE compressed = TRUE) AS avg_compressed_size,
--   AVG(LENGTH(content_md)) FILTER (WHERE compressed = FALSE) AS avg_uncompressed_size
-- FROM elongoat.content_cache
-- GROUP BY kind;

-- To check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'elongoat'
-- ORDER BY idx_scan DESC;
