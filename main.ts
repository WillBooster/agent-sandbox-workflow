/** CLI からバックログ処理全体を起動するエントリーポイント。 */
import { resolve } from "node:path";
import { defaultLog } from "./src/shared/logger";
import { processBacklogTickets } from "./src/steps/process-tickets";

const WORKSPACE_DIR = resolve("workspace");
const DIST_DIR = resolve("dist");

/** 本番用のバックログワークフローを実行する。 */
export async function main(): Promise<void> {
  defaultLog("=== Agent Sandbox Workflow Started ===");
  await processBacklogTickets({
    workspaceDir: WORKSPACE_DIR,
    distDir: DIST_DIR,
    log: defaultLog,
  });
  defaultLog("=== All tickets processed ===");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
