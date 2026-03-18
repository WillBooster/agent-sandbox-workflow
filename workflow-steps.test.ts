import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { implementTicket } from "./src/implement-ticket";
import { noopLog } from "./src/logger";
import { reviewWorkspace } from "./src/review-workspace";
import type { TicketDetail } from "./src/types";
import { verifyWorkspace } from "./src/verify-workspace";
import { processTicketList } from "./src/workflow";
import { createTempProjectDir, seedBunProject } from "./test-helpers";

const ticketAdd: TicketDetail = {
  id: 101,
  title: "足し算ユーティリティを追加",
  body: `Create src/add.ts that exports add(a: number, b: number): number.
Add tests in src/add.test.ts covering at least positive and negative numbers.
Keep the implementation minimal and focused.`,
};

const ticketSubtract: TicketDetail = {
  id: 102,
  title: "引き算ユーティリティを追加",
  body: `Create src/subtract.ts that exports subtract(a: number, b: number): number.
Add tests in src/subtract.test.ts covering at least positive and negative numbers.
Keep the implementation minimal and focused.`,
};

describe("workflow steps with real Claude Code", () => {
  test("step 2-4: implements, verifies, and reviews a specific ticket", async () => {
    const workspaceDir = createTempProjectDir("workflow-step-");
    seedBunProject(workspaceDir);

    const implementation = await implementTicket(ticketAdd, {
      workspaceDir,
      log: noopLog,
    });
    expect(implementation.isError).toBe(false);
    expect(existsSync(join(workspaceDir, "src/add.ts"))).toBe(true);
    expect(existsSync(join(workspaceDir, "src/add.test.ts"))).toBe(true);

    const verification = await verifyWorkspace({
      workspaceDir,
      log: noopLog,
    });
    expect(verification.success).toBe(true);

    const review = await reviewWorkspace({
      workspaceDir,
      log: noopLog,
    });
    expect(review.success).toBe(true);
  }, 300_000);

  test("step 5: repeats the workflow for a ticket list", async () => {
    const workspaceDir = createTempProjectDir("workflow-list-");
    const distDir = createTempProjectDir("workflow-dist-");
    seedBunProject(workspaceDir);

    const results = await processTicketList([ticketAdd, ticketSubtract], {
      workspaceDir,
      distDir,
      log: noopLog,
      maxRetries: 3,
    });

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.success)).toBe(true);
    expect(existsSync(join(distDir, "src/add.ts"))).toBe(true);
    expect(existsSync(join(distDir, "src/subtract.ts"))).toBe(true);
  }, 600_000);
});
