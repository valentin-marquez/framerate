import { CategorySchema } from "@framerate/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { currentActor } from "@/features/identity/middleware";
import { actorLabel } from "@/features/identity/types";
import { AppError } from "@/shared/http/errors";
import { listQuarantine, listRuns } from "./crawl-admin.queries";

/** Administración de la ingesta (montado bajo `/v1/admin`, protegido). */
export const crawlAdminRoutes = new Hono<AppEnv>()
  .post("/crawls", async (c) => {
    const body = z
      .object({ store: z.string().optional(), category: CategorySchema.optional() })
      .parse(await c.req.json().catch(() => ({})));
    // La API no conoce las tiendas ni la cola: `ingest` valida y encola.
    const result = await c.env.INGEST.enqueueCrawls({ ...body, requestedBy: actorLabel(currentActor(c)) });
    if (!result.ok) throw new AppError(400, result.error, `Tienda desconocida: ${body.store}`);
    return c.json({ enqueued: result.enqueued }, 202);
  })
  .get("/crawls", async (c) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(c.req.query());
    return c.json({ items: await listRuns(c.var.db, limit) });
  })
  .get("/quarantine", async (c) => {
    const query = z
      .object({ runId: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(100) })
      .parse(c.req.query());
    return c.json({ items: await listQuarantine(c.var.db, query) });
  });
