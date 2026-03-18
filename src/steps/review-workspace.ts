/** ステップ4: 実装内容をレビューし、必要なら是正する。 */
import { runClaudePrompt } from "../services/claude-code";
import { type LogFn, noopLog } from "../shared/logger";
import type { TicketDetail } from "./fetch-ticket";
import type { VerificationResult } from "./verify-workspace";
import { verifyWorkspace } from "./verify-workspace";

interface ReviewWorkspaceOptions {
  ticket: TicketDetail;
  workspaceDir: string;
  log?: LogFn;
}

/** レビュー結果が実質的に承認かどうかを判定する。 */
function reviewLooksGood(reviewText: string): boolean {
  const normalized = reviewText.toUpperCase();
  return normalized.includes("LGTM") || normalized.includes("LOOKS GOOD");
}

/** レビュー結果に修正要求マーカーが含まれるか判定する。 */
function reviewRequiresChanges(reviewText: string): boolean {
  return reviewText.includes("！要修正！");
}

/** 読み取り専用のコードレビュー用プロンプトを組み立てる。 */
export function buildReviewPrompt(ticket: TicketDetail): string {
  return `You are a code reviewer. Review the code in this project for:
- Correctness and potential bugs
- Code quality and readability
- Security issues
- Test coverage

You are working independently from the implementation agent and do not share context with it beyond the ticket below.

Ticket ID: ${ticket.id}
Title: ${ticket.title}
Description:
${ticket.body}

Read the source files and test files in this directory in light of the ticket above, then provide your review.
If there are any issues that require code changes, include "！要修正！" at the beginning of your review and then clearly state what needs to be fixed.
If everything looks good, say "LGTM" (Looks Good To Me).
Use Sonnet, not Opus. Do NOT use any git commands. Do NOT modify any files.`;
}

/** 独立した修正エージェント向けに、レビュー指摘の妥当性評価と反映用プロンプトを組み立てる。 */
export function buildReviewEvaluationPrompt(reviewText: string): string {
  return `You are a remediation agent working independently from the reviewer.
You do not share context with the reviewer. The only review context you may use is the review text below.

A code review was performed on this project. Here is the review:

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
  const { ticket, workspaceDir, log = noopLog } = options;

  log("Running code review...");
  const reviewResult = await runClaudePrompt(buildReviewPrompt(ticket), {
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

  if (!reviewRequiresChanges(reviewResult.result)) {
    return {
      success: true,
      reviewText: reviewResult.result,
      needsChanges: false,
    };
  }

  log("Code review found issues. Starting an independent remediation agent...");
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
