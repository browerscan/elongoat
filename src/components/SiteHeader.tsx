import Link from "next/link";

import { Rocket, Search } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-white/5"
        >
          <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-white/10 to-white/5 ring-1 ring-white/10">
            <Rocket className="h-5 w-5 text-white/90" />
            <span className="pointer-events-none absolute -inset-2 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.35),transparent_55%)] opacity-0 blur-sm transition-opacity group-hover:opacity-100" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-white">
              ElonGoat
            </div>
            <div className="text-xs text-white/60">Digital Elon (AI)</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <Link
            href="/q"
            className="rounded-xl px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Q&A
          </Link>
          <Link
            href="/videos"
            className="rounded-xl px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Videos
          </Link>
          <Link
            href="/x"
            className="rounded-xl px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            X Monitor
          </Link>
          <Link
            href="/topics"
            className="rounded-xl px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Topics
          </Link>
          <a
            href="https://x.com/elonmusk"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Real Elon on X
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/topics"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10"
          >
            <Search className="h-4 w-4" />
            Explore
          </Link>
        </div>
      </div>
    </header>
  );
}
