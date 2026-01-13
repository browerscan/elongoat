import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, FileText, Search, UserRound } from "lucide-react";

import { JsonLd } from "../components/JsonLd";
import { OpenChatButton } from "../components/OpenChatButton";
import { getClusterIndex } from "../lib/indexes";
import { getDynamicVariables } from "../lib/variables";
import { generateHomeMetadata } from "../lib/seo";
import {
  generateOrganizationSchema,
  generatePersonSchema,
  generateWebPageSchema,
  generateWebSiteSchema,
} from "../lib/structuredData";

import { HomeMetrics } from "../components/home/HomeMetrics";
import { LatestTweets } from "../components/home/LatestTweets";
import { FeaturedWriting } from "../components/home/FeaturedWriting";
import { RecommendedContent } from "../components/home/RecommendedContent";

export const revalidate = 3600;

export const metadata = generateHomeMetadata();

export default async function Home() {
  // Only lightweight fetches here for metadata/schema
  // The heavy lifting is now distributed to components
  const [cluster, vars] = await Promise.all([
    getClusterIndex(),
    getDynamicVariables(),
  ]);

  const jsonLd = [
    generateWebSiteSchema(),
    generateOrganizationSchema(),
    generatePersonSchema(),
    generateWebPageSchema({
      title: "Elon Musk (Unofficial) — ElonGoat",
      description:
        "An unofficial personal-style hub for Elon Musk: tweets, long-form articles, and related recommendations. Not affiliated.",
      url: "/",
      dateModified: new Date(cluster.generatedAt).toISOString(),
      breadcrumbs: [{ name: "Home", url: "/" }],
    }),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-12">
        <header className="hero-cosmic glass-premium rounded-3xl p-6 md:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                Unofficial • Not affiliated
              </div>
              <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Elon Musk
              </h1>
              <p className="mt-3 text-sm text-white/70 md:text-base">
                A personal-site style hub for tweets and long-form articles —
                with algorithmic related-content recommendations.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/about" className="btn-launch">
                  <UserRound className="h-4 w-4" />
                  About
                </Link>
                <Link
                  href="/writing"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  <FileText className="h-4 w-4" />
                  Writing
                </Link>
                <Link
                  href="/tweets"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  <BookOpen className="h-4 w-4" />
                  Tweets
                </Link>
                <Link
                  href="/search"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  <Search className="h-4 w-4" />
                  Search
                </Link>
                <OpenChatButton />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-white/10 to-white/5 ring-1 ring-white/10">
                <span className="text-sm font-semibold text-white/90">EM</span>
              </div>
              <div className="text-sm text-white/70">
                <div className="text-white/90 font-semibold">Snapshot</div>
                <div className="mt-1">
                  Age <span className="text-white/90">{vars.age}</span> • Net
                  worth <span className="text-white/90">{vars.net_worth}</span>
                </div>
                <div className="mt-1 text-xs text-white/50">Live updates</div>
              </div>
            </div>
          </div>
        </header>

        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-3xl bg-white/5" />
              ))}
            </div>
          }
        >
          <HomeMetrics />
        </Suspense>

        <section className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<div className="h-96 rounded-3xl bg-white/5" />}>
            <LatestTweets />
          </Suspense>

          <Suspense fallback={<div className="h-96 rounded-3xl bg-white/5" />}>
            <FeaturedWriting />
          </Suspense>
        </section>

        <Suspense fallback={<div className="h-80 rounded-3xl bg-white/5" />}>
          <RecommendedContent />
        </Suspense>
      </div>
    </>
  );
}
