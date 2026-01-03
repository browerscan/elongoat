-- Migration: Add GIN indexes for full-text search performance
-- These indexes dramatically improve tsvector-based search queries
-- Required for efficient RAG search across content tables

-- ============================================================================
-- PAA Tree Full-Text Search Index
-- ============================================================================

-- GIN index on question + answer for PAA full-text search
-- Used by: RAG search, hybrid search function
CREATE INDEX CONCURRENTLY IF NOT EXISTS paa_tree_fulltext_gin_idx
  ON elongoat.paa_tree
  USING gin (to_tsvector('english', question || ' ' || COALESCE(answer, '')));

COMMENT ON INDEX elongoat.paa_tree_fulltext_gin_idx IS
  'GIN index for full-text search on PAA questions and answers';

-- ============================================================================
-- Content Cache Full-Text Search Index
-- ============================================================================

-- GIN index on content_md + slug for content cache full-text search
-- Used by: RAG search, hybrid search function
CREATE INDEX CONCURRENTLY IF NOT EXISTS content_cache_fulltext_gin_idx
  ON elongoat.content_cache
  USING gin (to_tsvector('english', content_md || ' ' || slug));

COMMENT ON INDEX elongoat.content_cache_fulltext_gin_idx IS
  'GIN index for full-text search on cached content markdown and slugs';

-- ============================================================================
-- Cluster Pages Full-Text Search Index
-- ============================================================================

-- GIN index on topic + page + seed_keyword for cluster pages full-text search
-- Used by: RAG search, hybrid search function
CREATE INDEX CONCURRENTLY IF NOT EXISTS cluster_pages_fulltext_gin_idx
  ON elongoat.cluster_pages
  USING gin (to_tsvector('english', topic || ' ' || page || ' ' || COALESCE(seed_keyword, '')));

COMMENT ON INDEX elongoat.cluster_pages_fulltext_gin_idx IS
  'GIN index for full-text search on cluster topics, pages, and seed keywords';

-- ============================================================================
-- Custom Q&A Full-Text Search Index (optional but useful)
-- ============================================================================

-- GIN index on question + answer_md for custom Q&A full-text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS custom_qas_fulltext_gin_idx
  ON elongoat.custom_qas
  USING gin (to_tsvector('english', question || ' ' || answer_md));

COMMENT ON INDEX elongoat.custom_qas_fulltext_gin_idx IS
  'GIN index for full-text search on custom Q&A content';

-- ============================================================================
-- Maintenance Notes
-- ============================================================================

-- To verify index usage:
-- EXPLAIN ANALYZE SELECT * FROM elongoat.paa_tree 
--   WHERE to_tsvector('english', question || ' ' || COALESCE(answer, '')) 
--   @@ plainto_tsquery('english', 'elon musk');
--
-- To check index sizes:
-- SELECT pg_size_pretty(pg_relation_size('elongoat.paa_tree_fulltext_gin_idx'));
--
-- To update index statistics:
-- ANALYZE elongoat.paa_tree;
-- ANALYZE elongoat.content_cache;
-- ANALYZE elongoat.cluster_pages;
