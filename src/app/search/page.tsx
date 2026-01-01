import type { Metadata } from "next";

import { SearchPageClient } from "./SearchPageClient";

export const metadata: Metadata = {
  title: "Search",
  description: "Search all topics, pages, Q&A, and videos on ElonGoat.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "/search",
  },
};

// Static export: search is client-side only
export default function SearchPage() {
  return <SearchPageClient />;
}
