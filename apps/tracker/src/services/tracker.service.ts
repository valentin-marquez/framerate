import { Logger } from "@framerate/utils";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import pLimit from "p-limit";
import { config } from "../config";
import type { BaseTracker, TrackerResult } from "../domain/trackers/base";
import { PcExpressTracker } from "../domain/trackers/pc-express";
import { SpDigitalTracker } from "../domain/trackers/sp-digital";

/**
 * Service responsible for tracking and updating listings from various sources.
 * 
 * The `TrackerService` interacts with a Supabase database to fetch listings, process them
 * using specific trackers, and update the database with the latest price and stock information.
 * It also maintains a history of price changes for each listing.
 * 
 * ### Features:
 * - Fetches listings from the database in batches.
 * - Uses specific trackers to scrape and process listing data.
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
  private supabase: SupabaseClient;
  private trackers: BaseTracker[];
  private logger: Logger;
  private heavyLimit = pLimit(5); 
  private lightLimit = pLimit(20); 

  constructor() {
    this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
    this.trackers = [new PcExpressTracker(), new SpDigitalTracker()];
    this.logger = new Logger("TrackerService");
  }

  /**
   * Tracks a batch of listings by fetching data from the database, processing each listing
   * with its respective tracker, and updating the database with the results.
   *
   * @param limit - The maximum number of listings to process in a single batch. Defaults to 50.
   * @returns A promise that resolves to an object containing the counts of processed, errors, and updated listings:
   *          - `processed`: The number of listings successfully processed.
   *          - `errors`: The number of listings that encountered errors during processing.
   *          - `updated`: The number of listings that had their price or stock updated.
   *
   * @throws An error if the initial database fetch fails.
   */
  async trackBatch(limit = 50) {
    const { data: listings, error } = await this.supabase
      .from("listings")
      .select("id, url, price_cash, price_normal, stock_quantity")
      .order("last_scraped_at", { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch listings: ${error.message}`);
    }

    if (!listings || listings.length === 0) {
      return { processed: 0, errors: 0, updated: 0 };
    }

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
      processed++;

      const hasPriceChanged =
        listing.price_cash !== result.price ||
        (result.priceNormal && listing.price_normal !== result.priceNormal);

      const hasStockChanged = listing.stock_quantity !== result.stockQuantity;

      const { error: updateError } = await this.supabase
        .from("listings")
        .update({
          price_cash: result.price,
          price_normal: result.priceNormal || result.price,
          stock_quantity: result.stockQuantity || 0,
          is_active: result.available,
          last_scraped_at: new Date().toISOString(),
        })
        .eq("id", listing.id);

      if (updateError) {
        this.logger.error(`Failed to update listing ${listing.id}:`, updateError);
        errors++;
      } else {
        if (hasPriceChanged || hasStockChanged) {
          updated++;
        }
      }

      if (hasPriceChanged) {
        await this.supabase.from("price_history").insert({
          listing_id: listing.id,
          price_cash: result.price,
          price_normal: result.priceNormal || result.price,
          recorded_at: new Date().toISOString(),
        });
      }
    }

    return { processed, errors, updated };
  }

  private getTracker(url: string): BaseTracker | undefined {
    return this.trackers.find((t) => url.includes(t.domain));
  }
}
