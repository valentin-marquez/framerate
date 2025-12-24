import type { Database, Tables } from "@framerate/db";
import { client, type SupabaseClient } from "@framerate/db";
import { Logger } from "@framerate/utils";
import pLimit from "p-limit";
import { config } from "@/config";
import type { BaseTracker, TrackerResult } from "@/domain/trackers/base";
import { MyShopTracker } from "@/domain/trackers/myshop";
import { PcExpressTracker } from "@/domain/trackers/pc-express";
import { PuppeteerPool } from "@/domain/trackers/puppeteer-pool";
import { SpDigitalTracker } from "@/domain/trackers/sp-digital";
import { TectecTracker } from "@/domain/trackers/tectec";

type Listing = Pick<
  Tables<"listings">,
  "id" | "url" | "price_cash" | "price_normal" | "stock_quantity" | "is_active" | "last_scraped_at"
>;

export class TrackerService {
  private supabase: SupabaseClient<Database>;
  private trackers: BaseTracker[];
  private puppeteerPool: PuppeteerPool;
  private logger: Logger;
  private heavyLimit = pLimit(config.HEAVY_CONCURRENCY);
  private mediumLimit = pLimit(config.MEDIUM_CONCURRENCY);
  private lightLimit = pLimit(config.LIGHT_CONCURRENCY);
  private lastRequestAt = new Map<string, number>();

  constructor() {
    this.supabase = client({
      url: config.SUPABASE_URL,
      key: config.SUPABASE_SERVICE_ROLE_KEY,
      options: { auth: { persistSession: false } },
    });

    this.puppeteerPool = new PuppeteerPool(config.PUPPETEER_POOL_SIZE);
    this.logger = new Logger("TrackerService");

    // Initialize all trackers
    this.trackers = [
      new MyShopTracker(this.puppeteerPool),
      new SpDigitalTracker(this.puppeteerPool),
      new PcExpressTracker(),
      new TectecTracker(),
    ];
  }

  async trackBatch(limit = 0) {
    const listings = await this.fetchListings(limit);
    if (listings.length === 0) {
      this.logger.info("No listings to process");
      return { processed: 0, errors: 0, updated: 0 };
    }

    this.logger.info(`Processing ${listings.length} listings...`);
    const startTime = Date.now();

    const grouped = this.groupByDomain(listings);
    const results = await Promise.allSettled(
      Array.from(grouped.entries()).map(([domain, domainListings]) => this.processDomain(domain, domainListings)),
    );

    const stats = results.reduce(
      (acc, result) => {
        if (result.status === "fulfilled") {
          acc.processed += result.value.processed;
          acc.errors += result.value.errors;
          acc.updated += result.value.updated;
        } else {
          this.logger.error("Domain processing failed:", result.reason);
        }
        return acc;
      },
      { processed: 0, errors: 0, updated: 0 },
    );

    const duration = Date.now() - startTime;
    this.logger.info(
      `Batch complete: ${stats.processed} processed, ${stats.updated} updated, ${stats.errors} errors | ` +
        `Duration: ${(duration / 1000).toFixed(2)}s | Avg: ${(duration / stats.processed || 0).toFixed(0)}ms/listing`,
    );

    return { ...stats, duration };
  }

