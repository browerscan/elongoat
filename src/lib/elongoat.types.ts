import { z } from "zod";
import type { ReactNode } from "react";

/**
 * ISO 8601 datetime string.
 * Example: `2025-12-24T12:34:56.789Z` or `2025-12-24T12:34:56+00:00`.
 */
export type IsoDateTimeString = string;

/**
 * ISO 8601 calendar date string (`YYYY-MM-DD`).
 * Example: `1971-06-28`.
 */
export type IsoDateString = string;

export const IsoDateTimeStringSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/,
    "Expected ISO 8601 datetime string",
  );

export const IsoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO 8601 date string (YYYY-MM-DD)");

export const UuidSchema = z.string().uuid();
export type Uuid = z.infer<typeof UuidSchema>;

export const SlugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected kebab-case slug");
export type Slug = z.infer<typeof SlugSchema>;

/**
 * JSON-like value suitable for API payloads (Supabase JSON, SSE events, etc).
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(z.string(), JsonValueSchema),
    z.array(JsonValueSchema),
  ]),
);

/* -------------------------------------------------------------------------------------------------
 * Database (Supabase) - schema: elongoat
 * ------------------------------------------------------------------------------------------------- */

export const PaaQuestionRowSchema = z.object({
  id: UuidSchema,
  question: z.string().min(1),
  answer: z.string().nullable(),
  slug: SlugSchema,
  parent_id: UuidSchema.nullable(),
  level: z.number().int(),
  volume: z.number().int(),
  source_url: z.string().nullable(),
  created_at: IsoDateTimeStringSchema,
  updated_at: IsoDateTimeStringSchema,
});

export type PaaQuestionRow = z.infer<typeof PaaQuestionRowSchema>;

export const PaaQuestionInsertSchema = z.object({
  id: UuidSchema.optional(),
  question: z.string().min(1),
  answer: z.string().nullable().optional(),
  slug: SlugSchema,
  parent_id: UuidSchema.nullable().optional(),
  level: z.number().int().optional(),
  volume: z.number().int().optional(),
  source_url: z.string().nullable().optional(),
  created_at: IsoDateTimeStringSchema.optional(),
  updated_at: IsoDateTimeStringSchema.optional(),
});

export type PaaQuestionInsert = z.infer<typeof PaaQuestionInsertSchema>;

export const PaaQuestionUpdateSchema = z.object({
  id: UuidSchema.optional(),
  question: z.string().min(1).optional(),
  answer: z.string().nullable().optional(),
  slug: SlugSchema.optional(),
  parent_id: UuidSchema.nullable().optional(),
  level: z.number().int().optional(),
  volume: z.number().int().optional(),
  source_url: z.string().nullable().optional(),
  created_at: IsoDateTimeStringSchema.optional(),
  updated_at: IsoDateTimeStringSchema.optional(),
});

export type PaaQuestionUpdate = z.infer<typeof PaaQuestionUpdateSchema>;

/**
 * In-memory nested representation for rendering related questions.
 * Derived from `elongoat.paa_tree` rows.
 */
export type PaaQuestionNode = PaaQuestionRow & { children: PaaQuestionNode[] };

export const PaaQuestionNodeSchema: z.ZodType<PaaQuestionNode> = z.lazy(() =>
  PaaQuestionRowSchema.extend({
    children: z.array(PaaQuestionNodeSchema),
  }),
);

export const KeywordRowSchema = z.object({
  id: UuidSchema,
  keyword: z.string().min(1).max(500),
  slug: SlugSchema,
  cluster: z.string().nullable(),
  volume: z.number().int(),
  difficulty: z.number().int(),
  intent: z.string().nullable(),
  content: z.string().nullable(),
  generated_at: IsoDateTimeStringSchema.nullable(),
  created_at: IsoDateTimeStringSchema,
});

export type KeywordRow = z.infer<typeof KeywordRowSchema>;

export const KeywordInsertSchema = z.object({
  id: UuidSchema.optional(),
  keyword: z.string().min(1).max(500),
  slug: SlugSchema,
  cluster: z.string().nullable().optional(),
  volume: z.number().int().optional(),
  difficulty: z.number().int().optional(),
  intent: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  generated_at: IsoDateTimeStringSchema.nullable().optional(),
  created_at: IsoDateTimeStringSchema.optional(),
});

export type KeywordInsert = z.infer<typeof KeywordInsertSchema>;

export const KeywordUpdateSchema = z.object({
  id: UuidSchema.optional(),
  keyword: z.string().min(1).max(500).optional(),
  slug: SlugSchema.optional(),
  cluster: z.string().nullable().optional(),
  volume: z.number().int().optional(),
  difficulty: z.number().int().optional(),
  intent: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  generated_at: IsoDateTimeStringSchema.nullable().optional(),
  created_at: IsoDateTimeStringSchema.optional(),
});

export type KeywordUpdate = z.infer<typeof KeywordUpdateSchema>;

export const VariableKeySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z][a-z0-9_]*$/, "Expected snake_case variable key");
export type VariableKey = z.infer<typeof VariableKeySchema>;

