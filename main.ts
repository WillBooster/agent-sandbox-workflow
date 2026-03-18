import { resolve } from "node:path";
import { defaultLog } from "./src/logger";
import { processBacklogTickets } from "./src/workflow";

const WORKSPACE_DIR = resolve("workspace");
const DIST_DIR = resolve("dist");

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
