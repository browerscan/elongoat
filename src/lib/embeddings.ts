import "server-only";

import { getEnv } from "./env";

const env = getEnv();
/**
 * Embedding Generation Utility
 *
 * Generates text embeddings using OpenAI-compatible APIs (OpenAI, VectorEngine, etc.)
 * Used for semantic search via pgvector.
 *
 * Supports:
 * - OpenAI text-embedding-3-small (1536 dimensions, default)
 * - OpenAI text-embedding-3-large (3072 dimensions)
 * - OpenAI text-embedding-ada-002 (1536 dimensions, legacy)
 * - Any OpenAI-compatible embedding API
 */

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  dimensions?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

// Max tokens per embedding request (model dependent)
const MAX_TOKENS_PER_REQUEST = 8191;

// Max batch size for embedding requests
const MAX_BATCH_SIZE = 100;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get embedding configuration from environment
 */
export function getEmbeddingConfig(): EmbeddingConfig | null {
  const apiKey = env.OPENAI_API_KEY || env.VECTORENGINE_API_KEY;

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: env.EMBEDDING_BASE_URL || env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    model: env.EMBEDDING_MODEL,
    dimensions: env.EMBEDDING_DIMENSIONS || DEFAULT_DIMENSIONS,
  };
}

/**
 * Check if embeddings are available
 */
export function isEmbeddingEnabled(): boolean {
  return getEmbeddingConfig() !== null;
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  config?: Partial<EmbeddingConfig>,
): Promise<EmbeddingResult | null> {
  const baseConfig = getEmbeddingConfig();
  if (!baseConfig) {
    console.warn("[Embeddings] No API key configured");
    return null;
  }

  const mergedConfig = { ...baseConfig, ...config };

  // Truncate text if too long (rough estimate: 1 token ~= 4 chars)
  const maxChars = MAX_TOKENS_PER_REQUEST * 4;
  const truncatedText = text.length > maxChars ? text.slice(0, maxChars) : text;

  try {
    const response = await fetch(`${mergedConfig.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mergedConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: mergedConfig.model,
        input: truncatedText,
        dimensions: mergedConfig.dimensions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Embeddings] API error ${response.status}:`, errorText);
      return null;
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
      model: string;
      usage: { prompt_tokens: number; total_tokens: number };
    };

    return {
      embedding: data.data[0].embedding,
      model: data.model,
      usage: data.usage,
    };
  } catch (error) {
    console.error("[Embeddings] Error generating embedding:", error);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  config?: Partial<EmbeddingConfig>,
): Promise<BatchEmbeddingResult | null> {
  const baseConfig = getEmbeddingConfig();
  if (!baseConfig) {
    console.warn("[Embeddings] No API key configured");
    return null;
  }

  const mergedConfig = { ...baseConfig, ...config };

  // Truncate texts if too long
  const maxChars = MAX_TOKENS_PER_REQUEST * 4;
  const truncatedTexts = texts.map((text) =>
    text.length > maxChars ? text.slice(0, maxChars) : text,
  );

  // Process in batches
  const allEmbeddings: number[][] = [];
  let totalPromptTokens = 0;
  let totalTokens = 0;
  let model = "";

  for (let i = 0; i < truncatedTexts.length; i += MAX_BATCH_SIZE) {
    const batch = truncatedTexts.slice(i, i + MAX_BATCH_SIZE);

    try {
      const response = await fetch(`${mergedConfig.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mergedConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: mergedConfig.model,
          input: batch,
          dimensions: mergedConfig.dimensions,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Embeddings] Batch API error ${response.status}:`,
          errorText,
        );
        return null;
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
        model: string;
        usage: { prompt_tokens: number; total_tokens: number };
      };

      // Sort by index to maintain order
      const sortedData = data.data.sort((a, b) => a.index - b.index);
      allEmbeddings.push(...sortedData.map((d) => d.embedding));

      model = data.model;
      totalPromptTokens += data.usage.prompt_tokens;
      totalTokens += data.usage.total_tokens;

      // Small delay between batches to avoid rate limiting
      if (i + MAX_BATCH_SIZE < truncatedTexts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error("[Embeddings] Error in batch:", error);
      return null;
    }
  }

  return {
    embeddings: allEmbeddings,
    model,
    usage: {
      prompt_tokens: totalPromptTokens,
      total_tokens: totalTokens,
    },
  };
}

// ============================================================================
// Text Preparation
// ============================================================================

/**
 * Prepare text for embedding by cleaning and normalizing
 */
export function prepareTextForEmbedding(text: string): string {
  return (
    text
      // Remove markdown formatting
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/```[\s\S]*?```/g, "")
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, "")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Prepare content cache entry for embedding
 */
export function prepareContentCacheForEmbedding(
  slug: string,
  contentMd: string,
): string {
  // Extract title from first heading
  const titleMatch = contentMd.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : slug.replace(/-/g, " ");

  // Get first ~1000 chars of content for embedding
  const cleanContent = prepareTextForEmbedding(contentMd).slice(0, 4000);

  return `${title}\n\n${cleanContent}`;
}

/**
 * Prepare PAA entry for embedding
 */
export function preparePaaForEmbedding(
  question: string,
  answer: string | null,
): string {
  const cleanAnswer = answer ? prepareTextForEmbedding(answer) : "";
  return `${question}\n\n${cleanAnswer}`.slice(0, 4000);
}

/**
 * Prepare cluster page for embedding
 */
export function prepareClusterForEmbedding(
  topic: string,
  page: string,
  seedKeyword: string | null,
): string {
  const parts = [topic, page];
  if (seedKeyword) {
    parts.push(seedKeyword);
  }
  return parts.join(" - ");
}

// ============================================================================
// Vector Format Helpers
// ============================================================================

/**
 * Format embedding array for PostgreSQL pgvector
 */
export function formatEmbeddingForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Parse PostgreSQL pgvector format to array
 */
export function parseEmbeddingFromPg(pgVector: string): number[] {
  // Remove brackets and split
  const cleaned = pgVector.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map(Number);
}
