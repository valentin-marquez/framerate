import type { EnqueueCrawlsRequest, IngestService } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import type { Env } from "@/env";

/** Env de la API con `ingest` falso: registra los pedidos de crawl y permite fijar la respuesta. */
export function testEnv(d1: D1Database, ingest: Partial<IngestService> = {}) {
  const crawlRequests: EnqueueCrawlsRequest[] = [];
  const service: IngestService = {
    enqueueCrawls: async (request) => {
      crawlRequests.push(request);
      return { ok: true, enqueued: 1 };
    },
    ...ingest,
  };
  const env: Env = {
    DB: d1,
    ADMIN_TOKEN: "test-admin-token",
    INGEST: service as unknown as Env["INGEST"],
  };
  return { env, crawlRequests };
}

export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/**
 * Catálogo mínimo sembrado directo en la base (sin pasar por `ingest`):
 *   ASUS RTX 4070 Super (gpu): oferta en alfa ($650.000) y en beta ($599.990, bajó desde $639.990)
 *   MSI RTX 4060 (gpu): una oferta en alfa, sin stock
 *   Ryzen 7 7800X3D (cpu): una oferta en alfa
 */
export async function seedCatalog(db: Db) {
  const at = daysAgo(10);
  const store = async (slug: string) =>
    (
      await db.query
        .insertInto("stores")
        .values({ slug, name: slug, url: `https://${slug}.cl`, domain: `${slug}.cl`, created_at: at })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  const product = async (slug: string, name: string, category: string, brand: string, attributes: object) =>
    (
      await db.query
        .insertInto("products")
        .values({ slug, name, category, brand, attributes: JSON.stringify(attributes), created_at: at, updated_at: at })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  const listing = async (
    store_id: number,
    product_id: number,
    external_id: string,
    category: string,
    price: number,
    in_stock: 0 | 1,
  ) =>
    (
      await db.query
        .insertInto("listings")
        .values({
          store_id,
          product_id,
          external_id,
          url: `https://tienda.cl/p/${external_id}`,
          title: `oferta ${external_id}`,
          category,
          price_cash: price,
          price_card: price,
          in_stock,
          first_seen_at: at,
          last_seen_at: at,
          updated_at: at,
        })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  const pricePoint = (listing_id: number, price: number, observed_at: string) =>
    db.query
      .insertInto("price_points")
      .values({ listing_id, price_cash: price, price_card: price, in_stock: 1, observed_at })
      .execute();

  const [alfa, beta] = [await store("alfa"), await store("beta")];
  const asus = await product("asus-dual-rtx-4070-super-oc-12gb", "ASUS Dual RTX 4070 SUPER OC 12GB", "gpu", "ASUS", {
    chipset: "rtx 4070 super",
    vram: 12,
  });
  const msi = await product("msi-rtx-4060-ventus-2x-8gb", "MSI RTX 4060 Ventus 2X 8GB", "gpu", "MSI", {});
  const ryzen = await product("amd-ryzen-7-7800x3d", "AMD Ryzen 7 7800X3D", "cpu", "AMD", {});

  const l1 = await listing(alfa, asus, "1", "gpu", 650_000, 1);
  await listing(alfa, msi, "2", "gpu", 320_000, 0);
  await listing(alfa, ryzen, "3", "cpu", 420_000, 1);
  const l4 = await listing(beta, asus, "9", "gpu", 599_990, 1);
  await pricePoint(l1, 650_000, daysAgo(5));
  await pricePoint(l4, 639_990, daysAgo(4));
  await pricePoint(l4, 599_990, daysAgo(2));

  return { alfa, beta, asus, msi, ryzen, listings: { l1, l4 } };
}
