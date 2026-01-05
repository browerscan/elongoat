export type RecommendationSource = "content_cache" | "paa" | "cluster";

export type RecommendationArticle = {
  title: string;
  url: string;
  relevance_score: number;
  source: RecommendationSource;
  snippet?: string;
};

export type RecommendationTweet = {
  tweetId: string;
  text: string;
  createdAt: string;
  likeCount: number;
  url: string;
  rank?: number;
};

export type RecommendationResponse = {
  query: string;
  keywords: string[];
  articles: RecommendationArticle[];
  tweets: RecommendationTweet[];
};
