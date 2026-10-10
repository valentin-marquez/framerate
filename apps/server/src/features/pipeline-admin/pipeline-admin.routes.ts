import { CategorySchema, PipelineEnqueueRequestSchema } from "@framerate/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { currentActor } from "@/features/identity/middleware";
import { actorLabel } from "@/features/identity/types";
import { AppError } from "@/shared/http/errors";
import { shadowReport } from "./pipeline-admin.queries";

/**
 * Administración del pipeline de normalización (#153), montado bajo `/v1/admin`, protegido. La API no toca las
 * colas: `ingest` es el productor y decide qué encolar.
 *
 *   normalize: backfill de identidades con Haiku (sin tocar vínculos; el vínculo sólo escribe `match_shadow`).
 *   relink:    aplica la sombra aprobada de una categoría (§5.4).
 */
const STAGES = {
  normalize: { stage: "normalize", reason: "backfill" },
  relink: { stage: "link", reason: "relink" },
} as const;

export const pipelineAdminRoutes = new Hono<AppEnv>()
  .post("/pipeline/:stage{normalize|relink}", async (c) => {
    const stage = c.req.param("stage") as keyof typeof STAGES;
    const body = PipelineEnqueueRequestSchema.parse(await c.req.json().catch(() => ({})));
    const result = await c.env.INGEST.enqueuePipeline({
      ...body,
      ...STAGES[stage],
      requestedBy: actorLabel(currentActor(c)),
    });
    if (!result.ok) throw new AppError(404, result.error, `Tienda desconocida: ${body.store}`);
    return c.json({ enqueued: result.enqueued }, 202);
  })
  .get("/pipeline/shadow", async (c) => {
    const { category } = z.object({ category: CategorySchema }).parse(c.req.query());
    return c.json(await shadowReport(c.var.db, category));
  });
