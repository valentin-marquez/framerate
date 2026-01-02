import type { Json, TablesInsert } from "@framerate/db";
import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

export type CategorySlug =
  | "gpu"
  | "cpu"
  | "psu"
  | "motherboard"
  | "case"
  | "ram"
  | "hdd"
  | "ssd"
  | "case_fan"
  | "cpu_cooler";

export interface UpsertResult {
  productId: string | null;
  listingId: string | null;
}

export class CatalogService {
  private logger = new Logger("CatalogService");
  private brandCache = new Map<string, string>();
  private brandPendingPromises = new Map<string, Promise<string | null>>();

  private CATEGORY_CONFIG: Record<CategorySlug, { slug: CategorySlug; name: string }> = {
    gpu: { slug: "gpu", name: "Graphics Card" },
    cpu: { slug: "cpu", name: "Processor" },
    psu: { slug: "psu", name: "Power Supply" },
    motherboard: { slug: "motherboard", name: "Motherboard" },
    case: { slug: "case", name: "Case" },
    ram: { slug: "ram", name: "RAM" },
    hdd: { slug: "hdd", name: "HDD" },
    ssd: { slug: "ssd", name: "SSD" },
    case_fan: { slug: "case_fan", name: "Case Fan" },
    cpu_cooler: { slug: "cpu_cooler", name: "CPU Cooler" },
  };

