import { runClaudePrompt } from "./claude";
import { type LogFn, noopLog } from "./logger";
import { buildReviewEvaluationPrompt, buildReviewPrompt } from "./prompts";
import type { ReviewResult } from "./types";
import { verifyWorkspace } from "./verify-workspace";

function reviewLooksGood(reviewText: string): boolean {
  const normalized = reviewText.toUpperCase();
  return normalized.includes("LGTM") || normalized.includes("LOOKS GOOD");
}

interface ReviewWorkspaceOptions {
  workspaceDir: string;
  log?: LogFn;
}

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
