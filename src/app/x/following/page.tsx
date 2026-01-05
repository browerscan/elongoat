import type { Metadata } from "next";

import Link from "next/link";

import { OpenChatButton } from "../../../components/OpenChatButton";
import { listXFollowing } from "../../../lib/x";
import { getEnv } from "../../../lib/env";

const env = getEnv();
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "X Following",
  description:
    "Best-effort capture of accounts followed by @elonmusk (may be incomplete due to X restrictions).",
  robots: { index: false, follow: true },
  alternates: { canonical: "/x/following" },
};

function primaryHandle(): string {
  const raw = env.X_HANDLES?.split(",")[0]?.trim();
  return (raw?.replace(/^@/, "") || "elonmusk").toLowerCase();
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

export default async function XFollowingPage() {
  const handle = primaryHandle();
  const following = await listXFollowing({ handle, limit: 5000 });
  const lastScrapedAt = following[0]?.scrapedAt;

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold text-white">Following</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Best-effort list of accounts followed by{" "}
              <span className="text-white/85">@{handle}</span>. X heavily
              rate-limits this data for unauthenticated scraping, so this view
              may be incomplete.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {lastScrapedAt
                  ? `Updated ${timeAgo(lastScrapedAt)}`
                  : "Not ingested yet"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Rows: {following.length.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/x"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Back to tweets
            </Link>
            <a
              href={`https://x.com/${handle}/following`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              View on X
            </a>
            <OpenChatButton
              label="Ask the AI about this network"
              id="open-chat-x-following"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            />
          </div>
        </div>
      </div>

      {following.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {following.map((f) => (
            <a
              key={f.followingHandle}
              href={`https://x.com/${f.followingHandle}`}
              target="_blank"
              rel="noreferrer"
              className="glass rounded-3xl p-5 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="text-sm font-semibold text-white">
                @{f.followingHandle}
              </div>
              <div className="mt-1 text-xs text-white/55">
                Seen {timeAgo(f.scrapedAt)}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="glass rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">
            No following data ingested yet
          </h2>
          <p className="mt-2 text-sm text-white/60">
            This list is optional and requires a scraping provider (SOAX)
            because X does not reliably expose following lists to
            unauthenticated clients.
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
            <div className="font-semibold text-white">Quick start</div>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                Set env:{" "}
                <code className="rounded bg-white/10 px-1">
                  SOAX_API_SECRET=... X_FETCH_FOLLOWING=true
                </code>
              </li>
              <li>
                Run worker:{" "}
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
