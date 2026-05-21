/**
 * Backfill de tarjetas Open Graph para productos ya existentes.
 *
 * Rationale:
 *   `collector` genera la tarjeta OG sólo al dar de alta una imagen nueva
 *   (ver `uploadProductImage` en `src/lib/storage.ts`). Los productos que ya
 *   tenían imagen antes de esa feature no la tienen. Este script las genera
 *   para todo el catálogo.
 *
 * Comportamiento:
 *   - Lista las tarjetas OG ya presentes en `product-images/og/` y las saltea
 *     (idempotente: re-ejecutar sólo procesa lo que falta).
 *   - Para cada producto con `image_url` + `mpn`, baja la imagen AVIF de
 *     Storage (`sharp` decodifica AVIF nativamente), compone la tarjeta y la
 *     sube a `product-images/og/<filename>.png`.
 *   - El nombre del archivo OG se deriva del filename de `image_url` (ya
 *     sanitizado) para garantizar que coincida con lo que espera `web`
 *     (`getProductOgImage` en `apps/web/app/shared/utils/images.ts`).
 *
 * Uso (desde la raíz del repo):
 *   bun run --cwd apps/collector backfill:og-cards          # dry-run
 *   bun run --cwd apps/collector backfill:og-cards --apply  # genera y sube
 *
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el env (las mismas
 * variables que consume `src/lib/supabase.ts`).
 */

import { StorageBuckets } from "@framerate/db";
import { Logger } from "@/lib/logger";
import { renderProductOgCard } from "@/lib/og-card";
import { supabase } from "@/lib/supabase";

const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 6;
const logger = new Logger("backfill-og-cards");

interface ProductRow {
  name: string;
  mpn: string | null;
  image_url: string | null;
}

/** Extrae el filename (último segmento) de una URL o ruta de imagen. */
function imageFilename(imageUrl: string): string {
  return imageUrl.split("?")[0].split("/").pop() ?? imageUrl;
}

/** Lista todas las tarjetas OG ya presentes en `product-images/og/`. */
async function listExistingOgCards(): Promise<Set<string>> {
  const existing = new Set<string>();
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(StorageBuckets.PRODUCT_IMAGES)
      .list("og", { limit: pageSize, offset });

    if (error) throw new Error(`Storage list failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const file of data) existing.add(file.name);
    if (data.length < pageSize) break;
  }
  return existing;
}

/** Lee todas las filas de `products` con imagen y MPN, paginando. */
async function listProducts(): Promise<ProductRow[]> {
  const rows: ProductRow[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("name, mpn, image_url")
      .not("image_url", "is", null)
      .not("mpn", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Products query failed: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as ProductRow[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

/** Genera y sube la tarjeta OG de un producto. Devuelve true si tuvo éxito. */
async function processProduct(product: ProductRow): Promise<boolean> {
  const sourceFile = imageFilename(product.image_url ?? "");
  const ogFile = sourceFile.replace(/\.[a-z0-9]+$/i, ".png");

  const { data: blob, error: downloadError } = await supabase.storage
    .from(StorageBuckets.PRODUCT_IMAGES)
    .download(sourceFile);

  if (downloadError || !blob) {
    logger.warn(`Skip ${product.name}: download failed (${downloadError?.message ?? "no data"})`);
    return false;
  }

  const card = await renderProductOgCard({
    productName: product.name,
    photo: Buffer.from(await blob.arrayBuffer()),
  });

  const { error: uploadError } = await supabase.storage
    .from(StorageBuckets.PRODUCT_IMAGES)
    .upload(`og/${ogFile}`, card, { contentType: "image/png", upsert: true });

  if (uploadError) {
    logger.warn(`Skip ${product.name}: upload failed (${uploadError.message})`);
    return false;
  }

  logger.info(`OG card → og/${ogFile}`);
  return true;
}

async function main(): Promise<void> {
  logger.info(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const [existing, products] = await Promise.all([listExistingOgCards(), listProducts()]);
  logger.info(`Catalog: ${products.length} products with image · ${existing.size} OG cards already present`);

  const pending = products.filter((p) => {
    const ogFile = imageFilename(p.image_url ?? "").replace(/\.[a-z0-9]+$/i, ".png");
    return !existing.has(ogFile);
  });
  logger.info(`Pending: ${pending.length} OG cards to generate`);

  if (!APPLY) {
    logger.info("Dry-run — no writes. Re-run with --apply to generate and upload.");
    return;
  }

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((p) => processProduct(p).catch(() => false)));
    for (const r of results) r ? ok++ : failed++;
    logger.info(`Progress: ${ok + failed}/${pending.length} (${ok} ok, ${failed} failed)`);
  }

  logger.info(`Done. ${ok} OG cards generated, ${failed} failed.`);
}

main().catch((err) => {
  logger.error("Backfill failed:", String(err));
  process.exit(1);
});
