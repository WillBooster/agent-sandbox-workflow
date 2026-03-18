import { expect, test } from "bun:test";
import { buildImplementationPrompt } from "../src/steps/implement-ticket";
import type { TicketDetail } from "../src/steps/fetch-ticket";

const ticket: TicketDetail = {
  id: 1,
  title: "Sample ticket",
  body: "Implement the requested feature.",
};

test("buildImplementationPrompt includes verification feedback for retries", () => {
  const prompt = buildImplementationPrompt(
    ticket,
    false,
    "bun run typecheck\nsrc/index.ts:1:1 error TS1005: ';' expected.",
  );

  expect(prompt).toContain("The previous implementation attempt failed verification.");
  expect(prompt).toContain("bun run typecheck");
  expect(prompt).toContain("error TS1005");
});
