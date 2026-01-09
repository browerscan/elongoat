import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { WritingClient } from "./WritingClient";

export const metadata: Metadata = {
  title: "Writing | ElonGoat",
  description:
    "Browse 570+ AI-generated long-form articles about Elon Musk, Tesla, SpaceX, and more. Deep analysis powered by RAG from 55K+ tweets.",
  alternates: { canonical: "/writing" },
};

function LoadingFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white/50" />
    </div>
  );
}

export default function WritingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WritingClient />
    </Suspense>
  );
}
