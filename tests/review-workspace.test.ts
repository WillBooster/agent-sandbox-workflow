import { beforeEach, describe, expect, test, vi } from "vitest";
import { runClaudePrompt } from "../src/services/claude-code";
import {
  buildReviewEvaluationPrompt,
  buildReviewPrompt,
  reviewWorkspace,
} from "../src/steps/review-workspace";
import type { TicketDetail } from "../src/steps/fetch-ticket";
import { verifyWorkspace } from "../src/steps/verify-workspace";

vi.mock("../src/services/claude-code", () => ({
  runClaudePrompt: vi.fn(),
}));

vi.mock("../src/steps/verify-workspace", () => ({
  verifyWorkspace: vi.fn(),
}));

const runClaudePromptMock = vi.mocked(runClaudePrompt);
const verifyWorkspaceMock = vi.mocked(verifyWorkspace);
const ticket: TicketDetail = {
  id: 101,
  title: "Sample ticket",
  body: "Implement add(a, b).",
};

describe("reviewWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("buildReviewPrompt instructs the reviewer to use the ticket details and emit the required marker", () => {
    const prompt = buildReviewPrompt(ticket);

    expect(prompt).toContain("working independently from the implementation agent");
    expect(prompt).toContain(`Ticket ID: ${ticket.id}`);
    expect(prompt).toContain(`Title: ${ticket.title}`);
    expect(prompt).toContain(ticket.body);
    expect(prompt).toContain('include "！要修正！" at the beginning of your review');
    expect(prompt).toContain('say "LGTM"');
  });

  test("buildReviewEvaluationPrompt instructs the fixer to handle only valid findings", () => {
    const prompt = buildReviewEvaluationPrompt("！要修正！ Fix this.");

    expect(prompt).toContain("working independently from the reviewer");
    expect(prompt).toContain(
      "You do not share context with the reviewer.",
    );
    expect(prompt).toContain("For each point raised, determine if it is valid and actionable.");
    expect(prompt).toContain("If a point is valid, fix the code accordingly.");
    expect(prompt).toContain('Print the rebuttal prefixed with "REBUTTAL:"');
  });

  test("returns success without remediation when review says LGTM", async () => {
    runClaudePromptMock.mockResolvedValueOnce({
      result: "LGTM",
      isError: false,
    });

    const result = await reviewWorkspace({ ticket, workspaceDir: "/tmp/workspace" });

    expect(result).toEqual({
      success: true,
      reviewText: "LGTM",
      needsChanges: false,
    });
    expect(runClaudePromptMock).toHaveBeenCalledTimes(1);
    expect(verifyWorkspaceMock).not.toHaveBeenCalled();
  });

  test("does not remediate when review does not include the required marker", async () => {
    runClaudePromptMock.mockResolvedValueOnce({
      result: "Consider renaming this variable for clarity.",
      isError: false,
    });

    const result = await reviewWorkspace({ ticket, workspaceDir: "/tmp/workspace" });

    expect(result).toEqual({
      success: true,
      reviewText: "Consider renaming this variable for clarity.",
      needsChanges: false,
    });
    expect(runClaudePromptMock).toHaveBeenCalledTimes(1);
    expect(verifyWorkspaceMock).not.toHaveBeenCalled();
  });

  test("remediates and re-verifies only when the review includes the required marker", async () => {
    runClaudePromptMock
      .mockResolvedValueOnce({
        result: "！要修正！ Missing validation for empty input.",
        isError: false,
      })
      .mockResolvedValueOnce({
        result: "Applied the valid fix and rebutted the invalid suggestion.",
        isError: false,
      });
    verifyWorkspaceMock.mockResolvedValueOnce({
      success: true,
      steps: [],
    });

    const result = await reviewWorkspace({ ticket, workspaceDir: "/tmp/workspace" });

    expect(runClaudePromptMock).toHaveBeenCalledTimes(2);
    expect(runClaudePromptMock.mock.calls[0]?.[0]).toBe(buildReviewPrompt(ticket));
    expect(runClaudePromptMock.mock.calls[1]?.[0]).toContain(
      "working independently from the reviewer",
    );
    expect(runClaudePromptMock.mock.calls[1]?.[0]).toContain(
      "！要修正！ Missing validation for empty input.",
    );
    expect(verifyWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      reviewText: "！要修正！ Missing validation for empty input.",
      needsChanges: true,
      evaluationText: "Applied the valid fix and rebutted the invalid suggestion.",
      verification: {
        success: true,
        steps: [],
      },
    });
  });
});
