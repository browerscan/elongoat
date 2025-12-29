import os
import time
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import Json
from youtube_transcript_api import YouTubeTranscriptApi


def get_env(name: str, default: Optional[str] = None) -> str:
    v = os.environ.get(name, default)
    if v is None or v.strip() == "":
        raise RuntimeError(f"Missing env: {name}")
    return v.strip()


def connect_db():
    dsn = get_env("DATABASE_URL")
    return psycopg2.connect(dsn)


def fetch_pending_video_ids(conn, limit: int) -> List[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select v.video_id
            from elongoat.youtube_videos v
            left join elongoat.youtube_transcripts t on t.video_id = v.video_id
            where t.video_id is null
            order by v.scraped_at desc
            limit %s
            """,
            (limit,),
        )
        return [r[0] for r in cur.fetchall()]


def upsert_transcript(conn, video_id: str, language: Optional[str], transcript: List[Dict[str, Any]]):
    transcript_text = " ".join([seg.get("text", "") for seg in transcript]).strip()
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into elongoat.youtube_transcripts (video_id, language, transcript_text, transcript_json)
            values (%s, %s, %s, %s)
            on conflict (video_id) do update set
              language = excluded.language,
              transcript_text = excluded.transcript_text,
              transcript_json = excluded.transcript_json,
              fetched_at = now()
            """,
            (video_id, language, transcript_text, Json(transcript)),
        )


def get_transcript_safe(
    api: YouTubeTranscriptApi,
    video_id: str,
    sleep_seconds: float,
    languages: List[str],
) -> Optional[Dict[str, Any]]:
    try:
        fetched = api.fetch(video_id, languages=tuple(languages))
        transcript = fetched.to_raw_data()
        time.sleep(sleep_seconds)
        return {"language": fetched.language_code, "transcript": transcript}
    except Exception as e:
        print(f"[transcripts] video_id={video_id} error={e}")
        time.sleep(max(0.5, sleep_seconds))
        return None


def main():
    limit = int(os.environ.get("TRANSCRIPT_BATCH_LIMIT", "25"))
    sleep_seconds = float(os.environ.get("TRANSCRIPT_SLEEP_SECONDS", "1.0"))
    languages = [s.strip() for s in os.environ.get("TRANSCRIPT_LANGUAGES", "en").split(",") if s.strip()]

    conn = connect_db()
    try:
        video_ids = fetch_pending_video_ids(conn, limit)
        print(f"[transcripts] pending={len(video_ids)}")

        api = YouTubeTranscriptApi()
        for video_id in video_ids:
            result = get_transcript_safe(api, video_id, sleep_seconds=sleep_seconds, languages=languages)
            if result is None:
                continue
            upsert_transcript(conn, video_id, result["language"], result["transcript"])
            conn.commit()
            text_len = len(" ".join([t.get("text", "") for t in result["transcript"]]))
            print(f"[transcripts] saved video_id={video_id} chars={text_len}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