export const VariableTypeSchema = z.enum([
  "string",
  "number",
  "date",
  "boolean",
  "json",
]);
export type VariableType = z.infer<typeof VariableTypeSchema>;

export const VariableRowSchema = z.object({
  key: VariableKeySchema,
  value: z.string().min(1),
  type: VariableTypeSchema.default("string"),
  updated_at: IsoDateTimeStringSchema,
});

export type VariableRow = z.infer<typeof VariableRowSchema>;

export const VariableInsertSchema = z.object({
  key: VariableKeySchema,
  value: z.string().min(1),
  type: VariableTypeSchema.optional(),
  updated_at: IsoDateTimeStringSchema.optional(),
});

export type VariableInsert = z.infer<typeof VariableInsertSchema>;

export const VariableUpdateSchema = z.object({
  key: VariableKeySchema.optional(),
  value: z.string().min(1).optional(),
  type: VariableTypeSchema.optional(),
  updated_at: IsoDateTimeStringSchema.optional(),
});

export type VariableUpdate = z.infer<typeof VariableUpdateSchema>;

/**
 * Minimal Supabase `Database` type for the dedicated schema `elongoat`.
 * Useful for `createClient<Database>(...)` and shared typing across routes/components.
 */
export interface ElonGoatDatabase {
  elongoat: {
    Tables: {
      paa_tree: {
        Row: PaaQuestionRow;
        Insert: PaaQuestionInsert;
        Update: PaaQuestionUpdate;
      };
      keywords: {
        Row: KeywordRow;
        Insert: KeywordInsert;
        Update: KeywordUpdate;
      };
      variables: {
        Row: VariableRow;
        Insert: VariableInsert;
        Update: VariableUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/* -------------------------------------------------------------------------------------------------
 * API - Chat (streaming SSE) + Variables
 * ------------------------------------------------------------------------------------------------- */

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: JsonValueSchema.optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ChatProviderSchema = z.enum(["vectorengine", "grok"]);
export type ChatProvider = z.infer<typeof ChatProviderSchema>;

export const ChatMessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

export const ChatContextSchema = z
  .object({
    currentPage: z.string().min(1).max(255).optional(),
    paaSlug: SlugSchema.optional(),
    paaQuestionId: UuidSchema.optional(),
    paaContext: z.string().min(1).max(500).optional(),
  })
  .strict();

export type ChatContext = z.infer<typeof ChatContextSchema>;

export const ChatMessageSchema = z.object({
  id: UuidSchema,
  role: ChatMessageRoleSchema,
  content: z.string().min(1),
  createdAt: IsoDateTimeStringSchema,
  metadata: z
    .object({
      provider: ChatProviderSchema.optional(),
      model: z.string().min(1).optional(),
      tokensUsed: z.number().int().nonnegative().optional(),
    })
    .strict()
    .optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z
  .object({
    message: z.string().min(1).max(2000),
    conversationId: UuidSchema.optional(),
    context: ChatContextSchema.optional(),
  })
  .strict();

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatUsageSchema = z
  .object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  })
  .strict();

export type ChatUsage = z.infer<typeof ChatUsageSchema>;

export const ChatResponseSchema = z
  .object({
    conversationId: UuidSchema,
    provider: ChatProviderSchema,
    model: z.string().min(1).optional(),
    message: ChatMessageSchema,
    usage: ChatUsageSchema.optional(),
  })
  .strict();

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const ChatFinishReasonSchema = z.enum([
  "stop",
  "length",
  "content_filter",
  "error",
]);
export type ChatFinishReason = z.infer<typeof ChatFinishReasonSchema>;

/**
 * Discriminated union for server-sent events (SSE) emitted by `/api/chat`.
 * Each SSE `data:` line should JSON-serialize to one of these shapes.
 */
export type ChatStreamEvent =
  | {
      type: "meta";
      conversationId: Uuid;
      provider: ChatProvider;
      model?: string;
      createdAt: IsoDateTimeString;
    }
  | { type: "delta"; delta: string }
  | { type: "message"; message: ChatMessage }
  | { type: "error"; error: ApiError }
  | { type: "done"; finishReason: ChatFinishReason; usage?: ChatUsage };

export const ChatStreamEventSchema: z.ZodType<ChatStreamEvent> =
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("meta"),
      conversationId: UuidSchema,
      provider: ChatProviderSchema,
      model: z.string().min(1).optional(),
      createdAt: IsoDateTimeStringSchema,
    }),
    z.object({
      type: z.literal("delta"),
      delta: z.string(),
    }),
    z.object({
      type: z.literal("message"),
      message: ChatMessageSchema,
    }),
    z.object({
      type: z.literal("error"),
      error: ApiErrorSchema,
    }),
    z.object({
      type: z.literal("done"),
      finishReason: ChatFinishReasonSchema,
      usage: ChatUsageSchema.optional(),
    }),
  ]);

/**
 * Dynamic variables used for pSEO interpolation and chat grounding.
 * Values are already resolved/parsed (e.g. `children_count` is a number).
 */
