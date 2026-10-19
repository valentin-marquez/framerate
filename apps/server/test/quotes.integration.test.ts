import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  ApiErrorSchema,
  PublicQuoteSchema,
  QuoteCondensePlanSchema,
  QuoteDetailSchema,
  QuoteLikeSchema,
  QuotePageSchema,
} from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createUser, seedCatalog, sessionHeaders, testEnv } from "./helpers";

/** Cotizaciones: slots derivados de la categoría, alternativas, totales con la oferta resuelta y visibilidad. */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
let ana: string;
let beto: string;
let seed: Awaited<ReturnType<typeof seedCatalog>>;

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1));
});
afterAll(() => dispose());
beforeEach(async () => {
  await resetD1(d1);
  seed = await seedCatalog(db);
  ana = await createUser(env, db, { name: "Ana", username: "ana" });
  beto = await createUser(env, db, { name: "Beto", username: "beto" });
});

/** `actor`: id de usuario (sesión) o "anon". */
async function call(actor: string, path: string, method = "GET", body?: unknown) {
  const headers = new Headers({ "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" });
  if (actor !== "anon") for (const [k, v] of await sessionHeaders(env, actor)) headers.set(k, v);
  return app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
}
const code = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

async function createQuote(actor: string, body: Record<string, unknown> = { name: "Mi PC" }) {
  const res = await call(actor, "/v1/quotes", "POST", body);
  expect(res.status).toBe(201);
  return QuoteDetailSchema.parse(await res.json());
}
const addItem = (actor: string, quoteId: string, productId: number, quantity?: number) =>
  call(actor, `/v1/quotes/${quoteId}/items`, "POST", { productId, quantity });
const detail = async (actor: string, quoteId: string) => {
  const res = await call(actor, `/v1/quotes/${quoteId}`);
  expect(res.status).toBe(200);
  return QuoteDetailSchema.parse(await res.json());
};

describe("crear y listar", () => {
  test("crear exige sesión; la cotización nace privada, vacía y con su autor", async () => {
    expect((await call("anon", "/v1/quotes", "POST", { name: "x" })).status).toBe(401);

    const quote = await createQuote(ana, { name: "  Mi PC gamer  ", description: "Para 1440p" });
    expect(quote).toMatchObject({
      name: "Mi PC gamer",
      description: "Para 1440p",
      visibility: "private",
      itemCount: 0,
      items: [],
      totals: { cash: 0, card: 0 },
      author: { username: "ana", displayName: "Ana" },
    });
    expect(quote.id).toMatch(/^[A-Za-z0-9]{8,16}$/);
  });

  test("un nombre vacío no pasa y un usuario sancionado no puede publicar", async () => {
    expect((await call(ana, "/v1/quotes", "POST", { name: "   " })).status).toBe(400);

    await db.query
      .insertInto("user_bans")
      .values({ user_id: beto, reason: "spam", banned_by: ana, created_at: new Date().toISOString() })
      .execute();
    const res = await call(beto, "/v1/quotes", "POST", { name: "Spam" });
    expect(res.status).toBe(403);
    expect(await code(res)).toBe("banned");
  });

  test("GET /v1/quotes devuelve sólo las mías, las más recientes primero, con su cantidad de ítems", async () => {
    const first = await createQuote(ana, { name: "Primera" });
    const second = await createQuote(ana, { name: "Segunda" });
    await createQuote(beto, { name: "De Beto" });
    await addItem(ana, first.id, seed.asus);

    expect((await call("anon", "/v1/quotes")).status).toBe(401);
    const page = QuotePageSchema.parse(await (await call(ana, "/v1/quotes?pageSize=10")).json());
    expect(page.total).toBe(2);
    // Agregar un ítem toca la cotización (trigger): la primera pasa a ser la más reciente.
    expect(page.items.map((q) => [q.name, q.itemCount])).toEqual([
      ["Primera", 1],
      ["Segunda", 0],
    ]);
    expect(second.id).not.toBe(first.id);
  });
});

