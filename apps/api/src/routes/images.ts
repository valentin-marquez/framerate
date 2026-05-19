/**
 * @module images
 *
 * @remarks
 * Este módulo expone una ruta para servir imágenes directamente desde el almacenamiento de Supabase,
 * construyendo la URL de acceso público a partir de la ruta solicitada por el usuario.
 *
 * Esta implementación actúa como CDN proxy aprovechando el cache de Cloudflare Workers
 * para mejorar significativamente el rendimiento (LCP) de la aplicación.
 *
 * @reason
 * - Control de headers de caché y CORS
 * - Caché en edge de Cloudflare (Cache API)
 * - No exponer directamente la URL de Supabase al cliente
 * - URLs más cortas y portables para el frontend
 */
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";

const images = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Tiempo de caché: 1 año para imágenes inmutables
const CACHE_TTL = 31536000;

// Allowed image extensions for security
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"]);

images.get("/*", async (c) => {
  // Handle /v1/images/bucket/file.jpg or /images/bucket/file.jpg
  const parts = c.req.path.split("/images/");
  const path = parts.length > 1 ? parts[1] : null;

  // Security: Validate path
  if (!path || path.includes("..") || path.startsWith("/")) {
    return c.text("Invalid image path", 400);
  }

  // El path puede traer un cache-buster (?v=timestamp) cuando el dueño
  // reemplaza un asset reutilizando el mismo nombre de objeto. La query
  // participa de la cacheKey (busta el cache de Cloudflare) pero NO debe
  // contar para validar la extensión ni al pedir el objeto a Storage.
  const cleanPath = path.split("?")[0];

  // Security: Validate file extension
  const extension = cleanPath.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return c.text("Invalid file type", 400);
  }

  const supabaseUrl = c.env.SUPABASE_URL || Bun.env.SUPABASE_URL;

  if (!supabaseUrl) {
    console.error("SUPABASE_URL is not defined");
    return c.text("Internal Server Error", 500);
  }

  // Try Cloudflare Cache first
  // @ts-expect-error - caches.default is Cloudflare Workers specific
  const cache = caches.default as Cache;
  const cacheKey = new Request(c.req.url, c.req.raw);

  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const headers = new Headers(cachedResponse.headers);
      headers.set("X-Cache", "HIT");
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        headers,
      });
    }
  } catch {
    // Cache miss or error, continue to fetch
  }

  // Construye la URL pública al archivo en Supabase Storage (sin el
  // cache-buster: Storage sirve por nombre de objeto, no por query).
  const storageUrl = `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;

  try {
    // Fetch with Cloudflare caching hints
    const response = await fetch(storageUrl, {
      cf: {
        cacheTtl: CACHE_TTL,
        cacheEverything: true,
      },
    });

    if (!response.ok) {
      return c.text("Image not found", 404);
    }

    // Determine content type
    const contentType = response.headers.get("Content-Type") || `image/${extension}`;

    // Build optimized headers
    const newHeaders = new Headers();
    newHeaders.set("Content-Type", contentType);
    newHeaders.set("Cache-Control", `public, max-age=${CACHE_TTL}, immutable`);
    newHeaders.set("CDN-Cache-Control", `public, max-age=${CACHE_TTL}`);
    newHeaders.set("X-Cache", "MISS");
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD");
    newHeaders.set("Access-Control-Allow-Headers", "Content-Type");
    newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
    newHeaders.set("Timing-Allow-Origin", "*");

    // Clone response for caching
    const responseBody = await response.arrayBuffer();

    const cachedResponse = new Response(responseBody, {
      status: response.status,
      headers: newHeaders,
    });

    // Store in Cloudflare Cache (non-blocking)
    c.executionCtx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));

    return cachedResponse;
  } catch (error) {
    console.error("Error fetching image:", error);
    return c.text("Internal Server Error", 500);
  }
});

export default images;
