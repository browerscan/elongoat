import { exec } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";

const execAsync = promisify(exec);

export type CodexEffort = "low" | "medium" | "high" | "xhigh";
export type CodexMode = "silent" | "json";

export type CodexResult = {
  success: boolean;
  content: string;
  sessionId?: string;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  error?: string;
};

const CODEX_ROUTER_PATH = "/Users/butterfly/.claude/bin/codex_router.sh";

/**
 * Call the codex router for high-quality content generation
 */
export async function generateWithCodex(params: {
  prompt: string;
  effort?: CodexEffort;
  timeout?: number;
}): Promise<CodexResult> {
  const effort = params.effort ?? "high";
  const timeout = params.timeout ?? 60000; // 60s default

  try {
    // Write prompt to temp file
    const tempFile = `/tmp/codex_prompt_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`;
    await writeFile(tempFile, params.prompt, "utf-8");

    // Create a wrapper script that reads the file and calls codex
    const wrapperScript = `/tmp/codex_wrapper_${Date.now()}.sh`;
    const wrapperContent = `#!/bin/bash
PROMPT=$(cat "${tempFile}")
${CODEX_ROUTER_PATH} "$PROMPT" "" json ${effort}
`;
    await writeFile(wrapperScript, wrapperContent, "utf-8");
    await execAsync(`chmod +x "${wrapperScript}"`);

    // Execute the wrapper
    const { stdout, stderr } = await execAsync(wrapperScript, {
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large content
    });

    // Clean up
    await unlink(tempFile).catch(() => {});
    await unlink(wrapperScript).catch(() => {});

    // Check for fatal error in stderr
    if (stderr && stderr.includes("[FATAL_CODEX_ERROR]")) {
      return {
        success: false,
        content: "",
        error: `Codex fatal error: ${stderr}`,
      };
    }

    // Parse JSON output
    try {
      const result = JSON.parse(stdout) as {
        success: boolean;
        session_id?: string;
        content?: string;
        tokens?: {
          prompt?: number;
          completion?: number;
          total?: number;
        };
      };

      return {
        success: result.success,
        content: result.content ?? "",
        sessionId: result.session_id,
        tokens: result.tokens,
      };
    } catch (parseError) {
      // Fallback: treat stdout as raw content
      return {
        success: true,
        content: stdout,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[codex] Generation failed:", errorMsg);

    return {
      success: false,
      content: "",
      error: errorMsg,
    };
  }
}

/**
 * Batch generate with codex using parallel execution
 * Automatically handles concurrency with up to 6 parallel threads
 */
export async function batchGenerateWithCodex(
  tasks: Array<{
    id: string;
    prompt: string;
    effort?: CodexEffort;
  }>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number, taskId: string) => void;
  } = {},
): Promise<Map<string, CodexResult>> {
  const concurrency = options.concurrency ?? 6;
  const results = new Map<string, CodexResult>();
  const queue = [...tasks];
  let completed = 0;

  const workers: Promise<void>[] = [];

  for (let i = 0; i < concurrency; i++) {
    const worker = (async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (!task) break;

        const result = await generateWithCodex({
          prompt: task.prompt,
          effort: task.effort,
        });

        results.set(task.id, result);
        completed++;

        if (options.onProgress) {
          options.onProgress(completed, tasks.length, task.id);
        }

        // Small delay between requests to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    })();

    workers.push(worker);
  }

  await Promise.all(workers);
  return results;
}

/**
 * Count words in text (simple approximation)
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

/**
 * Validate that content meets minimum word count
 */
export function validateWordCount(
  content: string,
  minWords: number,
): { valid: boolean; actual: number; message?: string } {
  const actual = countWords(content);
  const valid = actual >= minWords;

  return {
    valid,
    actual,
    message: valid
      ? undefined
      : `Content has ${actual} words, requires at least ${minWords}`,
  };
}
