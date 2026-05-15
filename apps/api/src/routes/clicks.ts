import { Logger } from "@framerate/utils";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { Limit } from "@/middleware/rate-limit";

const clicks = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const logger = new Logger("ClicksRoute");

interface ClickPayload {
  source?: unknown;
  target_url?: unknown;
  referrer_path?: unknown;
  listing_id?: unknown;
  store_id?: unknown;
  product_id?: unknown;
}

const SOURCE_MAX = 64;
const URL_MAX = 2048;
const PATH_MAX = 512;
const UA_MAX = 512;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

function asUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return UUID_RE.test(value) ? value : null;
}

/**
 * POST /v1/clicks
 *
 * Registra un click saliente hacia una tienda externa. Pensado para invocarse
 * con `fetch(..., { keepalive: true })` desde el click handler del cliente —
 * NO bloquea la apertura del target. Devuelve 204 No Content si todo OK.
 *
 * Auth opcional: si llega `Authorization: Bearer <jwt>`, se intenta extraer el
 * `user_id`. Si no, la fila se registra como anónima (user_id = null).
 *
 * El payload es untrusted: el origen es el navegador del usuario, así que
 * cualquier campo puede ser falsificado. Se valida que tenga forma correcta
 * pero NO se cruza contra integridad referencial — Postgres lo hace via FK
 * y los IDs inválidos se setean a null por el ON DELETE SET NULL.
 */
clicks.post("/", Limit("lenient"), async (c) => {
  let body: ClickPayload;
  try {
    body = (await c.req.json()) as ClickPayload;
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const source = asText(body.source, SOURCE_MAX);
  const targetUrl = asText(body.target_url, URL_MAX);

  if (!source || !targetUrl) {
    return c.json({ error: "Missing source or target_url" }, 400);
  }

  // El target_url debe ser http(s). Bloquea esquemas raros (javascript:, data:, etc.)
  if (!/^https?:\/\//i.test(targetUrl)) {
    return c.json({ error: "Invalid target_url scheme" }, 400);
  }

  const referrerPath = asText(body.referrer_path, PATH_MAX);
  const listingId = asUuid(body.listing_id);
  const storeId = asUuid(body.store_id);
  const productId = asUuid(body.product_id);
  const userAgent = asText(c.req.header("User-Agent"), UA_MAX);

  // user_id opcional: extraemos del bearer si viene y es válido.
  let userId: string | null = null;
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const supabase = createSupabase(c.env);
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        userId = data.user.id;
      }
    } catch {
      // Token inválido o expirado: tratamos el click como anónimo.
    }
  }

  const supabase = createSupabase(c.env);
  const { error: insertError } = await supabase.from("outbound_clicks").insert({
    user_id: userId,
    listing_id: listingId,
    store_id: storeId,
    product_id: productId,
    source,
    target_url: targetUrl,
    referrer_path: referrerPath,
    user_agent: userAgent,
  });

  if (insertError) {
    logger.warn(`clicks: insert failed: ${insertError.message}`);
    return c.json({ error: "Failed to record click" }, 500);
  }

  return c.body(null, 204);
});

export default clicks;
