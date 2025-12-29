/**
 * Environment Variable Validation with Zod
 *
 * Validates all environment variables at startup, failing fast with clear errors.
 * Provides type-safe access to environment variables throughout the application.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------------------------------
 * Environment Variable Schemas
 * ------------------------------------------------------------------------------------------------- */

/**
 * Schema for public environment variables (exposed to client).
 * These start with NEXT_PUBLIC_ and can be used in both server and client code.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

/**
 * Schema for server-side environment variables.
 * These are never exposed to the client.
 */
const ServerEnvSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (url) => url.includes("postgres") || url.includes("postgresql"),
      "DATABASE_URL must be a PostgreSQL connection string",
    )
    .optional(),

  // Supabase
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Redis
  REDIS_URL: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith("redis://") || url.startsWith("rediss://"),
      "REDIS_URL must use redis:// or rediss:// protocol",
    )
    .optional(),

  // VectorEngine / AI
  VECTORENGINE_API_KEY: z
    .string()
    .min(1)
    .startsWith("ve_", "VECTORENGINE_API_KEY must start with 've_'")
    .optional(),
  VECTORENGINE_BASE_URL: z
    .string()
    .url()
    .default("https://api.vectorengine.ai"),
  VECTORENGINE_API_URL: z.string().url().optional(),
  VECTORENGINE_MODEL: z.string().min(1).default("grok-4-fast-non-reasoning"),
  VECTORENGINE_CONTENT_MODEL: z
    .string()
    .min(1)
    .default("claude-sonnet-4-5-20250929"),

  // xAI/Grok (optional alternative)
  XAI_API_KEY: z.string().min(1).optional(),
  GROK_API_URL: z.string().url().optional(),

  // Admin
  ELONGOAT_ADMIN_TOKEN: z
    .string()
    .min(32, "ELONGOAT_ADMIN_TOKEN must be at least 32 characters")
    .optional(),

  // Dynamic variables (Elon Goat specific)
  ELON_DOB: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "ELON_DOB must be in YYYY-MM-DD format")
    .default("1971-06-28"),
  ELON_CHILDREN_COUNT: z
    .string()
    .default("14")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative()),
  ELON_NET_WORTH: z
    .string()
    .default("Varies with markets (estimate; may be outdated)."),

  // Chat configuration
  CHAT_MOOD: z
    .enum(["confident", "neutral", "playful", "technical"])
    .default("confident"),
  CHAT_TYPING_QUIRK: z
    .string()
    .default("1")
    .transform((val) => val === "1" || val === "true"),
  CHAT_ANALYTICS_ENABLED: z
    .string()
    .default("0")
    .transform((val) => val === "1" || val === "true"),

  // PostgreSQL pool settings
  PGPOOL_MAX: z
    .string()
    .default("10")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100)),
  PG_STATEMENT_TIMEOUT_MS: z
    .string()
    .default("30000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Keywords Everywhere API
  KEYWORDS_EVERYWHERE_API_KEY: z.string().min(1).optional(),

  // SOAX scraping service
  SOAX_BASE_URL: z.string().url().optional(),
  SOAX_API_SECRET: z.string().min(1).optional(),
  SOAX_COUNTRY: z
    .string()
    .length(2, "SOAX_COUNTRY must be a 2-letter ISO country code")
    .default("us"),
  SOAX_LOCATION: z.string().min(1).optional(),

  // Transcript worker settings
  TRANSCRIPT_BATCH_LIMIT: z
    .string()
    .default("25")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100)),
  TRANSCRIPT_SLEEP_SECONDS: z
    .string()
    .default("1.0")
    .transform((val) => parseFloat(val))
    .pipe(z.number().nonnegative()),
  TRANSCRIPT_LANGUAGES: z.string().default("en"),
  TRANSCRIPT_MAX_RETRIES: z
    .string()
    .default("3")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative().max(10)),
  TRANSCRIPT_RETRY_DELAY: z
    .string()
    .default("2.0")
    .transform((val) => parseFloat(val))
    .pipe(z.number().nonnegative()),

  // Video ingest settings
  VIDEO_QUERIES: z
    .string()
    .min(1)
    .default("elon musk interview,elon musk spacex,elon musk tesla"),
  VIDEO_LIMIT_PER_QUERY: z
    .string()
    .default("10")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100)),

  // X (Twitter) settings
  X_HANDLES: z.string().min(1).default("elonmusk"),
  X_MAX_TWEETS: z
    .string()
    .default("60")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(200)),
  X_INCLUDE_NON_AUTHOR: z
    .string()
    .default("true")
    .transform((val) => val === "1" || val === "true"),
  X_FETCH_FOLLOWING: z
    .string()
    .default("false")
    .transform((val) => val === "1" || val === "true"),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/**
 * Combined environment schema.
 */
const EnvSchema = PublicEnvSchema.merge(ServerEnvSchema);

/* -------------------------------------------------------------------------------------------------
 * Type Definitions
 * ------------------------------------------------------------------------------------------------- */

