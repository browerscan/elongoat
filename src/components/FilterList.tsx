"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ArrowUpRight, Search } from "lucide-react";

export type FilterListItem = {
  id: string;
  title: string;
  href: string;
  subtitle?: string;
  meta?: string;
};

export function FilterList({
  items,
  placeholder,
  defaultLimit = 120,
}: {
  items: FilterListItem[];
  placeholder: string;
  defaultLimit?: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const hay =
        `${i.title} ${i.subtitle ?? ""} ${i.meta ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const visible = filtered.slice(0, defaultLimit);

  return (
    <div className="space-y-4">
      <div className="glass glow-ring flex items-center gap-3 rounded-2xl px-4 py-3">
        <Search className="h-4 w-4 text-white/60" />
        <input
          id="filter-list-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
        <div className="shrink-0 text-xs text-white/50">
          {filtered.length} results
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((i) => (
          <Link
            key={i.id}
            href={i.href}
            className="group glass rounded-2xl p-4 transition hover:border-white/20 hover:bg-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {i.title}
                </div>
                {i.subtitle ? (
                  <div className="mt-1 text-xs leading-snug text-white/60">
                    {i.subtitle}
                  </div>
                ) : null}
                {i.meta ? (
                  <div className="mt-2 text-[11px] text-white/45">{i.meta}</div>
                ) : null}
              </div>
              <ArrowUpRight className="h-4 w-4 text-white/40 transition group-hover:text-white/80" />
            </div>
          </Link>
        ))}
      </div>

      {filtered.length > visible.length ? (
        <div className="text-xs text-white/50">
          Showing {visible.length} of {filtered.length}. Refine your search to
          narrow results.
        </div>
      ) : null}
    </div>
  );
}
