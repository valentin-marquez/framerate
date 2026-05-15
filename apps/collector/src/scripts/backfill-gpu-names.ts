/**
 * Backfill: corregir nombres y slugs de GPUs cuyo "<n>GB" en el `name` no
 * coincide con `specs.memory_gb`.
 *
 * Origen del bug: el normalizer regex de GPU mal-extraía la capacidad VRAM
 * desde el título de la tienda (e.g. "ASUS Dual RTX 5070 70GB OC" cuando la
 * GPU real es 12GB). El normalizer ya está corregido por otro agente, pero las
 * filas previas quedaron persistidas con el nombre y el slug malos.
 *
 * El script:
 *   1. Lee la categoría "tarjetas-de-video" desde la DB (slug dinámico).
 *   2. Trae todos los productos de esa categoría con `specs.memory_gb`.
 *   3. Compara el GB del `name` (regex) contra `specs.memory_gb`.
 *   4. Si difieren y `specs.memory_gb` es un número > 0:
 *      - Reemplaza el primer "<n>GB" del nombre por "<memory_gb>GB".
 *      - Regenera el slug a partir del nombre corregido + timestamp.
 *      - Imprime una tabla dry-run.
 *      - Con --apply, hace el UPDATE en Postgres.
 *
 * Idempotente: re-ejecutar después de aplicar no produce nuevos cambios
 * porque el nombre ya está consistente con `specs.memory_gb`.
 *
 * Uso:
 *   bun run --cwd apps/collector src/scripts/backfill-gpu-names.ts          # dry run
 *   bun run --cwd apps/collector src/scripts/backfill-gpu-names.ts --apply  # aplica
 */

import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

const logger = new Logger("backfill-gpu-names");

const GPU_CATEGORY_SLUG = "tarjetas-de-video";
const APPLY = process.argv.includes("--apply");

