import {
  AdminReplyRequestSchema,
  type AdminTicket,
  type AdminTicketDetail,
  AdminUpdateTicketRequestSchema,
  hasRole,
  SupportStatusSchema,
  type TeamMember,
  type TicketMessage,
} from "@framerate/contracts";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { findUserById } from "@/features/identity/identity.repository";
import { currentActor } from "@/features/identity/middleware";
import { actorUserId } from "@/features/identity/types";
import { sendEmailInBackground } from "@/shared/email";
import { AppError } from "@/shared/http/errors";
import {
  addMessage,
  findTicket,
  listMessages,
  listTickets,
  setMessageId,
  setStatus,
  type TicketRow,
  toAdminTicket,
  toMessage,
} from "./support.repository";

/** Bandeja de soporte del personal (montado bajo `/v1/admin/support`). Ve también las notas internas. */

async function ticketOr404(c: Context<AppEnv>) {
  const ticket = await findTicket(c.var.db, c.req.param("id") ?? "");
  if (!ticket) throw new AppError(404, "ticket_not_found", "Ticket no encontrado");
  return ticket;
}

// El enlace con token sólo va en el primer correo: en la base queda su hash, así que al anónimo se le escribe sin enlace.
const ticketEmailProps = (c: Context<AppEnv>, ticket: TicketRow) => ({
  ticketId: ticket.public_id,
  subject: ticket.subject,
  channel: ticket.user_id ? ({ kind: "account" } as const) : ({ kind: "email" } as const),
  baseUrl: c.env.WEB_ORIGIN,
});

export const supportAdminRoutes = new Hono<AppEnv>()
  .get("/team", async (c) => {
    const rows = await c.var.db.query
      .selectFrom("users")
      .select(["id", "display_name"])
      .where("role", "!=", "user")
      .where("deleted_at", "is", null)
      .orderBy("display_name")
      .execute();
    return c.json<{ items: TeamMember[] }>({ items: rows.map((r) => ({ id: r.id, displayName: r.display_name })) });
  })

  .get("/tickets", async (c) => {
    const filter = z
      .object({ status: SupportStatusSchema.optional(), limit: z.coerce.number().int().min(1).max(200).default(50) })
      .parse(c.req.query());
    return c.json({ items: (await listTickets(c.var.db, filter)).map(toAdminTicket) });
  })

  .get("/tickets/:id", async (c) => {
    const ticket = await ticketOr404(c);
    const messages = await listMessages(c.var.db, ticket.id, true);
    return c.json<AdminTicketDetail>({ ...toAdminTicket(ticket), messages: messages.map(toMessage) });
  })

  .patch("/tickets/:id", async (c) => {
    const input = AdminUpdateTicketRequestSchema.parse(await c.req.json().catch(() => ({})));
    const ticket = await ticketOr404(c);
    if (input.assignedTo) {
      const assignee = await findUserById(c.var.db, input.assignedTo);
      if (!assignee || !hasRole(assignee.role, "support")) {
        throw new AppError(400, "invalid_assignee", "Sólo se asigna a alguien del equipo");
      }
    }
    const updated = await c.var.db.query
      .updateTable("support_tickets")
      .set({
        updated_at: new Date().toISOString(),
        ...(input.status && {
          status: input.status,
          closed_at: input.status === "closed" ? (ticket.closed_at ?? new Date().toISOString()) : null,
        }),
        ...(input.assignedTo !== undefined && { assigned_to: input.assignedTo }),
      })
      .where("id", "=", ticket.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    const { status } = updated;
    if ((status === "resolved" || status === "closed") && status !== ticket.status) {
      sendEmailInBackground(c, ticket.email, (t) => t.ticketClosedEmail({ ...ticketEmailProps(c, ticket), status }));
    }
    return c.json<AdminTicket>(toAdminTicket(updated));
  })

  .post("/tickets/:id/reply", async (c) => {
    const actor = currentActor(c);
    const { body, isInternal } = AdminReplyRequestSchema.parse(await c.req.json().catch(() => ({})));
    const ticket = await ticketOr404(c);
    const message = await addMessage(c.var.db, {
      ticketId: ticket.id,
      authorId: actorUserId(actor),
      authorRole: "staff",
      body,
      isInternal,
    });
    if (!isInternal) {
      const status = ticket.status === "open" || ticket.status === "in_progress" ? "waiting_user" : ticket.status;
      if (status !== ticket.status) await setStatus(c.var.db, ticket.id, status);
      sendEmailInBackground(
        c,
        ticket.email,
        (t) =>
          t.ticketReplyEmail({
            ...ticketEmailProps(c, ticket),
            staffName: actor.kind === "user" ? actor.user.displayName : null,
            reply: body,
            status,
          }),
        // Si la persona responde a este correo, su In-Reply-To apunta a este Message-ID (#69).
        (messageId) => setMessageId(c.var.db, message.id, messageId),
      );
    }
    return c.json<TicketMessage>(toMessage(message), 201);
  });
