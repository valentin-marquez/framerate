import type { Database as DatabaseGenerated, ProductSpecs } from "@framerate/db";
import type { MergeDeep, Simplify } from "type-fest";

// Typed JSON structures
export interface ProductPrices {
  /** Precio efectivo/transferencia (el más bajo entre listings activos). */
  cash: number;
  /** Precio tarjeta/normal del mismo listing (medio de pago, NO un descuento). */
  normal: number;
  /**
   * Precio de referencia para descuento REAL: el cash más alto que tuvo la
   * oferta más barata en su propio historial (ventana 90d). `null` cuando no
   * hubo movimiento real de precio → no hay descuento que mostrar.
   */
  reference: number | null;
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
    // icon_url NO es columna: la API lo resuelve al asset del bucket
    // store-assets (store_profiles.icon_path ?? stores.scraped_icon_path).
    store: { name: string; slug: string; icon_url: string | null };
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
