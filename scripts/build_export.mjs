import { copyFileSync, existsSync, renameSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const apiDir = resolve("src/app/api");
const disabledDir = resolve("src/app/_api_disabled");
const configSrc = resolve("next.config.export.mjs");
const configDest = resolve("next.config.mjs");
const outDir = resolve("out");

function restoreApiDir() {
  if (existsSync(disabledDir) && !existsSync(apiDir)) {
    renameSync(disabledDir, apiDir);
  }
}

try {
  // Clean previous export output to avoid path conflicts.
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }

  // Temporarily disable API routes for static export.
  if (existsSync(apiDir) && !existsSync(disabledDir)) {
    renameSync(apiDir, disabledDir);
  }

  copyFileSync(configSrc, configDest);
  execSync("NEXT_BUILD_TARGET=export next build", { stdio: "inherit" });
} finally {
  restoreApiDir();
}
