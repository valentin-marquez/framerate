import type { Database, Tables } from "@framerate/db";
import { client, type SupabaseClient } from "@framerate/db";
import { Logger } from "@framerate/utils";
import pLimit from "p-limit";
import { config } from "../config";
import type { BaseTracker, TrackerResult } from "../domain/trackers/base";
import { MyShopTracker } from "../domain/trackers/myshop";
import { SpDigitalTracker } from "../domain/trackers/sp-digital";

type Listing = Pick<Tables<"listings">, "id" | "url" | "price_cash" | "price_normal" | "stock_quantity"> & {
  product?: Pick<Tables<"products">, "mpn"> | null;
};

/**
 * Service responsible for tracking and updating listings from various sources.
 *
 * The `TrackerService` interacts with a Supabase database to fetch listings, process them
 * using specific trackers, and update the database with the latest price and stock information.
 * It also maintains a history of price changes for each listing.
 *
 * ### Features:
 * - Fetches listings from the database with product MPN via JOIN
 * - Uses MPN-based tracking for MyShop (much faster via cached data)
 * - Uses URL-based tracking for other stores
 * - Updates the database with the latest price, stock, and availability information.
 * - Logs errors and maintains a count of processed, updated, and failed listings.
 * - Inserts price history records for listings with price changes.
 *
 * ### Dependencies:
 * - `SupabaseClient`: Used to interact with the Supabase database.
 * - `BaseTracker`: Abstract class for implementing specific trackers.
 * - `Logger`: Utility for logging errors and information.
 * - `pLimit`: Library for limiting the concurrency of asynchronous operations.
 *
 * ### Usage:
 * Create an instance of `TrackerService` and call the `trackBatch` method to process a batch of listings.
 *
 * Example:
 * ```typescript
 * const trackerService = new TrackerService();
 * const result = await trackerService.trackBatch(100);
 * console.log(result);
 * ```
 */
export class TrackerService {
  private supabase: SupabaseClient<Database>;
  private trackers: BaseTracker[];
  private myShopTracker: MyShopTracker;
  private logger: Logger;
  private heavyLimit = pLimit(5);
  private lightLimit = pLimit(20);

  constructor() {
    this.supabase = client({
      url: config.SUPABASE_URL,
      key: config.SUPABASE_SERVICE_ROLE_KEY,
      options: { auth: { persistSession: false } },
    });

    this.myShopTracker = new MyShopTracker();
    this.trackers = [
      this.myShopTracker,
      // new PcExpressTracker(),
      // new SpDigitalTracker(),
    ];
    this.logger = new Logger("TrackerService");
  }

  /**
   * Tracks a batch of listings by fetching data from the database, processing each listing
   * with its respective tracker, and updating the database with the results.
   *
   * This method now intelligently uses MPN-based tracking for MyShop products (much faster)
   * and falls back to URL-based tracking for other stores or products without MPN.
   *
   * @param limit - The maximum number of listings to process in a single batch. Defaults to 0 (process all).
   * @returns A promise that resolves to an object containing the counts of processed, errors, and updated listings:
   *          - `processed`: The number of listings successfully processed.
   *          - `errors`: The number of listings that encountered errors during processing.
   *          - `updated`: The number of listings that had their price or stock updated.
   *
   * @throws An error if the initial database fetch fails.
   */
  async trackBatch(limit = 0) {
    // Fetch listings with product MPN via JOIN
    let query = this.supabase
      .from("listings")
      .select(`
				id,
				url,
				price_cash,
				price_normal,
				stock_quantity,
				product:products!inner(mpn)
			`)
      .eq("is_active", true)
      .order("last_scraped_at", { ascending: true, nullsFirst: true });

    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    const listings = (data ?? []) as Listing[];

    if (error) {
      throw new Error(`Failed to fetch listings: ${error.message}`);
    }

    if (!listings || listings.length === 0) {
      this.logger.info("No listings to process");
      return { processed: 0, errors: 0, updated: 0 };
    }

    this.logger.info(`Processing ${listings.length} listings...`);

    // Group listings by store for efficient batch processing
    const myShopListings = listings.filter((l) => l.url.includes("myshop.cl") && l.product?.mpn);
    const otherListings = listings.filter((l) => !l.url.includes("myshop.cl") || !l.product?.mpn);

    this.logger.info(`MyShop listings with MPN: ${myShopListings.length}, Other/No-MPN: ${otherListings.length}`);

    let processed = 0;
    let errors = 0;
    let updated = 0;

    // Process MyShop listings in batch (super fast via cache)
    if (myShopListings.length > 0) {
      const batchResult = await this.processMyShopBatch(myShopListings);
      processed += batchResult.processed;
      errors += batchResult.errors;
      updated += batchResult.updated;
    }

    // Process other listings individually (slower)
    if (otherListings.length > 0) {
      const individualResult = await this.processIndividualListings(otherListings);
      processed += individualResult.processed;
      errors += individualResult.errors;
      updated += individualResult.updated;
    }

    this.logger.info(`Batch complete: ${processed} processed, ${updated} updated, ${errors} errors`);

    return { processed, errors, updated };
  }

