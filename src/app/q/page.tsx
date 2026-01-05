import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Globe,
  HelpCircle,
  MessageCircle,
  Sparkles,
  Zap,
} from "lucide-react";

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

  // Count AI-enhanced answers
  const aiAnswerCount = sortedQuestions.filter((q) =>
    aiQaSlugs.has(q.slug),
  ).length;

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-6">
        {/* Hero Header */}
        <header className="hero-cosmic glass-premium glow-ring rounded-3xl p-6 md:p-8">
          <div className="relative">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent2/20 bg-accent2/10 px-3 py-1 text-xs text-accent2">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Knowledge Base
                </div>
                <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                  <span className="text-gradient-bold">Q&A</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                  Get answers to the most common questions about Elon Musk.
                  First principles thinking applied to every question.
                </p>
                <LastModified date={paaUpdated} className="mt-4" />

                {/* Stats Row */}
                <div className="mt-6 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent2/10">
                      <Brain className="h-4 w-4 text-accent2" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {paa.questions.length.toLocaleString()}
                      </div>
                      <div className="text-xs text-white/50">Questions</div>
                    </div>
                  </div>
                  {aiAnswerCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                        <Sparkles className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {aiAnswerCount}
                        </div>
                        <div className="text-xs text-white/50">AI Enhanced</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent3/10">
                      <Zap className="h-4 w-4 text-accent3" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">Instant</div>
                      <div className="text-xs text-white/50">AI Answers</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Navigation */}
              <div className="flex flex-wrap gap-2 md:flex-col">
                <Link href="/" className="badge-x">
                  <Globe className="h-3 w-3" />
                  Home
                </Link>
                <Link href="/topics" className="badge-x">
                  <Brain className="h-3 w-3" />
                  Topics
                </Link>
                <Link href="/search" className="badge-x">
                  <Zap className="h-3 w-3" />
                  Search
                </Link>
              </div>
            </div>
          </div>
        </header>

        {custom.length ? (
          <section className="glass-premium rounded-3xl p-6">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <MessageCircle className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    From the Community
                  </h2>
                  <p className="text-xs text-white/50">
                    Real questions promoted from chat
                  </p>
                </div>
              </div>
              <div className="badge-x">
                <Sparkles className="h-3 w-3" />
                Newest first
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {custom.map((c, i) => (
                <Link
                  key={c.slug}
                  href={`/q/${c.slug}`}
                  className="knowledge-node group"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/10 text-xs font-bold text-accent shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[10px] text-white/50">
                        <Zap className="h-3 w-3 text-accent3" />
                        Chat-derived •{" "}
                        {new Date(c.createdAt).toLocaleDateString()}
                      </div>
                      <div className="mt-1 text-sm font-medium text-white group-hover:text-accent transition-colors">
                        {c.question}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-accent transition-colors shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Search & Browse */}
        <section className="glass-premium rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent2/10">
              <Brain className="h-4 w-4 text-accent2" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                All Questions
              </h2>
              <p className="text-xs text-white/50">
                Search or browse the knowledge base
              </p>
            </div>
          </div>
          <FilterList
            items={items}
            placeholder="Search questions (age, net worth, companies...)..."
            enablePagination={true}
            itemsPerPage={50}
          />
        </section>
      </div>
    </>
  );
}
