import type { EnqueueCrawlsRequest, IngestService, Role } from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { testUtils } from "better-auth/plugins";
import type { Env } from "@/env";
import { createAuth } from "@/features/identity/auth";

export const WEB_ORIGIN = "http://localhost:5173";

/**
 * Env de la API para tests: `ingest` falso (registra los pedidos de crawl y permite
 * fijar la respuesta) y credenciales de Discord de mentira. `overrides` pisa cualquier binding.
 */
export function testEnv(d1: D1Database, ingest: Partial<IngestService> = {}, overrides: Partial<Env> = {}) {
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
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123456",
    BETTER_AUTH_URL: "http://localhost:8787",
    WEB_ORIGIN,
    DISCORD_CLIENT_ID: "discord-test-id",
    DISCORD_CLIENT_SECRET: "discord-test-secret",
    ...overrides,
  };
  return { env, crawlRequests };
}

/**
 * Cabeceras de una sesión válida para `userId`, sin pasar por el proveedor OAuth.
 * Usa el plugin oficial `testUtils` de Better Auth (sólo existe en tests) y firma
 * la cookie con el mismo secreto, así la instancia de la app la acepta.
 */
export async function sessionHeaders(env: Env, userId: string): Promise<Headers> {
  const auth = createAuth(env, { plugins: [testUtils()] });
  const ctx = (await auth.$context) as unknown as { test: { getAuthHeaders(o: { userId: string }): Promise<Headers> } };
  return ctx.test.getAuthHeaders({ userId });
}

/**
 * Crea un usuario como lo hace un login OAuth real (pasa por los mismos hooks:
 * username generado, rol por defecto) y, opcionalmente, le fija un rol.
 */
export async function createUser(
  env: Env,
  db: Db,
  input: { name: string; email?: string; username?: string; role?: Role; image?: string | null },
) {
  const auth = createAuth(env);
  const ctx = await auth.$context;
  const email = input.email ?? `${input.name.toLowerCase().replace(/\W+/g, "")}@example.com`;
  const { user } = await ctx.internalAdapter.createOAuthUser(
    { email, name: input.name, emailVerified: true, image: input.image ?? null, username: input.username } as never,
    { providerId: "discord", accountId: crypto.randomUUID() } as never,
  );
  if (input.role && input.role !== "user") {
    await db.query.updateTable("users").set({ role: input.role }).where("id", "=", user.id).execute();
  }
  return user.id as string;
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