  async getCategoryId(slug: CategorySlug): Promise<string | null> {
    const config = this.CATEGORY_CONFIG[slug];

    const { data: existing, error: selError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", config.slug)
      .single();

    if (selError) this.logger.error("getCategoryId: select error", selError.message || String(selError));

    if (existing) return existing.id;

    const insert: TablesInsert<"categories"> = {
      name: config.name,
      slug: config.slug,
    };

    const { data: created, error } = await supabase.from("categories").insert(insert).select("id").single();

    if (error) {
      const code = (error as { code?: unknown }).code as string | undefined;
      if (code === "23505") {
        const { data: retryExisting } = await supabase.from("categories").select("id").eq("slug", config.slug).single();
        if (retryExisting) return retryExisting.id;
      }

      const msg = (error as { message?: unknown }).message as string | undefined;
      this.logger.error(`Failed to create category ${slug}`, msg ?? String(error));
      return null;
    }

    return created?.id ?? null;
  }

  private async getOrCreateBrandInternal(normalizedName: string, slug: string): Promise<string | null> {
    const { data: existing } = await supabase.from("brands").select("id").eq("slug", slug).single();

    if (existing) {
      this.brandCache.set(slug, existing.id);
      return existing.id;
    }

    const insert: TablesInsert<"brands"> = {
      name: normalizedName,
      slug,
    };

    const { data: created, error } = await supabase.from("brands").insert(insert).select("id").single();

    if (error) {
      const code = (error as { code?: unknown }).code as string | undefined;
      if (code === "23505") {
        await new Promise((r) => setTimeout(r, 100));
        const { data: retryExisting } = await supabase.from("brands").select("id").eq("slug", slug).single();
        if (retryExisting) {
          this.brandCache.set(slug, retryExisting.id);
          return retryExisting.id;
        }
      }
      const msg = (error as { message?: unknown }).message as string | undefined;
      this.logger.error(`Failed to create brand ${normalizedName}`, msg ?? String(error));
      return null;
    }

    if (created?.id) this.brandCache.set(slug, created.id);

    return created?.id ?? null;
  }

  async resolveBrandId(brandName: string): Promise<string | null> {
    const normalizedName = (brandName || "").trim() || "Generic";
    const slug = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const cached = this.brandCache.get(slug);
    if (cached) return cached;

    const pending = this.brandPendingPromises.get(slug);
    if (pending) return pending;

    const promise = this.getOrCreateBrandInternal(normalizedName, slug);
    this.brandPendingPromises.set(slug, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.brandPendingPromises.delete(slug);
    }
  }

  async getStoreId(slug: string): Promise<string | null> {
    const { data, error } = await supabase.from("stores").select("id").eq("slug", slug).single();

    if (error || !data) {
      this.logger.error(`Store '${slug}' not found in DB`);
      return null;
    }

    return data.id;
  }

  async findExistingProductByMpn(mpn: string): Promise<string | null> {
    const { data } = await supabase.from("products").select("id").eq("mpn", mpn).single();
    return data?.id ?? null;
  }

  async upsertProductAndListing(
    product: {
      title?: string;
      mpn?: string | null;
      specs?: Json;
      brandId: string;
      categoryId: string;
      imageUrl?: string | null;
    },
    listing: {
      url?: string;
      price?: number | null;
      originalPrice?: number | null;
      stock?: boolean | number | null;
      stockQuantity?: number | null;
      storeId: string;
    },
    // If pending is true, the listing will be created/updated as inactive so it won't be public until
    // another process (e.g., Cortex) activates it after validating/generating specs.
    options?: { pending?: boolean },
  ): Promise<UpsertResult> {
    try {
      const normalizedTitle = product.title ?? `${product.mpn ?? "product"}`;

      // If product has mpn try to find existing
      let productId: string | null = null;
      if (product.mpn) {
        productId = await this.findExistingProductByMpn(product.mpn);
      }

      if (!productId) {
        const insert: TablesInsert<"products"> = {
          name: normalizedTitle,
          slug: `${normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
          mpn: product.mpn ?? null,
          category_id: product.categoryId,
          brand_id: product.brandId,
          image_url: product.imageUrl ?? null,
          specs: product.specs ?? null,
        };

        const { data, error } = await supabase.from("products").insert(insert).select("id").single();
        if (error) {
          const msg = (error as { message?: unknown }).message as string | undefined;
          this.logger.error("Failed to create product", msg ?? String(error));
          return { productId: null, listingId: null };
        }
        productId = data?.id ?? null;
      } else {
        // update specs if present
        if (product.specs) {
          const { error } = await supabase
            .from("products")
            .update({ specs: product.specs as Json })
            .eq("id", productId);
          if (error) {
            const msg = (error as { message?: unknown }).message as string | undefined;
            this.logger.error(`Failed to update product specs: ${productId}`, msg ?? String(error));
          }
        }
      }

      if (!productId) return { productId: null, listingId: null };

      // Check if listing exists to preserve is_active state
      const { data: existingListing } = await supabase
        .from("listings")
        .select("is_active")
        .eq("store_id", listing.storeId)
        .eq("external_id", listing.url ?? "")
        .single();

      let isActive = options?.pending ? false : !!(listing.price != null && listing.price > 0 && listing.stock);

      if (existingListing) {
        // If listing exists, we ignore the 'pending' flag for is_active calculation
        // because it has likely been reviewed already.
        // We update is_active based on the current scrape data.
        isActive = !!(listing.price != null && listing.price > 0 && listing.stock);
      }

      // If stock is explicitly false, ensure stock_quantity is 0 to indicate out-of-stock
      // This helps other services (like Cortex) know the stock status even if is_active is false
      const finalStockQuantity = listing.stockQuantity ?? (listing.stock === false || listing.stock === 0 ? 0 : null);

      const insertListing: TablesInsert<"listings"> = {
        store_id: listing.storeId,
        product_id: productId,
        url: listing.url ?? "",
        external_id: listing.url ?? "",
        price_cash: listing.price ?? null,
        price_normal: listing.originalPrice ?? listing.price ?? null,
        is_active: isActive,
        stock_quantity: finalStockQuantity,
        last_scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: listingData, error: listingError } = await supabase
        .from("listings")
        .upsert(insertListing, { onConflict: "store_id,external_id" })
        .select("id")
        .single();

      if (listingError) {
        const msg = (listingError as { message?: unknown }).message as string | undefined;
        this.logger.error("Failed to upsert listing", msg ?? String(listingError));
        return { productId, listingId: null };
      }

      const listingId = listingData?.id ?? null;

      // Record price history
      if (listingId && insertListing.price_cash != null && insertListing.price_cash > 0) {
        const priceInsert: TablesInsert<"price_history"> = {
          listing_id: listingId,
          price_cash: insertListing.price_cash,
          price_normal: insertListing.price_normal ?? insertListing.price_cash,
        };
        await supabase.from("price_history").insert(priceInsert);
      }

      return { productId, listingId };
    } catch (err) {
      this.logger.error("upsertProductAndListing failed", (err as Error).message || String(err));
      return { productId: null, listingId: null };
    }
  }
}
