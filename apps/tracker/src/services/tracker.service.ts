import type { Database, Tables } from "@framerate/db";
import { client, type SupabaseClient } from "@framerate/db";
import { Logger } from "@framerate/utils";
import pLimit from "p-limit";
import { config } from "../config";
import type { BaseTracker, TrackerResult } from "../domain/trackers/base";
import { MyShopTracker } from "../domain/trackers/myshop";
import { PcExpressTracker } from "../domain/trackers/pc-express";
import { PuppeteerPool } from "../domain/trackers/puppeteer-pool";
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
  private puppeteerPool: PuppeteerPool;
  private logger: Logger;
  private heavyLimit = pLimit(config.HEAVY_CONCURRENCY);
  private mediumLimit = pLimit(config.MEDIUM_CONCURRENCY);
  private lightLimit = pLimit(config.LIGHT_CONCURRENCY);

  // Simple per-domain rate limiter: stores last request timestamp (ms)
  private lastRequestAt = new Map<string, number>();

  constructor() {
    this.supabase = client({
      url: config.SUPABASE_URL,
      key: config.SUPABASE_SERVICE_ROLE_KEY,
      options: { auth: { persistSession: false } },
    });

    // Initialize Puppeteer pool
    this.puppeteerPool = new PuppeteerPool(config.PUPPETEER_POOL_SIZE);

    this.myShopTracker = new MyShopTracker(this.puppeteerPool);
    this.trackers = [this.myShopTracker, new SpDigitalTracker(this.puppeteerPool), new PcExpressTracker()];
    this.logger = new Logger("TrackerService");
  }

  /**
   * Tracks a batch of listings by fetching data from the database, processing each listing
   * with its respective tracker, and updating the database with the results.
   *
   * MyShop is now tracked via URL (Puppeteer) like other stores; listings are processed
   * individually using the appropriate tracker.
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

    const startTime = Date.now();

    // Group listings by tracker domain to process each domain in parallel
    const groupedByDomain = this.groupListingsByDomain(listings);

    let processed = 0;
    let errors = 0;
    let updated = 0;

    const domainEntries = Array.from(groupedByDomain.entries());

    this.logger.info(`Processing ${listings.length} listings across ${domainEntries.length} domains`);

    const domainResults = await Promise.allSettled(
      domainEntries.map(([domain, domainListings]) => {
        this.logger.info(`Processing ${domainListings.length} listings for ${domain}`);
        return this.processIndividualListings(domainListings);
      }),
    );

    for (const result of domainResults) {
      if (result.status === "fulfilled") {
        processed += result.value.processed;
        errors += result.value.errors;
        updated += result.value.updated;
      } else {
        this.logger.error("Domain processing failed:", result.reason);
      }
    }

    const duration = Date.now() - startTime;
    const avgTimePerListing = processed > 0 ? duration / processed : 0;
    this.logger.info(
      `Batch complete: ${processed} processed, ${updated} updated, ${errors} errors | ` +
        `Duration: ${(duration / 1000).toFixed(2)}s | Avg: ${avgTimePerListing.toFixed(0)}ms/listing`,
    );

    return { processed, errors, updated, duration, avgTimePerListing };
  }

  private groupListingsByDomain(listings: Listing[]): Map<string, Listing[]> {
    const groups = new Map<string, Listing[]>();

    for (const listing of listings) {
      const tracker = this.getTracker(listing.url);
      if (!tracker) continue;

      const domain = tracker.domain;
      const arr = groups.get(domain);
      if (!arr) {
        groups.set(domain, [listing]);
      } else {
        arr.push(listing);
      }
    }

    return groups;
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

        // Select limiter by tracker type
        const limiter =
          tracker instanceof SpDigitalTracker || tracker instanceof MyShopTracker
            ? this.heavyLimit
            : tracker instanceof PcExpressTracker
              ? this.mediumLimit
              : this.lightLimit;

        return limiter(async () => {
          // Rate limiting per domain to avoid 403 responses from being too aggressive
          const domain = tracker.domain;
          const delayMs =
            tracker instanceof SpDigitalTracker || tracker instanceof MyShopTracker
              ? config.RATE_DELAY_HEAVY_MS
              : tracker instanceof PcExpressTracker
                ? config.RATE_DELAY_MEDIUM_MS
                : config.RATE_DELAY_LIGHT_MS;

          await this.waitForDomain(domain, delayMs);

          const start = Date.now();
          // Use URL-based tracking for all trackers (MyShop is now URL-based)
          const result = await tracker.track(listing.url);
          const elapsed = Date.now() - start;
          this.logger.info(`Tracked ${listing.url} in ${elapsed}ms`);
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

  private async waitForDomain(domain: string, delayMs: number) {
    const now = Date.now();
    const last = this.lastRequestAt.get(domain) ?? 0;
    const nextAllowed = last + delayMs;
    if (nextAllowed > now) {
      const wait = nextAllowed - now;
      this.logger.info(`Waiting ${wait}ms before calling ${domain} to respect rate limit`);
      await new Promise((r) => setTimeout(r, wait));
    }
    this.lastRequestAt.set(domain, Date.now());
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

      // Log where the price was found if tracker provided that metadata
      if (result.meta?.priceFoundAt) {
        this.logger.info(`Listing ${listing.id} price found at: ${String(result.meta.priceFoundAt)}`);
      }
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
   * Cleanup resources used by the service (e.g., Puppeteer pool)
   */
  async cleanup() {
    try {
      await this.puppeteerPool.destroy();
    } catch (error) {
      this.logger.warn("Error during cleanup:", error);
    }
  }
}
