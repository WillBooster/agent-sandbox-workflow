/** プレビュー版 V2 SDK を使って Claude Code を実行する補助関数群。 */
import {
  type SDKMessage,
  unstable_v2_createSession,
} from "@anthropic-ai/claude-agent-sdk";
import { DEFAULT_MAX_TURNS, DEFAULT_MODEL } from "../shared/config";
import { type LogFn, noopLog } from "../shared/logger";

/** Claude 実行結果の最小表現。 */
export interface AgentRunResult {
  result: string;
  isError: boolean;
}

/** ストリームされた SDK の result メッセージをローカル型へ変換する。 */
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

/** 指定ディレクトリ内で Sonnet ベースの Claude Code プロンプトを 1 回実行する。 */
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
    return withWorkingDirectory(cwd, async () => {
      const sessionOptions = {
        model,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns,
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
