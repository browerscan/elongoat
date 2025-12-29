#!/usr/bin/env python3
"""
fetch_transcripts.py - YouTube Transcript Fetcher

P0 Critical Task: Fetch YouTube video transcripts with robust error handling,
retry logic, and proxy support.

Usage:
    python fetch_transcripts.py

Environment Variables:
    DATABASE_URL            - PostgreSQL connection string (required)
    TRANSCRIPT_BATCH_LIMIT  - Max videos to process per run (default: 25)
    TRANSCRIPT_SLEEP_SECONDS - Delay between requests (default: 1.0)
    TRANSCRIPT_LANGUAGES    - Comma-separated language codes (default: en)
    TRANSCRIPT_MAX_RETRIES  - Max retry attempts per video (default: 3)
    TRANSCRIPT_RETRY_DELAY  - Base delay between retries in seconds (default: 2.0)
    SOAX_PROXY_URL          - Optional SOAX proxy URL for requests
"""

import os
import sys
import time
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

import psycopg2
from psycopg2.extras import Json
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    TooManyRequests,
    NotTranslatable,
    TranslationLanguageNotAvailable,
    NoTranscriptAvailable,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("fetch_transcripts")


class FetchStatus(Enum):
    """Status codes for transcript fetch attempts."""
    SUCCESS = "success"
    DISABLED = "disabled"
    NOT_FOUND = "not_found"
    UNAVAILABLE = "unavailable"
    RATE_LIMITED = "rate_limited"
    ERROR = "error"


@dataclass
class FetchResult:
    """Result of a transcript fetch attempt."""
    video_id: str
    status: FetchStatus
    language: Optional[str] = None
    transcript: Optional[List[Dict[str, Any]]] = None
    error_message: Optional[str] = None


def get_env(name: str, default: Optional[str] = None) -> str:
    """Get environment variable or raise if required and missing."""
    v = os.environ.get(name, default)
    if v is None or v.strip() == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return v.strip()


def get_env_int(name: str, default: int) -> int:
    """Get integer environment variable with default."""
    v = os.environ.get(name)
    if v is None or v.strip() == "":
        return default
    try:
        return int(v.strip())
    except ValueError:
        logger.warning(f"Invalid integer for {name}: {v}, using default: {default}")
        return default


def get_env_float(name: str, default: float) -> float:
    """Get float environment variable with default."""
    v = os.environ.get(name)
    if v is None or v.strip() == "":
        return default
    try:
        return float(v.strip())
    except ValueError:
        logger.warning(f"Invalid float for {name}: {v}, using default: {default}")
        return default


def connect_db():
    """Create database connection from DATABASE_URL."""
    dsn = get_env("DATABASE_URL")
    return psycopg2.connect(dsn)


def fetch_pending_video_ids(conn, limit: int) -> List[str]:
    """
    Fetch video IDs that don't have transcripts yet.
    Prioritizes recently scraped videos.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT v.video_id
            FROM elongoat.youtube_videos v
            LEFT JOIN elongoat.youtube_transcripts t ON t.video_id = v.video_id
            WHERE t.video_id IS NULL
            ORDER BY v.scraped_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        return [r[0] for r in cur.fetchall()]


def fetch_failed_video_ids(conn, limit: int, max_attempts: int = 3) -> List[Tuple[str, int]]:
    """
    Fetch video IDs that previously failed but might be retryable.
    Returns tuples of (video_id, attempt_count).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.video_id, COALESCE(t.fetch_attempts, 1) as attempts
            FROM elongoat.youtube_transcripts t
            WHERE t.transcript_text IS NULL
              AND t.fetch_status NOT IN ('disabled', 'unavailable')
              AND COALESCE(t.fetch_attempts, 1) < %s
            ORDER BY t.fetched_at ASC
            LIMIT %s
            """,
            (max_attempts, limit),
        )
        return [(r[0], r[1]) for r in cur.fetchall()]


def upsert_transcript(
    conn,
    video_id: str,
    language: Optional[str],
    transcript: Optional[List[Dict[str, Any]]],
    status: FetchStatus,
    error_message: Optional[str] = None,
    attempt_count: int = 1,
):
    """
    Insert or update transcript record.
    Stores both successful transcripts and failure status for retry logic.
    """
    transcript_text = None
    if transcript:
        transcript_text = " ".join([seg.get("text", "") for seg in transcript]).strip()

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO elongoat.youtube_transcripts
                (video_id, language, transcript_text, transcript_json, fetch_status, error_message, fetch_attempts)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (video_id) DO UPDATE SET
                language = EXCLUDED.language,
                transcript_text = COALESCE(EXCLUDED.transcript_text, elongoat.youtube_transcripts.transcript_text),
                transcript_json = COALESCE(EXCLUDED.transcript_json, elongoat.youtube_transcripts.transcript_json),
                fetch_status = EXCLUDED.fetch_status,
                error_message = EXCLUDED.error_message,
                fetch_attempts = elongoat.youtube_transcripts.fetch_attempts + 1,
                fetched_at = NOW()
            """,
            (
                video_id,
                language,
                transcript_text,
                Json(transcript) if transcript else None,
                status.value,
                error_message,
                attempt_count,
            ),
        )


