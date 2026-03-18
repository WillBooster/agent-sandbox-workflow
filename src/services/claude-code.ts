/** Claude Code session helpers built on the preview V2 SDK. */
import { execSync } from "node:child_process";
import {
  type SDKMessage,
  unstable_v2_createSession,
} from "@anthropic-ai/claude-agent-sdk";
import { DEFAULT_MAX_TURNS, DEFAULT_MODEL } from "../shared/config";
import { type LogFn, noopLog } from "../shared/logger";
import type { AgentRunResult } from "../shared/types";

/** Converts a streamed SDK result message into the local result shape. */
export function extractAgentResult(message: SDKMessage): AgentRunResult | null {
  if (message.type !== "result") return null;

  if (message.subtype === "success") {
    return {
      result: message.result,
      isError: false,
    };
  }

  return {
    result: "errors" in message ? message.errors.join("\n") : "Unknown error",
    isError: true,
  };
}

async function withWorkingDirectory<T>(
  cwd: string,
  callback: () => Promise<T>,
): Promise<T> {
  const previousCwd = process.cwd();
  process.chdir(cwd);

  try {
    return await callback();
  } finally {
    process.chdir(previousCwd);
  }
}

interface RunClaudePromptOptions {
  cwd: string;
  model?: string;
  maxTurns?: number;
  log?: LogFn;
}

/** Runs a single Sonnet-backed Claude Code prompt inside the target directory. */
export async function runClaudePrompt(
  prompt: string,
  options: RunClaudePromptOptions,
): Promise<AgentRunResult> {
  const {
    cwd,
    model = DEFAULT_MODEL,
    maxTurns = DEFAULT_MAX_TURNS,
    log = noopLog,
  } = options;

  log(`[Agent] Starting agent in ${cwd}`);
  log(`[Agent] Prompt: ${prompt.slice(0, 100)}...`);

  try {
    return await withWorkingDirectory(cwd, async () => {
      const claudePath = execSync("which claude", {
        encoding: "utf-8",
      }).trim();
      const sessionOptions = {
        model,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns,
        pathToClaudeCodeExecutable: claudePath,
      } as Parameters<typeof unstable_v2_createSession>[0];

      await using session = unstable_v2_createSession(sessionOptions);
      await session.send(prompt);

      let finalResult: AgentRunResult | null = null;

      for await (const message of session.stream()) {
        if (message.type !== "result") continue;

        const result = extractAgentResult(message);
        if (!result) continue;

        finalResult = result;
        if (!result.isError) {
          log(
            `[Agent] Completed successfully (${message.num_turns} turns, $${message.total_cost_usd.toFixed(4)})`,
          );
        } else {
          log(
            `[Agent] Error: ${message.subtype} - ${result.result.slice(0, 200)}`,
          );
        }
      }

      if (!finalResult) {
        throw new Error("Agent session completed without returning a result");
      }

      return finalResult;
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`[Agent] Exception: ${errorMessage}`);
    return { result: errorMessage, isError: true };
  }
}
