import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { JsonLd } from "./JsonLd";

export interface StructuredBreadcrumbItem {
  name: string;
  url: string;
}

export interface StructuredBreadcrumbsProps {
  items: StructuredBreadcrumbItem[];
  className?: string;
  schema?: boolean;
}

/**
 * Structured breadcrumb navigation with full JSON-LD BreadcrumbList schema
 * Enhanced version with proper structured data for rich results
 *
 * Features:
 * - Full BreadcrumbList schema with position, name, and item
 * - Proper URL resolution for both client and server
 * - Mobile-friendly truncation
 * - Accessible ARIA labels
 */
export function StructuredBreadcrumbs({
  items,
  className = "",
  schema = true,
}: StructuredBreadcrumbsProps) {
  // Generate JSON-LD BreadcrumbList schema with full properties
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item:
        typeof window !== "undefined"
          ? new URL(item.url, window.location.origin).href
          : `https://elongoat.io${item.url}`,
    })),
  };

  return (
    <>
      {schema && <JsonLd data={breadcrumbSchema} />}
      <nav
        aria-label="Breadcrumb"
        className={`flex flex-wrap items-center gap-1 text-xs text-white/60 ${className}`}
      >
        {items.map((item, index) => (
          <li key={item.url} className="flex items-center gap-1">
            {index === 0 && <Home className="h-3 w-3" aria-label="Home" />}
            {index === items.length - 1 ? (
              <span
                className="text-white/80 truncate max-w-[200px] sm:max-w-none"
                aria-current="page"
              >
                {item.name}
              </span>
            ) : (
              <Link
                href={item.url}
                className="hover:text-white transition-colors truncate max-w-[150px] sm:max-w-none"
              >
                {item.name}
              </Link>
            )}
            {index < items.length - 1 && (
              <ChevronRight
                className="h-3 w-3 text-white/30 flex-shrink-0"
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </nav>
    </>
  );
}

/**
 * Helper to generate structured breadcrumb items for all page types
 * Includes proper URLs and semantic naming
 */
export function getStructuredBreadcrumbs(
  pageType:
    | "home"
    | "topics"
    | "topic"
    | "page"
    | "qa"
    | "qa-index"
    | "video"
    | "videos"
    | "fact"
    | "facts"
    | "tweets"
    | "x-archive",
  params?: {
    topic?: string;
    topicSlug?: string;
    page?: string;
    pageSlug?: string;
    question?: string;
    slug?: string;
    fact?: string;
    videoId?: string;
  },
): StructuredBreadcrumbItem[] {
  const base: StructuredBreadcrumbItem[] = [{ name: "Home", url: "/" }];

  switch (pageType) {
    case "home":
      return [{ name: "Home", url: "/" }];
    case "topics":
      return [...base, { name: "All Topics", url: "/topics" }];
    case "topic":
      return [
        ...base,
        { name: "Topics", url: "/topics" },
        {
          name: params?.topic ?? "Topic",
          url: `/${params?.topicSlug ?? ""}`,
        },
      ];
    case "page":
      return [
        ...base,
        { name: "Topics", url: "/topics" },
        {
          name: params?.topic ?? "Topic",
          url: `/${params?.topicSlug ?? ""}`,
        },
        {
          name: params?.page ?? "Page",
          url: `/${params?.topicSlug ?? ""}/${params?.pageSlug ?? ""}`,
        },
      ];
    case "qa-index":
      return [...base, { name: "Q&A", url: "/q" }];
    case "qa":
      return [
        ...base,
        { name: "Q&A", url: "/q" },
        {
          name: params?.question?.slice(0, 40) ?? "Question",
          url: `/q/${params?.slug ?? ""}`,
        },
      ];
    case "videos":
      return [...base, { name: "Videos", url: "/videos" }];
    case "video":
      return [
        ...base,
        { name: "Videos", url: "/videos" },
        {
          name: "Video Details",
          url: `/videos/${params?.videoId ?? ""}`,
        },
      ];
    case "facts":
      return [...base, { name: "Facts", url: "/facts" }];
    case "fact":
      return [
        ...base,
        { name: "Facts", url: "/facts" },
        {
          name: params?.fact ?? "Fact",
          url: `/facts/${params?.slug ?? ""}`,
        },
      ];
    case "tweets":
      return [...base, { name: "Tweet Archive", url: "/tweets" }];
    case "x-archive":
      return [...base, { name: "X Archive", url: "/x/archive" }];
    default:
      return base;
  }
}
