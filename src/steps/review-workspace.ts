/** Step 4: reviews an implementation and optionally applies review fixes. */
import { runClaudePrompt } from "../services/claude-code";
import { type LogFn, noopLog } from "../shared/logger";
import type { ReviewResult } from "../shared/types";
import { verifyWorkspace } from "./verify-workspace";

interface ReviewWorkspaceOptions {
  workspaceDir: string;
  log?: LogFn;
}

/** Detects whether the review output effectively approves the code. */
function reviewLooksGood(reviewText: string): boolean {
  const normalized = reviewText.toUpperCase();
  return normalized.includes("LGTM") || normalized.includes("LOOKS GOOD");
}

/** Builds the prompt used for the read-only code review pass. */
function buildReviewPrompt(): string {
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

/** Builds the prompt that evaluates and applies review feedback. */
function buildReviewEvaluationPrompt(reviewText: string): string {
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

/** Runs the review flow and re-verifies the workspace if changes were applied. */
export async function reviewWorkspace(
  options: ReviewWorkspaceOptions,
): Promise<ReviewResult> {
  const { workspaceDir, log = noopLog } = options;

  log("Running code review...");
  const reviewResult = await runClaudePrompt(buildReviewPrompt(), {
    cwd: workspaceDir,
    log,
  });

  if (reviewResult.isError) {
    return {
      success: false,
      reviewText: reviewResult.result,
      needsChanges: true,
    };
  }

  if (reviewLooksGood(reviewResult.result)) {
    return {
      success: true,
      reviewText: reviewResult.result,
      needsChanges: false,
    };
  }

  log("Code review found issues. Evaluating review validity...");
  const evaluationResult = await runClaudePrompt(
    buildReviewEvaluationPrompt(reviewResult.result),
    {
      cwd: workspaceDir,
      log,
    },
  );

  if (evaluationResult.isError) {
    return {
      success: false,
      reviewText: reviewResult.result,
      needsChanges: true,
      evaluationText: evaluationResult.result,
    };
  }

  const verification = await verifyWorkspace({ workspaceDir, log });
  return {
    success: verification.success,
    reviewText: reviewResult.result,
    needsChanges: true,
    evaluationText: evaluationResult.result,
    verification,
  };
}
