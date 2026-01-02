import type { Database as DatabaseGenerated, ProductSpecs } from "@framerate/db";
import type { MergeDeep, Simplify } from "type-fest";

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
            brand: ProductBrand;
            category: ProductCategory;
            specs: ProductSpecs;
            prices: ProductPrices;
            popularity_score: number;
          };
        };
      };
    };
  }
>;

// Export enhanced types derived from the patched Database
export type Product = Simplify<Database["public"]["Views"]["api_products"]["Row"]>;
export type Category = Simplify<Database["public"]["Tables"]["categories"]["Row"]>;
export type Brand = Simplify<Database["public"]["Tables"]["brands"]["Row"]>;
export type Store = Simplify<Database["public"]["Tables"]["stores"]["Row"]>;
export type ListingRow = Simplify<Database["public"]["Tables"]["listings"]["Row"]>;
export type Quote = Simplify<Database["public"]["Tables"]["quotes"]["Row"]>;
export type QuoteItem = Simplify<Database["public"]["Tables"]["quote_items"]["Row"]>;

// For joins that are not in the generated types (like listings with store)
export type Listing = Simplify<
  Omit<ListingRow, "store_id"> & {
    store: Simplify<Pick<Store, "name" | "slug" | "logo_url" | "appearance">>;
  }
>;

export type ProductDetail = Simplify<
  Product & {
    variants: Product[];
    listings: Listing[];
  }
>;

/**
 * Type guard to check if a product has specific specs
 */
export function hasSpecs<T extends ProductSpecs>(product: Product): product is Product & { specs: T } {
  return product.specs !== null && typeof product.specs === "object";
}

/**
 * Re-export builder types for convenience
 */
export type {
  BuildAnalysis,
  BuildComponentCategory,
  CompatibilityStatus,
  ValidationIssue,
  ValidationSeverity,
} from "@framerate/db";