describe("ítems y slots", () => {
  test("el slot sale de la categoría; la primera GPU queda seleccionada y la siguiente es alternativa", async () => {
    const quote = await createQuote(ana);
    expect((await addItem(ana, quote.id, seed.asus)).status).toBe(201);
    expect((await addItem(ana, quote.id, seed.msi)).status).toBe(201);
    expect((await addItem(ana, quote.id, seed.ryzen)).status).toBe(201);

    const result = await detail(ana, quote.id);
    expect(result.items.map((i) => [i.product.slug, i.slot, i.isSelected])).toEqual([
      ["amd-ryzen-7-7800x3d", "cpu", true],
      ["asus-dual-rtx-4070-super-oc-12gb", "gpu", true],
      ["msi-rtx-4060-ventus-2x-8gb", "gpu", false],
    ]);
    expect(result.itemCount).toBe(2);
  });

  test("cada ítem trae la mejor oferta con stock y el total sólo cuenta los seleccionados", async () => {
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.asus, 2);
    await addItem(ana, quote.id, seed.msi);
    await addItem(ana, quote.id, seed.ryzen);

    const result = await detail(ana, quote.id);
    const asus = result.items.find((i) => i.product.id === seed.asus);
    // De las dos ofertas del ASUS gana beta ($599.990), no alfa ($650.000).
    expect(asus?.offer).toMatchObject({ id: seed.listings.l4, priceCash: 599_990, store: { slug: "beta" } });
    // La MSI no tiene stock en ninguna tienda: sin oferta, y además es alternativa.
    expect(result.items.find((i) => i.product.id === seed.msi)?.offer).toBeNull();
    expect(result.totals.cash).toBe(599_990 * 2 + 420_000);
    expect(result.totals.card).toBe(599_990 * 2 + 420_000);
  });

  test("agregar el mismo producto suma a su cantidad, con tope de 99", async () => {
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.ryzen, 2);
    await addItem(ana, quote.id, seed.ryzen, 1);
    expect((await detail(ana, quote.id)).items[0]?.quantity).toBe(3);

    await addItem(ana, quote.id, seed.ryzen, 99);
    expect((await detail(ana, quote.id)).items[0]?.quantity).toBe(99);
  });

  test("un producto que no existe da 404 y una cantidad fuera de rango 400", async () => {
    const quote = await createQuote(ana);
    const missing = await addItem(ana, quote.id, 999_999);
    expect(missing.status).toBe(404);
    expect(await code(missing)).toBe("product_not_found");
    expect((await addItem(ana, quote.id, seed.ryzen, 100)).status).toBe(400);
    expect((await addItem(ana, quote.id, seed.ryzen, 0)).status).toBe(400);
  });

  test("cambiar la cantidad y quitar un ítem; al quitar el seleccionado sube la alternativa", async () => {
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.asus);
    await addItem(ana, quote.id, seed.msi);
    const items = (await detail(ana, quote.id)).items;
    const asusItem = items.find((i) => i.product.id === seed.asus);
    const msiItem = items.find((i) => i.product.id === seed.msi);
    if (!asusItem || !msiItem) throw new Error("faltan ítems");

    // El PATCH devuelve la cotización ya actualizada, con el total recalculado: la web no vuelve a pedirla.
    const patched = await call(ana, `/v1/quotes/${quote.id}/items/${asusItem.id}`, "PATCH", { quantity: 4 });
    expect(patched.status).toBe(200);
    const updated = QuoteDetailSchema.parse(await patched.json());
    expect(updated.items.find((i) => i.id === asusItem.id)?.quantity).toBe(4);
    expect(updated.totals.cash).toBe(599_990 * 4);
    expect((await call(ana, `/v1/quotes/${quote.id}/items/${asusItem.id}`, "PATCH", { quantity: 0 })).status).toBe(400);

    const removed = await call(ana, `/v1/quotes/${quote.id}/items/${asusItem.id}`, "DELETE");
    expect(removed.status).toBe(200);
    const after = QuoteDetailSchema.parse(await removed.json());
    expect(after.items.map((i) => [i.id, i.isSelected])).toEqual([[msiItem.id, true]]);
    expect((await call(ana, `/v1/quotes/${quote.id}/items/${asusItem.id}`, "DELETE")).status).toBe(404);
  });
});

