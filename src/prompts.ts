import type { TicketDetail } from "./types";

export function buildImplementationPrompt(
  ticket: TicketDetail,
  isFirstTicket: boolean,
): string {
  const additionalInstruction = isFirstTicket
    ? `\n\nIMPORTANT: Since this is the first ticket, also define the following npm scripts in package.json:
- "typecheck": type-checking command using bunx tsc --noEmit
- "format": formatting/linting command using bunx biome check --write .
- "test": test command using bun test

Also set up biome.json for the project, and tsconfig.json if not present.
Make sure to install necessary devDependencies (@biomejs/biome, @types/bun, typescript).`
    : "";

  return `You are implementing a software project. Here is the ticket:

Title: ${ticket.title}
Description:
${ticket.body}

${additionalInstruction}

Please implement this feature. Also write test code (using bun:test with import { test, expect, describe } from "bun:test") in files ending with .test.ts.

Use Bun as the runtime. Use TypeScript. Do not use external packages unless absolutely necessary — prefer built-in Bun APIs.
Use the Sonnet model behavior level only. Do NOT use Opus. Do NOT use any git commands.`;
}

export function buildVerificationPrompt(command: string): string {
  return `Run \`${command}\` and fix any issues that command surfaces. Do NOT use any git commands. Only fix issues needed to make the command pass; do not add new features. Use Sonnet, not Opus.`;
}

export function buildReviewPrompt(): string {
  return `You are a code reviewer. Review the code in this project for:
- Correctness and potential bugs
- Code quality and readability
- Security issues
- Test coverage

Read the source files and test files, then provide your review.
If there are issues, clearly state what needs to be fixed.
If everything looks good, say "LGTM" (Looks Good To Me).
Use Sonnet, not Opus. Do NOT use any git commands. Do NOT modify any files.`;
}

export function buildReviewEvaluationPrompt(reviewText: string): string {
  return `A code review was performed on this project. Here is the review:

---
${reviewText}
---

Please evaluate this review:
1. For each point raised, determine if it is valid and actionable.
2. If a point is valid, fix the code accordingly.
3. If a point is NOT valid (e.g., nitpicking, false positive, or would break functionality), generate a rebuttal comment explaining why the suggestion should not be applied. Print the rebuttal prefixed with "REBUTTAL:".

Use Sonnet, not Opus. Do NOT use any git commands.`;
}
