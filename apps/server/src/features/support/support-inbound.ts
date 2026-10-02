import { createDb } from "@framerate/database";
import { createLogger } from "@framerate/kit";
import PostalMime from "postal-mime";
import type { Env } from "@/env";
import { findUserByEmail } from "@/features/identity/identity.repository";
import { sendEmail } from "@/shared/email";
import {
  addMessage,
  countEmailTicketsSince,
  createTicket,
  findTicket,
  findTicketByMessageIds,
  messageIdExists,
  setStatus,
} from "./support.repository";

/**
 * Correo que llega a soporte@framerate.cl (Email Routing → este handler). Si responde a un ticket de la misma
 * dirección, se suma a su hilo; si no, abre un ticket nuevo con `source = 'email'`. Lo que no se puede autenticar,
 * las respuestas automáticas y el exceso de tickets nuevos se descartan en silencio (sin rebote: no da pistas a un
 * spammer ni arma loops).
 */

const log = createLogger({ feature: "support-inbound" });
const TICKET_TAG = /\[Framerate #([A-Z0-9]{8})\]/;
const NEW_TICKETS_PER_HOUR = 5;

const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase();

/**
 * Email Routing deja en ARC-Authentication-Results lo que verificó. Vale si pasa DMARC (el dominio del From está
 * autenticado) o si el sobre es del mismo dominio que el From y pasa SPF o DKIM. Así nadie escribe a nombre de otra
 * dirección para meterse en su ticket o en su cuenta.
 */
function isAuthentic(message: ForwardableEmailMessage, from: string) {
  const results = `${message.headers.get("arc-authentication-results") ?? ""} ${message.headers.get("authentication-results") ?? ""}`;
  const passed = (check: string) => new RegExp(`\\b${check}=pass\\b`, "i").test(results);
  return passed("dmarc") || (domainOf(message.from) === domainOf(from) && (passed("spf") || passed("dkim")));
}

// Lo citado del correo anterior no se guarda: el hilo ya lo tiene.
const QUOTE_MARKERS = [
  /\n[^\n]*\b(?:El|On)\b[^\n]*\n?[^\n]*(?:escribió|wrote):\s*\n/i,
  /\n-{2,}\s*(?:Mensaje original|Original Message)\s*-{2,}/i,
  /\n(?:De|From):\s.*\n(?:Enviado|Sent|Fecha|Date):/i,
  /\n>/,
];

/** El texto propio del correo, sin lo citado ni firmas largas: máximo 5000 caracteres, como cualquier mensaje. */
export function messageBody(text: string) {
  const normalized = `\n${text.replace(/\r\n/g, "\n")}`;
  const cut = Math.min(...QUOTE_MARKERS.map((marker) => normalized.search(marker)).filter((i) => i >= 0));
  const own = normalized.slice(0, Number.isFinite(cut) ? cut : undefined).trim();
  return (own || normalized.trim()).slice(0, 5000) || "(Correo sin texto)";
}

const plainSubject = (subject: string | undefined) => {
  const clean = (subject ?? "").replace(TICKET_TAG, "").trim().slice(0, 200);
  return clean.length >= 3 ? clean : "Mensaje por correo";
};

export async function receiveSupportEmail(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
  const parsed = await PostalMime.parse(await new Response(message.raw).arrayBuffer());
  const from = (parsed.from?.address ?? message.from).toLowerCase();
  const autoSubmitted = message.headers.get("auto-submitted");

  if (domainOf(from) === "framerate.cl" || (autoSubmitted && autoSubmitted.toLowerCase() !== "no")) {
    log.info("email_ignored", { reason: "automatic" });
    return;
  }
  if (!isAuthentic(message, from)) {
    log.warn("email_dropped", { reason: "not_authentic", fromDomain: domainOf(from) });
    return;
  }

  const db = createDb(env.DB);
  const messageId = parsed.messageId ?? null;
  if (messageId && (await messageIdExists(db, messageId))) return;

  const text = parsed.text ?? (parsed.html ?? "").replace(/<[^>]+>/g, " ");
  const body = messageBody(text);
  const now = new Date().toISOString();

  const tag = parsed.subject?.match(TICKET_TAG)?.[1];
  const references = [parsed.inReplyTo, ...(parsed.references ?? "").split(/\s+/)].filter((id): id is string => !!id);
  const existing =
    (tag ? await findTicket(db, tag) : undefined) ??
    (references.length > 0 ? await findTicketByMessageIds(db, references) : undefined);

  // Sólo quien abrió el ticket escribe en él; un ticket cerrado no se reabre por correo: va uno nuevo.
  if (existing && existing.email.toLowerCase() === from && existing.status !== "closed") {
    await addMessage(db, {
      ticketId: existing.id,
      authorId: existing.user_id,
      authorRole: "user",
      body,
      isInternal: false,
      messageId,
    });
    if (existing.status === "waiting_user" || existing.status === "resolved") {
      await setStatus(db, existing.id, "open");
    }
    log.info("email_appended", { ticketId: existing.public_id });
    return;
  }

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  if ((await countEmailTicketsSince(db, from, hourAgo)) >= NEW_TICKETS_PER_HOUR) {
    log.warn("email_dropped", { reason: "rate_limited", fromDomain: domainOf(from) });
    return;
  }

  const user = await findUserByEmail(db, from);
  const subject = plainSubject(parsed.subject);
  const ticketId = await createTicket(db, {
    userId: user?.id ?? null,
    email: from,
    category: "other",
    subject,
    body,
    accessTokenHash: null,
    source: "email",
    messageId,
    now,
  });
  log.info("email_ticket_created", { ticketId });

  ctx.waitUntil(
    sendEmail(env, from, (t) =>
      t.ticketReceivedEmail({
        ticketId,
        subject,
        category: "other",
        message: body,
        channel: user ? { kind: "account" } : { kind: "email" },
        baseUrl: env.WEB_ORIGIN,
      }),
    ),
  );
}
