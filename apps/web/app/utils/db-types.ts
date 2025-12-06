import type { Database as DatabaseGenerated, ProductSpecs } from "@framerate/db";
import type { MergeDeep } from "type-fest";

// Typed JSON structures
export interface ProductPrices {
  cash: number;
  normal: number;
}

export interface ProductBrand {
  name: string;
  slug: string;
}

export interface ProductCategory {
  name: string;
  slug: string;
}

// Patch the Database type using MergeDeep
export type Database = MergeDeep<
  DatabaseGenerated,
  {
    public: {
      Views: {
        api_products: {
          Row: {
            brand: ProductBrand | null;
            category: ProductCategory | null;
            specs: ProductSpecs;
            prices: ProductPrices | null;
            popularity_score: number;
          };
        };
      };
    };
  }
>;

// Export enhanced types derived from the patched Database
export type Product = Database["public"]["Views"]["api_products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type Store = Database["public"]["Tables"]["stores"]["Row"];
export type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

// For joins that are not in the generated types (like listings with store)
// We still need to define them manually or use a helper if we had the query
export interface Listing extends Omit<ListingRow, "store_id"> {
  store: Pick<Store, "name" | "slug" | "logo_url">;
}

export interface ProductDetail extends Product {
  variants: Product[];
  listings: Listing[];
}

/**
 * Type guard to check if a product has specific specs
 */
export function hasSpecs<T extends ProductSpecs>(
  product: Product,
): product is Product & { specs: T } {
  return product.specs !== null && typeof product.specs === "object";
}
