import { CategorySchema } from "@framerate/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { listQuarantine, listRuns } from "./ingestion.repository";
import { enqueueAllCrawls } from "./runtime";
import { findStore } from "./stores/registry";

/** Administración de la ingesta (montado bajo `/v1/admin`, protegido). */
export const ingestionAdminRoutes = new Hono<AppEnv>()
  .post("/crawls", async (c) => {
    const body = z
      .object({ store: z.string().optional(), category: CategorySchema.optional() })
      .parse(await c.req.json().catch(() => ({})));
    if (body.store && !findStore(body.store)) {
      return c.json({ error: { code: "unknown_store", message: `Tienda desconocida: ${body.store}` } }, 400);
    }
    const enqueued = await enqueueAllCrawls(c.env, "admin", body);
    return c.json({ enqueued }, 202);
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
