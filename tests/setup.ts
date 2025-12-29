/**
 * Test setup file for ElonGoat project
 *
 * This file runs before all tests and configures the test environment.
 */

import { vi, afterAll } from "vitest";

// Mock server-only module at the global level
vi.mock("server-only", () => ({}));

// Set test environment variables
process.env.NODE_ENV = "test";

// Suppress console output during tests unless explicitly needed
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Restore console in case of test failures
afterAll(() => {
  global.console = originalConsole;
});

// Mock crypto.randomUUID for tests
if (!global.crypto) {
  global.crypto = {} as Crypto;
}
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () =>
    "test-uuid-00000000-0000-4000-8000-000000000000";
}

// Mock process.hrtime for benchmarking tests
if (!process.hrtime) {
  process.hrtime = (() => {
    const start = Date.now();
    return () => {
      const diff = Date.now() - start;
      return [Math.floor(diff / 1000), (diff % 1000) * 1000000] as [
        number,
        number,
      ];
    };
  }) as any;
}
