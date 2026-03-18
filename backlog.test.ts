import { expect, test } from "bun:test";
import { fetchTicketDetail } from "./src/backlog";

test("step 1: fetches a ticket detail from backlog", async () => {
  const ticket = await fetchTicketDetail(1);

  expect(ticket.id).toBe(1);
  expect(ticket.title.length).toBeGreaterThan(0);
  expect(ticket.body.length).toBeGreaterThan(0);
}, 30_000);
