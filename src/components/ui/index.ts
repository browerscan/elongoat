/**
 * UI Component Index
 * Centralized exports for all reusable UI components
 */

// Enhanced Image Components
export { EnhancedImage, Avatar, CoverImage } from "../EnhancedImage";

export { LazyImage, LazyAvatar, LazyCover } from "../LazyImage";

// Loading States
export {
  Skeleton,
  CardSkeleton,
  ArticleSkeleton,
  StatsCardSkeleton,
  TopicHubSkeleton,
  SearchResultsSkeleton,
  TweetSkeleton,
  LoadingSpinner,
  FullPageLoader,
} from "../LoadingSkeleton";

// Search Components
export {
  SearchSuggestions,
  type SearchSuggestionsProps,
} from "../SearchSuggestions";

// Error Handling
export {
  ErrorBoundary,
  withErrorBoundary,
  type ErrorBoundaryProps,
} from "../ErrorBoundary";

// Hooks
export {
  useSearchHistory,
  formatSearchTime,
  type SearchHistoryItem,
} from "../../hooks/useSearchHistory";
