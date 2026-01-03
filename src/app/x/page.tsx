import type { Metadata } from "next";

import Link from "next/link";

import { CopyPromptButton } from "@/components/CopyPromptButton";
import { OpenChatButton } from "@/components/OpenChatButton";
import { listXTweets } from "@/lib/x";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "X Monitor",
  description:
    "A cached, best-effort mirror of @elonmusk's public timeline (may be incomplete or stale).",
  robots: { index: false, follow: true },
  alternates: { canonical: "/x" },
};

function primaryHandle(): string {
  const raw = process.env.X_HANDLES?.split(",")[0]?.trim();
  return (raw?.replace(/^@/, "") || "elonmusk").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function extractTweetMeta(raw: unknown): {
  authorHandle?: string;
  authorName?: string;
  avatar?: string;
  followers?: number;
  following?: number;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  quoteCount?: number;
} {
  if (!isRecord(raw)) return {};
  const tweet = raw["tweet"];
  if (!isRecord(tweet)) return {};

  const user = tweet["user"];
  const userObj = isRecord(user) ? user : null;

  return {
    authorHandle:
      userObj && typeof userObj["screen_name"] === "string"
        ? userObj["screen_name"]
        : undefined,
    authorName:
      userObj && typeof userObj["name"] === "string"
        ? userObj["name"]
        : undefined,
    avatar:
      userObj && typeof userObj["profile_image_url_https"] === "string"
        ? userObj["profile_image_url_https"]
        : undefined,
    followers:
      userObj && typeof userObj["followers_count"] === "number"
        ? userObj["followers_count"]
        : undefined,
    following:
      userObj && typeof userObj["friends_count"] === "number"
        ? userObj["friends_count"]
        : undefined,
    likeCount:
      typeof tweet["favorite_count"] === "number"
        ? tweet["favorite_count"]
        : undefined,
    replyCount:
      typeof tweet["reply_count"] === "number"
        ? tweet["reply_count"]
        : undefined,
    retweetCount:
      typeof tweet["retweet_count"] === "number"
        ? tweet["retweet_count"]
        : undefined,
    quoteCount:
      typeof tweet["quote_count"] === "number"
        ? tweet["quote_count"]
        : undefined,
  };
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function XIndexPage() {
  const handle = primaryHandle();
  const tweets = await listXTweets({ handle, limit: 60 });

  const lastScrapedAt = tweets[0]?.scrapedAt;
  const latestMeta = tweets[0]?.raw ? extractTweetMeta(tweets[0].raw) : {};

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold text-white">X Monitor</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Cached mirror of <span className="text-white/85">@{handle}</span>{" "}
              via a public syndication endpoint. It may be incomplete or stale.
              Always verify on{" "}
              <a
                href={`https://x.com/${handle}`}
                target="_blank"
                rel="noreferrer"
                className="text-white/80 hover:underline"
              >
                x.com
              </a>
              .
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {lastScrapedAt
                  ? `Updated ${timeAgo(lastScrapedAt)}`
                  : "Not ingested yet"}
              </span>
              {typeof latestMeta.followers === "number" ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Followers: {latestMeta.followers.toLocaleString()}
                </span>
              ) : null}
              {typeof latestMeta.following === "number" ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Following: {latestMeta.following.toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/x/following"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Following
            </Link>
            <OpenChatButton
              label="Ask the AI about these tweets"
              id="open-chat-x"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <CopyPromptButton
          text={`Summarize the last ~10 posts on @${handle} and infer the main themes.`}
        />
        <CopyPromptButton
          text={`Pick the most important recent post by @${handle} and explain why it matters.`}
        />
      </div>

      {tweets.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {tweets.map((t) => {
            const meta = extractTweetMeta(t.raw);
            const author = meta.authorHandle
              ? `@${meta.authorHandle}`
              : `@${handle}`;
            const posted = t.postedAt
              ? new Date(t.postedAt).toLocaleString()
              : null;
            const isOther =
              meta.authorHandle &&
              meta.authorHandle.toLowerCase() !== handle.toLowerCase();

            return (
              <a
                key={t.tweetId}
                href={t.url ?? `https://x.com/${handle}`}
                target="_blank"
                rel="noreferrer"
                className="glass rounded-3xl p-5 transition hover:border-white/20 hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {meta.authorName ? `${meta.authorName} ` : ""}
                      <span className="text-white/70">{author}</span>
                    </div>
                    <div className="mt-1 text-xs text-white/55">
                      {posted ? `${posted} • ` : ""}
                      Cached {timeAgo(t.scrapedAt)}
                      {isOther
                        ? " • appears in timeline (not authored by @elonmusk)"
                        : ""}
                    </div>
                  </div>
                </div>

                {t.content ? (
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                    {t.content}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-white/60">
                    (No text captured)
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/55">
                  {typeof meta.replyCount === "number" ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      Replies {meta.replyCount.toLocaleString()}
                    </span>
                  ) : null}
                  {typeof meta.retweetCount === "number" ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      Reposts {meta.retweetCount.toLocaleString()}
                    </span>
                  ) : null}
                  {typeof meta.quoteCount === "number" ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      Quotes {meta.quoteCount.toLocaleString()}
                    </span>
                  ) : null}
                  {typeof meta.likeCount === "number" ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      Likes {meta.likeCount.toLocaleString()}
                    </span>
                  ) : null}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="glass rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">
            No X data ingested yet
          </h2>
          <p className="mt-2 text-sm text-white/60">
            To ingest tweets into Postgres, run the X worker. This keeps the
            website fast and avoids fetching X on every page render.
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
                Ingest tweets:{" "}
                <code className="rounded bg-white/10 px-1">
                  DATABASE_URL=... npm run worker:x
                </code>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
