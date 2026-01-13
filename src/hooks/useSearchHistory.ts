"use client";

import { useState, useEffect, useCallback } from "react";

const SEARCH_HISTORY_KEY = "elongoat_search_history";
const MAX_HISTORY = 10;
const STORAGE_VERSION = 1;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount?: number;
}

interface SearchHistoryStorage {
  version: number;
  items: SearchHistoryItem[];
}

/**
 * Hook for managing search history with localStorage persistence
 * Provides add, remove, clear, and history query functions
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryStorage;
        if (parsed.version === STORAGE_VERSION && Array.isArray(parsed.items)) {
          setHistory(parsed.items);
        }
      }
    } catch {
      // Silent fail on storage error
    }
    setLoaded(true);
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback((items: SearchHistoryItem[]) => {
    try {
      const data: SearchHistoryStorage = {
        version: STORAGE_VERSION,
        items: items.slice(0, MAX_HISTORY),
      };
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(data));
    } catch {
      // Silent fail on storage error
    }
  }, []);

  // Add a search query to history
  const addSearch = useCallback(
    (query: string, resultCount?: number) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      const newItem: SearchHistoryItem = {
        query: trimmed,
        timestamp: Date.now(),
        resultCount,
      };

      setHistory((prev) => {
        // Remove existing entry with same query (to move it to top)
        const filtered = prev.filter((item) => item.query !== trimmed);
        const updated = [newItem, ...filtered];
        saveHistory(updated);
        return updated;
      });
    },
    [saveHistory],
  );

  // Remove a specific entry from history
  const removeSearch = useCallback(
    (query: string) => {
      setHistory((prev) => {
        const updated = prev.filter((item) => item.query !== query);
        saveHistory(updated);
        return updated;
      });
    },
    [saveHistory],
  );

  // Clear all search history
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
      // Silent fail
    }
  }, []);

  // Get unique queries (for suggestions)
  const uniqueQueries = useCallback(() => {
    return history.map((item) => item.query);
  }, [history]);

  // Get recent searches (last N items)
  const getRecentSearches = useCallback(
    (count = 5) => {
      return history.slice(0, count);
    },
    [history],
  );

  // Search within history
  const searchInHistory = useCallback(
    (query: string) => {
      const lowerQuery = query.toLowerCase();
      return history.filter((item) =>
        item.query.toLowerCase().includes(lowerQuery),
      );
    },
    [history],
  );

  return {
    history,
    loaded,
    addSearch,
    removeSearch,
    clearHistory,
    uniqueQueries,
    getRecentSearches,
    searchInHistory,
  };
}

/**
 * Helper function to format timestamp for display
 */
export function formatSearchTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
