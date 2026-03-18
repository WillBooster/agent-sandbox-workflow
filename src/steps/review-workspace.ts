/** ステップ4: 実装内容をレビューし、必要なら是正する。 */
import { runClaudePrompt } from "../services/claude-code";
import { type LogFn, noopLog } from "../shared/logger";
import type { VerificationResult } from "./verify-workspace";
import { verifyWorkspace } from "./verify-workspace";

interface ReviewWorkspaceOptions {
  workspaceDir: string;
  log?: LogFn;
}

/** レビュー結果が実質的に承認かどうかを判定する。 */
function reviewLooksGood(reviewText: string): boolean {
  const normalized = reviewText.toUpperCase();
  return normalized.includes("LGTM") || normalized.includes("LOOKS GOOD");
}

/** 読み取り専用のコードレビュー用プロンプトを組み立てる。 */
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

/** レビュー指摘の妥当性評価と反映用プロンプトを組み立てる。 */
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

/** レビューフローを実行し、変更が入った場合は再検証する。 */
export interface ReviewResult {
  success: boolean;
  reviewText: string;
  needsChanges: boolean;
  evaluationText?: string;
  verification?: VerificationResult;
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