describe("visibilidad", () => {
  test("una cotización privada ajena responde 404, igual que si no existiera", async () => {
    const quote = await createQuote(ana);
    for (const actor of [beto, "anon"]) {
      const res = await call(actor, `/v1/quotes/${quote.id}`);
      expect(res.status).toBe(404);
      expect(await code(res)).toBe("quote_not_found");
    }
    expect((await call("anon", "/v1/quotes/noexiste1")).status).toBe(404);
  });

  test("unlisted la lee quien tenga el link; public además aparece en el perfil del autor", async () => {
    const unlisted = await createQuote(ana, { name: "Con link", visibility: "unlisted" });
    const pub = await createQuote(ana, { name: "Pública", visibility: "public" });
    await createQuote(ana, { name: "Privada" });

    expect((await detail("anon", unlisted.id)).author.username).toBe("ana");
    expect((await detail(beto, pub.id)).name).toBe("Pública");

    const res = await call("anon", "/v1/quotes/user/ana");
    expect(res.status).toBe(200);
    const page = QuotePageSchema.parse(await res.json());
    expect(page.items.map((q) => q.name)).toEqual(["Pública"]);
    expect((await call("anon", "/v1/quotes/user/nadie")).status).toBe(404);
  });

  test("sólo el dueño modifica: los demás reciben 404, también al agregar o quitar ítems", async () => {
    const quote = await createQuote(ana, { name: "Pública", visibility: "public" });
    await addItem(ana, quote.id, seed.ryzen);
    const item = (await detail(ana, quote.id)).items[0];
    if (!item) throw new Error("falta el ítem");

    expect((await addItem(beto, quote.id, seed.asus)).status).toBe(404);
    expect((await addItem("anon", quote.id, seed.asus)).status).toBe(401);
    expect((await call(beto, `/v1/quotes/${quote.id}/items/${item.id}`, "PATCH", { quantity: 2 })).status).toBe(404);
    expect((await call(beto, `/v1/quotes/${quote.id}/items/${item.id}`, "DELETE")).status).toBe(404);
    expect((await all(db, "quote_items")).length).toBe(1);
  });
});

