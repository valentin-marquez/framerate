import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";
import type { SqlBool } from "./codecs";

/**
 * Tipos de las tablas para Kysely: espejo de `migrations/*.sql`, que son la
 * autoridad del esquema. Los tests de integración corren esas migraciones en
 * D1 real, así que un desfase entre este archivo y el SQL rompe CI.
 *
 * Convenciones: booleanos = `SqlBool` (0/1), JSON = `string` (ver codecs.ts),
 * fechas = ISO-8601 `string`. `Generated` = la base asigna el valor (PK, DEFAULT).
 */

type JsonText = ColumnType<string, string | undefined, string>;

export interface StoresTable {
  id: Generated<number>;
  slug: string;
  name: string;
  url: string;
  is_active: ColumnType<SqlBool, SqlBool | undefined, SqlBool>;
  created_at: string;
}

export interface ProductsTable {
  id: Generated<number>;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  attribute_key: string | null;
  attributes: JsonText;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductIdentifiersTable {
  kind: "mpn" | "gtin";
  value: string;
  product_id: number;
}

export interface ListingsTable {
  id: Generated<number>;
  store_id: number;
  external_id: string;
  url: string;
  title: string;
  category: string;
  brand: string | null;
  mpn: string | null;
  gtin: string | null;
  image_url: string | null;
  attributes: JsonText;
  price_cash: number;
  price_card: number;
  in_stock: SqlBool;
  stock_quantity: number | null;
  is_active: ColumnType<SqlBool, SqlBool | undefined, SqlBool>;
  product_id: number | null;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
}

export interface PricePointsTable {
  id: Generated<number>;
  listing_id: number;
  price_cash: number;
  price_card: number;
  in_stock: SqlBool;
  observed_at: string;
}

export const MATCH_METHODS = ["identifier", "attributes", "new_product", "manual", "unlinked"] as const;
export type MatchMethod = (typeof MATCH_METHODS)[number];

export interface MatchDecisionsTable {
  id: Generated<number>;
  listing_id: number;
  product_id: number | null;
  method: MatchMethod;
  confidence: number;
  evidence: JsonText;
  decided_by: string;
  created_at: string;
}

export type ReviewStatus = "pending" | "accepted" | "rejected";

export interface MatchReviewsTable {
  id: Generated<number>;
  listing_id: number;
  candidate_product_id: number;
  score: number;
  evidence: JsonText;
  status: ColumnType<ReviewStatus, ReviewStatus | undefined, ReviewStatus>;
  created_at: string;
  resolved_at: string | null;
}

export interface CrawlRunsTable {
  id: string;
  store_id: number;
  category: string;
  status: "running" | "succeeded" | "failed";
  started_at: string;
  finished_at: string | null;
  stats: JsonText;
  error: string | null;
}

export interface QuarantineTable {
  id: Generated<number>;
  run_id: string;
  store_id: number;
  external_id: string | null;
  reason: string;
  payload: string;
  created_at: string;
}

export interface Database {
  stores: StoresTable;
  products: ProductsTable;
  product_identifiers: ProductIdentifiersTable;
  listings: ListingsTable;
  price_points: PricePointsTable;
  match_decisions: MatchDecisionsTable;
  match_reviews: MatchReviewsTable;
  crawl_runs: CrawlRunsTable;
  quarantine: QuarantineTable;
}

export type ListingRow = Selectable<ListingsTable>;
export type NewListing = Insertable<ListingsTable>;
export type ListingUpdate = Updateable<ListingsTable>;
export type ProductRow = Selectable<ProductsTable>;
