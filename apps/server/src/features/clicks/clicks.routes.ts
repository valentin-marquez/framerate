import { RecordClickRequestSchema } from "@framerate/contracts";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "@/app";
import { AppError } from "@/shared/http/errors";
import { resolveClick } from "./clicks.repository";

/**
 * `/v1/clicks` (sin sesión): la web lo llama en segundo plano al abrir un link a una tienda. Como las vistas de ficha
 * (#120), va a Analytics Engine y no a D1. Punto: `index` = tienda; `blobs` = ["click", source, referrer_path];
 * `doubles` = [tienda, listing, producto] (0 si no se sabe).
 */
export const clicksRoutes = new Hono<AppEnv>().post(
  "/",
  bodyLimit({
    maxSize: 4096,
    onError: () => {
      throw new AppError(413, "payload_too_large", "Solicitud demasiado grande");
    },
  }),
  async (c) => {
    const input = RecordClickRequestSchema.parse(await c.req.json().catch(() => ({})));
    const click = await resolveClick(c.var.db, input);
    if (!click) throw new AppError(404, "store_not_found", "No encontramos la tienda de ese clic");
    c.env.ANALYTICS?.writeDataPoint({
      indexes: [String(click.storeId)],
      blobs: ["click", input.source, input.referrer_path ?? ""],
      doubles: [click.storeId, click.listingId ?? 0, click.productId ?? 0],
    });
    return c.body(null, 204);
  },
);