describe("me gusta y cotizaciones populares", () => {
  const like = (actor: string, quoteId: string) => call(actor, `/v1/quotes/${quoteId}/like`, "PUT");
  const publicList = async (query = "") => {
    const res = await call("anon", `/v1/quotes/public${query}`);
    expect(res.status).toBe(200);
    return PublicQuoteSchema.array().parse(await res.json());
  };

  test("dar y quitar el me gusta es idempotente, cuenta una vez por persona y se ve en el detalle", async () => {
    const quote = await createQuote(ana, { name: "Pública", visibility: "public" });

    expect(QuoteLikeSchema.parse(await (await like(beto, quote.id)).json())).toEqual({ likeCount: 1, likedByMe: true });
    expect(QuoteLikeSchema.parse(await (await like(beto, quote.id)).json())).toEqual({ likeCount: 1, likedByMe: true });
    expect(await detail(beto, quote.id)).toMatchObject({ likeCount: 1, likedByMe: true });
    expect(await detail("anon", quote.id)).toMatchObject({ likeCount: 1, likedByMe: false });

    const res = await call(beto, `/v1/quotes/${quote.id}/like`, "DELETE");
    expect(QuoteLikeSchema.parse(await res.json())).toEqual({ likeCount: 0, likedByMe: false });
    expect((await detail(beto, quote.id)).likeCount).toBe(0);
  });

  test("exige sesión, no vale en la propia ni en las que no son públicas", async () => {
    const quote = await createQuote(ana, { name: "Pública", visibility: "public" });
    const priv = await createQuote(ana, { name: "Privada" });
    const unlisted = await createQuote(ana, { name: "Con link", visibility: "unlisted" });

    expect((await like("anon", quote.id)).status).toBe(401);
    const own = await like(ana, quote.id);
    expect(own.status).toBe(403);
    expect(await code(own)).toBe("own_quote");
    for (const id of [priv.id, unlisted.id, "noexiste1"]) expect((await like(beto, id)).status).toBe(404);
    expect((await call(beto, `/v1/quotes/${priv.id}/like`, "DELETE")).status).toBe(404);
    expect(await all(db, "quote_likes")).toEqual([]);
  });

  test("un usuario sancionado no puede dar me gusta", async () => {
    const quote = await createQuote(ana, { name: "Pública", visibility: "public" });
    await db.query
      .insertInto("user_bans")
      .values({ user_id: beto, reason: "spam", banned_by: ana, created_at: new Date().toISOString() })
      .execute();
    expect((await like(beto, quote.id)).status).toBe(403);
  });

  test("la lista pública va de más a menos me gusta, sin privadas ni vacías, con total y fotos", async () => {
    const a = await createQuote(ana, { name: "Poco querida", visibility: "public" });
    const b = await createQuote(ana, { name: "Muy querida", visibility: "public" });
    const empty = await createQuote(ana, { name: "Vacía", visibility: "public" });
    const priv = await createQuote(ana, { name: "Privada" });
    for (const q of [a, b, priv]) await addItem(ana, q.id, seed.ryzen);
    await addItem(ana, b.id, seed.asus);
    const carla = await createUser(env, db, { name: "Carla", username: "carla" });
    await like(beto, b.id);
    await like(carla, b.id);
    await like(beto, a.id);
    await like(beto, empty.id);

    const list = await publicList();
    expect(list.every((q) => !q.likedByMe)).toBe(true);
    const asBeto = PublicQuoteSchema.array().parse(await (await call(beto, "/v1/quotes/public")).json());
    expect(asBeto.map((q) => [q.name, q.likedByMe])).toEqual([
      ["Muy querida", true],
      ["Poco querida", true],
    ]);
    expect(list.map((q) => [q.name, q.likeCount])).toEqual([
      ["Muy querida", 2],
      ["Poco querida", 1],
    ]);
    const [top] = list;
    const expected = (await detail(ana, b.id)).totals.cash;
    expect(top?.totalCash).toBe(expected);
    expect(top?.totalCash).toBeGreaterThan(0);
    expect(top?.author.username).toBe("ana");
    expect((await publicList("?limit=1")).map((q) => q.name)).toEqual(["Muy querida"]);
    expect((await publicList("?limit=1&page=2")).map((q) => q.name)).toEqual(["Poco querida"]);
    expect(await publicList("?limit=1&page=3")).toEqual([]);
    expect((await call("anon", "/v1/quotes/public?limit=99")).status).toBe(400);
  });

  test("las fotos van por importancia (gabinete, procesador, placa, gráfica) y sin foto pasa el siguiente", async () => {
    const quote = await createQuote(ana, { name: "Pública", visibility: "public" });
    await db.query
      .updateTable("products")
      .set({ image_url: "https://img.test/gpu.png" })
      .where("id", "=", seed.asus)
      .execute();
    await db.query
      .updateTable("products")
      .set({ image_url: "https://img.test/cpu.png" })
      .where("id", "=", seed.ryzen)
      .execute();
    await addItem(ana, quote.id, seed.asus);
    await addItem(ana, quote.id, seed.ryzen);

    const [top] = await publicList();
    expect(top?.images).toEqual(["https://img.test/cpu.png", "https://img.test/gpu.png"]);
  });

  test("al hacerse privada deja de aparecer en la lista y al borrarla se van sus me gusta", async () => {
    const quote = await createQuote(ana, { name: "Pública", visibility: "public" });
    await addItem(ana, quote.id, seed.ryzen);
    await like(beto, quote.id);
    expect(await publicList()).toHaveLength(1);

    await call(ana, `/v1/quotes/${quote.id}`, "PATCH", { visibility: "private" });
    expect(await publicList()).toEqual([]);

    await call(ana, `/v1/quotes/${quote.id}`, "DELETE");
    expect(await all(db, "quote_likes")).toEqual([]);
  });
});

