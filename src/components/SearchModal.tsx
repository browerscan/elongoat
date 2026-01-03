"use client";

import { useRouter } from "next/navigation";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { X, Search as SearchIcon } from "lucide-react";

import { SearchInput } from "./SearchInput";
import { useSearch } from "./SearchProvider";

export function SearchModal() {
  const router = useRouter();
  const { isOpen, closeSearch } = useSearch();
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  const focusableSelector = useMemo(
    () =>
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "textarea:not([disabled])",
        "select:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(", "),
    [],
  );

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
      lastActiveRef.current = document.activeElement as HTMLElement | null;

      focusTimerRef.current = window.setTimeout(() => {
        const focusables =
          modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
        focusables?.[0]?.focus();
      }, 0);
    } else {
      document.body.style.overflow = "";
      lastActiveRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = "";
      if (focusTimerRef.current) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [focusableSelector, isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSearch();
      }
      if (e.key === "Tab") {
        const focusables =
          modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
        if (!focusables || focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSearch, focusableSelector, isOpen]);

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
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
      aria-describedby="search-modal-hint"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-2xl px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={modalRef}
          className="glass glow-ring overflow-hidden rounded-2xl shadow-2xl"
        >
          <h2 id="search-modal-title" className="sr-only">
            Search ElonGoat
          </h2>
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
              <span id="search-modal-hint" className="ml-auto">
                Powered by ElonGoat search
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
