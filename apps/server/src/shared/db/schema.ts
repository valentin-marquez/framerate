import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Espejo tipado de `migrations/*.sql`. Las migraciones SQL son la autoridad
 * (se escriben a mano y se aplican con `wrangler d1 migrations apply`); este
 * archivo sólo da tipos al query builder. Los tests de integración corren las
 * migraciones reales en D1 local, así que un desfase entre ambos rompe CI.
 */

type Json = Record<string, unknown>;

export const stores = sqliteTable("stores", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    brand: text("brand"),
    category: text("category").notNull(),
    attributeKey: text("attribute_key"),
    attributes: text("attributes", { mode: "json" }).$type<Json>().notNull().default(sql`'{}'`),
    imageUrl: text("image_url"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("products_category_idx").on(t.category), index("products_attribute_key_idx").on(t.attributeKey)],
);

export const productIdentifiers = sqliteTable(
  "product_identifiers",
  {
    kind: text("kind", { enum: ["mpn", "gtin"] }).notNull(),
    value: text("value").notNull(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.kind, t.value] })],
);

export const listings = sqliteTable(
  "listings",
  {
    id: integer("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    brand: text("brand"),
    mpn: text("mpn"),
    gtin: text("gtin"),
    imageUrl: text("image_url"),
    attributes: text("attributes", { mode: "json" }).$type<Json>().notNull().default(sql`'{}'`),
    priceCash: integer("price_cash").notNull(),
    priceCard: integer("price_card").notNull(),
    inStock: integer("in_stock", { mode: "boolean" }).notNull(),
    stockQuantity: integer("stock_quantity"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    productId: integer("product_id").references(() => products.id),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("listings_store_id_external_id_unique").on(t.storeId, t.externalId)],
);

export const pricePoints = sqliteTable("price_points", {
  id: integer("id").primaryKey(),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  priceCash: integer("price_cash").notNull(),
  priceCard: integer("price_card").notNull(),
  inStock: integer("in_stock", { mode: "boolean" }).notNull(),
  observedAt: text("observed_at").notNull(),
});

export const MATCH_METHODS = ["identifier", "attributes", "new_product", "manual", "unlinked"] as const;
export type MatchMethod = (typeof MATCH_METHODS)[number];

export const matchDecisions = sqliteTable("match_decisions", {
  id: integer("id").primaryKey(),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  method: text("method", { enum: MATCH_METHODS }).notNull(),
  confidence: real("confidence").notNull(),
  evidence: text("evidence", { mode: "json" }).$type<Json>().notNull().default(sql`'{}'`),
  decidedBy: text("decided_by").notNull(),
  createdAt: text("created_at").notNull(),
});

export const matchReviews = sqliteTable("match_reviews", {
  id: integer("id").primaryKey(),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  candidateProductId: integer("candidate_product_id")
    .notNull()
    .references(() => products.id),
  score: real("score").notNull(),
  evidence: text("evidence", { mode: "json" }).$type<Json>().notNull().default(sql`'{}'`),
  status: text("status", { enum: ["pending", "accepted", "rejected"] })
    .notNull()
    .default("pending"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const crawlRuns = sqliteTable("crawl_runs", {
  id: text("id").primaryKey(),
  storeId: integer("store_id")
    .notNull()
    .references(() => stores.id),
  category: text("category").notNull(),
  status: text("status", { enum: ["running", "succeeded", "failed"] }).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  stats: text("stats", { mode: "json" }).$type<Json>().notNull().default(sql`'{}'`),
  error: text("error"),
});

export const quarantine = sqliteTable("quarantine", {
  id: integer("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => crawlRuns.id, { onDelete: "cascade" }),
  storeId: integer("store_id")
    .notNull()
    .references(() => stores.id),
  externalId: text("external_id"),
  reason: text("reason").notNull(),
  payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
  createdAt: text("created_at").notNull(),
});
