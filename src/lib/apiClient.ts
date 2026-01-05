import { getEnv, getPublicEnv } from "./env";
/**
 * API client for fetching data from the backend.
 * During static export build, this fetches from NEXT_PUBLIC_API_URL.
 * During client-side navigation, it fetches from the same API.
 */

const getApiBaseUrl = (): string => {
  const publicEnv = getPublicEnv();
  // In browser, use relative paths (same-origin) or configured API URL
  if (typeof window !== "undefined") {
    return publicEnv.NEXT_PUBLIC_API_URL || "";
  }
  // During build/SSR, use the full API URL
  const env = getEnv();
  return (
    publicEnv.NEXT_PUBLIC_API_URL || env.API_URL || "http://localhost:3000"
  );
};

type ApiOptions = {
  revalidate?: number;
  tags?: string[];
};

async function apiFetch<T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
    },
    next: {
      revalidate: options.revalidate ?? 3600,
      tags: options.tags,
    },
  };

  const res = await fetch(url, fetchOptions);

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// Types based on the API responses
export type ClusterTopic = {
  slug: string;
  topic: string;
  pageCount: number;
  totalVolume: number;
  pages: string[];
};

export type ClusterKeyword = {
  keyword: string;
  volume: number;
  kd: number;
  intent?: string;
  cpc?: string;
  serp_features?: string;
};

export type ClusterPage = {
  slug: string;
  topicSlug: string;
  topic: string;
  pageSlug: string;
  page: string;
  pageType?: string | null;
  seedKeyword?: string | null;
  tags?: string | null;
  keywordCount: number;
  maxVolume: number;
  totalVolume: number;
  minKd?: number | null;
  maxKd?: number | null;
  topKeywords: ClusterKeyword[];
};

export type PaaQuestion = {
  slug: string;
  question: string;
  parent?: string | null;
  answer?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  volume: number;
};

export type DynamicVariables = {
  age: number;
  children_count: number;
  net_worth: string;
  dob: string;
  updatedAt: string;
};

export type CustomQaSummary = {
  slug: string;
  question: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
};

// API response types
export type ClusterDataResponse = {
  cluster: {
    generatedAt: string;
    source: string;
    topics: ClusterTopic[];
    totalPages: number;
  };
  paa: {
    generatedAt: string;
    source: string;
    totalQuestions: number;
  };
  topPages: string[];
  topQuestions: string[];
  variables: DynamicVariables;
};

export type TopicDataResponse = {
  topic: ClusterTopic;
  pages: ClusterPage[];
  allTopics: ClusterTopic[];
};

export type PageDataResponse = {
  page: ClusterPage;
  topic: ClusterTopic | null;
  siblingPages: ClusterPage[];
  content: {
    contentMd: string;
    model: string;
    cached: boolean;
  };
  variables: DynamicVariables;
  allTopics: ClusterTopic[];
};

export type QaIndexResponse = {
  paa: {
    generatedAt: string;
    source: string;
    questions: PaaQuestion[];
  };
  customQas: CustomQaSummary[];
};

export type QaDetailResponse =
  | {
      kind: "custom";
      slug: string;
      question: string;
      contentMd: string;
      model: string | null;
      sources: unknown;
      createdAt: string;
      updatedAt: string;
      variables: DynamicVariables;
    }
  | {
      kind: "paa";
      slug: string;
      question: string;
      parent?: string | null;
      sourceUrl?: string | null;
      sourceTitle?: string | null;
      volume: number;
      content: {
        contentMd: string;
        model: string;
        cached: boolean;
      };
      variables: DynamicVariables;
      totalQuestions: number;
    };

// API functions
export async function fetchClusterData(): Promise<ClusterDataResponse> {
  return apiFetch<ClusterDataResponse>("/api/data/cluster", {
    revalidate: 3600,
    tags: ["cluster"],
  });
}

export async function fetchTopicData(
  slug: string,
): Promise<TopicDataResponse | null> {
  try {
    return await apiFetch<TopicDataResponse>(`/api/data/topic/${slug}`, {
      revalidate: 3600,
      tags: ["topic", `topic-${slug}`],
    });
  } catch {
    return null;
  }
}

export async function fetchPageData(
  topicSlug: string,
  pageSlug: string,
): Promise<PageDataResponse | null> {
  try {
    return await apiFetch<PageDataResponse>(
      `/api/data/page/${topicSlug}/${pageSlug}`,
      {
        revalidate: 3600,
        tags: ["page", `page-${topicSlug}-${pageSlug}`],
      },
    );
  } catch {
    return null;
  }
}

export async function fetchQaIndex(): Promise<QaIndexResponse> {
  return apiFetch<QaIndexResponse>("/api/data/qa", {
    revalidate: 3600,
    tags: ["qa"],
  });
}

export async function fetchQaDetail(
  slug: string,
): Promise<QaDetailResponse | null> {
  try {
    return await apiFetch<QaDetailResponse>(`/api/data/qa/${slug}`, {
      revalidate: 3600,
      tags: ["qa", `qa-${slug}`],
    });
  } catch {
    return null;
  }
}
