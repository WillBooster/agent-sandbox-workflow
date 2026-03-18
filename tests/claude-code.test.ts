import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  extractAgentResult,
  runClaudePrompt,
} from "../src/services/claude-code";

const { createSessionMock } = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_createSession: createSessionMock,
}));

describe("claude-code service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("extractAgentResult maps success result messages", () => {
    const result = extractAgentResult({
      type: "result",
      subtype: "success",
      result: "LGTM",
    } as never);

    expect(result).toEqual({
      result: "LGTM",
      isError: false,
    });
  });

  test("runClaudePrompt creates a fresh SDK session for each invocation", async () => {
    createSessionMock
      .mockReturnValueOnce({
        send: vi.fn().mockResolvedValue(undefined),
        async *stream() {
          yield {
            type: "result",
            subtype: "success",
            result: "first",
            num_turns: 1,
            total_cost_usd: 0,
          };
        },
        [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
      })
      .mockReturnValueOnce({
        send: vi.fn().mockResolvedValue(undefined),
        async *stream() {
          yield {
            type: "result",
            subtype: "success",
            result: "second",
            num_turns: 1,
            total_cost_usd: 0,
          };
        },
        [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
      });

    const first = await runClaudePrompt("review prompt", { cwd: process.cwd() });
    const second = await runClaudePrompt("fix prompt", { cwd: process.cwd() });

    expect(first).toEqual({ result: "first", isError: false });
    expect(second).toEqual({ result: "second", isError: false });
    expect(createSessionMock).toHaveBeenCalledTimes(2);
    expect(createSessionMock.mock.results[0]?.value).not.toBe(
      createSessionMock.mock.results[1]?.value,
    );
  });
});