describe("editar y borrar la cotización", () => {
  const patch = (actor: string, id: string, body: unknown) => call(actor, `/v1/quotes/${id}`, "PATCH", body);

  test("cambia nombre, descripción y visibilidad, y devuelve la cotización", async () => {
    const quote = await createQuote(ana, { name: "Mi PC" });
    await addItem(ana, quote.id, seed.ryzen);

    const res = await patch(ana, quote.id, { name: "  PC gamer  ", description: "Para 1440p", visibility: "unlisted" });
    expect(res.status).toBe(200);
    const updated = QuoteDetailSchema.parse(await res.json());
    expect(updated).toMatchObject({
      name: "PC gamer",
      description: "Para 1440p",
      visibility: "unlisted",
      itemCount: 1,
    });
    expect(updated.items).toHaveLength(1);

    // Cambios parciales: lo que no se manda se queda, y una descripción vacía la borra.
    const onlyName = QuoteDetailSchema.parse(await (await patch(ana, quote.id, { name: "Otro" })).json());
    expect(onlyName).toMatchObject({ name: "Otro", description: "Para 1440p", visibility: "unlisted" });
    const cleared = QuoteDetailSchema.parse(await (await patch(ana, quote.id, { description: "" })).json());
    expect(cleared.description).toBeNull();
  });

  test("hacerla pública la muestra en el perfil, y volverla privada la esconde", async () => {
    const quote = await createQuote(ana, { name: "Mi PC" });
    const listed = async () =>
      QuotePageSchema.parse(await (await call("anon", "/v1/quotes/user/ana")).json()).items.map((q) => q.name);
    expect(await listed()).toEqual([]);

    await patch(ana, quote.id, { visibility: "public" });
    expect(await listed()).toEqual(["Mi PC"]);
    expect((await call("anon", `/v1/quotes/${quote.id}`)).status).toBe(200);

    await patch(ana, quote.id, { visibility: "private" });
    expect(await listed()).toEqual([]);
    expect((await call("anon", `/v1/quotes/${quote.id}`)).status).toBe(404);
  });

  test("un cuerpo vacío o inválido da 400, y sólo el dueño puede editar", async () => {
    const quote = await createQuote(ana);
    expect((await patch(ana, quote.id, {})).status).toBe(400);
    expect((await patch(ana, quote.id, { name: "   " })).status).toBe(400);
    expect((await patch(ana, quote.id, { visibility: "secreta" })).status).toBe(400);

    expect((await patch(beto, quote.id, { name: "Mía" })).status).toBe(404);
    expect((await patch("anon", quote.id, { name: "Mía" })).status).toBe(401);
    expect((await detail(ana, quote.id)).name).toBe("Mi PC");
  });

  test("borrar quita la cotización y sus ítems; sólo el dueño puede", async () => {
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.ryzen);

    expect((await call(beto, `/v1/quotes/${quote.id}`, "DELETE")).status).toBe(404);
    expect((await call("anon", `/v1/quotes/${quote.id}`, "DELETE")).status).toBe(401);
    expect((await all(db, "quotes")).length).toBe(1);

    expect((await call(ana, `/v1/quotes/${quote.id}`, "DELETE")).status).toBe(204);
    expect(await all(db, "quotes")).toEqual([]);
    expect(await all(db, "quote_items")).toEqual([]);
    expect((await call(ana, `/v1/quotes/${quote.id}`)).status).toBe(404);
    expect((await call(ana, `/v1/quotes/${quote.id}`, "DELETE")).status).toBe(404);
  });
});

