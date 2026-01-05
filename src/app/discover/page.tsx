import type { Metadata } from "next";

import { DiscoverClient } from "./DiscoverClient";

export const metadata: Metadata = {
  title: "Discover",
  description:
    "Algorithmic recommendations across tweets and long-form content about Elon Musk.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/discover" },
};

export default function DiscoverPage() {
  return <DiscoverClient />;
}
