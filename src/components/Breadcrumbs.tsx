import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumb navigation with JSON-LD BreadcrumbList schema
 * Shows navigation path: Home > Topic > Page
 * Mobile-friendly with truncation for long paths
 */
export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  // Generate JSON-LD BreadcrumbList schema
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
      <JsonLd data={breadcrumbSchema} />
      <nav
        aria-label="Breadcrumb"
        className={`flex flex-wrap items-center gap-1 text-xs text-white/60 ${className}`}
      >
        {items.map((item, index) => (
          <li key={item.url} className="flex items-center gap-1">
            {index === 0 && <Home className="h-3 w-3" aria-label="Home" />}
            {index === items.length - 1 ? (
              <span className="text-white/80 truncate max-w-[200px] sm:max-w-none">
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
              <ChevronRight className="h-3 w-3 text-white/30 flex-shrink-0" />
            )}
          </li>
        ))}
      </nav>
    </>
  );
}

/**
 * Helper to generate standard breadcrumb items for common page types
 */
export function getPageBreadcrumbs(
  pageType: "home" | "topic" | "page" | "qa" | "video" | "fact",
  params?: {
    topic?: string;
    topicSlug?: string;
    page?: string;
    pageSlug?: string;
    question?: string;
    slug?: string;
    fact?: string;
  },
): BreadcrumbItem[] {
  const base: BreadcrumbItem[] = [{ name: "Home", url: "/" }];

  switch (pageType) {
    case "home":
      return base;
    case "topic":
      return [
        ...base,
        { name: "Topics", url: "/topics" },
        { name: params?.topic ?? "Topic", url: `/${params?.topicSlug ?? ""}` },
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
    case "qa":
      return [
        ...base,
        { name: "Q&A", url: "/q" },
        {
          name: params?.question?.slice(0, 30) ?? "Question",
          url: `/q/${params?.slug ?? ""}`,
        },
      ];
    case "video":
      return [
        ...base,
        { name: "Videos", url: "/videos" },
        { name: "Video", url: `/videos/${params?.slug ?? ""}` },
      ];
    case "fact":
      return [
        ...base,
        { name: "Facts", url: "/facts" },
        { name: params?.fact ?? "Fact", url: `/facts/${params?.slug ?? ""}` },
      ];
    default:
      return base;
  }
}
