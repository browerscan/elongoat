/**
 * E2E Test Helpers - Main Export
 *
 * Central export point for all E2E test utilities.
 */

export { TestClient, readStream, parseSSEStream } from "./testClient";
export type { TestClientOptions, TestResponse } from "./testClient";

export {
  createMockHealthResponse,
  createMockChatRequest,
  createMockSSEEvent,
  createMockChatDelta,
  createMockChatMeta,
  createMockSerpResponse,
  createMockMetricsResponse,
  createMockVariablesResponse,
  createMockClusterPage,
  createMockQaQuestion,
  createMockTweet,
  createMockVideo,
  createMockFetchResponse,
  createMockSSEStream,
  isFetchError,
  waitFor,
} from "./mocks";

export {
  createMockDbPool,
  createMockRedisClient,
  createMockVectorEngineResponse,
  createMockVectorEngineStreamChunks,
  createMockProxyGridSerpResponse,
  mockEnv,
  createMockNextRequest,
  mockFetch,
} from "./mocks/mocksExternal";

// Re-export setup functions for convenience
export { shouldRunE2E, healthCheck, e2eConfig } from "../setup";
