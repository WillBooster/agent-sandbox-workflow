/** ステップ5: チケット列に対してステップ1-4を繰り返し実行する。 */
import {
  copyWorkspaceToDist,
  ensureDir,
  initializeWorkspaceGitRepo,
} from "../services/workspace";
import { BACKLOG_BASE_URL, DEFAULT_MAX_RETRIES } from "../shared/config";
import { type LogFn, noopLog } from "../shared/logger";
import type { TicketDetail, TicketSummary } from "./fetch-ticket";
import { fetchTicketDetail, fetchTickets } from "./fetch-ticket";
import { implementTicket } from "./implement-ticket";
import { reviewWorkspace } from "./review-workspace";
import { verifyWorkspace } from "./verify-workspace";

interface ProcessTicketOptions {
  workspaceDir: string;
  log?: LogFn;
  isFirstTicket?: boolean;
  maxRetries?: number;
}

interface ProcessTicketListOptions {
  workspaceDir: string;
  distDir: string;
  log?: LogFn;
  maxRetries?: number;
}

interface ProcessBacklogTicketsOptions extends ProcessTicketListOptions {
  baseUrl?: string;
}

/** チケット処理 1 件分の結果。 */
export interface TicketProcessingResult {
  ticketId: number;
  success: boolean;
  attempts: number;
}

function formatVerificationFeedback(ticket: TicketDetail, attempt: number, output: string) {
  return [
    `Verification failed for ticket #${ticket.id} on attempt ${attempt}.`,
    "This is the exact output from the failed verification command.",
    output,
  ].join("\n\n");
}

/** ワークフロー開始前に必要なワークスペース準備をまとめて行う。 */
function prepareWorkspace(workspaceDir: string, log: LogFn): void {
  ensureDir(workspaceDir, log);
  initializeWorkspaceGitRepo(workspaceDir, log);
}

/** 1 件のチケットを実装・検証・レビューまで通して処理する。 */
export async function processSingleTicket(
  ticket: TicketDetail,
  options: ProcessTicketOptions,
): Promise<TicketProcessingResult> {
  const {
    workspaceDir,
    log = noopLog,
    isFirstTicket = false,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;
  let retryFeedback: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(
      `--- Implementation attempt ${attempt}/${maxRetries} for ticket #${ticket.id} ---`,
    );

    const implementation = await implementTicket(ticket, {
      workspaceDir,
      isFirstTicket,
      retryFeedback,
      log,
    });
    if (implementation.isError) {
      log(`Implementation agent error: ${implementation.result}`);
      continue;
    }

    const verification = await verifyWorkspace({ workspaceDir, log });
    if (!verification.success) {
      const failedStep = verification.steps.find((step) => step.isError);
      retryFeedback = failedStep
        ? formatVerificationFeedback(ticket, attempt, failedStep.output)
        : "Verification failed without command output.";
      log("Verification failed. Retrying...");
      continue;
    }

    const review = await reviewWorkspace({ workspaceDir, log });
    if (!review.success) {
      log("Review flow failed. Retrying...");
      continue;
    }

    log(`Ticket #${ticket.id} implementation completed successfully.`);
    return {
      ticketId: ticket.id,
      success: true,
      attempts: attempt,
    };
  }

  log(
    `WARNING: Ticket #${ticket.id} exceeded max retries (${maxRetries}). Moving on.`,
  );
  return {
    ticketId: ticket.id,
    success: false,
    attempts: maxRetries,
  };
}

/** 詳細取得済みチケット列に対してワークフローを繰り返し実行する。 */
export async function processTicketList(
  tickets: TicketDetail[],
  options: ProcessTicketListOptions,
): Promise<TicketProcessingResult[]> {
  const {
    workspaceDir,
    distDir,
    log = noopLog,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  prepareWorkspace(workspaceDir, log);

  const results: TicketProcessingResult[] = [];

  for (const [index, ticket] of tickets.entries()) {
    log(
      `\n========== Processing Ticket #${ticket.id}: ${ticket.title} ==========`,
    );

    const result = await processSingleTicket(ticket, {
      workspaceDir,
      log,
      isFirstTicket: index === 0,
      maxRetries,
    });
    results.push(result);

    copyWorkspaceToDist(workspaceDir, distDir, log);
    log(`========== Ticket #${ticket.id} done ==========\n`);
  }

  return results;
}

/** バックログからチケットを取得し、全件にワークフローを適用する。 */
export async function processBacklogTickets(
  options: ProcessBacklogTicketsOptions,
): Promise<TicketProcessingResult[]> {
  const {
    baseUrl = BACKLOG_BASE_URL,
    workspaceDir,
    distDir,
    log = noopLog,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  const summaries: TicketSummary[] = await fetchTickets(baseUrl, log);
  const results: TicketProcessingResult[] = [];

  prepareWorkspace(workspaceDir, log);

  for (const [index, summary] of summaries.entries()) {
    log(
      `\n========== Processing Ticket #${summary.id}: ${summary.title} ==========`,
    );

    const ticket = await fetchTicketDetail(summary.id, baseUrl, log);
    const result = await processSingleTicket(ticket, {
      workspaceDir,
      log,
      isFirstTicket: index === 0,
      maxRetries,
    });
    results.push(result);

    copyWorkspaceToDist(workspaceDir, distDir, log);
    log(`========== Ticket #${summary.id} done ==========\n`);
  }

  return results;
}
