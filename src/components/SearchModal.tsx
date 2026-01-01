"use client";

import { useRouter } from "next/navigation";

import { useEffect, useRef, useState, useTransition } from "react";

import { X, Search as SearchIcon } from "lucide-react";

import { SearchInput } from "./SearchInput";
import { useSearch } from "./SearchProvider";

export function SearchModal() {
  const router = useRouter();
  const { isOpen, closeSearch } = useSearch();
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset query when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      closeSearch();
    }
  };

  const handleSearch = (value: string) => {
    setQuery(value);
  };

  const handleSubmit = () => {
    if (query.trim().length >= 2) {
      startTransition(() => {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        closeSearch();
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-2xl px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass glow-ring overflow-hidden rounded-2xl shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <SearchIcon className="h-5 w-5 shrink-0 text-white/60" />
            <div className="flex-1">
              <SearchInput
                value={query}
                onChange={handleSearch}
                onSubmit={handleSubmit}
                placeholder="Search topics, pages, Q&A, videos..."
                autoFocus
                debounceMs={0}
              />
            </div>
            <button
              type="button"
              onClick={closeSearch}
              className="shrink-0 rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
              <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono">
                Enter
              </kbd>
              <span>to search</span>
              <kbd className="ml-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono">
                Esc
              </kbd>
              <span>to close</span>
              <span className="ml-auto">Powered by ElonGoat search</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
