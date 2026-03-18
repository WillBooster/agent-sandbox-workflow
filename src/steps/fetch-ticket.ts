/** Step 1: fetches ticket data from the backlog endpoint. */
import { BACKLOG_BASE_URL } from "../shared/config";
import { type LogFn, noopLog } from "../shared/logger";
import type { TicketDetail, TicketSummary } from "../shared/types";

/** Fetches the available ticket summaries from the backlog API. */
export async function fetchTickets(
  baseUrl = BACKLOG_BASE_URL,
  log: LogFn = noopLog,
): Promise<TicketSummary[]> {
  const url = `${baseUrl}/api/tickets.json`;
  log(`Fetching ticket list from ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch tickets: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { tickets: TicketSummary[] };
  log(`Found ${data.tickets.length} ticket(s)`);
  return data.tickets;
}

/** Fetches the full detail for a single backlog ticket. */
export async function fetchTicketDetail(
  id: number,
  baseUrl = BACKLOG_BASE_URL,
  log: LogFn = noopLog,
): Promise<TicketDetail> {
  const url = `${baseUrl}/api/tickets/${id}.json`;
  log(`Fetching detail for ticket #${id} from ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ticket #${id}: ${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as TicketDetail;
  log(`Ticket #${id}: ${data.title}`);
  return data;
}
