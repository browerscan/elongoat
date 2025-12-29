-- Migration: Add retry tracking fields to youtube_transcripts table
-- This enables the fetch_transcripts.py worker to track failed attempts and retry

-- Add new columns for retry logic
ALTER TABLE elongoat.youtube_transcripts
  ADD COLUMN IF NOT EXISTS fetch_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS fetch_attempts INTEGER DEFAULT 0;

-- Add index for querying failed transcripts for retry
CREATE INDEX IF NOT EXISTS youtube_transcripts_fetch_status_idx
  ON elongoat.youtube_transcripts(fetch_status);

-- Update existing rows to have proper status
UPDATE elongoat.youtube_transcripts
SET fetch_status = CASE
  WHEN transcript_text IS NOT NULL AND transcript_text != '' THEN 'success'
  ELSE 'pending'
END,
fetch_attempts = CASE
  WHEN transcript_text IS NOT NULL AND transcript_text != '' THEN 1
  ELSE 0
END
WHERE fetch_status = 'pending' OR fetch_status IS NULL;

-- Comment on columns
COMMENT ON COLUMN elongoat.youtube_transcripts.fetch_status IS 'Status of transcript fetch: success, disabled, not_found, unavailable, rate_limited, error, pending';
COMMENT ON COLUMN elongoat.youtube_transcripts.error_message IS 'Error message from last failed fetch attempt';
COMMENT ON COLUMN elongoat.youtube_transcripts.fetch_attempts IS 'Number of fetch attempts made for this video';
