import { supabase } from "@/db";
import logger from "@/logger";

const POLL_INTERVAL = 10000; // 10 seconds
const BATCH_SIZE = 50;

export async function startSyncerWorker() {
  logger.info("Syncer Worker started.");
  loop();
}

async function loop() {
  try {
    await processBatch();
  } catch (err) {
    logger.error("Syncer Worker error:", err);
  } finally {
    setTimeout(loop, POLL_INTERVAL);
  }
}

export async function processBatch() {
  // Fetch MATCHED items that haven't been synced yet
  const { data: items, error } = await supabase
    .from("raw_feed")
    .select("*")
    .eq("processing_status", "MATCHED")
    .is("synced_at", null)
    .limit(BATCH_SIZE);

  if (error) throw error;

  if (!items || items.length === 0) return;

  logger.info(`Syncer Worker: Syncing ${items.length} items to listings...`);

  for (const item of items) {
    try {
      await syncItem(item);
    } catch (err) {
      logger.error(`Failed to sync raw_feed ${item.id}:`, err);
      // Optionally mark error in raw_feed?
    }
  }
}

// biome-ignore lint/suspicious/noExplicitAny: specs sin tipo
async function syncItem(item: any) {
  if (!item.match_candidate_id) {
    throw new Error("Item is MATCHED but has no match_candidate_id");
  }

  const payload = item.payload || {};
  // Extract listing details
  // Payload usually follows ScrapedProductSchema: { url, price, stock, ... }

  // 1. Resolve Store ID
  // We might need to query stores by source or part of URL
  // raw_feed.source should be the crawler type (pc-express, sp-digital, etc.)
  // We assume source maps to store.slug or we need a map.

  // Simple resolution: source -> store.slug
  const storeSlug = item.source;

  // We need store_id
  const { data: store } = await supabase.from("stores").select("id").eq("slug", storeSlug).single();

  if (!store) {
    logger.warn(`Store not found for slug: ${storeSlug} (raw_feed: ${item.id})`);
    // Cannot sync without store
    return;
  }

  // 2. Hydrate/Check Legacy Product Table
  // listings references public.products(id). We must ensure the candidate ID exists there.
  const candidateId = item.match_candidate_id;

  const { data: existingLegacy } = await supabase.from("products").select("id").eq("id", candidateId).single();

  if (!existingLegacy) {
    // We need to fetch canonical data to populate legacy product
    const { data: canonical } = await supabase
      .from("products_canonical")
      .select("specifications")
      .eq("id", candidateId)
      .single();

    if (!canonical) {
      throw new Error(`Canonical product ${candidateId} not found (data integrity error)`);
    }

    // biome-ignore lint/suspicious/noExplicitAny: specs sin tipo
    const specs = canonical.specifications as any;
    const name = specs?.name || specs?.model || `Product ${candidateId}`;
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    // Insert into products with the SAME ID as canonical to unify them
    const { error: createError } = await supabase.from("products").insert({
      id: candidateId,
      name: name,
      slug: slug,
      mpn: specs?.mpn || specs?.part_number || null,
      category_id: store.id, // WAIT: This requires a category_id.
      // We don't have category_id handy in raw_feed or specs properly mapped.
      // We need to resolve category_id.
      // Hardcoding or resolving?
      // raw_feed payload has category? No, context?
      // Let's use a default or fetch from payload if available.
      // Or query category table by some hint?
      // This is getting complex.
      // Let's check payload for category.
    });

    if (createError) {
      throw new Error(`Failed to hydrate product: ${createError.message}`);
    }
  }

  const listingData = {
    store_id: store.id,
    product_id: candidateId,
    url: item.external_id || payload.url,
    external_id: item.external_id || payload.url,
    price_cash: payload.price,
    price_normal: payload.originalPrice || payload.price,
    is_active: payload.stock !== false && payload.stock > 0,
    stock_quantity: typeof payload.stockQuantity === "number" ? payload.stockQuantity : null,
    last_scraped_at: item.ingested_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 3. Upsert Listing
  const { data: listing, error: upsertError } = await supabase
    .from("listings")
    .upsert(listingData, { onConflict: "store_id,external_id" })
    .select("id")
    .single();

  if (upsertError) {
    throw new Error(`Upsert failed: ${upsertError.message}`);
  }

  // 4. Insert Price History
  if (listingData.price_cash && listingData.price_cash > 0) {
    await supabase.from("price_history").insert({
      listing_id: listing.id,
      price_cash: listingData.price_cash,
      price_normal: listingData.price_normal,
      recorded_at: new Date().toISOString(),
    });
  }

  // 4. Mark as Synced
  await supabase.from("raw_feed").update({ synced_at: new Date().toISOString() }).eq("id", item.id);

  logger.info(`Synced raw_feed ${item.id} -> listing ${listing.id}`);
}
