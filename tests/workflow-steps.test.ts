import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  processSingleTicket,
  processTicketList,
} from "../src/steps/process-tickets";
import type { TicketDetail } from "../src/steps/fetch-ticket";
import { implementTicket } from "../src/steps/implement-ticket";
import { reviewWorkspace } from "../src/steps/review-workspace";
import { verifyWorkspace } from "../src/steps/verify-workspace";
import {
  copyWorkspaceToDist,
  ensureDir,
  initializeWorkspaceGitRepo,
} from "../src/services/workspace";

vi.mock("../src/steps/implement-ticket", () => ({
  implementTicket: vi.fn(),
}));

vi.mock("../src/steps/review-workspace", () => ({
  reviewWorkspace: vi.fn(),
}));

vi.mock("../src/steps/verify-workspace", () => ({
  verifyWorkspace: vi.fn(),
}));

vi.mock("../src/services/workspace", () => ({
  copyWorkspaceToDist: vi.fn(),
  ensureDir: vi.fn(),
  initializeWorkspaceGitRepo: vi.fn(),
}));

const implementTicketMock = vi.mocked(implementTicket);
const reviewWorkspaceMock = vi.mocked(reviewWorkspace);
const verifyWorkspaceMock = vi.mocked(verifyWorkspace);
const copyWorkspaceToDistMock = vi.mocked(copyWorkspaceToDist);
const ensureDirMock = vi.mocked(ensureDir);
const initializeWorkspaceGitRepoMock = vi.mocked(initializeWorkspaceGitRepo);

const ticketAdd: TicketDetail = {
  id: 101,
  title: "足し算ユーティリティのNode.jsプロジェクトを新規作成",
  body: "Implement add(a, b).",
};

const ticketSubtract: TicketDetail = {
  id: 102,
  title: "引き算ユーティリティを追加",
  body: "Implement subtract(a, b).",
};

describe("workflow steps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("step 2-4: implementation, verification, and review succeed in order", async () => {
    implementTicketMock.mockResolvedValueOnce({
      result: "implemented",
      isError: false,
    });
    verifyWorkspaceMock
      .mockResolvedValueOnce({
        success: true,
        steps: [],
      })
      .mockResolvedValueOnce({
        success: true,
        steps: [],
      });
    reviewWorkspaceMock.mockResolvedValueOnce({
      success: true,
      reviewText: "LGTM",
      needsChanges: false,
    });

    const result = await processSingleTicket(ticketAdd, {
      workspaceDir: "/tmp/workspace",
      maxRetries: 1,
    });

    expect(implementTicketMock).toHaveBeenCalledWith(ticketAdd, {
      workspaceDir: "/tmp/workspace",
      retryFeedback: undefined,
      log: expect.any(Function),
    });
    expect(verifyWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(reviewWorkspaceMock).toHaveBeenCalledWith({
      ticket: ticketAdd,
      workspaceDir: "/tmp/workspace",
      log: expect.any(Function),
    });
    expect(result).toEqual({
      ticketId: 101,
      success: true,
      attempts: 1,
    });
  });

  test("step 5: repeats the workflow for a ticket list and copies the workspace after each ticket", async () => {
    implementTicketMock
      .mockResolvedValueOnce({
        result: "implemented add",
        isError: false,
      })
      .mockResolvedValueOnce({
        result: "implemented subtract",
        isError: false,
      });
    verifyWorkspaceMock
      .mockResolvedValueOnce({
        success: true,
        steps: [],
      })
      .mockResolvedValueOnce({
        success: true,
        steps: [],
      });
    reviewWorkspaceMock
      .mockResolvedValueOnce({
        success: true,
        reviewText: "LGTM",
        needsChanges: false,
      })
      .mockResolvedValueOnce({
        success: true,
        reviewText: "LGTM",
        needsChanges: false,
      });

    const results = await processTicketList([ticketAdd, ticketSubtract], {
      workspaceDir: "/tmp/workspace",
      distDir: "/tmp/dist",
      maxRetries: 1,
    });

    expect(ensureDirMock).toHaveBeenCalledWith(
      "/tmp/workspace",
      expect.any(Function),
    );
    expect(initializeWorkspaceGitRepoMock).toHaveBeenCalledWith(
      "/tmp/workspace",
      expect.any(Function),
    );
    expect(copyWorkspaceToDistMock).toHaveBeenCalledTimes(2);
    expect(copyWorkspaceToDistMock).toHaveBeenNthCalledWith(
      1,
      "/tmp/workspace",
      "/tmp/dist",
      expect.any(Function),
    );
    expect(copyWorkspaceToDistMock).toHaveBeenNthCalledWith(
      2,
      "/tmp/workspace",
      "/tmp/dist",
      expect.any(Function),
    );
    expect(results).toEqual([
      {
        ticketId: 101,
        success: true,
        attempts: 1,
      },
      {
        ticketId: 102,
        success: true,
        attempts: 1,
      },
    ]);
  });
});