/** Extrae el primer "<digits>GB" del nombre (ignora la zona del MPN en corchetes). */
function extractGbFromName(name: string): number | null {
  const stripped = name.replace(/\s*\[.*?\]\s*$/, "");
  const m = stripped.match(/\b(\d{1,4})\s*GB\b/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Reemplaza la PRIMERA ocurrencia de "<digits>GB" por "<targetGb>GB". */
function replaceFirstGb(name: string, targetGb: number): string {
  // Reemplaza el primer match fuera del bracket de MPN.
  // Implementación: split en bracket si existe, transformar lado izquierdo, rejoin.
  const bracketIdx = name.lastIndexOf("[");
  const head = bracketIdx >= 0 ? name.slice(0, bracketIdx) : name;
  const tail = bracketIdx >= 0 ? name.slice(bracketIdx) : "";
  const replacedHead = head.replace(/\b\d{1,4}\s*GB\b/i, `${targetGb}GB`);
  return `${replacedHead}${tail}`;
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  specs: unknown;
  mpn: string | null;
}

interface PendingUpdate {
  id: string;
  oldName: string;
  newName: string;
  oldSlug: string;
  newSlug: string;
  memoryGb: number;
  nameGb: number | null;
  mpn: string | null;
}

async function fetchGpuCategoryId(): Promise<string | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, code")
    .eq("slug", GPU_CATEGORY_SLUG)
    .single();
  if (error || !data) {
    logger.error("could_not_resolve_gpu_category", {
      slug: GPU_CATEGORY_SLUG,
      error: error?.message,
    });
    return null;
  }
  return data.id;
}

async function fetchAllGpuProducts(categoryId: string): Promise<ProductRow[]> {
  const out: ProductRow[] = [];
  const pageSize = 1000;
  let offset = 0;
  // Paginado por seguridad — la categoría puede crecer.
  // PostgREST .range es inclusivo.
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, specs, mpn")
      .eq("category_id", categoryId)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      logger.error("fetch_products_failed", { error: error.message });
      break;
    }
    if (!data || data.length === 0) break;
    out.push(...(data as ProductRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

function buildPendingUpdate(row: ProductRow): PendingUpdate | null {
  if (!row.name) return null;
  const specs = row.specs as Record<string, unknown> | null;
  const memoryGbRaw = specs?.memory_gb;
  const memoryGb =
    typeof memoryGbRaw === "number"
      ? memoryGbRaw
      : typeof memoryGbRaw === "string"
        ? Number.parseFloat(memoryGbRaw)
        : null;
  if (memoryGb == null || !Number.isFinite(memoryGb) || memoryGb <= 0) return null;
  // Solo trabajamos con enteros razonables.
  const targetGb = Math.round(memoryGb);
  if (targetGb < 1 || targetGb > 128) return null;

  const nameGb = extractGbFromName(row.name);
  if (nameGb === targetGb) return null; // consistente, nada que hacer

  const newName = replaceFirstGb(row.name, targetGb);
  if (newName === row.name) {
    // El nombre no tenía un token "<n>GB" reemplazable y por lo tanto no podemos corregirlo
    // sin tocar la estructura — lo dejamos pasar (no churn).
    return null;
  }

  // Si después del replace el nuevo nombre tampoco contiene el targetGb (defensivo),
  // abortar. Esto puede pasar si el regex matchea algo dentro del MPN inesperadamente.
  const newGb = extractGbFromName(newName);
  if (newGb !== targetGb) return null;

  const newSlug = `${nameToSlug(newName)}-${Date.now()}`;
  return {
    id: row.id,
    oldName: row.name,
    newName,
    oldSlug: row.slug,
    newSlug,
    memoryGb: targetGb,
    nameGb,
    mpn: row.mpn,
  };
}

function printDryRunTable(updates: PendingUpdate[]) {
  if (updates.length === 0) {
    console.log("[backfill-gpu-names] No products need fixing.");
    return;
  }
  console.log(`[backfill-gpu-names] ${updates.length} products need fixing:`);
  for (const u of updates) {
    console.log(
      [
        `  id=${u.id}`,
        `mpn=${u.mpn ?? "-"}`,
        `name_gb=${u.nameGb ?? "none"}`,
        `memory_gb=${u.memoryGb}`,
        `\n    name:  "${u.oldName}"`,
        `    →      "${u.newName}"`,
        `    slug:  "${u.oldSlug}"`,
        `    →      "${u.newSlug}"`,
      ].join(" "),
    );
  }
}

async function applyUpdates(updates: PendingUpdate[]) {
  let ok = 0;
  let failed = 0;
  for (const u of updates) {
    // Renueva el timestamp para evitar colisiones de slug si dos updates corren en el mismo ms.
    const newSlug = `${nameToSlug(u.newName)}-${Date.now()}`;
    const { error } = await supabase.from("products").update({ name: u.newName, slug: newSlug }).eq("id", u.id);
    if (error) {
      failed++;
      logger.error("update_failed", {
        product_id: u.id,
        error: error.message,
      });
      continue;
    }
    ok++;
    // Registrar el slug viejo para servir 301. Best-effort: no abortamos si falla.
    if (u.oldSlug && u.oldSlug !== newSlug) {
      const { error: redirectError } = await supabase
        .from("product_slug_redirects")
        .insert({ old_slug: u.oldSlug, product_id: u.id });
      if (redirectError && !/duplicate key/i.test(redirectError.message ?? "")) {
        logger.warn(`slug_redirect_insert_failed product=${u.id}: ${redirectError.message}`);
      }
    }
    logger.info("product_renamed", {
      product_id: u.id,
      old_name: u.oldName,
      new_name: u.newName,
      old_slug: u.oldSlug,
      new_slug: newSlug,
      reason: "backfill_gpu_memory_gb_mismatch",
      mpn: u.mpn,
    });
    // Tiny pacing para no martillar la DB.
    await new Promise((r) => setTimeout(r, 5));
  }
  console.log(`[backfill-gpu-names] Done. ok=${ok} failed=${failed}`);
}

async function main() {
  console.log(`[backfill-gpu-names] mode=${APPLY ? "APPLY" : "dry-run"}`);

  const categoryId = await fetchGpuCategoryId();
  if (!categoryId) {
    process.exitCode = 1;
    return;
  }
  console.log(`[backfill-gpu-names] gpu category_id=${categoryId}`);

  const rows = await fetchAllGpuProducts(categoryId);
  console.log(`[backfill-gpu-names] scanned ${rows.length} GPU products`);

  const updates: PendingUpdate[] = [];
  for (const row of rows) {
    const u = buildPendingUpdate(row);
    if (u) updates.push(u);
  }

  printDryRunTable(updates);

  if (!APPLY) {
    console.log("[backfill-gpu-names] dry-run only. Re-run with --apply to persist.");
    return;
  }

  if (updates.length === 0) return;
  await applyUpdates(updates);
}

main().catch((err) => {
  logger.error("backfill_crashed", { error: (err as Error).message });
  process.exitCode = 1;
});
