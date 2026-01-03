"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface VirtualListProps<T> {
  /** All items to render */
  items: T[];
  /** Height of each item in pixels */
  itemHeight: number;
  /** Maximum height of the container in pixels */
  containerHeight: number;
  /** Number of items to render outside the visible area (buffer) */
  overscan?: number;
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional className for the container */
  className?: string;
  /** Optional className for the inner wrapper */
  innerClassName?: string;
}

/**
 * Virtual list component for efficient rendering of large lists.
 * Only renders items that are visible in the viewport plus a small buffer.
 *
 * Performance: Handles 70k+ items smoothly.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
  renderItem,
  className = "",
  innerClassName = "",
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate visible range
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
  );
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Reset scroll on items change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div
        style={{ height: totalHeight, position: "relative" }}
        className={innerClassName}
      >
        <div
          style={{
            position: "absolute",
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, idx) => (
            <div key={startIndex + idx} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + idx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Virtual grid component for 2-column layouts.
 * Optimized for the FilterList use case.
 */
export interface VirtualGridProps<T> {
  /** All items to render */
  items: T[];
  /** Height of each row in pixels */
  rowHeight: number;
  /** Maximum height of the container in pixels */
  containerHeight: number;
  /** Number of columns */
  columns?: number;
  /** Number of rows to render outside the visible area (buffer) */
  overscan?: number;
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional className for the container */
  className?: string;
  /** Gap between items in pixels */
  gap?: number;
}

export function VirtualGrid<T>({
  items,
  rowHeight,
  containerHeight,
  columns = 2,
  overscan = 3,
  renderItem,
  className = "",
  gap = 12,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate rows
  const totalRows = Math.ceil(items.length / columns);
  const totalHeight = totalRows * (rowHeight + gap) - gap;

  // Calculate visible range of rows
  const startRow = Math.max(
    0,
    Math.floor(scrollTop / (rowHeight + gap)) - overscan,
  );
  const endRow = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + containerHeight) / (rowHeight + gap)) + overscan,
  );

  // Get visible items
  const startIndex = startRow * columns;
  const endIndex = Math.min(items.length - 1, (endRow + 1) * columns - 1);
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startRow * (rowHeight + gap);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Reset scroll on items change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);

  // Group items into rows
  const rows: T[][] = [];
  for (let i = 0; i < visibleItems.length; i += columns) {
    rows.push(visibleItems.slice(i, i + columns));
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {rows.map((row, rowIdx) => (
            <div
              key={startRow + rowIdx}
              className="grid gap-3 md:grid-cols-2"
              style={{
                height: rowHeight,
                marginBottom: rowIdx < rows.length - 1 ? gap : 0,
              }}
            >
              {row.map((item, colIdx) => {
                const globalIndex = startIndex + rowIdx * columns + colIdx;
                return (
                  <div key={globalIndex} className="h-full">
                    {renderItem(item, globalIndex)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
