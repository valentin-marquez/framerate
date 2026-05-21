import { client as createDbClient, type Database } from "@framerate/db";
import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { notifyNewSupportTicket } from "@/lib/discord-webhook";
import { createSupabase } from "@/lib/supabase";
import { verifyTurnstile } from "@/lib/turnstile";
import { authMiddleware } from "@/middleware/auth";
import { Limit } from "@/middleware/rate-limit";

const logger = new Logger("SupportRoute");

type SupportCategory = Database["public"]["Enums"]["support_category"];

const VALID_CATEGORIES: SupportCategory[] = [
  "privacy",
  "data_request",
  "abuse_report",
  "store_issue",
  "bug",
  "feature",
  "other",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const support = new Hono<{ Bindings: Bindings; Variables: Variables }>();

interface CreateTicketBody {
  category?: string;
  subject?: string;
  body?: string;
  /** Email obligatorio si el usuario no está autenticado. */
  email?: string;
  /** Turnstile token obligatorio para anon. */
  turnstile_token?: string;
}

function validateCommonFields(body: CreateTicketBody) {
  const category = body.category as SupportCategory | undefined;
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return { error: "Categoría inválida" as const };
  }
  if (!body.subject || typeof body.subject !== "string") {
    return { error: "Falta asunto" as const };
  }
  const subject = body.subject.trim();
  if (subject.length < 3 || subject.length > 200) {
    return { error: "Asunto debe tener entre 3 y 200 caracteres" as const };
  }
  if (!body.body || typeof body.body !== "string") {
    return { error: "Falta mensaje" as const };
  }
  const messageBody = body.body.trim();
  if (messageBody.length < 10 || messageBody.length > 5000) {
    return { error: "Mensaje debe tener entre 10 y 5000 caracteres" as const };
  }
  return { ok: true as const, category, subject, body: messageBody };
}

/**
 * POST /v1/support/tickets
 *
 * Crea un ticket. Si trae Authorization válido, queda vinculado al user_id.
 * Si no, exige turnstile_token + email y se inserta via service role.
 */
