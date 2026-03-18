/** ステップ1: バックログ API からチケット情報を取得する。 */
import { BACKLOG_BASE_URL } from "../shared/config";
import { type LogFn, noopLog } from "../shared/logger";

/** チケット一覧向けの要約情報。 */
export interface TicketSummary {
  id: number;
  title: string;
}

/** チケット 1 件分の詳細情報。 */
export interface TicketDetail extends TicketSummary {
  body: string;
}

/** バックログ API からチケット一覧を取得する。 */
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

/** バックログ API から 1 件分のチケット詳細を取得する。 */
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
