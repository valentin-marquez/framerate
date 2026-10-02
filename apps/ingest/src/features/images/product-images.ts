import type { Db } from "@framerate/database";
import type { Logger } from "@framerate/kit";
import { USER_AGENT } from "@/features/ingestion/stores/http";

/** Con Cron cada 6 h, los ~4000 productos que había al estrenar esto se copian en unos 4 días. */
const BATCH = 250;
const RETRY_AFTER_MS = 86_400_000;
const MAX_BYTES = 10 * 1024 * 1024;
/** Ancho de la copia: el de la foto de la ficha. La tarjeta la muestra más chica. */
const WIDTH = 800;

type ImageExtension = "jpg" | "png" | "gif" | "webp";

/**
 * Formato según los primeros bytes. Content-Type no sirve: hay tiendas que sirven PNG como image/jpeg, o HTML con 200.
 * Lo que no es una foto se descarta antes de procesarla (cada proceso cuenta como transformación), y nunca SVG: el
 * bucket se sirve bajo framerate.cl.
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
 * binding de Images y guarda ese WebP, que cdn.framerate.cl sirve tal cual. Así cada foto cuenta una vez como
 * transformación, no cada mes que alguien la vea. Corre aparte de los crawls, de a una foto por vez, y lo que falla se
 * reintenta al día siguiente; mientras tanto la API sirve la URL de la tienda.
 */
export async function copyProductImages(
  db: Db,
  bucket: Pick<R2Bucket, "put">,
  images: Pick<ImagesBinding, "input">,
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
      key = await copyImage(bucket, images, product.image_url as string, fetchImage);
      stats.copied++;
    } catch (error) {
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
  images: Pick<ImagesBinding, "input">,
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
  const webp = await images
    .input(new Blob([original]).stream())
    .transform({ width: WIDTH, fit: "scale-down" })
    .output({ format: "image/webp", quality: 85 });
  // En bytes: R2 rechaza un stream sin largo conocido.
  await bucket.put(key, await webp.response().arrayBuffer(), {
    httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
  });
  return key;
}