/**
 * Type for validated public environment variables.
 */
export type PublicEnv = z.infer<typeof PublicEnvSchema>;

/**
 * Type for validated server environment variables.
 */
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/**
 * Type for all validated environment variables.
 */
export type Env = z.infer<typeof EnvSchema>;

/**
 * Raw environment variables type (process.env).
 */
export type RawEnv = Record<string, string | undefined>;

/* -------------------------------------------------------------------------------------------------
 * Validation and Access
 * ------------------------------------------------------------------------------------------------- */

/**
 * Cached validated environment variables.
 */
let validatedEnv: Env | null = null;
let validationError: Error | null = null;

/**
 * Validation result type.
 */
export interface EnvValidationResult {
  success: boolean;
  env?: Env;
  errors?: Array<{
    key: string;
    message: string;
    received?: string;
  }>;
}

/**
 * Validates all environment variables.
 * Returns a detailed result object with any validation errors.
 */
export function validateEnv(input: RawEnv = process.env): EnvValidationResult {
  const result: EnvValidationResult = {
    success: true,
  };

  try {
    const env = EnvSchema.parse(input);
    result.env = env;
    validatedEnv = env;
    validationError = null;
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.success = false;
      result.errors = error.issues.map((issue) => ({
        key: issue.path.join("."),
        message: issue.message,
        received:
          "received" in issue ? JSON.stringify(issue.received) : undefined,
      }));

      // Create a helpful error message
      const errorMessages = result.errors
        .map(
          (e) =>
            `  - ${e.key}: ${e.message}${e.received ? " (received: " + e.received + ")" : ""}`,
        )
        .join("\n");

      validationError = new Error(
        `Environment variable validation failed:\n${errorMessages}`,
      );
    } else {
      validationError = new Error(
        `Unexpected error during environment validation: ${error instanceof Error ? error.message : String(error)}`,
      );
      result.success = false;
    }

    return result;
  }
}

/**
 * Gets validated environment variables.
 * Throws if validation has failed.
 *
 * This function should be used instead of accessing process.env directly.
 */
export function getEnv(): Env {
  if (validationError) {
    throw validationError;
  }

  if (!validatedEnv) {
    const result = validateEnv();
    if (!result.success || !result.env) {
      const error = new Error(
        `Environment not validated. Errors:\n${result.errors?.map((e) => `  - ${e.key}: ${e.message}`).join("\n")}`,
      );
      throw error;
    }
    validatedEnv = result.env;
  }

  return validatedEnv;
}

/**
 * Gets public environment variables (safe to expose to client).
 */
