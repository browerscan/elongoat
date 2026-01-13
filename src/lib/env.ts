/**
 * Environment Variable Validation with Zod
 *
 * Validates all environment variables at startup, failing fast with clear errors.
 * Provides type-safe access to environment variables throughout the application.
 */

import { z } from "zod";

function isVitestRuntime(): boolean {
  if (typeof process === "undefined") return false;

  const env = process.env;
  if (env.VITEST === "1" || env.VITEST === "true") return true;
  if (env.VITE_TEST === "1" || env.VITE_TEST === "true") return true;
  if (env.npm_lifecycle_event?.startsWith("test")) return true;
  if (env.npm_lifecycle_script?.includes("vitest")) return true;

  if (typeof globalThis !== "undefined" && "__vitest_worker__" in globalThis) {
    return true;
  }

  return false;
}

function isTestRuntime(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.NODE_ENV === "test" || isVitestRuntime();
}

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const optionalString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(emptyToUndefined, schema.optional());

/* -------------------------------------------------------------------------------------------------
 * Environment Variable Schemas
 * ------------------------------------------------------------------------------------------------- */

/**
 * Schema for public environment variables (exposed to client).
 * These start with NEXT_PUBLIC_ and can be used in both server and client code.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://elongoat.io"),
  NEXT_PUBLIC_API_URL: optionalString(z.string().url()),
  NEXT_PUBLIC_SUPABASE_URL: optionalString(z.string().url()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString(z.string().min(1)),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/**
 * Schema for server-side environment variables.
 * These are never exposed to the client.
 */
