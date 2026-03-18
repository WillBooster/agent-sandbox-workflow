/** Filesystem helpers for workspace setup and artifact copying. */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type LogFn, noopLog } from "../shared/logger";

/** Ensures that the target directory exists. */
export function ensureDir(dir: string, log: LogFn = noopLog): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`);
  }
}

/** Initializes the workspace as a git repository when needed by Claude Code. */
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

/** Copies the current workspace to the dist directory, excluding transient files. */
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

/** Checks whether a named npm script exists in the workspace package.json. */
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
