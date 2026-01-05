import Link from "next/link";

import { FilterList, type FilterListItem } from "../../components/FilterList";
import { JsonLd } from "../../components/JsonLd";
import { LastModified } from "../../components/LastModified";
import { getSlugsWithAiContent } from "../../lib/contentCache";
import { listLatestCustomQas } from "../../lib/customQa";
import { getPaaIndex } from "../../lib/indexes";
import { generateQaIndexMetadata } from "../../lib/seo";
import {
  generateBreadcrumbSchema,
  generateFaqPageSchema,
  generateItemListSchema,
  generateWebPageSchema,
} from "../../lib/structuredData";

export const revalidate = 3600;

export async function generateMetadata() {
  const paa = await getPaaIndex();
  const qaCount = paa.questions.length;

  return generateQaIndexMetadata({ qaCount });
}

export default async function QuestionsIndexPage() {
  const [paa, custom, aiQaSlugs] = await Promise.all([
    getPaaIndex(),
    listLatestCustomQas(8),
    getSlugsWithAiContent("paa_question"),
  ]);

  const paaUpdated = new Date(paa.generatedAt);

  // Top questions with answers for FAQ schema
  const topQuestionsWithAnswers = paa.questions
    .filter((q) => q.answer && q.answer.length > 20)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 10);

  // JSON-LD structured data
  const jsonLd = [
    generateWebPageSchema({
      title: "Q&A — Elon Musk Questions and Answers",
      description: `Get answers to ${paa.questions.length.toLocaleString()} frequently asked questions about Elon Musk.`,
      url: "/q",
      dateModified: paaUpdated.toISOString(),
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Q&A", url: "/q" },
      ],
    }),
    generateBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Q&A", url: "/q" },
    ]),
    // ItemList schema for Q&A index
    generateItemListSchema({
      name: "Elon Musk Questions and Answers",
      description: `Browse ${paa.questions.length.toLocaleString()} frequently asked questions about Elon Musk`,
      url: "/q",
      items: paa.questions.slice(0, 50).map((q) => ({
        name: q.question,
        url: `/q/${q.slug}`,
        description: q.answer?.slice(0, 100),
      })),
      itemListOrder: "Descending",
    }),
    // FAQ schema for top questions
    generateFaqPageSchema(
      topQuestionsWithAnswers.map((q) => ({
        question: q.question,
        answer: q.answer!,
      })),
    ),
  ];

  // Sort questions: AI content first, then by volume
  const sortedQuestions = [...paa.questions].sort((a, b) => {
    const aHasAi = aiQaSlugs.has(a.slug);
    const bHasAi = aiQaSlugs.has(b.slug);
    if (aHasAi && !bHasAi) return -1;
    if (!aHasAi && bHasAi) return 1;
    return (b.volume ?? 0) - (a.volume ?? 0);
  });

  const items: FilterListItem[] = sortedQuestions.map((q) => ({
    id: q.slug,
    title: q.question,
    subtitle: q.answer ?? "Open and ask the AI for a better answer.",
    meta: aiQaSlugs.has(q.slug) ? "AI Answer" : undefined,
    href: `/q/${q.slug}`,
  }));

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-6">
        <div className="glass rounded-3xl p-6">
          <h1 className="text-2xl font-semibold text-white">Q&A</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            These come from a Google People Also Ask scrape. We show the
            original snippet when available and let the AI expand the answer.
          </p>
          <LastModified date={paaUpdated} className="mt-3" />
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
                  These Q&As are promoted from real user questions (manual
                  review) and become new pages.
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
          placeholder="Search questions (age, net worth, companies...)..."
          enablePagination={true}
          itemsPerPage={50}
        />
      </div>
    </>
  );
}
