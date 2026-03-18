import { expect, test } from "vitest";
import type { TicketDetail } from "../src/steps/fetch-ticket";
import { buildImplementationPrompt } from "../src/steps/implement-ticket";

const ticket: TicketDetail = {
  id: 1,
  title: "Sample ticket",
  body: "Implement the requested feature.",
};

test("buildImplementationPrompt includes verification feedback for retries", () => {
  const prompt = buildImplementationPrompt(
    ticket,
    "npm run format\nsrc/index.ts:1:1 error TS1005: ';' expected.",
  );

  expect(prompt).toContain(
    "The previous implementation attempt failed verification.",
  );
  expect(prompt).toContain("npm run format");
  expect(prompt).toContain("error TS1005");
  expect(prompt).not.toContain("Node.js as the runtime");
  expect(prompt).not.toContain("TypeScript");
  expect(prompt).not.toContain("Playwright");
});
