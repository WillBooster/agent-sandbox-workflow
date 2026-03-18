/** Shared domain and result types for the workflow steps. */
export interface TicketSummary {
  id: number;
  title: string;
}

export interface TicketDetail extends TicketSummary {
  body: string;
}

export interface AgentRunResult {
  result: string;
  isError: boolean;
}

export interface VerificationStepResult {
  name: string;
  skipped: boolean;
  output: string;
  isError: boolean;
}

export interface VerificationResult {
  success: boolean;
  steps: VerificationStepResult[];
}

export interface ReviewResult {
  success: boolean;
  reviewText: string;
  needsChanges: boolean;
  evaluationText?: string;
  verification?: VerificationResult;
}

export interface TicketProcessingResult {
  ticketId: number;
  success: boolean;
  attempts: number;
}
