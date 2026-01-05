// Lazy imports for backend-only dependencies
let getDbPool: typeof import("./db").getDbPool | undefined;

async function getBackendModules() {
  try {
    const dbModule = await import("./db");
    getDbPool = dbModule.getDbPool;
  } catch {
    // Modules not available in static export
  }
}

export type VideoRow = {
  videoId: string;
  title: string | null;
  link: string | null;
  channel: string | null;
  snippet: string | null;
  duration: string | null;
  thumbnail: string | null;
  publishedAt: string | null;
  scrapedAt: string;
  sourceQuery: string | null;
};

export type TranscriptRow = {
  videoId: string;
  transcriptText: string | null;
  fetchedAt: string;
};

export async function listVideos(limit: number = 50): Promise<VideoRow[]> {
  await getBackendModules();
  const db = getDbPool?.();
  if (!db) return [];

  try {
    const res = await db.query<{
      video_id: string;
      title: string | null;
      link: string | null;
      channel: string | null;
      snippet: string | null;
      duration: string | null;
      thumbnail: string | null;
      published_at: string | null;
      scraped_at: string;
      source_query: string | null;
    }>(
      `
      select video_id, title, link, channel, snippet, duration, thumbnail, published_at, scraped_at, source_query
      from elongoat.youtube_videos
      order by scraped_at desc
      limit $1
      `,
      [limit],
    );

    return res.rows.map((r) => ({
      videoId: r.video_id,
      title: r.title,
      link: r.link,
      channel: r.channel,
      snippet: r.snippet,
      duration: r.duration,
      thumbnail: r.thumbnail,
      publishedAt: r.published_at
        ? new Date(r.published_at).toISOString()
        : null,
      scrapedAt: new Date(r.scraped_at).toISOString(),
      sourceQuery: r.source_query,
    }));
  } catch {
    return [];
  }
}

export async function getTranscript(
  videoId: string,
): Promise<TranscriptRow | null> {
  await getBackendModules();
  const db = getDbPool?.();
  if (!db) return null;

  try {
    const res = await db.query<{
      video_id: string;
      transcript_text: string | null;
      fetched_at: string;
    }>(
      `
      select video_id, transcript_text, fetched_at
      from elongoat.youtube_transcripts
      where video_id = $1
      limit 1
      `,
      [videoId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      videoId: row.video_id,
      transcriptText: row.transcript_text,
      fetchedAt: new Date(row.fetched_at).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getVideo(videoId: string): Promise<VideoRow | null> {
  await getBackendModules();
  const db = getDbPool?.();
  if (!db) return null;

  try {
    const res = await db.query<{
      video_id: string;
      title: string | null;
      link: string | null;
      channel: string | null;
      snippet: string | null;
      duration: string | null;
      thumbnail: string | null;
      published_at: string | null;
      scraped_at: string;
      source_query: string | null;
    }>(
      `
      select video_id, title, link, channel, snippet, duration, thumbnail, published_at, scraped_at, source_query
      from elongoat.youtube_videos
      where video_id = $1
      limit 1
      `,
      [videoId],
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      videoId: r.video_id,
      title: r.title,
      link: r.link,
      channel: r.channel,
      snippet: r.snippet,
      duration: r.duration,
      thumbnail: r.thumbnail,
      publishedAt: r.published_at
        ? new Date(r.published_at).toISOString()
        : null,
      scrapedAt: new Date(r.scraped_at).toISOString(),
      sourceQuery: r.source_query,
    };
  } catch {
    return null;
  }
}
