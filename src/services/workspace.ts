/** ワークスペースの初期化と成果物コピーを扱う補助関数群。 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type LogFn, noopLog } from "../shared/logger";

/** 対象ディレクトリが存在しなければ作成する。 */
export function ensureDir(dir: string, log: LogFn = noopLog): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`);
  }
}

/** Claude Code が要求するため、必要ならワークスペースを git 管理下に置く。 */
export function initializeWorkspaceGitRepo(
  workspaceDir: string,
  log: LogFn = noopLog,
): void {
  ensureDir(workspaceDir, log);

  if (existsSync(join(workspaceDir, ".git"))) {
    return;
  }

  log("Initializing workspace as git repository...");
  execSync("git init", { cwd: workspaceDir, stdio: "pipe" });
  execSync('git commit --allow-empty -m "init"', {
    cwd: workspaceDir,
    stdio: "pipe",
  });
}

/** 一時ファイルを除いて現在のワークスペースを dist へ複製する。 */
export function copyWorkspaceToDist(
  workspaceDir: string,
  distDir: string,
  log: LogFn = noopLog,
): void {
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true });
  }

  mkdirSync(distDir, { recursive: true });
  cpSync(workspaceDir, distDir, {
    recursive: true,
    filter: (src) => !src.includes("/.git") && !src.includes("/node_modules"),
  });
  log(`Copied workspace to ${distDir}`);
}

/** workspace の package.json に指定スクリプトがあるかを返す。 */
export function hasScript(workspaceDir: string, name: string): boolean {
  try {
    const pkgPath = join(workspaceDir, "package.json");
    if (!existsSync(pkgPath)) return false;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return !!pkg.scripts?.[name];
  } catch {
    return false;
  }
}
