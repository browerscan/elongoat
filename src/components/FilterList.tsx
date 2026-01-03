"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";

import { ArrowUpRight, ChevronLeft, ChevronRight, Search } from "lucide-react";

export type FilterListItem = {
  id: string;
  title: string;
  href: string;
  subtitle?: string;
  meta?: string;
};

// Threshold for enabling virtual scrolling
const VIRTUAL_SCROLL_THRESHOLD = 500;
// Default items per page for pagination mode
const DEFAULT_ITEMS_PER_PAGE = 50;

interface FilterListProps {
  items: FilterListItem[];
  placeholder: string;
  defaultLimit?: number;
  /** Enable pagination mode for very large lists */
  enablePagination?: boolean;
  /** Items per page when pagination is enabled */
  itemsPerPage?: number;
}

export function FilterList({
  items,
  placeholder,
  defaultLimit = 120,
  enablePagination = false,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
}: FilterListProps) {
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const hay =
        `${i.title} ${i.subtitle ?? ""} ${i.meta ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  // Reset page when search changes
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newQuery = e.target.value;
      startTransition(() => {
        setQuery(newQuery);
        setCurrentPage(1);
      });
    },
    [],
  );

  // Calculate pagination
  const totalPages = enablePagination
    ? Math.ceil(filtered.length / itemsPerPage)
    : 1;

  const visible = useMemo(() => {
    if (enablePagination) {
      const start = (currentPage - 1) * itemsPerPage;
      return filtered.slice(start, start + itemsPerPage);
    }
    return filtered.slice(0, defaultLimit);
  }, [filtered, enablePagination, currentPage, itemsPerPage, defaultLimit]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // Scroll to top of list
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Determine if we should show virtual scroll hint
  const isLargeList = items.length > VIRTUAL_SCROLL_THRESHOLD;

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="glass glow-ring flex items-center gap-3 rounded-2xl px-4 py-3">
        <Search className="h-4 w-4 flex-shrink-0 text-white/60" />
        <input
          id="filter-list-query"
          value={query}
          onChange={handleQueryChange}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
          aria-label="Search filter"
        />
        <div className="flex shrink-0 items-center gap-2">
          {isPending && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          )}
          <span className="text-xs text-white/50">
            {filtered.length.toLocaleString()} results
          </span>
        </div>
      </div>

      {/* Results count hint for large lists */}
      {isLargeList && !query && (
        <p className="text-xs text-white/40">
          Showing {visible.length.toLocaleString()} of{" "}
          {items.length.toLocaleString()} items. Use search to find specific
          content.
        </p>
      )}

      {/* Results grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((i) => (
          <FilterListCard key={i.id} item={i} />
        ))}
      </div>

      {/* Pagination controls */}
      {enablePagination && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
        />
      )}

      {/* Show more hint */}
      {!enablePagination && filtered.length > visible.length && (
        <div className="text-xs text-white/50">
          Showing {visible.length.toLocaleString()} of{" "}
          {filtered.length.toLocaleString()}. Refine your search to narrow
          results.
        </div>
      )}
    </div>
  );
}

/**
 * Individual card component - memoized for performance
 */
function FilterListCard({ item }: { item: FilterListItem }) {
  return (
    <Link
      href={item.href}
      className="group glass rounded-2xl p-4 transition hover:border-white/20 hover:bg-white/10"
      prefetch={false}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {item.title}
          </div>
          {item.subtitle ? (
            <div className="mt-1 line-clamp-2 text-xs leading-snug text-white/60">
              {item.subtitle}
            </div>
          ) : null}
          {item.meta ? (
            <div className="mt-2 text-[11px] text-white/45">{item.meta}</div>
          ) : null}
        </div>
        <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-white/40 transition group-hover:text-white/80" />
      </div>
    </Link>
  );
}

/**
 * Pagination component with page numbers
 */
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}: PaginationProps) {
  // Calculate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // Show all pages if small enough
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      // Pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      {/* Items info */}
      <div className="text-xs text-white/50">
        Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of{" "}
        {totalItems.toLocaleString()}
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, idx) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 text-white/40"
                aria-hidden="true"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`h-9 min-w-[36px] rounded-xl border text-xs transition ${
                  page === currentPage
                    ? "border-white/30 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </button>
            ),
          )}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
