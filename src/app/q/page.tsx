import type { Metadata } from "next";

import Link from "next/link";

import { FilterList, type FilterListItem } from "@/components/FilterList";
import { listLatestCustomQas } from "@/lib/customQa";
import { getPaaIndex } from "@/lib/indexes";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Q&A",
  description:
    "People Also Ask questions about Elon Musk, with sources and AI expansion.",
};

export default async function QuestionsIndexPage() {
  const [paa, custom] = await Promise.all([
    getPaaIndex(),
    listLatestCustomQas(8),
  ]);

  const items: FilterListItem[] = paa.questions.map((q) => ({
    id: q.slug,
    title: q.question,
    subtitle: q.answer ?? "Open and ask the AI for a better answer.",
    meta: q.volume ? `Search volume: ${q.volume.toLocaleString()}` : undefined,
    href: `/q/${q.slug}`,
  }));

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6">
        <h1 className="text-2xl font-semibold text-white">Q&A</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          These come from a Google People Also Ask scrape. We show the original
          snippet when available and let the AI expand the answer.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
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
            Browse topics
          </Link>
        </div>
      </div>

      {custom.length ? (
        <section className="glass rounded-3xl p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-lg font-semibold text-white">From chat</h2>
              <p className="mt-1 max-w-2xl text-sm text-white/60">
                These Q&As are promoted from real user questions (manual review)
                and become new pages.
              </p>
            </div>
            <div className="text-xs text-white/50">Newest first</div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {custom.map((c) => (
              <Link
                key={c.slug}
                href={`/q/${c.slug}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
              >
                <div className="text-[11px] text-white/55">
                  Chat-derived • {new Date(c.createdAt).toLocaleDateString()}
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {c.question}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <FilterList
        items={items}
        placeholder="Search questions (age, net worth, companies…)…"
      />
    </div>
  );
}
