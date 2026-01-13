# E2E Testing Framework

This directory contains end-to-end tests for the ElonGoat application.

## Overview

The E2E test framework validates the entire application stack, including:

- **API endpoints** - Health, chat, SERP, metrics, variables, and data APIs
- **Page rendering** - Static page generation and content delivery
- **Integration tests** - Cross-component functionality

## Directory Structure

```
tests/e2e/
├── helpers/
│   ├── testClient.ts       # HTTP client for API testing
│   ├── mocks.ts            # Test data factories
│   ├── mocks/
│   │   └── mocksExternal.ts # External service mocks
│   └── index.ts            # Main exports
├── api/
│   ├── health.test.ts      # Health endpoint tests
│   ├── chat.test.ts        # Chat streaming tests
│   ├── serp.test.ts        # SERP API tests
│   ├── metrics.test.ts     # Metrics endpoint tests
│   ├── variables.test.ts   # Dynamic variables tests
│   ├── data.test.ts        # Data API tests
│   └── articles.test.ts    # Articles API tests
├── pages/
│   └── rendering.test.ts   # Page rendering tests
├── setup.ts                # E2E test setup
└── index.test.ts           # Test suite entry point
```

## Running Tests

### Unit Tests Only

```bash
npm run test:unit
```

### E2E Tests Only

```bash
npm run test:e2e
```

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:e2e:watch
```

### Coverage Report

```bash
npm run test:coverage
```

## Environment Variables

Configure the test environment using these variables:

| Variable        | Description                     | Default                 |
| --------------- | ------------------------------- | ----------------------- |
| `TEST_API_URL`  | Base URL for API testing        | `http://localhost:3000` |
| `METRICS_TOKEN` | Auth token for metrics endpoint | (optional)              |

### Example

```bash
TEST_API_URL=https://api.elongoat.io npm run test:e2e
```

## Test Client

The `TestClient` class provides a convenient wrapper for API testing:

```typescript
import { TestClient } from "@e2e/helpers";

const client = new TestClient({
  baseUrl: "http://localhost:3000",
});

// GET request
const response = await client.get("/api/health");
expect(response.status).toBe(200);

// POST request
const postResponse = await client.post("/api/chat", {
  message: "Hello",
});

// Stream response
const stream = await client.stream("/api/chat", { message: "Test" });
```

## Writing Tests

### API Endpoint Tests

```typescript
import { describe, it, expect } from "vitest";
import { TestClient } from "@e2e/helpers";

describe("API: /my-endpoint", () => {
  const client = new TestClient();

  it("should return 200", async () => {
    const response = await client.get("/api/my-endpoint");
    expect(response.status).toBe(200);
  });
});
```

### SSE Stream Tests

```typescript
import { parseSSEStream } from "@e2e/helpers";

it("should stream chunks", async () => {
  const stream = await client.stream("/api/chat", { message: "Test" });
  const events = await parseSSEStream(stream);

  expect(events.length).toBeGreaterThan(0);
});
```

## Test Categories

### API Tests (`api/`)

- `health.test.ts` - Health check, component status, system metrics
- `chat.test.ts` - Chat streaming, SSE responses, fallback behavior
- `serp.test.ts` - SERP queries, caching, analysis mode
- `metrics.test.ts` - Prometheus metrics, authentication
- `variables.test.ts` - Dynamic variables, caching
- `data.test.ts` - Topic/page/qa data endpoints
- `articles.test.ts` - Articles API

### Page Tests (`pages/`)

- `rendering.test.ts` - Static page rendering, SEO metadata, error pages

## CI/CD Integration

The tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: |
    npm run test:e2e
  env:
    TEST_API_URL: ${{ secrets.API_URL }}
    METRICS_TOKEN: ${{ secrets.METRICS_TOKEN }}
```

## Troubleshooting

### Server Not Running

If tests fail with connection errors:

```bash
# Start the development server
npm run dev

# In another terminal, run tests
TEST_API_URL=http://localhost:3000 npm run test:e2e
```

### Rate Limiting

Tests may encounter rate limits. Configure:

```bash
RATE_LIMIT_ENABLED=false npm run test:e2e
```

### Timing Issues

For slower environments, increase timeouts:

```typescript
it("should complete within extended time", async () => {
  // Test code
}, 60_000); // 60 second timeout
```