describe("alternativa y tienda elegidas", () => {
  const patchItem = (actor: string, quoteId: string, itemId: number, body: unknown) =>
    call(actor, `/v1/quotes/${quoteId}/items/${itemId}`, "PATCH", body);
  const itemOf = (quote: Awaited<ReturnType<typeof detail>>, productId: number) => {
    const item = quote.items.find((i) => i.product.id === productId);
    if (!item) throw new Error("falta el ítem");
    return item;
  };

  test("elegir una alternativa la deja seleccionada y suelta a la anterior, sin tocar otros slots", async () => {
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.asus);
    await addItem(ana, quote.id, seed.msi);
    await addItem(ana, quote.id, seed.ryzen);
    const before = await detail(ana, quote.id);
    expect(itemOf(before, seed.asus).isSelected).toBe(true);

    const res = await patchItem(ana, quote.id, itemOf(before, seed.msi).id, { isSelected: true });
    expect(res.status).toBe(200);
    const after = QuoteDetailSchema.parse(await res.json());
    expect(itemOf(after, seed.msi).isSelected).toBe(true);
    expect(itemOf(after, seed.asus).isSelected).toBe(false);
    expect(itemOf(after, seed.ryzen).isSelected).toBe(true);
    // La MSI no tiene stock: el total sólo cuenta el procesador.
    expect(after.totals.cash).toBe(420_000);

    // Y se puede volver atrás.
    const back = QuoteDetailSchema.parse(
      await (await patchItem(ana, quote.id, itemOf(before, seed.asus).id, { isSelected: true })).json(),
    );
    expect(back.items.filter((i) => i.slot === "gpu" && i.isSelected).map((i) => i.product.id)).toEqual([seed.asus]);
  });

  test("elegir una oferta cambia el precio del ítem, y null vuelve al mejor precio", async () => {
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.asus, 2);
    const item = itemOf(await detail(ana, quote.id), seed.asus);
    expect(item).toMatchObject({ chosenListingId: null, offer: { id: seed.listings.l4, priceCash: 599_990 } });

    const chosen = QuoteDetailSchema.parse(
      await (await patchItem(ana, quote.id, item.id, { listingId: seed.listings.l1 })).json(),
    );
    expect(itemOf(chosen, seed.asus)).toMatchObject({
      chosenListingId: seed.listings.l1,
      offer: { id: seed.listings.l1, priceCash: 650_000, store: { slug: "alfa" } },
    });
    expect(chosen.totals.cash).toBe(650_000 * 2);

    const best = QuoteDetailSchema.parse(await (await patchItem(ana, quote.id, item.id, { listingId: null })).json());
    expect(itemOf(best, seed.asus)).toMatchObject({ chosenListingId: null, offer: { id: seed.listings.l4 } });
    expect(best.totals.cash).toBe(599_990 * 2);
  });

  test("si la oferta elegida se queda sin stock, el ítem vuelve a contar con el mejor precio", async () => {
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.asus);
    const item = itemOf(await detail(ana, quote.id), seed.asus);
    await patchItem(ana, quote.id, item.id, { listingId: seed.listings.l1 });
    await db.query.updateTable("listings").set({ in_stock: 0 }).where("id", "=", seed.listings.l1).execute();

    const result = itemOf(await detail(ana, quote.id), seed.asus);
    expect(result).toMatchObject({ chosenListingId: seed.listings.l1, offer: { id: seed.listings.l4 } });
  });

  test("una oferta de otro producto o que no existe da 400; sin cambios o isSelected false también", async () => {
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.asus);
    const item = itemOf(await detail(ana, quote.id), seed.asus);
    const ryzenListing = await db.query
      .selectFrom("listings")
      .select("id")
      .where("product_id", "=", seed.ryzen)
      .executeTakeFirstOrThrow();

    const foreign = await patchItem(ana, quote.id, item.id, { listingId: ryzenListing.id });
    expect(foreign.status).toBe(400);
    expect(await code(foreign)).toBe("invalid_listing");
    expect((await patchItem(ana, quote.id, item.id, { listingId: 999_999 })).status).toBe(400);
    expect((await patchItem(ana, quote.id, item.id, {})).status).toBe(400);
    expect((await patchItem(ana, quote.id, item.id, { isSelected: false })).status).toBe(400);
    expect(itemOf(await detail(ana, quote.id), seed.asus).chosenListingId).toBeNull();
  });

  test("sólo el dueño puede elegir", async () => {
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.asus);
    const item = itemOf(await detail(ana, quote.id), seed.asus);
    expect((await patchItem(beto, quote.id, item.id, { listingId: seed.listings.l1 })).status).toBe(404);
    expect((await patchItem("anon", quote.id, item.id, { isSelected: true })).status).toBe(401);
  });
});