  /**
   * Process MyShop listings in batch using MPN-based tracking.
   * This is MUCH faster as it uses the pre-populated cache.
   */
  private async processMyShopBatch(listings: Listing[]) {
    this.logger.info(`Processing ${listings.length} MyShop listings via MPN batch...`);

    const mpns = listings.map((l) => l.product?.mpn).filter(Boolean) as string[];

    let processed = 0;
    let errors = 0;
    let updated = 0;

    try {
      // Get all results in one batch call
      const results = await this.myShopTracker.trackBatch(mpns);

      // Update database for each listing
      for (const listing of listings) {
        const mpn = listing.product?.mpn;
        if (!mpn) continue;

        const result = results.get(mpn);
        if (!result) {
          this.logger.warn(`No result found for MPN: ${mpn} (listing: ${listing.id})`);
          errors++;
          continue;
        }

        const updateResult = await this.updateListing(listing, result);
        processed++;
        if (updateResult.updated) updated++;
        if (updateResult.error) errors++;
      }
    } catch (error) {
      this.logger.error("Error processing MyShop batch:", error);
      errors += listings.length;
    }

    return { processed, errors, updated };
  }

  /**
   * Process listings individually using URL-based tracking.
   * Used for non-MyShop stores or listings without MPN.
   */
  private async processIndividualListings(listings: Listing[]) {
    this.logger.info(`Processing ${listings.length} listings individually...`);

    let processed = 0;
    let errors = 0;
    let updated = 0;

    const results = await Promise.allSettled(
      listings.map((listing) => {
        const tracker = this.getTracker(listing.url);
        if (!tracker) {
          return Promise.reject(new Error(`No tracker found for URL: ${listing.url}`));
        }

        const limiter = tracker instanceof SpDigitalTracker ? this.heavyLimit : this.lightLimit;

        return limiter(async () => {
          // For MyShop without MPN, try to use trackByMpn if we can extract it
          if (tracker instanceof MyShopTracker && listing.product?.mpn) {
            const result = await this.myShopTracker.trackByMpn(listing.product.mpn);
            return { listing, result };
          }

          // Otherwise use URL-based tracking
          const result = await tracker.track(listing.url);
          return { listing, result };
        });
      }),
    );

    for (const res of results) {
      if (res.status === "rejected") {
        this.logger.error("Error processing listing:", res.reason);
        errors++;
        continue;
      }

      const { listing, result } = res.value;
      const updateResult = await this.updateListing(listing, result);
      processed++;
      if (updateResult.updated) updated++;
      if (updateResult.error) errors++;
    }

    return { processed, errors, updated };
  }

  /**
   * Update a single listing in the database and create price history if needed.
   */
  private async updateListing(listing: Listing, result: TrackerResult) {
    const oldPriceCash = listing.price_cash ?? 0;
    const oldPriceNormal = listing.price_normal ?? 0;
    const oldStockQuantity = listing.stock_quantity ?? 0;

    const hasPriceChanged =
      oldPriceCash !== result.price || (result.priceNormal && oldPriceNormal !== result.priceNormal);

    const hasStockChanged = oldStockQuantity !== (result.stockQuantity ?? 0);

    const { error: updateError } = await this.supabase
      .from("listings")
      .update({
        price_cash: result.price,
        price_normal: result.priceNormal || result.price,
        stock_quantity: result.stockQuantity || 0,
        is_active: result.available,
        last_scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    if (updateError) {
      this.logger.error(`Failed to update listing ${listing.id}:`, updateError);
      return { updated: false, error: true };
    }

    // Create price history entry if price changed
    if (hasPriceChanged) {
      await this.supabase.from("price_history").insert({
        listing_id: listing.id,
        price_cash: result.price,
        price_normal: result.priceNormal || result.price,
        recorded_at: new Date().toISOString(),
      });
    }

    return {
      updated: hasPriceChanged || hasStockChanged,
      error: false,
    };
  }

  private getTracker(url: string): BaseTracker | undefined {
    return this.trackers.find((t) => url.includes(t.domain));
  }

  /**
   * Get cache statistics from MyShop tracker.
   * Useful for monitoring and debugging.
   */
  getCacheStats() {
    return this.myShopTracker.getCacheStats();
  }

  /**
   * Force refresh the MyShop cache.
   * Useful when you want to ensure fresh data.
   */
  async refreshMyShopCache() {
    this.logger.info("Forcing MyShop cache refresh...");
    await this.myShopTracker.forceCacheRefresh();
    this.logger.info("MyShop cache refreshed");
  }
}
