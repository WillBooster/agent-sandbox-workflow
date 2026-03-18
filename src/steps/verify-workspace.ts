/** ステップ3: ワークスペースの検証コマンドを実行する。 */
import { runClaudePrompt } from "../services/claude-code";
import { hasScript } from "../services/workspace";
import { type LogFn, noopLog } from "../shared/logger";

/** 検証ステップ 1 件分の実行結果。 */
export interface VerificationStepResult {
  name: string;
  skipped: boolean;
  output: string;
  isError: boolean;
}

/** ワークスペース検証全体の実行結果。 */
export interface VerificationResult {
  success: boolean;
  steps: VerificationStepResult[];
}

const CHECKS = [
  { name: "typecheck", command: "bun run typecheck" },
  { name: "format", command: "bun run format" },
  { name: "test", command: "bun run test" },
] as const;

interface VerifyWorkspaceOptions {
  workspaceDir: string;
  log?: LogFn;
}

/** 単一コマンド用の検証プロンプトを組み立てる。 */
function buildVerificationPrompt(command: string): string {
  return `Run \`${command}\` and fix any issues that command surfaces. Do NOT use any git commands. Only fix issues needed to make the command pass; do not add new features. Use Sonnet, not Opus.`;
}

/** typecheck/format/test を順に回し、必要なら Claude に修正させる。 */
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
