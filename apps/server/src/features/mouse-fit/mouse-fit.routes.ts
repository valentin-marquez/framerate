import { HandSchema, MouseFitReportRequestSchema } from "@framerate/contracts";
import { Hono } from "hono";
import type { AppEnv } from "@/app";
import { currentUser } from "@/features/identity/middleware";
import { AppError } from "@/shared/http/errors";
import { verifyTurnstile } from "@/shared/http/turnstile";

/** `/v1/me/hand`: las medidas de la mano de quien tiene cuenta. */
export const handProfileRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const row = await c.var.db.query
      .selectFrom("hand_profiles")
      .select(["length_mm", "width_mm", "grip"])
      .where("user_id", "=", currentUser(c).id)
      .executeTakeFirst();
    return c.json({ hand: row ?? null });
  })
  .put("/", async (c) => {
    const hand = HandSchema.parse(await c.req.json().catch(() => ({})));
    const row = { ...hand, updated_at: new Date().toISOString() };
    await c.var.db.query
      .insertInto("hand_profiles")
      .values({ user_id: currentUser(c).id, ...row })
      .onConflict((oc) => oc.column("user_id").doUpdateSet(row))
      .execute();
    return c.json({ hand });
  })
  .delete("/", async (c) => {
    await c.var.db.query.deleteFrom("hand_profiles").where("user_id", "=", currentUser(c).id).execute();
    return c.body(null, 204);
  });

/**
 * `/v1/mouse-fit`: casos de calibración. Turnstile para todos y sin leer la sesión: el endpoint no sabe quién llama, y
 * una cuenta (aunque esté baneada) no puede saltarse la verificación para sesgar la calibración.
 */
export const mouseFitRoutes = new Hono<AppEnv>().post("/reports", async (c) => {
  const input = MouseFitReportRequestSchema.parse(await c.req.json().catch(() => ({})));
  const secret = c.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new AppError(503, "mouse_fit_unavailable", "Esto no está disponible por ahora");
  await verifyTurnstile(c, secret, input.turnstileToken);
  const product = await c.var.db.query
    .selectFrom("products")
    .select("id")
    .where("slug", "=", input.product_slug)
    .where("category", "=", "mouse")
    .executeTakeFirst();
  if (!product) throw new AppError(404, "mouse_not_found", "No encontramos ese mouse");
  await c.var.db.query
    .insertInto("mouse_fit_reports")
    .values({
      hand_length_mm: input.length_mm,
      hand_width_mm: input.width_mm,
      grip: input.grip,
      product_id: product.id,
      fit: input.fit,
      reported_on: new Date().toISOString().slice(0, 10),
    })
    .execute();
  return c.body(null, 204);
});