describe("condensar tiendas", () => {
  /** Otra oferta del Ryzen, en beta, para que pueda juntarse con la ASUS. */
  async function ryzenInBeta(price: number) {
    const at = new Date().toISOString();
    return (
      await db.query
        .insertInto("listings")
        .values({
          store_id: seed.beta,
          product_id: seed.ryzen,
          external_id: "ryzen-beta",
          url: "https://beta.cl/p/ryzen",
          title: "oferta ryzen beta",
          category: "cpu",
          price_cash: price,
          price_card: price,
          in_stock: 1,
          first_seen_at: at,
          last_seen_at: at,
          updated_at: at,
        })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  }
  const condense = (actor: string, quoteId: string, query = "") =>
    call(actor, `/v1/quotes/${quoteId}/condense${query}`);
  const patchItem = (actor: string, quoteId: string, itemId: number, body: unknown) =>
    call(actor, `/v1/quotes/${quoteId}/items/${itemId}`, "PATCH", body);

  test("junta la compra en una tienda si el aumento vale la pena, y el plan se puede aplicar", async () => {
    // Juntarlas en beta cuesta $5.000 más y se evita una tienda, que por defecto vale $10.000.
    const ryzenBeta = await ryzenInBeta(425_000);
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.asus);
    await addItem(ana, quote.id, seed.ryzen);

    const res = await condense(ana, quote.id);
    expect(res.status).toBe(200);
    const plan = QuoteCondensePlanSchema.parse(await res.json());
    expect(plan).toMatchObject({ improves: true, storesBefore: 2, storesAfter: 1, extraCash: 5_000 });
    expect(plan.stores).toEqual([
      { slug: "beta", name: "beta", itemIds: expect.any(Array), subtotalCash: 599_990 + 425_000 },
    ]);
    const ryzen = plan.items.find((i) => i.listingId === ryzenBeta);
    expect(ryzen).toMatchObject({
      store: { slug: "beta" },
      cheapestStore: { slug: "alfa" },
      cheapestPriceCash: 420_000,
    });

    // Aplicar es fijar cada oferta del plan con el PATCH de siempre.
    const applied = QuoteDetailSchema.parse(
      await (await patchItem(ana, quote.id, ryzen?.itemId ?? 0, { listingId: ryzenBeta })).json(),
    );
    expect(applied.totals.cash).toBe(599_990 + 425_000);
  });

  test("el valor por tienda evitada es editable: con $20.000 se acepta un aumento que con $10.000 no", async () => {
    await ryzenInBeta(440_000);
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.asus);
    await addItem(ana, quote.id, seed.ryzen);
    const plan = async (query: string) =>
      QuoteCondensePlanSchema.parse(await (await condense(ana, quote.id, query)).json());

    // Juntar cuesta $20.000 más: por defecto una tienda vale $10.000 y no conviene.
    expect(await plan("")).toMatchObject({ improves: false, storesAfter: 2, extraCash: 0 });
    expect(await plan("?storeValue=20000")).toMatchObject({ improves: true, storesAfter: 1, extraCash: 20_000 });
    expect(await plan("?storeValue=0")).toMatchObject({ improves: false, storesAfter: 2 });

    expect((await condense(ana, quote.id, "?storeValue=-1")).status).toBe(400);
    expect((await condense(ana, quote.id, "?storeValue=mucho")).status).toBe(400);
  });

  test("no mueve un ítem a una tienda donde cuesta más de $30.000 sobre su mínimo, y no mejora", async () => {
    const quote = await createQuote(ana);
    await addItem(ana, quote.id, seed.asus);
    // Con el Ryzen sólo en alfa, la ASUS tendría que ir a alfa por $50.010 más: pasa el tope.
    await addItem(ana, quote.id, seed.ryzen);

    const plan = QuoteCondensePlanSchema.parse(await (await condense(ana, quote.id)).json());
    expect(plan).toMatchObject({ improves: false, storesBefore: 2, storesAfter: 2, extraCash: 0 });
    expect(plan.items.find((i) => i.cheapestPriceCash === 599_990)).toMatchObject({ store: { slug: "beta" } });
  });

  test("una cotización vacía no tiene nada que condensar; sólo el dueño la consulta", async () => {
    const quote = await createQuote(ana);
    const empty = QuoteCondensePlanSchema.parse(await (await condense(ana, quote.id)).json());
    expect(empty).toMatchObject({ improves: false, storesBefore: 0, storesAfter: 0, extraCash: 0, items: [] });

    expect((await condense(beto, quote.id)).status).toBe(404);
    expect((await condense("anon", quote.id)).status).toBe(401);
    expect((await condense(ana, "NOEXISTE00")).status).toBe(404);
  });
});

