"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, X, TrendingUp, Search } from "lucide-react";
import { useSearchHistory, formatSearchTime } from "../hooks/useSearchHistory";

export interface SearchSuggestionsProps {
  /** Current search input value */
  query: string;
  /** Callback when a suggestion is selected */
  onSelect: (query: string) => void;
  /** Callback when input changes */
  onChange: (query: string) => void;
  /** Maximum suggestions to show */
  maxSuggestions?: number;
  /** Additional className */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Custom trending searches */
  trendingSearches?: string[];
}

const DEFAULT_TRENDING = [
  "Elon Musk net worth",
  "Tesla stock price",
  "SpaceX Starship",
  "X/Twitter updates",
  "Neuralink progress",
];

/**
 * Search suggestions component with:
 * - Recent search history (from localStorage)
 * - Trending searches
 * - Keyboard navigation
 * - Click-outside to close
 */
export function SearchSuggestions({
  query,
  onSelect,
  onChange,
  maxSuggestions = 8,
  className = "",
  placeholder = "Search...",
  trendingSearches = DEFAULT_TRENDING,
}: SearchSuggestionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { history, removeSearch, getRecentSearches } = useSearchHistory();

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on query
  const filteredHistory = query
    ? history.filter((item) =>
        item.query.toLowerCase().includes(query.toLowerCase()),
      )
    : getRecentSearches(maxSuggestions);

  const filteredTrending = query
    ? trendingSearches.filter((s) =>
        s.toLowerCase().includes(query.toLowerCase()),
      )
    : trendingSearches.slice(0, maxSuggestions);

  const hasHistory = filteredHistory.length > 0;
  const hasTrending = filteredTrending.length > 0;
  const hasSuggestions = hasHistory || hasTrending;

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const allSuggestions = [
        ...filteredHistory.map((item) => ({
          type: "history" as const,
          data: item,
        })),
        ...filteredTrending.map((q) => ({
          type: "trending" as const,
          data: { query: q, timestamp: 0 },
        })),
      ];

      if (!isOpen || allSuggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < allSuggestions.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : allSuggestions.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < allSuggestions.length) {
            const suggestion = allSuggestions[selectedIndex];
            onSelect(suggestion.data.query);
            setIsOpen(false);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setSelectedIndex(-1);
          inputRef.current?.focus();
          break;
      }
    },
    [isOpen, selectedIndex, onSelect, filteredHistory, filteredTrending],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const items =
        suggestionsRef.current.querySelectorAll("[data-suggestion]");
      const selected = items[selectedIndex] as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (suggestionQuery: string) => {
    onSelect(suggestionQuery);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleRemove = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    removeSearch(query);
  };

  const clearButton = query ? (
    <button
      type="button"
      onClick={() => {
        onChange("");
        inputRef.current?.focus();
      }}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Clear search"
    >
      <X className="h-4 w-4" />
    </button>
  ) : null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
          <Search className="h-4 w-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
          aria-expanded={isOpen && hasSuggestions}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          role="combobox"
        />
        {clearButton}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && hasSuggestions && (
        <div
          id="search-suggestions"
          ref={suggestionsRef}
          className="absolute z-50 mt-2 w-full rounded-2xl border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          role="listbox"
        >
          <div className="max-h-80 overflow-y-auto py-2">
            {/* Recent searches */}
            {hasHistory && (
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                    Recent
                  </span>
                </div>
                <div className="space-y-1">
                  {filteredHistory.map((item, idx) => (
                    <div
                      key={`history-${item.query}`}
                      data-suggestion
                      role="option"
                      aria-selected={selectedIndex === idx}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                        selectedIndex === idx
                          ? "bg-white/10"
                          : "hover:bg-white/5"
                      }`}
                      onClick={() => handleSelect(item.query)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Clock className="h-4 w-4 text-white/30 shrink-0" />
                      <span className="flex-1 text-sm text-white/80 truncate">
                        {item.query}
                      </span>
                      <span className="text-xs text-white/30 shrink-0">
                        {formatSearchTime(item.timestamp)}
                      </span>
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-white/30 hover:text-white transition-all"
                        onClick={(e) => handleRemove(e, item.query)}
                        aria-label={`Remove ${item.query} from history`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending searches */}
            {hasTrending && (
              <div
                className={`px-3 py-2 ${hasHistory ? "border-t border-white/5" : ""}`}
              >
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                  Trending
                </span>
                <div className="mt-2 space-y-1">
                  {filteredTrending.map((trending, idx) => {
                    const globalIdx = hasHistory
                      ? filteredHistory.length + idx
                      : idx;
                    return (
                      <div
                        key={`trending-${trending}`}
                        data-suggestion
                        role="option"
                        aria-selected={selectedIndex === globalIdx}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                          selectedIndex === globalIdx
                            ? "bg-white/10"
                            : "hover:bg-white/5"
                        }`}
                        onClick={() => handleSelect(trending)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <TrendingUp className="h-4 w-4 text-accent3 shrink-0" />
                        <span className="flex-1 text-sm text-white/80">
                          {trending}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30">
            <span>Use arrow keys to navigate</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/5">ESC</kbd>
          </div>
        </div>
      )}
    </div>
  );
}