export interface DynamicVariables {
  age: number;
  children_count: number;
  net_worth: string;
  dob: IsoDateString;
  [key: string]: JsonValue;
}

export const DynamicVariablesSchema: z.ZodType<DynamicVariables> = z
  .object({
    age: z.number().int().nonnegative(),
    children_count: z.number().int().nonnegative(),
    net_worth: z.string().min(1),
    dob: IsoDateStringSchema,
  })
  .catchall(JsonValueSchema);

export const VariablesGetResponseSchema = z
  .object({
    variables: DynamicVariablesSchema,
    updatedAt: IsoDateTimeStringSchema,
  })
  .strict();

export type VariablesGetResponse = z.infer<typeof VariablesGetResponseSchema>;

export const VariablesUpsertRequestSchema = z
  .object({
    variables: z.array(VariableInsertSchema).min(1),
  })
  .strict();

export type VariablesUpsertRequest = z.infer<
  typeof VariablesUpsertRequestSchema
>;

export const VariablesUpsertResponseSchema = z
  .object({
    variables: z.array(VariableRowSchema),
  })
  .strict();

export type VariablesUpsertResponse = z.infer<
  typeof VariablesUpsertResponseSchema
>;

/* -------------------------------------------------------------------------------------------------
 * Components (props only)
 * ------------------------------------------------------------------------------------------------- */

export type NextSearchParams = Readonly<
  Record<string, string | string[] | undefined>
>;

export const PseoPageParamsSchema = z
  .object({
    slug: SlugSchema,
  })
  .strict();

export type PseoPageParams = z.infer<typeof PseoPageParamsSchema>;

export interface PseoPageProps {
  params: PseoPageParams;
  searchParams?: NextSearchParams;
}

export const SeoMetadataSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1).max(500),
    canonicalUrl: z.string().url().optional(),
    ogImageUrl: z.string().url().optional(),
  })
  .strict();

export type SeoMetadata = z.infer<typeof SeoMetadataSchema>;

export interface PseoPageViewModel {
  question: PaaQuestionRow;
  relatedQuestions: PaaQuestionRow[];
  variables: DynamicVariables;
  seo: SeoMetadata;
  content: {
    title: string;
    body: string;
  };
}

export const ChatWidgetVariantSchema = z.enum(["floating", "inline"]);
export type ChatWidgetVariant = z.infer<typeof ChatWidgetVariantSchema>;

export interface ChatWidgetProps {
  context?: ChatContext;
  conversationId?: Uuid;
  variant?: ChatWidgetVariant;
  className?: string;
  header?: ReactNode;
}

export const QuestionCardModelSchema = z
  .object({
    id: UuidSchema,
    question: z.string().min(1),
    slug: SlugSchema,
    volume: z.number().int(),
    level: z.number().int(),
  })
  .strict();

export type QuestionCardModel = z.infer<typeof QuestionCardModelSchema>;

export interface QuestionCardProps {
  question: QuestionCardModel;
  href?: string;
  className?: string;
}

/* -------------------------------------------------------------------------------------------------
 * Configuration (env + site config)
 * ------------------------------------------------------------------------------------------------- */

export const PublicEnvSchema = z
  .object({
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  })
  .strict();

export type PublicEnv = z.infer<typeof PublicEnvSchema>;

export const ServerEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    VECTORENGINE_API_KEY: z.string().min(1),
    VECTORENGINE_API_URL: z.string().url(),
    XAI_API_KEY: z.string().min(1).optional(),
    GROK_API_URL: z.string().url().optional(),
  })
  .strict();

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export const EnvSchema = PublicEnvSchema.merge(ServerEnvSchema);
export type Env = z.infer<typeof EnvSchema>;

export const ThemeModeSchema = z.enum(["dark", "light", "system"]);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const SiteThemeSchema = z
  .object({
    mode: ThemeModeSchema,
    /**
     * Cosmetic theme label (e.g. "dark-sci-fi") for toggles/analytics.
     * Actual styling remains in Tailwind/shadcn theme tokens.
     */
    flavor: z.string().min(1).optional(),
  })
  .strict();

export type SiteTheme = z.infer<typeof SiteThemeSchema>;

export const PseoConfigSchema = z
  .object({
    basePath: z.string().min(1),
    pageCount: z.number().int().positive(),
    revalidateSeconds: z.number().int().positive(),
  })
  .strict();

export type PseoConfig = z.infer<typeof PseoConfigSchema>;

export const ChatConfigSchema = z
  .object({
    primaryProvider: ChatProviderSchema,
    fallbackProvider: ChatProviderSchema,
    maxInputChars: z.number().int().positive(),
  })
  .strict();

export type ChatConfig = z.infer<typeof ChatConfigSchema>;

export const SiteConfigSchema = z
  .object({
    name: z.string().min(1),
    url: z.string().url(),
    titleTemplate: z.string().min(1),
    description: z.string().min(1),
    theme: SiteThemeSchema,
    pseo: PseoConfigSchema,
    chat: ChatConfigSchema,
    social: z
      .object({
        twitterHandle: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type SiteConfig = z.infer<typeof SiteConfigSchema>;
