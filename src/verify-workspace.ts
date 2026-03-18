import { runClaudePrompt } from "./claude";
import { type LogFn, noopLog } from "./logger";
import { buildVerificationPrompt } from "./prompts";
import type { VerificationResult, VerificationStepResult } from "./types";
import { hasScript } from "./workspace";

const CHECKS = [
  { name: "typecheck", command: "bun run typecheck" },
  { name: "format", command: "bun run format" },
  { name: "test", command: "bun run test" },
] as const;

interface VerifyWorkspaceOptions {
  workspaceDir: string;
  log?: LogFn;
}

export async function verifyWorkspace(
  options: VerifyWorkspaceOptions,
): Promise<VerificationResult> {
  const { workspaceDir, log = noopLog } = options;
  const steps: VerificationStepResult[] = [];

  for (const check of CHECKS) {
    if (!hasScript(workspaceDir, check.name)) {
      steps.push({
        name: check.name,
        skipped: true,
        output: `Missing script: ${check.name}`,
        isError: false,
      });
      continue;
    }

    log(`Running ${check.name}...`);
    const result = await runClaudePrompt(
      buildVerificationPrompt(check.command),
      {
        cwd: workspaceDir,
        log,
      },
    );

    steps.push({
      name: check.name,
      skipped: false,
      output: result.result,
      isError: result.isError,
    });

    if (result.isError) {
      return {
        success: false,
        steps,
      };
    }
  }

  return {
    success: true,
    steps,
  };
}
