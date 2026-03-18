import { runClaudePrompt } from "./claude";
import { type LogFn, noopLog } from "./logger";
import { buildImplementationPrompt } from "./prompts";
import type { AgentRunResult, TicketDetail } from "./types";

interface ImplementTicketOptions {
  workspaceDir: string;
  isFirstTicket?: boolean;
  log?: LogFn;
}

export async function implementTicket(
  ticket: TicketDetail,
  options: ImplementTicketOptions,
): Promise<AgentRunResult> {
  const { workspaceDir, isFirstTicket = false, log = noopLog } = options;

  return await runClaudePrompt(
    buildImplementationPrompt(ticket, isFirstTicket),
    {
      cwd: workspaceDir,
      log,
    },
  );
}
