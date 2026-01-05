import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "../../../components/JsonLd";
import { Markdown } from "../../../components/Markdown";
import { OpenChatButton } from "../../../components/OpenChatButton";
import { AuthorInfo } from "../../../components/AuthorInfo";
import { getTranscript, getVideo } from "../../../lib/videos";
import { generateVideoMetadata } from "../../../lib/seo";
import {
  generateBreadcrumbSchema,
  generateVideoObjectSchema,
  generateWebPageSchema,
} from "../../../lib/structuredData";

export const revalidate = 3600;

// Static params for export - return placeholder for ISR
// Real video IDs are handled at runtime via ISR
export async function generateStaticParams() {
  return [{ videoId: "placeholder" }];
}

export async function generateMetadata({
  params,
}: {
  params: { videoId: string };
}): Promise<Metadata> {
  const video = await getVideo(params.videoId);
  if (!video)
    return {
      title: "Video not found",
      robots: { index: false },
    };

  return generateVideoMetadata({
    title: video.title ?? `Video ${params.videoId}`,
    videoId: video.videoId,
    channel: video.channel,
    duration: video.duration,
    description: video.snippet ?? undefined,
  });
}

export default async function VideoPage({
  params,
}: {
  params: { videoId: string };
}) {
  const video = await getVideo(params.videoId);
  if (!video) return notFound();

  const transcript = await getTranscript(video.videoId);
  const raw = transcript?.transcriptText ?? null;
  const clipped = raw ? raw.slice(0, 12_000) : null;
  const truncated = Boolean(raw && clipped && raw.length > clipped.length);
  const transcriptMd = clipped
    ? `## Transcript (raw)\n\n${clipped}\n\n${truncated ? "_…(truncated)_" : ""}`.trim()
    : `## Transcript\n\nNo transcript has been ingested yet for this video.`;

  // JSON-LD structured data
  const jsonLd = [
    generateWebPageSchema({
      title: video.title ?? video.videoId,
      description:
        video.snippet ??
        `Video details and optional transcript for grounding chat.`,
      url: `/videos/${video.videoId}`,
      dateModified: video.scrapedAt,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Videos", url: "/videos" },
        {
          name: video.title?.slice(0, 30) ?? video.videoId,
          url: `/videos/${video.videoId}`,
        },
      ],
    }),
    generateVideoObjectSchema({
      name: video.title ?? video.videoId,
      description: video.snippet ?? `Video ${video.videoId}`,
      videoId: video.videoId,
      thumbnailUrl: video.thumbnail ?? undefined,
      uploadDate: video.publishedAt ?? undefined,
      duration: video.duration ?? undefined,
      channelName: video.channel ?? undefined,
      transcript: clipped ?? undefined,
    }),
    generateBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Videos", url: "/videos" },
      {
        name: video.title?.slice(0, 30) ?? video.videoId,
        url: `/videos/${video.videoId}`,
      },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-6">
        <header className="glass glow-ring rounded-3xl p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <Link href="/videos" className="hover:text-white">
              Videos
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white/80">{video.videoId}</span>
          </div>
          <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {video.title ?? video.videoId}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-white/65">
            {video.channel ? `${video.channel} • ` : ""}
            {video.duration ? `${video.duration} • ` : ""}
            Updated {new Date(video.scrapedAt).toLocaleString()}
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <OpenChatButton label="Ask the AI about this video" />
            {video.link ? (
              <a
                href={video.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                Open on YouTube
              </a>
            ) : null}
          </div>
        </header>

        <section className="glass rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">
            Transcript grounding
          </h2>
          <p className="mt-2 text-sm text-white/60">
            The chat can use this transcript for better answers (once ingested).
            This is raw text; it may contain errors from auto-captions.
          </p>
          <div className="mt-4">
            <Markdown content={transcriptMd} />
          </div>
          {transcript?.fetchedAt ? (
            <div className="mt-4 text-xs text-white/50">
              Transcript fetched:{" "}
              {new Date(transcript.fetchedAt).toLocaleString()}
            </div>
          ) : null}
        </section>

        <AuthorInfo lastUpdated={video.scrapedAt} contentType="video" />
      </div>
    </>
  );
}