const ServerEnvSchema = z.object({
  // App metadata
  APP_VERSION: optionalString(z.string()),
  npm_package_version: optionalString(z.string()),
  API_URL: optionalString(z.string().url()),

  // Database
  DATABASE_URL: optionalString(
    z
      .string()
      .url()
      .refine(
        (url) => url.includes("postgres") || url.includes("postgresql"),
        "DATABASE_URL must be a PostgreSQL connection string",
      ),
  ),
  PGPOOL_MAX: z
    .string()
    .default("10")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100)),
  PGPOOL_IDLE_TIMEOUT_MS: z
    .string()
    .default("30000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  PGPOOL_CONNECT_TIMEOUT_MS: z
    .string()
    .default("10000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  PG_STATEMENT_TIMEOUT_MS: z
    .string()
    .default("60000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Supabase
  SUPABASE_SERVICE_ROLE_KEY: optionalString(z.string().min(1)),

  // Redis
  REDIS_URL: optionalString(
    z
      .string()
      .url()
      .refine(
        (url) => url.startsWith("redis://") || url.startsWith("rediss://"),
        "REDIS_URL must use redis:// or rediss:// protocol",
      ),
  ),
  REDIS_MAX_RETRIES: z
    .string()
    .default("3")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative().max(20)),
  REDIS_RETRY_DELAY_MS: z
    .string()
    .default("100")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative()),
  REDIS_CONNECT_TIMEOUT_MS: z
    .string()
    .default("5000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  REDIS_KEEP_ALIVE_MS: z
    .string()
    .default("30000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  REDIS_POOL_SIZE: z
    .string()
    .default("5")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // VectorEngine / AI
  VECTORENGINE_API_KEY: optionalString(z.string().min(1)),
  VECTORENGINE_BASE_URL: z
    .string()
    .url()
    .default("https://api.vectorengine.ai"),
  VECTORENGINE_API_URL: optionalString(z.string().url()),
  VECTORENGINE_MODEL: z.string().min(1).default("grok-4-fast-non-reasoning"),
  VECTORENGINE_CONTENT_MODEL: z
    .string()
    .min(1)
    .default("claude-sonnet-4-5-20250929"),

  // xAI/Grok (optional alternative)
  XAI_API_KEY: optionalString(z.string().min(1)),
  GROK_API_URL: optionalString(z.string().url()),

  // Admin
  ELONGOAT_ADMIN_TOKEN: optionalString(z.string().min(1)),
  ELONGOAT_ADMIN_SESSION_SECRET: optionalString(z.string().min(1)),
  ELONGOAT_RAG_API_KEY: optionalString(z.string().min(1)),
  RATE_LIMIT_IP_SECRET: optionalString(z.string().min(1)),

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
  CHAT_MOOD: z.string().default("confident"),
  CHAT_TYPING_QUIRK: z
    .string()
    .default("1")
    .transform((val) => val === "1" || val === "true"),
  CHAT_ANALYTICS_ENABLED: z
    .string()
    .default("0")
    .transform((val) => val === "1" || val === "true"),

  // Rate limiting
  RATE_LIMIT_ENABLED: z
    .string()
    .default("1")
    .transform((val) => val === "1" || val === "true"),
  RATE_LIMIT_WHITELIST: z.string().default(""),
  RATE_LIMIT_API: z
    .string()
    .default("100")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_API_WINDOW: z
    .string()
    .default("60")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_CHAT: z
    .string()
    .default("20")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_CHAT_WINDOW: z
    .string()
    .default("3600")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_ADMIN: z
    .string()
    .default("60")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_ADMIN_WINDOW: z
    .string()
    .default("60")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_HEALTH: z
    .string()
    .default("300")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_HEALTH_WINDOW: z
    .string()
    .default("60")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_METRICS: z
    .string()
    .default("1200")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_METRICS_WINDOW: z
    .string()
    .default("60")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Keywords Everywhere API
  KEYWORDS_EVERYWHERE_API_KEY: optionalString(z.string().min(1)),

  // Proxy-Grid API (SERP, web scraping, content enrichment)
  PROXY_GRID_BASE_URL: z.string().url().default("http://google.savedimage.com"),
  PROXY_GRID_API_SECRET: optionalString(z.string().min(1)),
  PROXY_GRID_TIMEOUT_MS: z
    .string()
    .default("30000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(120000)),
  PROXY_GRID_CACHE_TTL_MS: z
    .string()
    .default("14400000") // 4 hours
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // SOAX scraping service
  SOAX_BASE_URL: optionalString(z.string().url()),
  SOAX_API_SECRET: optionalString(z.string().min(1)),
  SOAX_COUNTRY: z
    .string()
    .length(2, "SOAX_COUNTRY must be a 2-letter ISO country code")
    .default("us"),
  SOAX_LOCATION: optionalString(z.string().min(1)),

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

  // Backend workers / scripts
  USER_AGENT: z
    .string()
    .default("Mozilla/5.0 (compatible; ElonGoatBot/1.0; +https://elongoat.io)"),
  SEED_PAA: z
    .string()
    .default("false")
    .transform((val) => val === "1" || val === "true"),
  SEED_VIDEOS: z
    .string()
    .default("false")
    .transform((val) => val === "1" || val === "true"),
  SEED_TWEETS: z
    .string()
    .default("false")
    .transform((val) => val === "1" || val === "true"),
  SEED_LIMIT: z
    .string()
    .default("50")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  TEST_LIMIT: z
    .string()
    .default("5")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  BATCH_MODE: z
    .string()
    .default("false")
    .transform((val) => val === "1" || val === "true"),
  DELAY_MS: z.preprocess(
    (val) => (val === undefined ? undefined : parseInt(String(val), 10)),
    z.number().int().nonnegative().optional(),
  ),
  CONCURRENCY: z
    .string()
    .default("6")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  RESUME: z
    .string()
    .default("true")
    .transform((val) => val === "1" || val === "true"),
  START_FROM: z
    .string()
    .default("0")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative()),
  WARM_CLUSTER_COUNT: z
    .string()
    .default("20")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  WARM_PAA_COUNT: z
    .string()
    .default("20")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  WARMUP_DELAY_MS: z
    .string()
    .default("5000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  WARMUP_CONCURRENCY: z
    .string()
    .default("3")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Query cache configuration
  QUERY_CACHE_ENABLED: z
    .string()
    .default("1")
    .transform((val) => val === "1" || val === "true"),
  QUERY_CACHE_TTL_MS: z
    .string()
    .default("60000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  QUERY_CACHE_MAX_SIZE: z
    .string()
    .default("500")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Tiered cache configuration
  TIERED_CACHE_L1_TTL_MS: z
    .string()
    .default("300000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  TIERED_CACHE_L2_TTL_MS: z
    .string()
    .default("3600000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  TIERED_CACHE_L1_MAX_ENTRIES: z
    .string()
    .default("1000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  TIERED_CACHE_L1_CLEANUP_MS: z
    .string()
    .default("60000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  TIERED_CACHE_STAMP_TIMEOUT_MS: z
    .string()
    .default("5000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Content cache configuration
  CONTENT_CACHE_L1_TTL_MS: z
    .string()
    .default("300000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  CONTENT_CACHE_L2_TTL_MS: z
    .string()
    .default("3600000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Circuit breaker configuration
  CIRCUIT_BREAKER_TTL_MS: z
    .string()
    .default("3600000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  CIRCUIT_BREAKER_CLEANUP_INTERVAL_MS: z
    .string()
    .default("300000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  MAX_CIRCUIT_BREAKERS: z
    .string()
    .default("1000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // RAG cache configuration
  RAG_CACHE_ENABLED: z
    .string()
    .default("1")
    .transform((val) => val === "1" || val === "true"),
  RAG_CACHE_TTL_SECONDS: z
    .string()
    .default("3600")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Embeddings
  EMBEDDINGS_ENABLED: z
    .string()
    .default("1")
    .transform((val) => val === "1" || val === "true"),
  EMBEDDINGS_SKIP_BUILD: z
    .string()
    .default("0")
    .transform((val) => val === "1" || val === "true"),
  OPENAI_API_KEY: optionalString(z.string().min(1)),
  OPENAI_BASE_URL: optionalString(z.string().url()),
  EMBEDDING_BASE_URL: optionalString(z.string().url()),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z
    .string()
    .default("1536")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Security headers / monitoring
  HSTS_PRELOAD: z
    .string()
    .default("1")
    .transform((val) => val === "1" || val === "true"),
  METRICS_TOKEN: optionalString(z.string().min(1)),
  VALIDATE_ENV_ON_STARTUP: z
    .string()
    .default("1")
    .transform((val) => val === "1" || val === "true"),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/**
 * Combined environment schema.
 */
const EnvSchema = PublicEnvSchema.merge(ServerEnvSchema).superRefine(
  (env, ctx) => {
    if (isTestRuntime()) return;

    const isProduction = env.NODE_ENV === "production";

    if (
      isProduction &&
      env.VECTORENGINE_API_KEY &&
      !(
        env.VECTORENGINE_API_KEY.startsWith("ve_") ||
        env.VECTORENGINE_API_KEY.startsWith("sk-")
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["VECTORENGINE_API_KEY"],
        message: "VECTORENGINE_API_KEY must start with 've_' or 'sk-'",
      });
    }

    if (!isProduction) return;

    if (env.ELONGOAT_ADMIN_TOKEN && env.ELONGOAT_ADMIN_TOKEN.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ELONGOAT_ADMIN_TOKEN"],
        message: "ELONGOAT_ADMIN_TOKEN must be at least 32 characters",
      });
    }

    if (
      env.ELONGOAT_ADMIN_SESSION_SECRET &&
      env.ELONGOAT_ADMIN_SESSION_SECRET.length < 32
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ELONGOAT_ADMIN_SESSION_SECRET"],
        message: "ELONGOAT_ADMIN_SESSION_SECRET must be at least 32 characters",
      });
    }

    if (env.ELONGOAT_RAG_API_KEY && env.ELONGOAT_RAG_API_KEY.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ELONGOAT_RAG_API_KEY"],
        message: "ELONGOAT_RAG_API_KEY must be at least 32 characters",
      });
    }

    if (env.RATE_LIMIT_IP_SECRET && env.RATE_LIMIT_IP_SECRET.length < 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RATE_LIMIT_IP_SECRET"],
        message: "RATE_LIMIT_IP_SECRET must be at least 16 characters",
      });
    }
  },
);

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
let validatedPublicEnv: PublicEnv | null = null;
let publicValidationError: Error | null = null;
let liveEnvProxy: Env | null = null;
let livePublicEnvProxy: PublicEnv | null = null;

function isTestEnv(): boolean {
  return isTestRuntime();
}

function createLiveEnvProxy<T extends object>(schema: z.ZodType<T>): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      const parsed = schema.parse(process.env);
      return (parsed as Record<string, unknown>)[prop as string];
    },
  });
}

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
  if (isTestEnv()) {
    if (!liveEnvProxy) {
      liveEnvProxy = createLiveEnvProxy(EnvSchema);
    }
    return liveEnvProxy;
  }

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
  if (isTestEnv()) {
    if (!livePublicEnvProxy) {
      livePublicEnvProxy = createLiveEnvProxy(PublicEnvSchema);
    }
    return livePublicEnvProxy;
  }

  if (publicValidationError) {
    throw publicValidationError;
  }

  if (!validatedPublicEnv) {
    try {
      validatedPublicEnv = PublicEnvSchema.parse(process.env);
    } catch (error) {
      publicValidationError = new Error(
        `Public environment validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw publicValidationError;
    }
  }

  return validatedPublicEnv;
}

/**
 * Checks if a specific environment variable is set and valid.
 */
export function hasEnvKey(key: keyof Env): boolean {
  if (typeof process !== "undefined" && process.env) {
    return Object.prototype.hasOwnProperty.call(process.env, key);
  }

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
      throw new Error(
        "Environment validation failed in production. Aborting startup.",
      );
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

/**
 * Proxy-Grid configuration getter.
 */
export function getProxyGridConfig(): {
  baseUrl: string;
  apiSecret: string | undefined;
  timeout: number;
  cacheTtl: number;
} {
  const env = getEnv();
  return {
    baseUrl: env.PROXY_GRID_BASE_URL,
    apiSecret: env.PROXY_GRID_API_SECRET,
    timeout: env.PROXY_GRID_TIMEOUT_MS,
    cacheTtl: env.PROXY_GRID_CACHE_TTL_MS,
  };
}

// Auto-validate on module import in non-test environments
if (typeof process !== "undefined" && !isTestRuntime()) {
  // Don't fail on import, but validate for early error detection
  validateEnv();
}
