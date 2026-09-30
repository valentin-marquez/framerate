import { listPendingReviews } from "@framerate/matching";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { resolveMatchReview } from "./reviews";

/** Cola de revisión humana del matching (montado bajo `/v1/admin`, protegido). */
export const matchReviewRoutes = new Hono<AppEnv>()
  .get("/reviews", async (c) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(c.req.query());
    return c.json({ items: await listPendingReviews(c.var.db, limit) });
  })
  .post("/reviews/:id/:action{accept|reject}", async (c) => {
    const { id, action } = z
      .object({ id: z.coerce.number().int().positive(), action: z.enum(["accept", "reject"]) })
      .parse(c.req.param());
    await resolveMatchReview(c.var.db, { reviewId: id, action, decidedBy: "admin", now: new Date().toISOString() });
    return c.body(null, 204);
  });
