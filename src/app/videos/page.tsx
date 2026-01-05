import Link from "next/link";

import { JsonLd } from "../../components/JsonLd";
import { generateVideosIndexMetadata } from "../../lib/seo";
import { listVideos } from "../../lib/videos";
import {
  generateBreadcrumbSchema,
  generateWebPageSchema,
} from "../../lib/structuredData";

export const revalidate = 3600;

export async function generateMetadata() {
  const videos = await listVideos(1); // Just to check if any exist
  const hasVideos = videos.length > 0;

  return generateVideosIndexMetadata({ hasVideos });
}

export default async function VideosIndexPage() {
  const videos = await listVideos(60);

  // JSON-LD structured data
  const now = new Date().toISOString();
  const jsonLd = [
    generateWebPageSchema({
      title: "Videos — Elon Musk Video Index",
      description: videos.length
        ? `Browse ${videos.length} Elon Musk related videos from Google Videos search results.`
        : "Elon Musk video index with optional transcripts.",
      url: "/videos",
      dateModified: now,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Videos", url: "/videos" },
      ],
    }),
    generateBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Videos", url: "/videos" },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-6">
        <div className="glass rounded-3xl p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-semibold text-white">Videos</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/60">
                This index is built from Google Videos search results (via
                SOAX). You can enrich entries with YouTube transcripts using the
                worker in{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                  backend/workers
                </code>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Back home
              </Link>
              <Link
                href="/topics"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Topics
              </Link>
            </div>
          </div>
        </div>

        {videos.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {videos.map((v) => (
              <Link
                key={v.videoId}
                href={`/videos/${v.videoId}`}
                className="glass rounded-3xl p-5 transition hover:border-white/20 hover:bg-white/10"
              >
                <div className="text-sm font-semibold text-white">
                  {v.title ?? v.videoId}
                </div>
                <div className="mt-1 text-xs text-white/60">
                  {v.channel ? `${v.channel} • ` : ""}
                  {v.duration ? `${v.duration} • ` : ""}
                  Updated {new Date(v.scrapedAt).toLocaleString()}
                </div>
                {v.snippet ? (
                  <div className="mt-3 text-sm text-white/70">{v.snippet}</div>
                ) : null}
                {v.sourceQuery ? (
                  <div className="mt-3 text-[11px] text-white/45">
                    Query: {v.sourceQuery}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass rounded-3xl p-6">
            <h2 className="text-lg font-semibold text-white">
              No videos ingested yet
            </h2>
            <p className="mt-2 text-sm text-white/60">
              To ingest, you need a Postgres connection (`DATABASE_URL`) and a
              SOAX key (`SOAX_API_SECRET`).
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
              <div className="font-semibold text-white">Quick start</div>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>
                  Run the dev DB:{" "}
                  <code className="rounded bg-white/10 px-1">
                    docker compose -f docker-compose.dev.yml up -d
                  </code>
                </li>
                <li>
                  Apply schema:{" "}
                  <code className="rounded bg-white/10 px-1">
                    DATABASE_URL=... npm run db:apply-schema
                  </code>
                </li>
                <li>
                  Ingest videos:{" "}
                  <code className="rounded bg-white/10 px-1">
                    SOAX_API_SECRET=... DATABASE_URL=... npm run worker:videos
                  </code>
                </li>
                <li>
                  Ingest transcripts: run{" "}
                  <code className="rounded bg-white/10 px-1">
                    backend/workers/ingest_youtube_transcripts.py
                  </code>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