def fetch_transcript_with_retry(
    api: YouTubeTranscriptApi,
    video_id: str,
    languages: List[str],
    max_retries: int,
    retry_delay: float,
    sleep_seconds: float,
) -> FetchResult:
    """
    Fetch transcript for a video with exponential backoff retry.

    Args:
        api: YouTubeTranscriptApi instance
        video_id: YouTube video ID
        languages: Preferred language codes
        max_retries: Maximum retry attempts
        retry_delay: Base delay between retries (exponential backoff)
        sleep_seconds: Delay after successful fetch

    Returns:
        FetchResult with status and transcript data
    """
    last_error = None

    for attempt in range(max_retries):
        try:
            fetched = api.fetch(video_id, languages=tuple(languages))
            transcript = fetched.to_raw_data()

            # Success - add delay to avoid rate limiting
            time.sleep(sleep_seconds)

            return FetchResult(
                video_id=video_id,
                status=FetchStatus.SUCCESS,
                language=fetched.language_code,
                transcript=transcript,
            )

        except TranscriptsDisabled as e:
            # Permanent failure - no retry needed
            return FetchResult(
                video_id=video_id,
                status=FetchStatus.DISABLED,
                error_message=str(e),
            )

        except (NoTranscriptFound, NoTranscriptAvailable, NotTranslatable, TranslationLanguageNotAvailable) as e:
            # No transcript available in requested languages
            return FetchResult(
                video_id=video_id,
                status=FetchStatus.NOT_FOUND,
                error_message=str(e),
            )

        except VideoUnavailable as e:
            # Video deleted, private, or region-restricted
            return FetchResult(
                video_id=video_id,
                status=FetchStatus.UNAVAILABLE,
                error_message=str(e),
            )

        except TooManyRequests as e:
            # Rate limited - exponential backoff
            last_error = str(e)
            if attempt < max_retries - 1:
                delay = retry_delay * (2 ** attempt)
                logger.warning(f"Rate limited for {video_id}, retrying in {delay:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            else:
                return FetchResult(
                    video_id=video_id,
                    status=FetchStatus.RATE_LIMITED,
                    error_message=last_error,
                )

        except Exception as e:
            # Unknown error - retry with backoff
            last_error = str(e)
            if attempt < max_retries - 1:
                delay = retry_delay * (2 ** attempt)
                logger.warning(f"Error fetching {video_id}: {e}, retrying in {delay:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            else:
                return FetchResult(
                    video_id=video_id,
                    status=FetchStatus.ERROR,
                    error_message=last_error,
                )

    # Should not reach here, but just in case
    return FetchResult(
        video_id=video_id,
        status=FetchStatus.ERROR,
        error_message=last_error or "Unknown error after retries",
    )


def main():
    """Main entry point for transcript fetching."""
    # Configuration from environment
    batch_limit = get_env_int("TRANSCRIPT_BATCH_LIMIT", 25)
    sleep_seconds = get_env_float("TRANSCRIPT_SLEEP_SECONDS", 1.0)
    max_retries = get_env_int("TRANSCRIPT_MAX_RETRIES", 3)
    retry_delay = get_env_float("TRANSCRIPT_RETRY_DELAY", 2.0)
    languages = [s.strip() for s in get_env("TRANSCRIPT_LANGUAGES", "en").split(",") if s.strip()]

    logger.info(f"Starting transcript fetch: batch_limit={batch_limit}, languages={languages}")

    conn = connect_db()
    stats = {"success": 0, "disabled": 0, "not_found": 0, "unavailable": 0, "rate_limited": 0, "error": 0}

    try:
        # Get pending videos (no transcript record yet)
        video_ids = fetch_pending_video_ids(conn, batch_limit)
        logger.info(f"Found {len(video_ids)} pending videos")

        if not video_ids:
            logger.info("No pending videos to process")
            return

        api = YouTubeTranscriptApi()

        for i, video_id in enumerate(video_ids, 1):
            logger.info(f"Processing {i}/{len(video_ids)}: {video_id}")

            result = fetch_transcript_with_retry(
                api=api,
                video_id=video_id,
                languages=languages,
                max_retries=max_retries,
                retry_delay=retry_delay,
                sleep_seconds=sleep_seconds,
            )

            # Update stats
            stats[result.status.value] = stats.get(result.status.value, 0) + 1

            # Save to database
            upsert_transcript(
                conn=conn,
                video_id=result.video_id,
                language=result.language,
                transcript=result.transcript,
                status=result.status,
                error_message=result.error_message,
            )
            conn.commit()

            # Log result
            if result.status == FetchStatus.SUCCESS:
                text_len = len(" ".join([t.get("text", "") for t in (result.transcript or [])]))
                logger.info(f"  SUCCESS: language={result.language}, chars={text_len}")
            else:
                logger.warning(f"  {result.status.value.upper()}: {result.error_message}")

        # Print summary
        logger.info("=" * 50)
        logger.info("Fetch Summary:")
        for status, count in stats.items():
            if count > 0:
                logger.info(f"  {status}: {count}")
        logger.info("=" * 50)

    finally:
        conn.close()

    logger.info("Transcript fetch complete")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
