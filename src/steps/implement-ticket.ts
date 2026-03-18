/** Step 2: implements a single ticket with Claude Code. */
import { runClaudePrompt } from "../services/claude-code";
import { type LogFn, noopLog } from "../shared/logger";
import type { AgentRunResult, TicketDetail } from "../shared/types";

interface ImplementTicketOptions {
  workspaceDir: string;
  isFirstTicket?: boolean;
  log?: LogFn;
}

/** Builds the implementation prompt for a specific ticket. */
function buildImplementationPrompt(
  ticket: TicketDetail,
  isFirstTicket: boolean,
): string {
  const additionalInstruction = isFirstTicket
    ? `\n\nIMPORTANT: Since this is the first ticket, also define the following npm scripts in package.json:
- "typecheck": type-checking command using bunx tsc --noEmit
- "format": formatting/linting command using bunx biome check --write .
- "test": test command using bun test

Also set up biome.json for the project, and tsconfig.json if not present.
Make sure to install necessary devDependencies (@biomejs/biome, @types/bun, typescript).`
    : "";

  return `You are implementing a software project. Here is the ticket:

Title: ${ticket.title}
Description:
${ticket.body}

${additionalInstruction}

Please implement this feature. Also write test code (using bun:test with import { test, expect, describe } from "bun:test") in files ending with .test.ts.

Use Bun as the runtime. Use TypeScript. Do not use external packages unless absolutely necessary — prefer built-in Bun APIs.
Use the Sonnet model behavior level only. Do NOT use Opus. Do NOT use any git commands.`;
}

/** Runs Claude Code to implement one ticket inside the given workspace. */
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
