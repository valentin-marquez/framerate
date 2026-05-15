import type { Database } from "@framerate/db";
import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware, requireRole } from "@/middleware/auth";
import { Limit } from "@/middleware/rate-limit";

const logger = new Logger("AdminModerationRoute");

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Todas las rutas requieren autenticacion + rol minimo de moderator.
admin.use("*", Limit("moderate"), authMiddleware, requireRole("moderator"));

type ReportStatus = Database["public"]["Enums"]["report_status"];

const VALID_STATUSES: ReportStatus[] = ["open", "reviewing", "resolved", "dismissed"];
const VALID_DECISIONS: ReportStatus[] = ["reviewing", "resolved", "dismissed"];

/**
 * GET /v1/admin/moderation/queue
 *
 * Devuelve el proximo item de la cola pgmq de moderacion.
 */
admin.get("/queue", async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const { data, error } = await supabase.rpc("get_next_mod_item");

    if (error) {
      logger.error(`get_next_mod_item failed: ${error.message}`);
      return c.json({ error: "Failed to fetch queue item" }, 500);
    }

    const item = Array.isArray(data) ? data[0] : null;
    return c.json({ item: item ?? null });
  } catch (error) {
    logger.error(`queue error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

interface ResolveBody {
  msg_id?: number;
  report_id?: string;
  decision?: string;
  note?: string | null;
}

/**
 * POST /v1/admin/moderation/resolve
 *
 * Resuelve un report (decision: 'resolved' | 'dismissed' | 'reviewing').
 */
admin.post("/resolve", async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const body = await c.req.json<ResolveBody>();

    if (typeof body.msg_id !== "number") {
      return c.json({ error: "msg_id required (number)" }, 400);
    }
    if (!body.report_id || typeof body.report_id !== "string") {
      return c.json({ error: "report_id required" }, 400);
    }
    if (!body.decision || !VALID_DECISIONS.includes(body.decision as ReportStatus)) {
      return c.json({ error: `decision must be one of ${VALID_DECISIONS.join(", ")}` }, 400);
    }

    const { error } = await supabase.rpc("resolve_mod_report", {
      p_msg_id: body.msg_id,
      p_report_id: body.report_id,
      p_decision: body.decision,
      p_note: body.note ?? undefined,
    });

    if (error) {
      logger.error(`resolve_mod_report failed: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error(`resolve error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/admin/moderation/reports?status=open&limit=50
 *
 * Lista de reports filtrable. Solo accesible para mods/admins.
 */
admin.get("/reports", async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const status = c.req.query("status") as ReportStatus | undefined;
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 200);

    let query = supabase
      .from("reports")
      .select(
        "id, target_type, target_id, reason, details, status, reporter_id, resolved_by, resolved_at, resolution_note, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return c.json({ error: "Invalid status" }, 400);
      }
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      logger.error(`list reports failed: ${error.message}`);
      return c.json({ error: "Failed to fetch reports" }, 500);
    }

    return c.json({ reports: data ?? [] });
  } catch (error) {
    logger.error(`list reports error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

interface FlagBody {
  product_id?: string;
  reason?: string | null;
}

/**
 * POST /v1/admin/moderation/flag-product
 *
 * Marca un producto para re-scrapeo por el collector.
 */
admin.post("/flag-product", async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const body = await c.req.json<FlagBody>();

    if (!body.product_id || typeof body.product_id !== "string") {
      return c.json({ error: "product_id required" }, 400);
    }

    const { data, error } = await supabase.rpc("flag_product_for_recheck", {
      p_product_id: body.product_id,
      p_reason: body.reason ?? undefined,
    });

    if (error) {
      logger.error(`flag_product_for_recheck failed: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ recheck_id: data });
  } catch (error) {
    logger.error(`flag-product error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/admin/moderation/mod-actions?actor_id=&target_type=&limit=
 *
 * Audit log read-only.
 */
admin.get("/mod-actions", async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const actorId = c.req.query("actor_id");
    const targetType = c.req.query("target_type");
    const targetId = c.req.query("target_id");
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 200);

    let query = supabase
      .from("mod_actions")
      .select("id, actor_id, action, target_type, target_id, reason, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (actorId) query = query.eq("actor_id", actorId);
    if (targetType) query = query.eq("target_type", targetType);
    if (targetId) query = query.eq("target_id", targetId);

    const { data, error } = await query;
    if (error) {
      logger.error(`list mod-actions failed: ${error.message}`);
      return c.json({ error: "Failed to fetch mod actions" }, 500);
    }

    return c.json({ actions: data ?? [] });
  } catch (error) {
    logger.error(`mod-actions error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

interface BanBody {
  user_id?: string;
  reason?: string | null;
  expires_at?: string | null;
}

/**
 * POST /v1/admin/moderation/ban  (admin only)
 */
admin.post("/ban", requireRole("admin"), async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const body = await c.req.json<BanBody>();

    if (!body.user_id || typeof body.user_id !== "string") {
      return c.json({ error: "user_id required" }, 400);
    }

    const { data, error } = await supabase.rpc("admin_ban_user", {
      p_user_id: body.user_id,
      p_reason: body.reason ?? undefined,
      p_expires_at: body.expires_at ?? undefined,
    });

    if (error) {
      logger.error(`admin_ban_user failed: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ ban_id: data });
  } catch (error) {
    logger.error(`ban error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

interface UnbanBody {
  user_id?: string;
}

/**
 * POST /v1/admin/moderation/unban  (admin only)
 */
admin.post("/unban", requireRole("admin"), async (c) => {
  try {
    const supabase = createSupabase(c.env, c.get("token"));
    const body = await c.req.json<UnbanBody>();

    if (!body.user_id || typeof body.user_id !== "string") {
      return c.json({ error: "user_id required" }, 400);
    }

    const { error } = await supabase.rpc("admin_unban_user", {
      p_user_id: body.user_id,
    });

    if (error) {
      logger.error(`admin_unban_user failed: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error(`unban error: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default admin;
