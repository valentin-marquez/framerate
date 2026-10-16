import type { Db } from "@framerate/database";
import { imageVariant, type Logger } from "@framerate/kit";
import { USER_AGENT } from "@/features/ingestion/stores/http";

/** Con Cron cada 6 h, los ~4000 productos que había al estrenar esto se copian en unos 4 días. */
const BATCH = 250;
const RETRY_AFTER_MS = 86_400_000;
const MAX_BYTES = 10 * 1024 * 1024;
/** La copia base es la de la ficha; la de 400 px, la de tarjetas y listas (cubre pantallas de densidad 2). */
const WIDTH = 800;
const SMALL = 400;
const PUT_OPTIONS = {
  httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
};

/** Achica una foto a WebP del ancho dado (el resizer del servidor propio, #170). */
export type Resize = (image: Uint8Array, width: number) => Promise<ArrayBuffer>;

/** El resizer no respondió: la culpa no es de la foto, así que no se marca como fallida y se corta la corrida. */
export class ResizerDown extends Error {}

export function resizerClient(baseUrl: string, token: string, fetchImpl: typeof fetch = fetch): Resize {
  return async (image, width) => {
    const res = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/resize?w=${width}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
      body: image,
      signal: AbortSignal.timeout(30_000),
    }).catch((error) => {
      throw new ResizerDown(String(error));
    });
    // 422: la foto no se pudo leer (culpa de la foto). Lo demás es del resizer.
    if (res.status === 422) throw new Error(`resizer: ${await res.text()}`);
    if (!res.ok) throw new ResizerDown(`resizer: HTTP ${res.status}`);
    return res.arrayBuffer();
  };
}

type ImageExtension = "jpg" | "png" | "gif" | "webp";

/**
 * Formato según los primeros bytes. Content-Type no sirve: hay tiendas que sirven PNG como image/jpeg, o HTML con 200.
 * Lo que no es una foto se descarta antes de mandarla al resizer, y nunca SVG: el bucket se sirve bajo framerate.cl.
 */
export function imageExtension(b: Uint8Array): ImageExtension | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/** Clave por la foto original: la misma foto da la misma clave (idempotente, se comparte entre productos). */
export async function productImageKey(original: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", original));
  const hex = Array.from(digest.subarray(0, 16), (x) => x.toString(16).padStart(2, "0")).join("");
  return `products/${hex}.webp`;
}

/**
 * Copia a R2 la foto de los productos que todavía no tienen copia propia (`image_key`): la achica una sola vez con el
 * resizer, a 800 y 400 px, y cdn.framerate.cl sirve esos WebP tal cual. `image_key` se marca sólo con las dos
 * guardadas, así la web puede pedir la de 400 sin preguntar. Corre aparte de los crawls, de a una foto por vez, y lo
 * que falla (también el resizer caído) se reintenta al día siguiente; mientras tanto la API sirve la URL de la tienda.
 */
export async function copyProductImages(
  db: Db,
  bucket: Pick<R2Bucket, "put">,
  resize: Resize,
  now: string,
  log: Logger,
  fetchImage: typeof fetch = fetch,
) {
  const retryBefore = new Date(Date.parse(now) - RETRY_AFTER_MS).toISOString();
  const pending = await db.query
    .selectFrom("products")
    .select(["id", "image_url"])
    .where("image_key", "is", null)
    .where("image_url", "is not", null)
    .where((eb) => eb.or([eb("image_checked_at", "is", null), eb("image_checked_at", "<", retryBefore)]))
    // NULL primero: lo nuevo antes que los reintentos.
    .orderBy("image_checked_at")
    .orderBy("id")
    .limit(BATCH)
    .execute();

  const stats = { copied: 0, failed: 0 };
  for (const product of pending) {
    let key: string | null = null;
    try {
      key = await copyImage(bucket, resize, product.image_url as string, fetchImage);
      stats.copied++;
    } catch (error) {
      if (error instanceof ResizerDown) {
        log.error("images.resizer_down", { error });
        break;
      }
      stats.failed++;
      log.warn("images.copy_failed", { productId: product.id, url: product.image_url, error });
    }
    await db.query
      .updateTable("products")
      .set({ image_key: key, image_checked_at: now })
      .where("id", "=", product.id)
      .execute();
  }
  return stats;
}

async function copyImage(
  bucket: Pick<R2Bucket, "put">,
  resize: Resize,
  url: string,
  fetchImage: typeof fetch,
): Promise<string> {
  const res = await fetchImage(url, {
    // Sin image/avif: algunas CDN de tiendas negocian el formato y Images no siempre lo acepta como entrada.
    headers: { "User-Agent": USER_AGENT, Accept: "image/webp,image/*;q=0.8" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (Number(res.headers.get("content-length")) > MAX_BYTES) throw new Error("imagen demasiado grande");
  const original = new Uint8Array(await res.arrayBuffer());
  if (original.byteLength > MAX_BYTES) throw new Error("imagen demasiado grande");
  if (!imageExtension(original)) throw new Error("no es JPEG, PNG, GIF ni WebP");

  const key = await productImageKey(original);
  await bucket.put(key, await resize(original, WIDTH), PUT_OPTIONS);
  await bucket.put(imageVariant(key, SMALL), await resize(original, SMALL), PUT_OPTIONS);
  return key;
}

/**
 * Relleno de la variante de 400 px para las copias guardadas antes de #170 (sólo la de 800): lista el bucket, achica
 * la de 800 de las que no la tienen y la guarda. Sin estado: cuando ya están todas, sólo lista.
 */
export async function addSmallVariants(bucket: Pick<R2Bucket, "list" | "get" | "put">, resize: Resize, log: Logger) {
  const keys = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: "products/", cursor });
    for (const object of page.objects) keys.add(object.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const missing = [...keys].filter((key) => imageVariant(key, SMALL) !== key && !keys.has(imageVariant(key, SMALL)));
  const stats = { added: 0, failed: 0, remaining: Math.max(0, missing.length - BATCH) };
  for (const key of missing.slice(0, BATCH)) {
    try {
      const base = await bucket.get(key);
      if (!base) continue;
      await bucket.put(
        imageVariant(key, SMALL),
        await resize(new Uint8Array(await base.arrayBuffer()), SMALL),
        PUT_OPTIONS,
      );
      stats.added++;
    } catch (error) {
      if (error instanceof ResizerDown) {
        log.error("images.resizer_down", { error });
        break;
      }
      stats.failed++;
      log.warn("images.variant_failed", { key, error });
    }
  }
  return stats;
}
