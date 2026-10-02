import type { AdminTicket, SupportCategory, SupportStatus, Ticket, TicketMessage } from "@framerate/contracts";
import { type Db, type SupportMessagesTable, type SupportTicketsTable, toBool } from "@framerate/database";
import type { Selectable } from "kysely";
import { newPublicId } from "@/shared/public-id";

export type TicketRow = Selectable<SupportTicketsTable>;
type MessageRow = Selectable<SupportMessagesTable>;

/** Crea el ticket y su primer mensaje en un solo batch. Devuelve el `public_id`. */
export async function createTicket(
  db: Db,
  input: {
    userId: string | null;
    email: string;
    category: SupportCategory;
    subject: string;
    body: string;
    accessTokenHash: string | null;
    source: "web" | "email";
    messageId?: string | null;
    now: string;
  },
) {
  const insert = async (publicId: string) => {
    await db.batch([
      db.query.insertInto("support_tickets").values({
        public_id: publicId,
        user_id: input.userId,
        email: input.email,
        category: input.category,
        subject: input.subject,
        access_token_hash: input.accessTokenHash,
        source: input.source,
        created_at: input.now,
        updated_at: input.now,
        last_message_at: input.now,
      }),
      db.query.insertInto("support_messages").values({
        ticket_id: db.query.selectFrom("support_tickets").select("id").where("public_id", "=", publicId),
        author_id: input.userId,
        author_role: "user",
        body: input.body,
        message_id: input.messageId ?? null,
        created_at: input.now,
      }),
    ]);
    return publicId;
  };
  // 30^8 combinaciones: un choque del UNIQUE es rarísimo y basta un reintento.
  return insert(newPublicId()).catch((error: Error) => {
    if (!error.message.includes("UNIQUE") || error.message.includes("message_id")) throw error;
    return insert(newPublicId());
  });
}

export const findTicket = (db: Db, publicId: string) =>
  db.query.selectFrom("support_tickets").selectAll().where("public_id", "=", publicId).executeTakeFirst();

/** El ticket de alguno de estos Message-ID (In-Reply-To y References de un correo que responde). */
export const findTicketByMessageIds = (db: Db, messageIds: string[]) =>
  db.query
    .selectFrom("support_tickets as t")
    .innerJoin("support_messages as m", "m.ticket_id", "t.id")
    .selectAll("t")
    .where("m.message_id", "in", messageIds)
    .executeTakeFirst();

export const messageIdExists = async (db: Db, messageId: string) =>
  !!(await db.query.selectFrom("support_messages").select("id").where("message_id", "=", messageId).executeTakeFirst());

export const setMessageId = (db: Db, id: number, messageId: string) =>
  db.query.updateTable("support_messages").set({ message_id: messageId }).where("id", "=", id).execute();

/** Tickets que abrió por correo esta dirección desde `since` (límite contra spam). */
export const countEmailTicketsSince = async (db: Db, email: string, since: string) =>
  Number(
    (
      await db.query
        .selectFrom("support_tickets")
        .select((eb) => eb.fn.countAll<number>().as("n"))
        .where("email", "=", email)
        .where("source", "=", "email")
        .where("created_at", ">", since)
        .executeTakeFirstOrThrow()
    ).n,
  );

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
    messageId?: string | null;
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
      message_id: message.messageId ?? null,
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
