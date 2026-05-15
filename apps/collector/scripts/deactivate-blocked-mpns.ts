/**
 * Deactivate listings whose product MPN is on `MPN_BLOCKLIST`.
 *
 * Rationale:
 *   PC Express files accessories (PCI risers, NVLink bridges, TPM modules)
 *   under their parent category (gpu / motherboard). Those products were
 *   ingested with the wrong canonical category. We can't simply delete the
 *   `products` rows (would break listing history and price snapshots), so we
 *   flip `listings.is_active = false` for every listing tied to the offending
 *   product. The product row itself stays untouched.
 *
 * Behaviour:
 *   - Reads MPNs from `@/collector/domain/category-filters` (single source).
 *   - Resolves each MPN to a `products.id` (case-insensitive, punctuation-agnostic
 *     match using the same normalization the catalog service uses).
 *   - Lists every related listing (active or not).
 *   - In dry-run (default): prints a table, makes NO writes.
 *   - With `--apply`: sets `is_active=false` for any currently-active listing.
 *   - Idempotent: if everything is already deactivated, this is a no-op.
 *
 * Usage (from repo root):
 *   bun run --cwd apps/collector cleanup:blocked-mpns          # dry-run
 *   bun run --cwd apps/collector cleanup:blocked-mpns --apply  # actually persist
 *
 * Or directly:
 *   bun run --cwd apps/collector scripts/deactivate-blocked-mpns.ts
 *   bun run --cwd apps/collector scripts/deactivate-blocked-mpns.ts --apply
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env (same
 * variables already consumed by `src/lib/supabase.ts`).
 */

import { MPN_BLOCKLIST } from "@/collector/domain/category-filters";
import { normalizeMpnKey } from "@/collector/services/catalog.service";
import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

const APPLY = process.argv.includes("--apply");
const logger = new Logger("deactivate-blocked-mpns");

interface ProductMatch {
  id: string;
  name: string;
  mpn: string | null;
  category_id: string | null;
  blockedKey: string;
}

interface ListingRow {
  id: string;
  product_id: string;
  store_id: string;
  url: string;
  is_active: boolean;
}

async function findProductsForBlocklist(): Promise<ProductMatch[]> {
  const blockedNormalized = new Map<string, string>(); // normalized -> original spelling
  for (const mpn of MPN_BLOCKLIST) {
    const k = normalizeMpnKey(mpn);
    if (k) blockedNormalized.set(k, mpn);
  }

  // Fetch products with non-null MPN. We page just in case the table grows.
  const matches: ProductMatch[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, mpn, category_id")
      .not("mpn", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      logger.error("fetch_products_failed", { error: error.message });
      throw error;
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      const key = normalizeMpnKey(row.mpn);
      const blockedOriginal = blockedNormalized.get(key);
      if (blockedOriginal) {
        matches.push({
          id: row.id,
          name: row.name ?? "",
          mpn: row.mpn,
          category_id: row.category_id,
          blockedKey: blockedOriginal,
        });
      }
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return matches;
}

async function listListingsForProduct(productId: string): Promise<ListingRow[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, product_id, store_id, url, is_active")
    .eq("product_id", productId);
  if (error) {
    logger.error("fetch_listings_failed", { product_id: productId, error: error.message });
    return [];
  }
  return (data ?? []) as ListingRow[];
}

async function deactivateListings(listingIds: string[]): Promise<{ ok: number; failed: number }> {
  if (listingIds.length === 0) return { ok: 0, failed: 0 };
  // Single bulk update; PostgREST's `.in("id", ids)` is supported.
  const { error, count } = await supabase
    .from("listings")
    .update({ is_active: false }, { count: "exact" })
    .in("id", listingIds);
  if (error) {
    logger.error("deactivate_failed", { error: error.message });
    return { ok: 0, failed: listingIds.length };
  }
  return { ok: count ?? listingIds.length, failed: 0 };
}

function printSummaryHeader(matches: ProductMatch[]) {
  console.log(`[deactivate-blocked-mpns] mode=${APPLY ? "APPLY" : "dry-run"}`);
  console.log(`[deactivate-blocked-mpns] blocklist size=${MPN_BLOCKLIST.size}`);
  console.log(`[deactivate-blocked-mpns] matched products: ${matches.length}`);
}

async function main() {
  printSummaryHeader([]);

  const matches = await findProductsForBlocklist();
  if (matches.length === 0) {
    console.log("[deactivate-blocked-mpns] No products in DB match the blocklist — nothing to do.");
    return;
  }

  console.log("[deactivate-blocked-mpns] Matched products:");
  for (const m of matches) {
    console.log(`  - id=${m.id} mpn=${m.mpn} blocked_as="${m.blockedKey}" name="${m.name}"`);
  }

  const allActiveListingIds: string[] = [];
  let totalListings = 0;
  let alreadyInactive = 0;

  for (const m of matches) {
    const listings = await listListingsForProduct(m.id);
    totalListings += listings.length;
    for (const l of listings) {
      if (l.is_active) {
        allActiveListingIds.push(l.id);
        console.log(
          `    listing id=${l.id} store=${l.store_id} active=${l.is_active} url=${l.url} -> would deactivate`,
        );
      } else {
        alreadyInactive++;
        console.log(`    listing id=${l.id} store=${l.store_id} active=false (already inactive, no-op)`);
      }
    }
  }

  console.log(
    `[deactivate-blocked-mpns] total listings=${totalListings} active=${allActiveListingIds.length} already_inactive=${alreadyInactive}`,
  );

  if (!APPLY) {
    console.log("[deactivate-blocked-mpns] dry-run only. Re-run with --apply to persist changes.");
    return;
  }

  if (allActiveListingIds.length === 0) {
    console.log("[deactivate-blocked-mpns] Nothing to update (all matching listings already inactive).");
    return;
  }

  const { ok, failed } = await deactivateListings(allActiveListingIds);
  logger.info("listings_deactivated", {
    ok,
    failed,
    matched_products: matches.length,
    blocklist: [...MPN_BLOCKLIST],
  });
  console.log(`[deactivate-blocked-mpns] Done. listings_updated=${ok} failed=${failed}`);
}

main().catch((err) => {
  logger.error("deactivate_blocked_mpns_crashed", { error: (err as Error).message });
  process.exitCode = 1;
});
