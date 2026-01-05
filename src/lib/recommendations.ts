import "server-only";

import { findPage, findPaaQuestion } from "./indexes";
import { extractKeywordsFromText } from "./keywords";
import {
  getTweetById,
  searchTweets,
  type TweetSearchResult,
} from "./muskTweets";
import {
  buildSemanticQuery,
  getSemanticRelatedContent,
} from "./semanticRelated";
import { ragSearch } from "./ragSearch";
import { getPublicEnv } from "./env";
import type {
  RecommendationResponse,
  RecommendationTweet,
} from "./types/recommendations";

const env = getPublicEnv();
const SITE_URL = (env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io").replace(
  /\/$/,
  "",
);

function toRelativeUrl(url: string): string {
  if (!url) return "/";
  if (url.startsWith(SITE_URL)) {
    const rel = url.slice(SITE_URL.length);
    return rel.startsWith("/") ? rel : `/${rel}`;
  }
  return url;
}

function toTweetUrl(tweet: {
  tweetId: string;
  url: string | null;
  twitterUrl: string | null;
}) {
  return (
    tweet.url ||
    tweet.twitterUrl ||
    `https://x.com/elonmusk/status/${encodeURIComponent(tweet.tweetId)}`
  );
}

function mapTweetPreview(tweet: TweetSearchResult): RecommendationTweet {
  return {
    tweetId: tweet.tweetId,
    text: tweet.fullText,
    createdAt: tweet.createdAt,
    likeCount: tweet.likeCount,
    url: toTweetUrl(tweet),
    rank: tweet.rank,
  };
}

export async function resolveRecommendationQuery(params: {
  q?: string | null;
  slug?: string | null;
  tweetId?: string | null;
}): Promise<{ query: string; keywords: string[] } | null> {
  const rawQ = params.q?.trim();
  if (rawQ && rawQ.length >= 2) {
    return {
      query: rawQ.slice(0, 500),
      keywords: extractKeywordsFromText(rawQ),
    };
  }

  const rawTweetId = params.tweetId?.trim();
  if (rawTweetId) {
    const tweet = await getTweetById(rawTweetId);
    if (tweet?.fullText) {
      const keywords = extractKeywordsFromText(tweet.fullText);
      const query = buildSemanticQuery({
        title: keywords.slice(0, 6).join(" "),
        keywords,
      });
      return { query, keywords };
    }
  }

  const rawSlug = params.slug?.trim();
  if (rawSlug) {
    // PAA slugs typically do not contain a slash.
    const qa = await findPaaQuestion(rawSlug);
    if (qa) {
      const keywords = extractKeywordsFromText(qa.question);
      const query = buildSemanticQuery({
        title: qa.question,
        questionText: qa.question,
        keywords,
      });
      return { query, keywords };
    }

    const parts = rawSlug.split("/").filter(Boolean);
    if (parts.length === 2) {
      const page = await findPage(parts[0], parts[1]);
      if (page) {
        const keywords = [
          page.page,
          page.topic,
          ...(page.topKeywords?.map((k) => k.keyword) ?? []),
        ];
        const query = buildSemanticQuery({
          title: page.page,
          topic: page.topic,
          keywords,
        });
        return { query, keywords: extractKeywordsFromText(keywords.join(" ")) };
      }
    }

    const fallback = rawSlug.replace(/[-/]/g, " ");
    const keywords = extractKeywordsFromText(fallback);
    return { query: fallback, keywords };
  }

  return null;
}

export async function getRecommendations(params: {
  query: string;
  keywords?: string[];
  limitArticles?: number;
  limitTweets?: number;
  minScore?: number;
  minLikes?: number;
  semantic?: boolean;
}): Promise<RecommendationResponse> {
  const query = params.query.trim().slice(0, 500);
  const limitArticles = Math.max(1, Math.min(20, params.limitArticles ?? 8));
  const limitTweets = Math.max(1, Math.min(20, params.limitTweets ?? 8));
  const minScore = Math.max(0, Math.min(100, params.minScore ?? 0.01));
  const minLikes = Math.max(0, Math.min(5_000_000, params.minLikes ?? 0));
  const semantic = params.semantic === true;

  const keywords = params.keywords?.length
    ? params.keywords.slice(0, 30)
    : extractKeywordsFromText(query);

  const [articles, tweets] = await Promise.all([
    semantic
      ? getSemanticRelatedContent({
          query,
          limit: limitArticles,
          minScore,
          sources: ["content_cache", "paa", "cluster"],
        })
      : ragSearch({
          query,
          limit: limitArticles,
          minScore,
          sources: ["content_cache", "paa", "cluster"],
        }).then((r) =>
          r.results.map((item) => ({
            title: item.title,
            url: toRelativeUrl(item.url),
            relevance_score: item.relevance_score,
            source: item.source,
            snippet: item.content?.slice(0, 150),
          })),
        ),
    searchTweets({
      query,
      limit: limitTweets,
      includeReplies: true,
      includeRetweets: false,
      minLikes,
    }),
  ]);

  return {
    query,
    keywords,
    articles,
    tweets: tweets.map(mapTweetPreview),
  };
}
