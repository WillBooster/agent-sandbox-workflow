/** ステップ3: ワークスペースの検証コマンドを実行する。 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

const CHECKS = [{ name: "format" }, { name: "test" }] as const;

interface VerifyWorkspaceOptions {
  workspaceDir: string;
  log?: LogFn;
}

function hasScript(workspaceDir: string, name: string): boolean {
  try {
    const pkgPath = join(workspaceDir, "package.json");
    if (!existsSync(pkgPath)) return false;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return !!pkg.scripts?.[name];
  } catch {
    return false;
  }
}

function runCheck(workspaceDir: string, name: string): VerificationStepResult {
  const command = `npm run ${name}`;
  const result = spawnSync("npm", ["run", name], {
    cwd: workspaceDir,
    encoding: "utf-8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();

  return {
    name,
    skipped: false,
    output:
      output.length > 0
        ? output
        : `${command} exited with code ${result.status ?? "unknown"}`,
    isError: result.status !== 0,
  };
}

/** format/test をローカル実行し、exit code と出力を検証する。 */
export async function verifyWorkspace(
  options: VerifyWorkspaceOptions,
): Promise<VerificationResult> {
  const { workspaceDir, log = noopLog } = options;
  const steps: VerificationStepResult[] = [];

  for (const check of CHECKS) {
    if (!hasScript(workspaceDir, check.name)) {
      steps.push({
        name: check.name,
        skipped: false,
        output: `Missing script: ${check.name}`,
        isError: true,
      });
      return {
        success: false,
        steps,
      };
    }

    log(`Running ${check.name}...`);
    const result = runCheck(workspaceDir, check.name);

    steps.push(result);

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
