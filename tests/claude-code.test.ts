import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  extractAgentResult,
  runClaudePrompt,
} from "../src/services/claude-code";

const { promptMock } = vi.hoisted(() => ({
  promptMock: vi.fn(),
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_prompt: promptMock,
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

  test("runClaudePrompt calls unstable_v2_prompt for each invocation", async () => {
    promptMock
      .mockResolvedValueOnce({
        type: "result",
        subtype: "success",
        result: "first",
        num_turns: 1,
        total_cost_usd: 0,
      })
      .mockResolvedValueOnce({
        type: "result",
        subtype: "success",
        result: "second",
        num_turns: 1,
        total_cost_usd: 0,
      });

    const first = await runClaudePrompt("review prompt", {
      cwd: process.cwd(),
    });
    const second = await runClaudePrompt("fix prompt", { cwd: process.cwd() });

    expect(first).toEqual({ result: "first", isError: false });
    expect(second).toEqual({ result: "second", isError: false });
    expect(promptMock).toHaveBeenCalledTimes(2);
  });
});
