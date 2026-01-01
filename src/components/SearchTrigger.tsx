"use client";

import { Search } from "lucide-react";

import { useSearch } from "./SearchProvider";

export function SearchTrigger() {
  const { openSearch } = useSearch();

  return (
    <button
      type="button"
      onClick={openSearch}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
      aria-label="Search (Cmd+K)"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="ml-auto hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] font-mono text-white/50 sm:block">
        Cmd+K
      </kbd>
    </button>
  );
}
