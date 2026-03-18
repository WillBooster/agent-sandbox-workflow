/** ステップ2: Claude Code で単一チケットを実装する。 */

import type { AgentRunResult } from "../services/claude-code";
import { runClaudePrompt } from "../services/claude-code";
import { type LogFn, noopLog } from "../shared/logger";
import type { TicketDetail } from "./fetch-ticket";

interface ImplementTicketOptions {
  workspaceDir: string;
  retryFeedback?: string;
  log?: LogFn;
}

/** 対象チケット用の実装プロンプトを組み立てる。 */
export function buildImplementationPrompt(
  ticket: TicketDetail,
  retryFeedback?: string,
): string {
  const retryInstruction = retryFeedback
    ? `\n\nThe previous implementation attempt failed verification. Use the following command output, including stdout/stderr, to fix the implementation:\n\n\`\`\`\n${retryFeedback}\n\`\`\``
    : "";

  return `You are implementing a software project. Here is the ticket:

Title: ${ticket.title}
Description:
${ticket.body}

${retryInstruction}

Please implement this feature. Also write the necessary automated tests for the project.

Use the Sonnet model behavior level only. Do NOT use Opus. Do NOT use any git commands.`;
}

/** 指定ワークスペース内で 1 件分のチケット実装を実行する。 */
export async function implementTicket(
  ticket: TicketDetail,
  options: ImplementTicketOptions,
): Promise<AgentRunResult> {
  const { workspaceDir, retryFeedback, log = noopLog } = options;

  return runClaudePrompt(buildImplementationPrompt(ticket, retryFeedback), {
    cwd: workspaceDir,
    log,
  });
}