  private async fetchListings(limit: number): Promise<Listing[]> {
    // Compute cutoff to avoid re-scraping very recently scraped listings
    const cutoff = new Date(Date.now() - config.LISTING_RESCRAPE_INTERVAL_MS).toISOString();

    let query = this.supabase
      .from("listings")
      .select("id, url, price_cash, price_normal, stock_quantity, is_active, last_scraped_at")
      // Exclude listings scraped more recently than cutoff (keep nulls)
      .not("last_scraped_at", "gt", cutoff)
      // Prioritize inactive listings (is_active = false first), then older last_scraped_at
      .order("is_active", { ascending: true })
      .order("last_scraped_at", { ascending: true, nullsFirst: true });

    if (limit > 0) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch listings: ${error.message}`);

    this.logger.info(`Fetched ${data?.length ?? 0} listings (limit=${limit}, cutoff=${cutoff})`);

    return (data || []) as Listing[];
  }

  private groupByDomain(listings: Listing[]): Map<string, Listing[]> {
    const groups = new Map<string, Listing[]>();
    for (const listing of listings) {
      const tracker = this.getTracker(listing.url);
      if (!tracker) continue;

      const domain = tracker.domain;
      if (!groups.has(domain)) groups.set(domain, []);
      groups.get(domain)?.push(listing);
    }
    return groups;
  }

  private async processDomain(domain: string, listings: Listing[]) {
    this.logger.info(`Processing ${listings.length} listings for ${domain}`);
    let processed = 0,
      errors = 0,
      updated = 0;

    const results = await Promise.allSettled(listings.map((listing) => this.processListing(listing)));

    for (const res of results) {
      if (res.status === "rejected") {
        this.logger.error("Error processing listing:", res.reason);
        errors++;
        continue;
      }

      const { listing, result, elapsed, updateResult } = res.value;
      processed++;
      if (updateResult.updated) updated++;
      if (updateResult.error) errors++;

      const shortUrl = listing.url.length > 80 ? `${listing.url.slice(0, 77)}...` : listing.url;
      this.logger.info(
        `Listing ${listing.id} ${shortUrl} -> ` +
          `price=${result.price} priceNormal=${result.priceNormal || result.price} ` +
          `stockQuantity=${result.stockQuantity} available=${result.available} ` +
          `updated=${updateResult.updated ? "yes" : "no"} time=${elapsed}ms`,
      );
    }

    return { processed, errors, updated };
  }

  private async processListing(listing: Listing) {
    const tracker = this.getTracker(listing.url);
    if (!tracker) throw new Error(`No tracker found for URL: ${listing.url}`);

    const limiter = this.getLimiter(tracker);
    const delayMs = this.getDelay(tracker);

    return limiter(async () => {
      await this.waitForDomain(tracker.domain, delayMs);

      const start = Date.now();
      const result = await tracker.track(listing.url);
      const elapsed = Date.now() - start;
      const updateResult = await this.updateListing(listing, result);

      return { listing, result, elapsed, updateResult };
    });
  }

  private getLimiter(tracker: BaseTracker) {
    if (tracker instanceof SpDigitalTracker || tracker instanceof MyShopTracker) {
      return this.heavyLimit;
    }
    if (tracker instanceof PcExpressTracker) {
      return this.mediumLimit;
    }
    return this.lightLimit;
  }

  private getDelay(tracker: BaseTracker): number {
    if (tracker instanceof SpDigitalTracker || tracker instanceof MyShopTracker) {
      return config.RATE_DELAY_HEAVY_MS;
    }
    if (tracker instanceof PcExpressTracker) {
      return config.RATE_DELAY_MEDIUM_MS;
    }
    return config.RATE_DELAY_LIGHT_MS;
  }

  private async waitForDomain(domain: string, delayMs: number) {
    const now = Date.now();
    const last = this.lastRequestAt.get(domain) || 0;
    const nextAllowed = last + delayMs;

    if (nextAllowed > now) {
      const wait = nextAllowed - now;
      await new Promise((r) => setTimeout(r, wait));
    }

    this.lastRequestAt.set(domain, Date.now());
  }

  private async updateListing(listing: Listing, result: TrackerResult) {
    const oldPriceCash = listing.price_cash || 0;
    const oldPriceNormal = listing.price_normal || 0;
    const oldStockQuantity = listing.stock_quantity || 0;

    const hasPriceChanged =
      oldPriceCash !== result.price || (result.priceNormal && oldPriceNormal !== result.priceNormal);
    const hasStockChanged = oldStockQuantity !== (result.stockQuantity || 0);

    // Log tracker result for debugging
    this.logger.info(`Updating listing ${listing.id} with tracker result`, { result });

    const isActive = !!(
      result.price &&
      result.price > 0 &&
      (result.stock || (result.stockQuantity && result.stockQuantity > 0) || result.available)
    );

    const { error: updateError } = await this.supabase
      .from("listings")
      .update({
        price_cash: result.price,
        price_normal: result.priceNormal || result.price,
        stock_quantity: result.stockQuantity || 0,
        is_active: isActive,
        last_scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    if (updateError) {
      this.logger.error(`Failed to update listing ${listing.id}:`, updateError);
      return { updated: false, error: true };
    }

    if (hasPriceChanged) {
      await this.supabase.from("price_history").insert({
        listing_id: listing.id,
        price_cash: result.price,
        price_normal: result.priceNormal || result.price,
        recorded_at: new Date().toISOString(),
      });
    }

    return { updated: hasPriceChanged || hasStockChanged, error: false };
  }

  private getTracker(url: string): BaseTracker | undefined {
    return this.trackers.find((t) => url.includes(t.domain));
  }

  async cleanup() {
    await this.puppeteerPool.destroy().catch((err) => {
      this.logger.warn("Error during cleanup:", err);
    });
  }
}
