import "dotenv/config";

import { getEnv as getAppEnv, type Env } from "../../src/lib/env";

export function getEnv(): Env {
  return getAppEnv();
}

export function requireEnv<K extends keyof Env>(name: K): NonNullable<Env[K]> {
  const env = getAppEnv();
  const value = env[name];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing env: ${String(name)}`);
  }
  return value as NonNullable<Env[K]>;
}
