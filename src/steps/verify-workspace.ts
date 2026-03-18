/** Step 3: verifies a workspace by running its configured checks. */
import { runClaudePrompt } from "../services/claude-code";
import { hasScript } from "../services/workspace";
import { type LogFn, noopLog } from "../shared/logger";
import type {
  VerificationResult,
  VerificationStepResult,
} from "../shared/types";

const CHECKS = [
  { name: "typecheck", command: "bun run typecheck" },
  { name: "format", command: "bun run format" },
  { name: "test", command: "bun run test" },
] as const;

interface VerifyWorkspaceOptions {
  workspaceDir: string;
  log?: LogFn;
}

/** Builds the verification prompt for a single command. */
function buildVerificationPrompt(command: string): string {
  return `Run \`${command}\` and fix any issues that command surfaces. Do NOT use any git commands. Only fix issues needed to make the command pass; do not add new features. Use Sonnet, not Opus.`;
}

/** Runs typecheck/format/test with Claude fixing any issues it encounters. */
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
