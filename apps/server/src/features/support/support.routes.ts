import {
  type CreatedTicket,
  CreateTicketRequestSchema,
  ReplyRequestSchema,
  type TicketDetail,
  type TicketMessage,
} from "@framerate/contracts";
import { ticketReceivedEmail } from "@framerate/emails";
import { type Context, Hono } from "hono";
import type { AppEnv } from "@/app";
import { currentUser } from "@/features/identity/middleware";
import { sendEmailInBackground } from "@/shared/email";
import { AppError } from "@/shared/http/errors";
import { timingSafeEqual } from "@/shared/http/middleware";
import {
  addMessage,
  createTicket,
  findTicket,
  listMessages,
  listTicketsOf,
  setStatus,
  toMessage,
  toTicket,
} from "./support.repository";

/**
 * Tickets para quien escribe (se monta bajo `optionalUser`): con sesión, o sin cuenta con el token que recibió una
 * sola vez al crear el ticket. Un usuario sancionado igual puede escribir: puede querer apelar.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

async function verifyTurnstile(c: Context<AppEnv>, secret: string, token: string | undefined) {
  if (token) {
    const form = new URLSearchParams({ secret, response: token });
    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-client-ip");
    if (ip) form.set("remoteip", ip);
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
    const result = (await res.json().catch(() => ({}))) as { success?: boolean };
    if (result.success) return;
  }
  throw new AppError(400, "turnstile_failed", "No pudimos verificar que no eres un robot; intenta de nuevo");
}

/** Sin acceso responde 404, igual que si no existiera: no revela qué tickets hay. */
async function accessibleTicket(c: Context<AppEnv>, token: string | undefined) {
  const ticket = await findTicket(c.var.db, c.req.param("id") ?? "");
  const user = c.get("user");
  if (ticket?.user_id && ticket.user_id === user?.id) return ticket;
  if (ticket?.access_token_hash && token && (await timingSafeEqual(await sha256(token), ticket.access_token_hash))) {
    return ticket;
  }
  throw new AppError(404, "ticket_not_found", "Ticket no encontrado");
}

export const supportRoutes = new Hono<AppEnv>()
  .post("/tickets", async (c) => {
    const input = CreateTicketRequestSchema.parse(await c.req.json().catch(() => ({})));
    const user = c.get("user");
    let email: string;
    let accessToken: string | null = null;
    if (user) email = user.email;
    else {
      const secret = c.env.TURNSTILE_SECRET_KEY;
      if (!secret) {
        throw new AppError(
          503,
          "support_unavailable",
          "El soporte sin cuenta no está disponible; escríbenos a soporte@framerate.cl",
        );
      }
      if (!input.email) throw new AppError(400, "invalid_request", "Indica tu correo para poder responderte");
      await verifyTurnstile(c, secret, input.turnstileToken);
      email = input.email;
      accessToken = hex(crypto.getRandomValues(new Uint8Array(32)));
    }

    const now = new Date().toISOString();
    const publicId = await createTicket(c.var.db, {
      userId: user?.id ?? null,
      email,
      category: input.category,
      subject: input.subject,
      body: input.body,
      accessTokenHash: accessToken ? await sha256(accessToken) : null,
      source: "web",
      now,
    });

    sendEmailInBackground(
      c,
      email,
      ticketReceivedEmail({
        ticketId: publicId,
        subject: input.subject,
        category: input.category,
        message: input.body,
        channel: accessToken
          ? { kind: "anonymous", trackingUrl: `${c.env.WEB_ORIGIN}/soporte/${publicId}?t=${accessToken}` }
          : { kind: "account" },
        baseUrl: c.env.WEB_ORIGIN,
      }),
    );

    return c.json<CreatedTicket>(
      {
        id: publicId,
        category: input.category,
        subject: input.subject,
        status: "open",
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        accessToken,
      },
      201,
    );
  })

  .get("/tickets/mine", async (c) =>
    c.json({ items: (await listTicketsOf(c.var.db, currentUser(c).id)).map(toTicket) }),
  )

  .get("/tickets/:id", async (c) => {
    const ticket = await accessibleTicket(c, c.req.query("token"));
    const messages = await listMessages(c.var.db, ticket.id, false);
    return c.json<TicketDetail>({ ...toTicket(ticket), messages: messages.map(toMessage) });
  })

  .post("/tickets/:id/reply", async (c) => {
    const { body, token } = ReplyRequestSchema.parse(await c.req.json().catch(() => ({})));
    const ticket = await accessibleTicket(c, token);
    if (ticket.status === "closed") {
      throw new AppError(409, "ticket_closed", "Este ticket está cerrado; abre uno nuevo si necesitas ayuda");
    }
    const message = await addMessage(c.var.db, {
      ticketId: ticket.id,
      authorId: c.get("user")?.id ?? null,
      authorRole: "user",
      body,
      isInternal: false,
    });
    if (ticket.status === "waiting_user" || ticket.status === "resolved") await setStatus(c.var.db, ticket.id, "open");
    return c.json<TicketMessage>(toMessage(message), 201);
  });
