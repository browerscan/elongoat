import { exec } from "node:child_process";
import { promisify } from "node:util";

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
    // Use json mode for structured output
    const command = `${CODEX_ROUTER_PATH} "${escapeShellArg(params.prompt)}" "" json ${effort}`;

    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large content
    });

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

  // Worker function
  const worker = async () => {
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
    }
  };

  // Start workers
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Escape shell argument for safe execution
 */
function escapeShellArg(arg: string): string {
  // Replace single quotes with '\'' and wrap in single quotes
  return arg.replace(/'/g, "'\\''");
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
): { valid: boolean; wordCount: number; message?: string } {
  const wordCount = countWords(content);

  if (wordCount < minWords) {
    return {
      valid: false,
      wordCount,
      message: `Content has ${wordCount} words, minimum required is ${minWords}`,
    };
  }

  return {
    valid: true,
    wordCount,
  };
}
