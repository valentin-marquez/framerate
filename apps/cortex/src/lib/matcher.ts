import { Matcher } from "@framerate/matcher";
import type { CanonicalProduct } from "@framerate/opendb";
import { supabase } from "@/db";
import logger from "@/logger";

class MatcherService {
  private matcher: Matcher;
  private isLoaded = false;

  constructor() {
    this.matcher = new Matcher();
  }

  async init() {
    if (this.isLoaded) return;

    logger.info("MatcherService: Loading canonical products...");

    // Load all canonical products from DB
    // TODO: Handle pagination for large datasets
    const { data, error } = await supabase.from("products_canonical").select("*").eq("is_deleted", false);

    if (error) {
      throw new Error(`Failed to load products: ${error.message}`);
    }

    if (!data) {
      logger.warn("MatcherService: No products found.");
      return;
    }

    // Map DB rows to CanonicalProduct interface
    // We assume DB schema matches (it does mostly, specs is jsonb)
    const products: CanonicalProduct[] = data.map((row) => {
      const specs = (row.specifications ?? {}) as Record<string, string | number | boolean | string[]>;
      const type = typeof specs.type === "string" ? (specs.type as CanonicalProduct["type"]) : "GPU";
      const manufacturer = typeof specs.manufacturer === "string" ? specs.manufacturer : "Unknown";
      const model = typeof specs.model === "string" ? specs.model : "Unknown";
      const series = typeof specs.series === "string" ? specs.series : undefined;
      const mpn = typeof specs.mpn === "string" ? specs.mpn : undefined;
      return {
        id: row.id,
        type,
        manufacturer,
        model,
        series,
        mpn,
        specifications: specs,
      };
    });

    await this.matcher.load(products);
    this.isLoaded = true;
    logger.info(`MatcherService: Loaded ${products.length} products into index.`);
  }

  async search(query: string) {
    if (!this.isLoaded) await this.init();
    return this.matcher.search(query);
  }
}

export const matcherService = new MatcherService();
