/** 実際の Claude Code を使うステップ2-5の統合テスト。 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { noopLog } from "../src/shared/logger";
import type { TicketDetail } from "../src/steps/fetch-ticket";
import { implementTicket } from "../src/steps/implement-ticket";
import { processTicketList } from "../src/steps/process-tickets";
import { reviewWorkspace } from "../src/steps/review-workspace";
import { verifyWorkspace } from "../src/steps/verify-workspace";
import { createTempProjectDir, seedNodeProject } from "./test-helpers";

const ticketAdd: TicketDetail = {
  id: 101,
  title: "足し算ユーティリティのNode.jsプロジェクトを新規作成",
  body: `Create a Node.js project that implements src/add.ts exporting add(a: number, b: number): number.
Use Biome for formatting/linting and Playwright for end-to-end testing.
Define package.json scripts so that npm run format and npm run test both work.
Add tests for the add feature and keep the implementation minimal and focused.`,
};

const ticketSubtract: TicketDetail = {
  id: 102,
  title: "引き算ユーティリティを追加",
  body: `Extend the existing Node.js project by adding src/subtract.ts exporting subtract(a: number, b: number): number.
Keep npm run format and npm run test working after your changes.
Add tests for the subtract feature and keep the implementation minimal and focused.`,
};

describe("workflow steps with real Claude Code", () => {
  test("step 2-4: implements, verifies, and reviews a specific ticket", async () => {
    const workspaceDir = createTempProjectDir("workflow-step-");
    seedNodeProject(workspaceDir);

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
    seedNodeProject(workspaceDir);

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
