import type { Database } from "@framerate/db";
import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware, requireRole } from "@/middleware/auth";
import { Limit } from "@/middleware/rate-limit";

const logger = new Logger("AdminSupportRoute");

type SupportStatus = Database["public"]["Enums"]["support_status"];

const VALID_STATUSES: SupportStatus[] = ["open", "in_progress", "waiting_user", "resolved", "closed"];

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

admin.use("*", Limit("moderate"), authMiddleware, requireRole("moderator"));

/**
 * GET /v1/admin/support/tickets?status=&limit=
 */
admin.get("/tickets", async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const status = c.req.query("status") as SupportStatus | undefined;
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 200);

    let query = supabase
      .from("support_tickets")
      .select(
        "id, user_id, email, category, subject, status, assigned_to, source, created_at, updated_at, last_message_at",
      )
      .order("last_message_at", { ascending: false })
      .limit(limit);

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return c.json({ error: "Status inválido" }, 400);
      }
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      logger.error(`list tickets failed: ${error.message}`);
      return c.json({ error: "No pudimos cargar tickets" }, 500);
    }

    return c.json({ tickets: data ?? [] });
  } catch (error) {
    logger.error(`list error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/admin/support/tickets/:id
 *
 * Devuelve ticket completo + todos los mensajes (incluidas notas internas).
 */
admin.get("/tickets/:id", async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const ticketId = c.req.param("id");

    const { data: ticket, error: ticketErr } = await supabase
      .from("support_tickets")
      .select(
        "id, user_id, email, category, subject, body, status, assigned_to, source, created_at, updated_at, last_message_at",
      )
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
      logger.error(`get messages failed: ${msgsErr.message}`);
      return c.json({ error: "Error" }, 500);
    }

    return c.json({ ticket, messages: messages ?? [] });
  } catch (error) {
    logger.error(`get error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

interface ReplyBody {
  body?: string;
  is_internal_note?: boolean;
}

/**
 * POST /v1/admin/support/tickets/:id/reply
 *
 * Staff responde. is_internal_note=true crea una nota privada visible sólo a otros mods/admins.
 */
admin.post("/tickets/:id/reply", async (c) => {
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

    const isInternal = body.is_internal_note === true;

    const { data, error } = await supabase
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticketId,
        author_id: user.id,
        author_role: "staff",
        body: text,
        is_internal_note: isInternal,
      })
      .select("id, author_id, author_role, body, is_internal_note, created_at")
      .single();

    if (error) {
      logger.error(`staff reply failed: ${error.message}`);
      return c.json({ error: "No pudimos enviar la respuesta" }, 500);
    }

    return c.json(data, 201);
  } catch (error) {
    logger.error(`reply error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

interface UpdateStatusBody {
  status?: string;
  assign_to_self?: boolean;
}

/**
 * PATCH /v1/admin/support/tickets/:id
 *
 * Cambia status y/o asigna el ticket al staff actual.
 */
admin.patch("/tickets/:id", async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const user = c.get("user");
    const ticketId = c.req.param("id");
    const body = await c.req.json<UpdateStatusBody>();

    const updates: { status?: SupportStatus; assigned_to?: string } = {};

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status as SupportStatus)) {
        return c.json({ error: "Status inválido" }, 400);
      }
      updates.status = body.status as SupportStatus;
    }

    if (body.assign_to_self === true) {
      updates.assigned_to = user.id;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "Sin cambios" }, 400);
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .update(updates)
      .eq("id", ticketId)
      .select("id, status, assigned_to, updated_at")
      .single();

    if (error) {
      logger.error(`update ticket failed: ${error.message}`);
      return c.json({ error: "No pudimos actualizar el ticket" }, 500);
    }

    return c.json(data);
  } catch (error) {
    logger.error(`update error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default admin;