export function getPublicEnv(): PublicEnv {
  const env = getEnv();
  return {
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

/**
 * Checks if a specific environment variable is set and valid.
 */
export function hasEnvKey(key: keyof Env): boolean {
  try {
    const env = getEnv();
    return env[key] !== undefined && env[key] !== null;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------------------------------
 * Feature Flags and Helpers
 * ------------------------------------------------------------------------------------------------- */

/**
 * Feature flags derived from environment variables.
 */
export const featureFlags = {
  /**
   * Whether database functionality is enabled.
   */
  get databaseEnabled(): boolean {
    try {
      return !!getEnv().DATABASE_URL;
    } catch {
      return false;
    }
  },

  /**
   * Whether Redis is enabled.
   */
  get redisEnabled(): boolean {
    try {
      return !!getEnv().REDIS_URL;
    } catch {
      return false;
    }
  },

  /**
   * Whether VectorEngine AI is enabled.
   */
  get vectorEngineEnabled(): boolean {
    try {
      return !!getEnv().VECTORENGINE_API_KEY;
    } catch {
      return false;
    }
  },

  /**
   * Whether xAI/Grok is enabled as an alternative.
   */
  get grokEnabled(): boolean {
    try {
      return !!getEnv().XAI_API_KEY;
    } catch {
      return false;
    }
  },

  /**
   * Whether admin endpoints are enabled.
   */
  get adminEnabled(): boolean {
    try {
      return !!getEnv().ELONGOAT_ADMIN_TOKEN;
    } catch {
      return false;
    }
  },

  /**
   * Whether chat analytics are enabled.
   */
  get chatAnalyticsEnabled(): boolean {
    try {
      return getEnv().CHAT_ANALYTICS_ENABLED;
    } catch {
      return false;
    }
  },

  /**
   * Whether we're in development mode.
   */
  get isDevelopment(): boolean {
    try {
      return getEnv().NODE_ENV === "development";
    } catch {
      return true;
    }
  },

  /**
   * Whether we're in production mode.
   */
  get isProduction(): boolean {
    try {
      return getEnv().NODE_ENV === "production";
    } catch {
      return false;
    }
  },

  /**
   * Whether we're in test mode.
   */
  get isTest(): boolean {
    try {
      return getEnv().NODE_ENV === "test";
    } catch {
      return false;
    }
  },
};

/* -------------------------------------------------------------------------------------------------
 * Startup Validation
 * ------------------------------------------------------------------------------------------------- */

/**
 * Validates critical environment variables at startup.
 * In production, missing critical variables will cause the process to exit.
 *
 * This function should be called during application initialization.
 */
export function validateEnvAtStartup(): void {
  const result = validateEnv();

  if (!result.success) {
    const errorMessages = result.errors
      ?.map((e) => `  [MISSING/INVALID] ${e.key}: ${e.message}`)
      .join("\n");

    console.error("========================================");
    console.error("ENVIRONMENT VALIDATION FAILED");
    console.error("========================================");
    console.error(errorMessages);
    console.error("========================================");

    if (featureFlags.isProduction) {
      console.error(
        "FATAL: Cannot start application with invalid environment in production mode.",
      );
      console.error("Please fix the above errors and restart.");
      process.exit(1);
    } else {
      console.warn(
        "WARNING: Continuing in development mode with invalid environment.",
      );
      console.warn("Some features may not work correctly.");
    }
  } else {
    console.info("Environment variables validated successfully.");
  }
}

/* -------------------------------------------------------------------------------------------------
 * Common Access Patterns
 * ------------------------------------------------------------------------------------------------- */

/**
 * Database configuration getter.
 */
export function getDatabaseConfig(): {
  connectionString: string | undefined;
  poolMax: number;
  statementTimeout: number;
} {
  const env = getEnv();
  return {
    connectionString: env.DATABASE_URL,
    poolMax: env.PGPOOL_MAX,
    statementTimeout: env.PG_STATEMENT_TIMEOUT_MS,
  };
}

/**
 * Redis configuration getter.
 */
export function getRedisConfig(): {
  url: string | undefined;
} {
  const env = getEnv();
  return {
    url: env.REDIS_URL,
  };
}

/**
 * VectorEngine configuration getter.
 */
export function getVectorEngineConfig(): {
  apiKey: string | undefined;
  baseUrl: string;
  apiUrl: string | undefined;
  model: string;
  contentModel: string;
} {
  const env = getEnv();
  return {
    apiKey: env.VECTORENGINE_API_KEY,
    baseUrl: env.VECTORENGINE_BASE_URL,
    apiUrl: env.VECTORENGINE_API_URL,
    model: env.VECTORENGINE_MODEL,
    contentModel: env.VECTORENGINE_CONTENT_MODEL,
  };
}

/**
 * Admin configuration getter.
 */
export function getAdminConfig(): {
  token: string | undefined;
} {
  const env = getEnv();
  return {
    token: env.ELONGOAT_ADMIN_TOKEN,
  };
}

/**
 * Chat configuration getter.
 */
export function getChatEnvConfig(): {
  mood: string;
  typingQuirk: boolean;
  analyticsEnabled: boolean;
} {
  const env = getEnv();
  return {
    mood: env.CHAT_MOOD,
    typingQuirk: env.CHAT_TYPING_QUIRK,
    analyticsEnabled: env.CHAT_ANALYTICS_ENABLED,
  };
}

/**
 * Dynamic variables getter.
 */
export function getDynamicVariablesConfig(): {
  dob: string;
  childrenCount: number;
  netWorth: string;
} {
  const env = getEnv();
  return {
    dob: env.ELON_DOB,
    childrenCount: env.ELON_CHILDREN_COUNT,
    netWorth: env.ELON_NET_WORTH,
  };
}

/**
 * SOAX configuration getter.
 */
export function getSoaxConfig(): {
  baseUrl: string | undefined;
  apiSecret: string | undefined;
  country: string;
  location: string | undefined;
} {
  const env = getEnv();
  return {
    baseUrl: env.SOAX_BASE_URL,
    apiSecret: env.SOAX_API_SECRET,
    country: env.SOAX_COUNTRY,
    location: env.SOAX_LOCATION,
  };
}

/**
 * Video ingest configuration getter.
 */
export function getVideoIngestConfig(): {
  queries: string[];
  limitPerQuery: number;
} {
  const env = getEnv();
  return {
    queries: env.VIDEO_QUERIES.split(",")
      .map((q) => q.trim())
      .filter(Boolean),
    limitPerQuery: env.VIDEO_LIMIT_PER_QUERY,
  };
}

/**
 * X (Twitter) configuration getter.
 */
export function getXConfig(): {
  handles: string[];
  maxTweets: number;
  includeNonAuthor: boolean;
  fetchFollowing: boolean;
} {
  const env = getEnv();
  return {
    handles: env.X_HANDLES.split(",")
      .map((h) => h.trim())
      .filter(Boolean),
    maxTweets: env.X_MAX_TWEETS,
    includeNonAuthor: env.X_INCLUDE_NON_AUTHOR,
    fetchFollowing: env.X_FETCH_FOLLOWING,
  };
}

// Auto-validate on module import in non-test environments
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  // Don't fail on import, but validate for early error detection
  validateEnv();
}
