"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  contentSelector?: string;
  minItems?: number;
  className?: string;
}

export function TableOfContents({
  contentSelector = ".prose",
  minItems = 3,
  className = "",
}: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const content = document.querySelector(contentSelector);
    if (!content) return;

    const headings = content.querySelectorAll("h2, h3");
    const tocItems: TocItem[] = [];

    headings.forEach((heading, index) => {
      const id = heading.id || `heading-${index}`;
      if (!heading.id) heading.id = id;

      tocItems.push({
        id,
        text: heading.textContent || "",
        level: parseInt(heading.tagName[1]),
      });
    });

    setItems(tocItems);

    // Intersection observer for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -80% 0px" },
    );

    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, [contentSelector]);

  if (items.length < minItems) return null;

  return (
    <nav
      className={`glass rounded-2xl p-4 ${className}`}
      aria-label="Table of contents"
    >
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white/80">
        <List className="h-4 w-4" />
        On this page
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.id}
            style={{ paddingLeft: `${(item.level - 2) * 12}px` }}
          >
            <a
              href={`#${item.id}`}
              className={`block text-sm transition-colors line-clamp-1 py-0.5 ${
                activeId === item.id
                  ? "text-accent font-medium"
                  : "text-white/60 hover:text-white"
              }`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
