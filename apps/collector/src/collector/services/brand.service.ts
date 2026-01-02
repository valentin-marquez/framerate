import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

export class BrandService {
  private logger = new Logger("BrandService");
  private brandsCache: { name: string; slug: string }[] = [];
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  /**
   * Loads brands from the database into memory.
   * Uses a lock to prevent multiple simultaneous loads.
   */
  async loadBrands(): Promise<void> {
    if (this.loaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const { data, error } = await supabase.from("brands").select("name, slug");

        if (error) {
          this.logger.error("Failed to load brands", error.message);
          return;
        }

        if (data) {
          // Sort by length descending to prioritize longer matches (e.g. "Hewlett Packard" over "HP")
          this.brandsCache = data.sort((a, b) => b.name.length - a.name.length);
          this.loaded = true;
          this.logger.info(`Loaded ${this.brandsCache.length} brands from DB`);
        }
      } catch (err) {
        this.logger.error("Error loading brands", String(err));
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Extracts the brand from the product title and specs.
   * Prioritizes specs, then falls back to searching known brands in the title.
   */
  async extractBrand(title: string, specs: Record<string, string> = {}): Promise<string> {
    // Ensure brands are loaded
    if (!this.loaded) {
      await this.loadBrands();
    }

    // 1. Try explicit specs first
    const specBrand = specs.manufacturer || specs.Fabricante || specs.marca || specs.brand;
    if (specBrand && !this.isGeneric(specBrand)) {
      return specBrand;
    }

    // 2. Search in title
    const titleUpper = title.toUpperCase();

    for (const brand of this.brandsCache) {
      // Escape special regex characters
      const escapedName = brand.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match whole words only to avoid partial matches inside other words
      const regex = new RegExp(`\\b${escapedName}\\b`, "i");

      if (regex.test(title)) {
        return brand.name;
      }
    }

    return "Generic";
  }

  private isGeneric(name: string): boolean {
    const n = name.toUpperCase();
    return n === "GENERIC" || n === "GENERICO" || n === "N/A" || n === "OTHER";
  }
}