support.post("/tickets", Limit("strict"), async (c) => {
  try {
    const body = await c.req.json<CreateTicketBody>();
    const validated = validateCommonFields(body);
    if ("error" in validated) return c.json({ error: validated.error }, 400);

    const { category, subject, body: messageBody } = validated;
    const authHeader = c.req.header("Authorization");

    // ---- Autenticado ----
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const supabase = createSupabase(c.env);
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser(token);

      if (userErr || !user) {
        return c.json({ error: "Token inválido o expirado" }, 401);
      }

      const userSupabase = createSupabase(c.env, token);
      const { data, error } = await userSupabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          email: user.email ?? "no-email@unknown.local",
          category,
          subject,
          body: messageBody,
          source: "web",
        })
        .select("id, category, subject, status, created_at")
        .single();

      if (error) {
        logger.error(`insert ticket (auth) failed: ${error.message}`);
        return c.json({ error: "No pudimos crear el ticket" }, 500);
      }

      // Notificación Discord best-effort, no bloqueante.
      c.executionCtx?.waitUntil?.(
        notifyNewSupportTicket(c.env.DISCORD_SUPPORT_WEBHOOK_URL, c.env.DISCORD_SUPPORT_PING_USER_ID, {
          ticketId: data.id,
          category,
          subject,
          body: messageBody,
          email: user.email ?? "(sin email)",
          userId: user.id,
          source: "authenticated",
        }),
      );

      return c.json(data, 201);
    }

    // ---- Anónimo ----
    if (!body.email || typeof body.email !== "string" || !EMAIL_RE.test(body.email)) {
      return c.json({ error: "Email inválido" }, 400);
    }
    const email = body.email.trim().toLowerCase();
    if (email.length > 320) {
      return c.json({ error: "Email demasiado largo" }, 400);
    }

    const remoteIp = c.req.header("cf-connecting-ip") ?? null;
    const turnstileResult = await verifyTurnstile(c.env.TURNSTILE_SECRET_KEY, body.turnstile_token, remoteIp);
    if (!turnstileResult.ok) {
      return c.json({ error: turnstileResult.reason }, 400);
    }

    if (!c.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error("SUPABASE_SERVICE_ROLE_KEY missing — anon ticket flow not configured");
      return c.json({ error: "Flujo de tickets anónimos no configurado" }, 503);
    }

    const serviceClient = createDbClient({
      url: c.env.SUPABASE_URL,
      key: c.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    const { data: ticketId, error: rpcError } = await serviceClient.rpc("create_support_ticket_anonymous", {
      p_email: email,
      p_category: category,
      p_subject: subject,
      p_body: messageBody,
    });

    if (rpcError || !ticketId) {
      logger.error(`create_support_ticket_anonymous failed: ${rpcError?.message ?? "no id returned"}`);
      return c.json({ error: "No pudimos crear el ticket" }, 500);
    }

    c.executionCtx?.waitUntil?.(
      notifyNewSupportTicket(c.env.DISCORD_SUPPORT_WEBHOOK_URL, c.env.DISCORD_SUPPORT_PING_USER_ID, {
        ticketId,
        category,
        subject,
        body: messageBody,
        email,
        userId: null,
        source: "anonymous",
      }),
    );

    return c.json({ id: ticketId, category, subject, status: "open" }, 201);
  } catch (error) {
    logger.error(`Error creating ticket: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/support/tickets/mine
 *
 * Lista los tickets del usuario autenticado.
 */
support.get("/tickets/mine", Limit("lenient"), authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const supabase = createSupabase(c.env, c.get("token"));
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 100);

    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, category, subject, status, created_at, updated_at, last_message_at")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(`list mine tickets failed: ${error.message}`);
      return c.json({ error: "No pudimos cargar tus tickets" }, 500);
    }

    return c.json({ tickets: data ?? [] });
  } catch (error) {
    logger.error(`mine tickets error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/support/tickets/:id
 *
 * Devuelve un ticket (con sus mensajes no internos) del usuario.
 * RLS hace el filtrado real.
 */
support.get("/tickets/:id", Limit("lenient"), authMiddleware, async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const ticketId = c.req.param("id");

    const { data: ticket, error: ticketErr } = await supabase
      .from("support_tickets")
      .select("id, user_id, category, subject, body, status, created_at, updated_at, last_message_at")
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketErr) {
      logger.error(`get ticket failed: ${ticketErr.message}`);
      return c.json({ error: "Error" }, 500);
    }
    if (!ticket) return c.json({ error: "Ticket no encontrado" }, 404);

    const { data: messages, error: msgsErr } = await supabase
      .from("support_ticket_messages")
      .select("id, author_id, author_role, body, is_internal_note, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (msgsErr) {
      logger.error(`get ticket messages failed: ${msgsErr.message}`);
      return c.json({ error: "Error" }, 500);
    }

    return c.json({ ticket, messages: messages ?? [] });
  } catch (error) {
    logger.error(`get ticket error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

interface ReplyBody {
  body?: string;
}

/**
 * POST /v1/support/tickets/:id/reply
 *
 * El usuario dueño del ticket responde. RLS verifica ownership + status abierto.
 */
support.post("/tickets/:id/reply", Limit("moderate"), authMiddleware, async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const user = c.get("user");
    const ticketId = c.req.param("id");
    const body = await c.req.json<ReplyBody>();

    if (!body.body || typeof body.body !== "string") {
      return c.json({ error: "Falta mensaje" }, 400);
    }
    const text = body.body.trim();
    if (text.length < 1 || text.length > 5000) {
      return c.json({ error: "Mensaje debe tener entre 1 y 5000 caracteres" }, 400);
    }

    const { data, error } = await supabase
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticketId,
        author_id: user.id,
        author_role: "user",
        body: text,
        is_internal_note: false,
      })
      .select("id, body, author_role, created_at")
      .single();

    if (error) {
      logger.error(`user reply failed: ${error.message}`);
      // RLS bloquea si el ticket no es tuyo o está cerrado.
      return c.json({ error: "No pudimos enviar tu respuesta" }, 403);
    }

    return c.json(data, 201);
  } catch (error) {
    logger.error(`reply error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default support;
