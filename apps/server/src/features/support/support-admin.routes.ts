import {
  AdminReplyRequestSchema,
  type AdminTicket,
  type AdminTicketDetail,
  AdminUpdateTicketRequestSchema,
  SupportStatusSchema,
  type TicketMessage,
} from "@framerate/contracts";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { currentActor } from "@/features/identity/middleware";
import { actorUserId } from "@/features/identity/types";
import { AppError } from "@/shared/http/errors";
import {
  addMessage,
  findTicket,
  listMessages,
  listTickets,
  setStatus,
  toAdminTicket,
  toMessage,
} from "./support.repository";

/** Bandeja de soporte del personal (montado bajo `/v1/admin/support`). Ve también las notas internas. */

async function ticketOr404(c: Context<AppEnv>) {
  const ticket = await findTicket(c.var.db, c.req.param("id") ?? "");
  if (!ticket) throw new AppError(404, "ticket_not_found", "Ticket no encontrado");
  return ticket;
}

export const supportAdminRoutes = new Hono<AppEnv>()
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
    const actor = currentActor(c);
    const input = AdminUpdateTicketRequestSchema.parse(await c.req.json().catch(() => ({})));
    const ticket = await ticketOr404(c);
    if (input.assignToSelf && actor.kind === "token") {
      throw new AppError(400, "cannot_assign_token", "El token de servicio no puede asignarse tickets");
    }
    const updated = await c.var.db.query
      .updateTable("support_tickets")
      .set({
        updated_at: new Date().toISOString(),
        ...(input.status && {
          status: input.status,
          closed_at: input.status === "closed" ? (ticket.closed_at ?? new Date().toISOString()) : null,
        }),
        ...(input.assignToSelf !== undefined && { assigned_to: input.assignToSelf ? actorUserId(actor) : null }),
      })
      .where("id", "=", ticket.id)
      .returningAll()
      .executeTakeFirstOrThrow();
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
    if (!isInternal && (ticket.status === "open" || ticket.status === "in_progress")) {
      await setStatus(c.var.db, ticket.id, "waiting_user");
    }
    return c.json<TicketMessage>(toMessage(message), 201);
  });
