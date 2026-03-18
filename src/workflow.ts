import { fetchTicketDetail, fetchTickets } from "./backlog";
import { BACKLOG_BASE_URL, DEFAULT_MAX_RETRIES } from "./config";
import { implementTicket } from "./implement-ticket";
import { type LogFn, noopLog } from "./logger";
import { reviewWorkspace } from "./review-workspace";
import type {
  TicketDetail,
  TicketProcessingResult,
  TicketSummary,
} from "./types";
import { verifyWorkspace } from "./verify-workspace";
import {
  copyWorkspaceToDist,
  ensureDir,
  initializeWorkspaceGitRepo,
} from "./workspace";

interface ProcessTicketOptions {
  workspaceDir: string;
  log?: LogFn;
  isFirstTicket?: boolean;
  maxRetries?: number;
}

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

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(
      `--- Implementation attempt ${attempt}/${maxRetries} for ticket #${ticket.id} ---`,
    );

    const implementation = await implementTicket(ticket, {
      workspaceDir,
      isFirstTicket,
      log,
    });
    if (implementation.isError) {
      log(`Implementation agent error: ${implementation.result}`);
      continue;
    }

    const verification = await verifyWorkspace({ workspaceDir, log });
    if (!verification.success) {
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

interface ProcessTicketListOptions {
  workspaceDir: string;
  distDir: string;
  log?: LogFn;
  maxRetries?: number;
}

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

  ensureDir(workspaceDir, log);
  initializeWorkspaceGitRepo(workspaceDir, log);

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

interface ProcessBacklogTicketsOptions extends ProcessTicketListOptions {
  baseUrl?: string;
}

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

  ensureDir(workspaceDir, log);
  initializeWorkspaceGitRepo(workspaceDir, log);

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