describe("compatibilidad", () => {
  const at = "2026-10-01T00:00:00.000Z";
  async function identity(listingId: number, category: string, facts: Record<string, unknown>, specs = {}) {
    await db.query
      .insertInto("listing_identity")
      .values({
        listing_id: listingId,
        version: 2,
        input_hash: "h",
        model: "haiku",
        category,
        name: "x",
        confidence: "high",
        identity: JSON.stringify(facts),
        identity_raw: "{}",
        specs: JSON.stringify(specs),
        specs_source: "{}",
        created_at: at,
      })
      .execute();
  }
  async function product(slug: string, category: string, facts: Record<string, unknown>, specs = {}) {
    const { id } = await db.query
      .insertInto("products")
      .values({ slug, name: slug, category, attributes: "{}", created_at: at, updated_at: at })
      .returning("id")
      .executeTakeFirstOrThrow();
    const listing = await db.query
      .insertInto("listings")
      .values({
        store_id: seed.alfa,
        product_id: id,
        external_id: slug,
        url: `https://alfa.cl/${slug}`,
        title: slug,
        category,
        price_cash: 100_000,
        price_card: 100_000,
        in_stock: 1,
        first_seen_at: at,
        last_seen_at: at,
        updated_at: at,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await identity(listing.id, category, facts, specs);
    return id;
  }
  const listingsOf = async (productId: number) =>
    (await db.query.selectFrom("listings").select("id").where("product_id", "=", productId).execute()).map((l) => l.id);

  test("revisa los seleccionados con los datos de Haiku; el TDP de la GPU sale de su chipset", async () => {
    for (const id of await listingsOf(seed.ryzen)) {
      await identity(id, "cpu", { model: "ryzen 7 7800x3d" }, { socket: "AM5", tdp_w: 120, includes_cooler: false });
    }
    // La ASUS no trae TDP; otra GPU con el mismo chipset sí.
    for (const id of await listingsOf(seed.asus)) await identity(id, "gpu", { chipset: "rtx 4070 super" });
    for (const id of await listingsOf(seed.msi))
      await identity(id, "gpu", { chipset: "rtx 4070 super" }, { tdp_w: 220 });
    const board = await product("placa-z790", "motherboard", { memory_type: "ddr5" }, { socket: "LGA 1700" });
    const psu = await product("fuente-500", "psu", { wattage: 500 });

    const quote = await createQuote(ana);
    for (const id of [seed.ryzen, seed.asus, board, psu]) await addItem(ana, quote.id, id);
    const { compatibility } = await detail(ana, quote.id);

    expect(compatibility.status).toBe("incompatible");
    const byRule = Object.fromEntries(compatibility.checks.map((c) => [c.rule, c]));
    expect(byRule.socket).toMatchObject({
      result: "incompatible",
      message: "El procesador es AM5 y la placa LGA1700: no calzan.",
    });
    // 75 + 120 + 220 = 415 W: 500 W alcanza, pero sin el 25 % de margen.
    expect(byRule.psu_wattage?.result).toBe("warning");
    expect(byRule.cooler_missing?.result).toBe("warning");
    expect(compatibility.estimatedWatts).toBe(415);
    const { items } = await detail(ana, quote.id);
    expect(items.find((i) => i.product.id === seed.ryzen)?.specs).toEqual(["AM5", "120 W"]);
    expect(items.find((i) => i.product.id === board)?.specs).toEqual(["LGA1700", "DDR5"]);
  });

  test("una cotización vacía queda unknown", async () => {
    expect((await createQuote(ana)).compatibility).toEqual({ status: "unknown", checks: [], estimatedWatts: null });
  });
});
