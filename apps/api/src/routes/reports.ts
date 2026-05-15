import type { Database } from "@framerate/db";
import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware } from "@/middleware/auth";

const logger = new Logger("ReportsRoute");

const reports = new Hono<{ Bindings: Bindings; Variables: Variables }>();

reports.use("*", authMiddleware);

type ReportTargetType = Database["public"]["Enums"]["report_target_type"];
type ReportReason = Database["public"]["Enums"]["report_reason"];

const VALID_TARGET_TYPES: ReportTargetType[] = ["product", "comment", "store_review", "store"];
const VALID_REASONS: ReportReason[] = [
  "spam",
  "harassment",
  "misleading",
  "duplicate",
  "wrong_listing",
  "broken_link",
  "inappropriate",
  "other",
];

interface CreateReportBody {
  target_type?: string;
  target_id?: string;
  reason?: string;
  details?: string | null;
}

/**
 * POST /v1/reports
 *
 * Crea un nuevo reporte. RLS exige reporter_id = auth.uid() y que el
 * usuario no este baneado. Indice unique evita duplicados 'open'.
 */
reports.post("/", async (c) => {
  try {
    const user = c.get("user");
    const supabase = createSupabase(c.env, c.get("token"));
    const body = await c.req.json<CreateReportBody>();

    const targetType = body.target_type as ReportTargetType | undefined;
    const reason = body.reason as ReportReason | undefined;

    if (!targetType || !VALID_TARGET_TYPES.includes(targetType)) {
      return c.json({ error: "Invalid or missing target_type" }, 400);
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return c.json({ error: "Invalid or missing reason" }, 400);
    }
    if (!body.target_id || typeof body.target_id !== "string") {
      return c.json({ error: "Invalid or missing target_id" }, 400);
    }
    if (body.details !== undefined && body.details !== null && typeof body.details !== "string") {
      return c.json({ error: "Invalid details" }, 400);
    }
    if (typeof body.details === "string" && body.details.length > 1000) {
      return c.json({ error: "Details must be 1000 characters or fewer" }, 400);
    }

    const { data, error } = await supabase
      .from("reports")
      .insert({
        target_type: targetType,
        target_id: body.target_id,
        reason,
        details: body.details ?? null,
        reporter_id: user.id,
      })
      .select("id, target_type, target_id, reason, status, created_at")
      .single();

    if (error) {
      // Codigo 23505 = unique violation -> reporte abierto duplicado.
      if (error.code === "23505") {
        return c.json({ error: "Ya tienes un reporte abierto sobre este contenido" }, 409);
      }
      logger.error(`Failed to create report: ${error.message}`);
      return c.json({ error: "Failed to create report" }, 500);
    }

    return c.json(data, 201);
  } catch (error) {
    logger.error(`Error creating report: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/reports/my
 *
 * Lista los reportes del usuario autenticado.
 */
reports.get("/my", async (c) => {
  try {
    const user = c.get("user");
    const supabase = createSupabase(c.env, c.get("token"));

    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 100);

    const { data, error } = await supabase
      .from("reports")
      .select("id, target_type, target_id, reason, status, details, resolution_note, resolved_at, created_at")
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(`Failed to list my reports: ${error.message}`);
      return c.json({ error: "Failed to fetch reports" }, 500);
    }

    return c.json({ reports: data ?? [] });
  } catch (error) {
    logger.error(`Error fetching my reports: ${error instanceof Error ? error.message : String(error)}`);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default reports;
