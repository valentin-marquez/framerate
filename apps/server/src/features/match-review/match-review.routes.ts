import { RevertAiRequestSchema } from "@framerate/contracts";
import { listPendingReviews, revertAiDecisions } from "@framerate/matching";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { currentActor } from "@/features/identity/middleware";
import { actorLabel } from "@/features/identity/types";
import { mergeProductPair, resolveMatchReview, splitListing } from "./reviews";

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
    await resolveMatchReview(c.var.db, {
      reviewId: id,
      action,
      decidedBy: actorLabel(currentActor(c)),
      now: new Date().toISOString(),
    });
    return c.body(null, 204);
  })
  .post("/listings/:id/split", async (c) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(c.req.param());
    return c.json(
      await splitListing(c.var.db, {
        listingId: id,
        decidedBy: actorLabel(currentActor(c)),
        now: new Date().toISOString(),
      }),
    );
  })
  .post("/products/:a/merge/:b", async (c) => {
    const { a, b } = z
      .object({ a: z.coerce.number().int().positive(), b: z.coerce.number().int().positive() })
      .parse(c.req.param());
    return c.json(
      await mergeProductPair(c.var.db, { a, b, decidedBy: actorLabel(currentActor(c)), now: new Date().toISOString() }),
    );
  })
  .post("/match-reviews/revert-ai", async (c) => {
    const body = RevertAiRequestSchema.parse(await c.req.json().catch(() => ({})));
    return c.json(
      await revertAiDecisions(c.var.db, {
        ...body,
        decidedBy: actorLabel(currentActor(c)),
        now: new Date().toISOString(),
      }),
    );
  });
