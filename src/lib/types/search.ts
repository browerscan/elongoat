export type SearchResultItem = {
  id: string;
  title: string;
  snippet?: string;
  url: string;
  type: "topic" | "page" | "qa" | "video";
  meta?: string;
};

export interface SearchResponse {
  results: {
    topics: SearchResultItem[];
    pages: SearchResultItem[];
    qa: SearchResultItem[];
    videos: SearchResultItem[];
  };
  totalCount: number;
}
