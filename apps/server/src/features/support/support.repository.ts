import type { AdminTicket, SupportStatus, Ticket, TicketMessage } from "@framerate/contracts";
import { type Db, type SupportMessagesTable, type SupportTicketsTable, toBool } from "@framerate/database";
import type { Selectable } from "kysely";

export type TicketRow = Selectable<SupportTicketsTable>;
type MessageRow = Selectable<SupportMessagesTable>;

export const findTicket = (db: Db, publicId: string) =>
  db.query.selectFrom("support_tickets").selectAll().where("public_id", "=", publicId).executeTakeFirst();

export const listTicketsOf = (db: Db, userId: string) =>
  db.query
    .selectFrom("support_tickets")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("last_message_at", "desc")
    .limit(50)
    .execute();

export function listTickets(db: Db, filter: { status?: SupportStatus; limit: number }) {
  let query = db.query.selectFrom("support_tickets").selectAll().orderBy("last_message_at", "desc").limit(filter.limit);
  if (filter.status) query = query.where("status", "=", filter.status);
  return query.execute();
}

export function listMessages(db: Db, ticketId: number, includeInternal: boolean) {
  let query = db.query
    .selectFrom("support_messages")
    .selectAll()
    .where("ticket_id", "=", ticketId)
    .orderBy("created_at")
    .orderBy("id");
  if (!includeInternal) query = query.where("is_internal", "=", 0);
  return query.execute();
}

export const addMessage = (
  db: Db,
  message: {
    ticketId: number;
    authorId: string | null;
    authorRole: "user" | "staff";
    body: string;
    isInternal: boolean;
  },
) =>
  db.query
    .insertInto("support_messages")
    .values({
      ticket_id: message.ticketId,
      author_id: message.authorId,
      author_role: message.authorRole,
      body: message.body,
      is_internal: message.isInternal ? 1 : 0,
      created_at: new Date().toISOString(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

export const setStatus = (db: Db, ticketId: number, status: SupportStatus) =>
  db.query
    .updateTable("support_tickets")
    .set({ status, updated_at: new Date().toISOString() })
    .where("id", "=", ticketId)
    .execute();

export const toTicket = (row: TicketRow): Ticket => ({
  id: row.public_id,
  category: row.category,
  subject: row.subject,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastMessageAt: row.last_message_at,
});

export const toAdminTicket = (row: TicketRow): AdminTicket => ({
  ...toTicket(row),
  email: row.email,
  userId: row.user_id,
  assignedTo: row.assigned_to,
  source: row.source,
});

export const toMessage = (row: MessageRow): TicketMessage => ({
  id: row.id,
  authorRole: row.author_role,
  body: row.body,
  isInternal: toBool(row.is_internal),
  createdAt: row.created_at,
});
