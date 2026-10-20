import {
  type Category,
  isAdditiveSlot,
  type PublicQuote,
  QUOTE_SLOTS,
  type QuoteCondenseOptions,
  type QuoteDetail,
  type QuoteItem,
  type QuoteItemOffer,
  type QuoteLike,
  type QuotePage,
  type QuoteSlot,
  type QuoteSummary,
  type QuoteVisibility,
  quoteTotals,
  SLOT_BY_CATEGORY,
  type UpdateQuoteItemRequest,
  type UpdateQuoteRequest,
} from "@framerate/contracts";
import { type Db, parseJson, toBool } from "@framerate/database";
import { sql } from "kysely";
import { productImageUrl } from "@/features/catalog/catalog.queries";
import { checkCompatibility, highlights, num, type Part } from "@/features/compatibility/compatibility";
import { compact, matchPsuTier } from "@/features/compatibility/psu-tier";
import { avatarUrl } from "@/features/identity/domain/avatar";
import { newPublicId } from "@/shared/public-id";
import { type CondenseItem, planCondenseOptions } from "./condense";

/**
 * Acceso a datos de cotizaciones. Cada operación hace pocos viajes a D1 (~150 ms cada uno desde Chile): las lecturas
 * van juntas con `db.read`, y las escrituras viajan en el mismo lote que la lectura del detalle resultante.
 */

const SUMMARY_COLUMNS = [
  "q.id",
  "q.public_id",
  "q.owner_id",
  "q.name",
  "q.description",
  "q.visibility",
  "q.like_count",
  "q.created_at",
  "q.updated_at",
  "u.username",
  "u.display_name",
  "u.avatar_key",
  "u.avatar_source_url",
] as const;

const selectedCount = sql<number>`(select count(*) from quote_items qi where qi.quote_id = q.id and qi.is_selected = 1)`;

const summariesQuery = (db: Db) =>
  db.query
    .selectFrom("quotes as q")
    .innerJoin("users as u", "u.id", "q.owner_id")
    .where("u.deleted_at", "is", null)
    .select([...SUMMARY_COLUMNS, selectedCount.as("item_count")]);

type SummaryRow = Awaited<ReturnType<ReturnType<typeof summariesQuery>["executeTakeFirstOrThrow"]>>;

function toSummary(row: SummaryRow, assetsBaseUrl: string | undefined): QuoteSummary {
  return {
    id: row.public_id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    itemCount: Number(row.item_count),
    likeCount: row.like_count,
    author: {
      username: row.username,
      displayName: row.display_name,
      avatarUrl: avatarUrl(row, assetsBaseUrl),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Oferta con la que cuenta el ítem: la elegida si sigue activa y con stock, y si no, el mejor precio actual. */
const offerListingId = sql<number | null>`coalesce(
  (select l.id from listings l where l.id = qi.listing_id and l.is_active = 1 and l.in_stock = 1),
  (select l.id from listings l where l.product_id = qi.product_id and l.is_active = 1 and l.in_stock = 1 order by l.price_cash, l.id limit 1)
)`;

const itemsQuery = (db: Db, publicId: string) =>
  db.query
    .selectFrom("quote_items as qi")
    .innerJoin("quotes as q", "q.id", "qi.quote_id")
    .innerJoin("products as p", "p.id", "qi.product_id")
    .leftJoin("listings as o", (join) => join.on(sql<boolean>`o.id = ${offerListingId}`))
    .leftJoin("stores as s", "s.id", "o.store_id")
    .select([
      "qi.id",
      "qi.slot",
      "qi.quantity",
      "qi.is_selected",
      "qi.note",
      "qi.listing_id as chosen_listing_id",
      "p.id as product_id",
      "p.slug",
      "p.name",
      "p.brand",
      "p.category",
      "p.image_url",
      "p.image_key",
      "o.id as offer_id",
      "o.url as offer_url",
      "o.price_cash",
      "o.price_card",
      "s.slug as store_slug",
      "s.name as store_name",
      "s.url as store_url",
      "s.scraped_icon_url as store_icon_url",
    ])
    .where("q.public_id", "=", publicId);

type ItemRow = Awaited<ReturnType<ReturnType<typeof itemsQuery>["executeTakeFirstOrThrow"]>>;

function offerOf(r: ItemRow): QuoteItemOffer | null {
  if (
    r.offer_id === null ||
    r.offer_url === null ||
    r.price_cash === null ||
    r.price_card === null ||
    r.store_slug === null ||
    r.store_name === null ||
    r.store_url === null
  ) {
    return null;
  }
  return {
    id: r.offer_id,
    store: { slug: r.store_slug, name: r.store_name, url: r.store_url, iconUrl: r.store_icon_url },
    url: r.offer_url,
    priceCash: r.price_cash,
    priceCard: r.price_card,
  };
}

function toItem(r: ItemRow, assetsBaseUrl: string | undefined): QuoteItem {
  return {
    id: r.id,
    slot: r.slot,
    quantity: r.quantity,
    isSelected: toBool(r.is_selected),
    note: r.note,
    chosenListingId: r.chosen_listing_id,
    product: {
      id: r.product_id,
      slug: r.slug,
      name: r.name,
      brand: r.brand,
      category: r.category as Category,
      imageUrl: productImageUrl(r, assetsBaseUrl),
    },
    offer: offerOf(r),
    specs: [],
  };
}

/** La última identidad de cada oferta activa de los ítems seleccionados: los datos de las reglas de compatibilidad. */
const factsQuery = (db: Db, publicId: string) =>
  db.query
    .selectFrom("quote_items as qi")
    .innerJoin("quotes as q", "q.id", "qi.quote_id")
    .innerJoin("listings as l", "l.product_id", "qi.product_id")
    .innerJoin("listing_identity as i", "i.listing_id", "l.id")
    .select(["qi.id as item_id", "i.identity", "i.specs", "i.specs_source"])
    .where("q.public_id", "=", publicId)
    .where("qi.is_selected", "=", 1)
    .where("l.is_active", "=", 1)
    .where(
      "i.version",
      "=",
      sql<number>`(select max(x.version) from listing_identity x where x.listing_id = i.listing_id)`,
    );

/**
 * Votos de TDP por chipset para las GPU de la cotización: sólo el 39 % de las GPU trae su TDP, y el chipset lo fija.
 * ponytail: recorre las identidades de GPU en cada lectura (~1.000 filas); índice o tabla de chipsets si crece.
 */
const gpuTdpQuery = (db: Db, publicId: string) =>
  db.query
    .selectFrom("listing_identity as i")
    .select([
      sql<string>`json_extract(i.identity, '$.chipset')`.as("chipset"),
      sql<number>`json_extract(i.specs, '$.tdp_w')`.as("tdp"),
      sql<number>`count(*)`.as("n"),
    ])
    .where("i.category", "=", "gpu")
    .where(sql<number | null>`json_extract(i.specs, '$.tdp_w')`, "is not", null)
    .where(sql<string>`json_extract(i.identity, '$.chipset')`, "in", (eb) =>
      eb
        .selectFrom("quote_items as qi")
        .innerJoin("quotes as q", "q.id", "qi.quote_id")
        .innerJoin("listings as l", "l.product_id", "qi.product_id")
        .innerJoin("listing_identity as g", "g.listing_id", "l.id")
        .select(sql<string>`json_extract(g.identity, '$.chipset')`.as("chipset"))
        .where("q.public_id", "=", publicId)
        .where("qi.is_selected", "=", 1)
        .where("qi.slot", "=", "gpu"),
    )
    .groupBy(["chipset", "tdp"]);

/**
 * Las filas de calidad de fuente (#177) de la marca de la fuente seleccionada; el vínculo fino lo hace `matchPsuTier`.
 * La clave de marca en SQL replica `compact` para los nombres de marca reales (espacios, "!", ".", "-").
 * ponytail: el LIKE recorre la tabla (~1.400 filas) en cada lectura; tabla de alias indexada si pesa.
 */
const psuTierQuery = (db: Db, publicId: string) =>
  db.query
    .selectFrom("psu_tier as t")
    .select(["t.brand_key", "t.series", "t.subseries", "t.variant", "t.wattages", "t.tier", "t.limited", "t.best"])
    .where(({ exists, selectFrom }) =>
      exists(
        selectFrom("quote_items as qi")
          .innerJoin("quotes as q", "q.id", "qi.quote_id")
          .innerJoin("products as p", "p.id", "qi.product_id")
          .select(sql<number>`1`.as("one"))
          .where("q.public_id", "=", publicId)
          .where("qi.is_selected", "=", 1)
          .where("qi.slot", "=", "psu")
          .where(
            sql<boolean>`t.brand_key like '% ' || lower(replace(replace(replace(replace(coalesce(p.brand, substr(p.name, 1, instr(p.name, ' ') - 1)), ' ', ''), '!', ''), '.', ''), '-', '')) || ' %'`,
          ),
      ),
    );

/** Lo que necesita `toDetail`, para sumarlo al mismo viaje a D1 que la escritura. */
const detailQueries = (db: Db, publicId: string) =>
  [
    summariesQuery(db).where("q.public_id", "=", publicId),
    itemsQuery(db, publicId),
    factsQuery(db, publicId),
    gpuTdpQuery(db, publicId),
    psuTierQuery(db, publicId),
  ] as const;

type DetailRows = [
  ItemRow[],
  Awaited<ReturnType<ReturnType<typeof factsQuery>["execute"]>>,
  Awaited<ReturnType<ReturnType<typeof gpuTdpQuery>["execute"]>>,
  Awaited<ReturnType<ReturnType<typeof psuTierQuery>["execute"]>>,
];

/**
 * Por campo, el valor que más ofertas del producto dicen (como `fuseSpecs`, sin separar lo de conocimiento: #127). Lo
 * de la ficha oficial (`reference`, #179) le gana a cualquier cantidad de votos.
 */
function fuseFacts(rows: { identity: string; specs: string; specs_source: string }[]): Record<string, unknown> {
  const votes = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const facts = { ...parseJson<Record<string, unknown>>(row.identity, {}), ...parseJson(row.specs, {}) };
    const source = parseJson<Record<string, string>>(row.specs_source, {});
    for (const [key, value] of Object.entries(facts)) {
      if (value === null || value === "") continue;
      const bucket = votes.get(key) ?? new Map<string, number>();
      const k = JSON.stringify(value);
      bucket.set(k, (bucket.get(k) ?? 0) + (source[key] === "reference" ? 1000 : 1));
      votes.set(key, bucket);
    }
  }
  return Object.fromEntries(
    [...votes].map(([key, bucket]) => [key, JSON.parse([...bucket].reduce((a, b) => (b[1] > a[1] ? b : a))[0])]),
  );
}

/** Los ítems seleccionados con sus datos fusionados: alimentan la compatibilidad y los chips de specs. */
function partsOf(items: QuoteItem[], [, factRows, tdpRows, tierRows]: DetailRows): Part[] {
  const tiers = tierRows.map((r) => ({
    ...r,
    wattages: parseJson<number[]>(r.wattages, []),
    limited: toBool(r.limited),
  }));
  const tdpByChipset = new Map<string, { tdp: number; n: number }>();
  for (const r of tdpRows) {
    const best = tdpByChipset.get(r.chipset);
    if (!best || r.n > best.n) tdpByChipset.set(r.chipset, { tdp: r.tdp, n: r.n });
  }
  return items
    .filter((i) => i.isSelected)
    .map((i) => {
      const facts = fuseFacts(factRows.filter((r) => r.item_id === i.id));
      if (i.product.category === "gpu" && facts.tdp_w == null && typeof facts.chipset === "string") {
        facts.tdp_w = tdpByChipset.get(facts.chipset)?.tdp;
      }
      if (i.product.category === "psu") {
        const key = ` ${compact(i.product.brand ?? i.product.name.split(" ")[0] ?? "")} `;
        const rows = tiers.filter((r) => r.brand_key.includes(key));
        facts.psu_tier = matchPsuTier(i.product.name, num(facts.wattage), rows) ?? undefined;
      }
      return { itemId: i.id, name: i.product.name, category: i.product.category, quantity: i.quantity, facts };
    });
}

function toDetail(row: SummaryRow, detail: DetailRows, assetsBaseUrl: string | undefined): QuoteDetail {
  const [itemRows] = detail;
  const sorted = itemRows
    .map((r) => toItem(r, assetsBaseUrl))
    .sort(
      (a, b) =>
        QUOTE_SLOTS.indexOf(a.slot) - QUOTE_SLOTS.indexOf(b.slot) ||
        Number(b.isSelected) - Number(a.isSelected) ||
        a.id - b.id,
    );
  const parts = partsOf(sorted, detail);
  const items = sorted.map((i) => {
    const part = parts.find((p) => p.itemId === i.id);
    return part ? { ...i, specs: highlights(i.product.category, part.facts) } : i;
  });
  return {
    ...toSummary(row, assetsBaseUrl),
    likedByMe: false,
    items,
    totals: quoteTotals(items),
    compatibility: checkCompatibility(parts),
  };
}

export interface LoadedQuote {
  ownerId: string;
  detail: QuoteDetail;
}

const likedQuery = (db: Db, publicId: string, userId: string) =>
  db.query
    .selectFrom("quote_likes as l")
    .innerJoin("quotes as q", "q.id", "l.quote_id")
    .select("l.quote_id")
    .where("q.public_id", "=", publicId)
    .where("l.user_id", "=", userId);

/**
 * Cotización con sus ítems y autor, en un solo viaje. `null` si no existe. Con `viewerId`, `likedByMe` dice si quien
 * mira le dio "me gusta".
 */
export async function loadQuote(
  db: Db,
  publicId: string,
  assetsBaseUrl: string | undefined,
  viewerId?: string,
): Promise<LoadedQuote | null> {
  const [[row], items, facts, tdp, tiers, liked] = await db.read([
    ...detailQueries(db, publicId),
    likedQuery(db, publicId, viewerId ?? ""),
  ]);
  if (!row) return null;
  const detail = toDetail(row, [items, facts, tdp, tiers], assetsBaseUrl);
  return { ownerId: row.owner_id, detail: { ...detail, likedByMe: liked.length > 0 } };
}

/** ¿Puede leerla quien mira? El dueño siempre; los demás sólo si no es privada. */
export const canRead = (quote: LoadedQuote, userId: string | undefined) =>
  quote.ownerId === userId || quote.detail.visibility !== "private";

export async function createQuote(
  db: Db,
  ownerId: string,
  input: { name: string; description?: string | null; visibility: QuoteVisibility },
  assetsBaseUrl: string | undefined,
  now: string,
): Promise<QuoteDetail> {
  const insert = async (publicId: string) => {
    const [, [row], ...detail] = await db.read([
      db.query.insertInto("quotes").values({
        public_id: publicId,
        owner_id: ownerId,
        name: input.name,
        description: input.description || null,
        visibility: input.visibility,
        created_at: now,
        updated_at: now,
      }),
      ...detailQueries(db, publicId),
    ]);
    if (!row) throw new Error("La cotización recién creada no se encontró");
    return toDetail(row, detail, assetsBaseUrl);
  };
  // 30^10 combinaciones: un choque del UNIQUE es rarísimo y basta un reintento.
  return insert(newPublicId(10)).catch((error: Error) => {
    if (!error.message.includes("UNIQUE")) throw error;
    return insert(newPublicId(10));
  });
}

export async function listQuotes(
  db: Db,
  ownerId: string,
  page: number,
  pageSize: number,
  assetsBaseUrl: string | undefined,
): Promise<QuotePage> {
  const [rows, [totalRow]] = await db.read([
    summariesQuery(db)
      .where("q.owner_id", "=", ownerId)
      .orderBy("q.updated_at", "desc")
      .orderBy("q.id", "desc")
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.query
      .selectFrom("quotes")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .where("owner_id", "=", ownerId),
  ]);
  return {
    items: rows.map((r) => toSummary(r, assetsBaseUrl)),
    page,
    pageSize,
    total: Number(totalRow?.total ?? 0),
  };
}

/** Cotizaciones públicas de un usuario; `null` si el usuario no existe. */
export async function listPublicQuotes(
  db: Db,
  username: string,
  page: number,
  pageSize: number,
  assetsBaseUrl: string | undefined,
): Promise<QuotePage | null> {
  const [[user], rows, [totalRow]] = await db.read([
    db.query.selectFrom("users").select("id").where("username", "=", username).where("deleted_at", "is", null),
    summariesQuery(db)
      .where("u.username", "=", username)
      .where("q.visibility", "=", "public")
      .orderBy("q.updated_at", "desc")
      .orderBy("q.id", "desc")
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.query
      .selectFrom("quotes as q")
      .innerJoin("users as u", "u.id", "q.owner_id")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .where("u.username", "=", username)
      .where("q.visibility", "=", "public"),
  ]);
  if (!user) return null;
  return {
    items: rows.map((r) => toSummary(r, assetsBaseUrl)),
    page,
    pageSize,
    total: Number(totalRow?.total ?? 0),
  };
}

/** Edita la cotización del dueño y devuelve el detalle ya actualizado, todo en un viaje. `null` si no existe o no es suya. */
export async function updateQuote(
  db: Db,
  publicId: string,
  ownerId: string,
  changes: UpdateQuoteRequest,
  assetsBaseUrl: string | undefined,
  now: string,
): Promise<QuoteDetail | null> {
  const { name, description, visibility } = changes;
  const [, [row], ...detail] = await db.read([
    db.query
      .updateTable("quotes")
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(visibility !== undefined && { visibility }),
        updated_at: now,
      })
      .where("public_id", "=", publicId)
      .where("owner_id", "=", ownerId),
    ...detailQueries(db, publicId),
  ]);
  if (!row || row.owner_id !== ownerId) return null;
  return toDetail(row, detail, assetsBaseUrl);
}

/** Borra la cotización del dueño (sus ítems se van en cascada). `false` si no existe o no es suya. */
export async function deleteQuote(db: Db, publicId: string, ownerId: string): Promise<boolean> {
  const [[found]] = await db.read([
    db.query.selectFrom("quotes").select("id").where("public_id", "=", publicId).where("owner_id", "=", ownerId),
    db.query.deleteFrom("quotes").where("public_id", "=", publicId).where("owner_id", "=", ownerId),
  ]);
  return found !== undefined;
}

export type AddItemResult = { detail: QuoteDetail; created: boolean } | "quote_not_found" | "product_not_found";

/**
 * Agrega un producto en el slot que le corresponde. Si ya estaba, suma a su cantidad (tope 99). En un slot exclusivo
 * el primer producto queda seleccionado y los siguientes entran como alternativa.
 */
export async function addItem(
  db: Db,
  publicId: string,
  ownerId: string,
  productId: number,
  quantity: number,
  assetsBaseUrl: string | undefined,
  now: string,
): Promise<AddItemResult> {
  const [[quote], [product], current] = await db.read([
    db.query.selectFrom("quotes").select("id").where("public_id", "=", publicId).where("owner_id", "=", ownerId),
    db.query.selectFrom("products").select(["id", "category"]).where("id", "=", productId),
    db.query
      .selectFrom("quote_items as qi")
      .innerJoin("quotes as q", "q.id", "qi.quote_id")
      .select(["qi.product_id", "qi.slot", "qi.is_selected"])
      .where("q.public_id", "=", publicId),
  ]);
  if (!quote) return "quote_not_found";
  if (!product) return "product_not_found";

  const slot = SLOT_BY_CATEGORY[product.category as Category];
  const created = !current.some((i) => i.product_id === productId);
  const slotHasSelected = current.some((i) => i.slot === slot && toBool(i.is_selected));

  const [, [row], ...detail] = await db.read([
    db.query
      .insertInto("quote_items")
      .values({
        quote_id: quote.id,
        product_id: productId,
        slot,
        quantity,
        is_selected: isAdditiveSlot(slot) || !slotHasSelected ? 1 : 0,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.columns(["quote_id", "product_id"]).doUpdateSet({
          quantity: sql`min(99, quote_items.quantity + excluded.quantity)`,
          updated_at: now,
        }),
      ),
    ...detailQueries(db, publicId),
  ]);
  if (!row) return "quote_not_found";
  return { detail: toDetail(row, detail, assetsBaseUrl), created };
}

/** Ítem de una cotización del dueño, o `undefined` si no existe o no es suyo. */
const ownedItemQuery = (db: Db, publicId: string, ownerId: string, itemId: number) =>
  db.query
    .selectFrom("quote_items as qi")
    .innerJoin("quotes as q", "q.id", "qi.quote_id")
    .select(["qi.id", "qi.quote_id", "qi.product_id", "qi.slot", "qi.is_selected"])
    .where("q.public_id", "=", publicId)
    .where("q.owner_id", "=", ownerId)
    .where("qi.id", "=", itemId);

/**
 * Cambia la cantidad de un ítem, lo hace el elegido de su slot y/o fija su oferta, y devuelve la cotización ya
 * actualizada. `null` si el ítem no existe o no es del dueño; `"invalid_listing"` si la oferta no es de ese producto.
 */
export async function updateItem(
  db: Db,
  publicId: string,
  ownerId: string,
  itemId: number,
  changes: UpdateQuoteItemRequest,
  assetsBaseUrl: string | undefined,
  now: string,
): Promise<QuoteDetail | "invalid_listing" | null> {
  const { quantity, isSelected, listingId } = changes;
  const [[item], [listing]] = await db.read([
    ownedItemQuery(db, publicId, ownerId, itemId),
    db.query
      .selectFrom("listings")
      .select(["id", "product_id"])
      .where("id", "=", listingId ?? -1)
      .where("is_active", "=", 1),
  ]);
  if (!item) return null;
  if (listingId != null && listing?.product_id !== item.product_id) return "invalid_listing";

  // En un slot exclusivo, elegir este suelta a los demás (antes del UPDATE: el índice sólo admite uno seleccionado).
  const swap = isSelected === true && !isAdditiveSlot(item.slot);
  const [, , [row], ...detail] = await db.read([
    db.query
      .updateTable("quote_items")
      .set({ is_selected: 0, updated_at: now })
      .where("quote_id", "=", item.quote_id)
      .where("slot", "=", item.slot)
      .where("id", "!=", itemId)
      .where(sql<boolean>`${swap ? 1 : 0} = 1`),
    db.query
      .updateTable("quote_items")
      .set({
        ...(quantity !== undefined && { quantity }),
        ...(isSelected && { is_selected: 1 }),
        ...(listingId !== undefined && { listing_id: listingId }),
        updated_at: now,
      })
      .where("id", "=", itemId),
    ...detailQueries(db, publicId),
  ]);
  return row ? toDetail(row, detail, assetsBaseUrl) : null;
}

/**
 * Quita un ítem y devuelve la cotización ya actualizada; si era el seleccionado de un slot exclusivo, sube la
 * alternativa más antigua. `null` si el ítem no existe o no es del dueño.
 */
export async function removeItem(
  db: Db,
  publicId: string,
  ownerId: string,
  itemId: number,
  assetsBaseUrl: string | undefined,
): Promise<QuoteDetail | null> {
  const [[item]] = await db.read([ownedItemQuery(db, publicId, ownerId, itemId)]);
  if (!item) return null;
  const exclusiveSlots = QUOTE_SLOTS.filter((slot) => !isAdditiveSlot(slot));
  const [, , [row], ...detail] = await db.read([
    db.query.deleteFrom("quote_items").where("id", "=", itemId),
    // Idempotente: en cada slot exclusivo que se quedó sin seleccionado, sube el ítem más antiguo.
    db.query
      .updateTable("quote_items")
      .set({ is_selected: 1 })
      .where("id", "in", (eb) =>
        eb
          .selectFrom("quote_items")
          .select(eb.fn.min("id").as("id"))
          .where("quote_id", "=", item.quote_id)
          .where("slot", "in", exclusiveSlots)
          .groupBy("slot")
          .having(eb.fn.sum("is_selected"), "=", 0),
      ),
    ...detailQueries(db, publicId),
  ]);
  return row ? toDetail(row, detail, assetsBaseUrl) : null;
}

/**
 * Opciones para comprar en menos tiendas: con las ofertas activas y con stock de cada ítem seleccionado, el mejor plan
 * para cada número de tiendas. `storesNow` cuenta las tiendas de la oferta con que cuenta hoy cada ítem (también las
 * fijadas a mano). `null` si la cotización no existe o no es del dueño.
 */
export async function condenseOptions(db: Db, publicId: string, ownerId: string): Promise<QuoteCondenseOptions | null> {
  const [[quote], rows] = await db.read([
    db.query.selectFrom("quotes").select("id").where("public_id", "=", publicId).where("owner_id", "=", ownerId),
    db.query
      .selectFrom("quote_items as qi")
      .innerJoin("quotes as q", "q.id", "qi.quote_id")
      .innerJoin("products as p", "p.id", "qi.product_id")
      .innerJoin("listings as l", "l.product_id", "qi.product_id")
      .innerJoin("stores as s", "s.id", "l.store_id")
      .select([
        "qi.id as item_id",
        "qi.slot",
        "qi.quantity",
        "p.name as product_name",
        offerListingId.as("offer_id"),
        "l.id as listing_id",
        "l.price_cash",
        "s.id as store_id",
        "s.slug as store_slug",
        "s.name as store_name",
        "s.scraped_icon_url as store_icon_url",
      ])
      .where("q.public_id", "=", publicId)
      .where("q.owner_id", "=", ownerId)
      .where("qi.is_selected", "=", 1)
      .where("l.is_active", "=", 1)
      .where("l.in_stock", "=", 1),
  ]);
  if (!quote) return null;

  const stores = new Map(
    rows.map((r) => [r.store_id, { slug: r.store_slug, name: r.store_name, iconUrl: r.store_icon_url }]),
  );
  const items = new Map<number, CondenseItem & { slot: QuoteSlot; name: string }>();
  for (const r of rows) {
    const item = items.get(r.item_id) ?? {
      itemId: r.item_id,
      slot: r.slot,
      name: r.product_name,
      quantity: r.quantity,
      offers: [],
    };
    item.offers.push({ listingId: r.listing_id, storeId: r.store_id, priceCash: r.price_cash });
    items.set(r.item_id, item);
  }
  const ordered = [...items.values()].sort(
    (a, b) => QUOTE_SLOTS.indexOf(a.slot) - QUOTE_SLOTS.indexOf(b.slot) || a.itemId - b.itemId,
  );
  const result = planCondenseOptions(ordered);
  const storesNow = new Set(rows.filter((r) => r.listing_id === r.offer_id).map((r) => r.store_id)).size;

  return {
    itemCount: result.itemCount,
    storesNow,
    minTotalCash: result.minTotalCash,
    options: result.options.map(({ picks, ...option }) => {
      const split = new Map<number, QuoteCondenseOptions["options"][number]["split"][number]>();
      for (const { itemId, quantity, offer, cheapest } of picks) {
        const item = items.get(itemId) as (typeof ordered)[number];
        const entry = split.get(offer.storeId) ?? {
          store: stores.get(offer.storeId) ?? { slug: "", name: "", iconUrl: null },
          subtotalCash: 0,
          items: [],
        };
        entry.subtotalCash += offer.priceCash * quantity;
        entry.items.push({
          itemId,
          listingId: offer.listingId,
          slot: item.slot,
          name: item.name,
          quantity,
          priceCash: offer.priceCash,
          cheapest: offer.priceCash === cheapest.priceCash,
          extraCash: (offer.priceCash - cheapest.priceCash) * quantity,
        });
        split.set(offer.storeId, entry);
      }
      return { ...option, split: [...split.values()].sort((a, b) => b.subtotalCash - a.subtotalCash) };
    }),
  };
}

/** Qué componentes dan la cara de una cotización, del que más la identifica al que menos; sin foto, pasa el siguiente. */
const COLLAGE_ORDER: readonly string[] = [
  "case",
  "cpu",
  "motherboard",
  "gpu",
  "ram",
  "psu",
  "ssd",
  "hdd",
  "cpu_cooler",
  "case_fan",
];
const collageRank = (category: string) => {
  const rank = COLLAGE_ORDER.indexOf(category);
  return rank === -1 ? COLLAGE_ORDER.length : rank;
};

/** Las públicas con más "me gusta" (con al menos un componente), con lo que cuestan hoy y fotos de sus componentes. */
export async function listTopQuotes(
  db: Db,
  limit: number,
  page: number,
  viewerId: string | undefined,
  assetsBaseUrl: string | undefined,
): Promise<PublicQuote[]> {
  const rows = await summariesQuery(db)
    .select(
      viewerId
        ? sql<number>`exists(select 1 from quote_likes l where l.quote_id = q.id and l.user_id = ${viewerId})`.as(
            "liked",
          )
        : sql<number>`0`.as("liked"),
    )
    .where("q.visibility", "=", "public")
    .where(sql<boolean>`${selectedCount} > 0`)
    .orderBy("q.like_count", "desc")
    .orderBy("q.updated_at", "desc")
    .orderBy("q.id", "desc")
    .limit(limit)
    .offset((page - 1) * limit)
    .execute();
  if (rows.length === 0) return [];
  const [items] = await db.read([
    db.query
      .selectFrom("quote_items as qi")
      .innerJoin("products as p", "p.id", "qi.product_id")
      .leftJoin("listings as o", (join) => join.on(sql<boolean>`o.id = ${offerListingId}`))
      .select([
        "qi.quote_id",
        "qi.quantity",
        "qi.slot",
        "p.name",
        "p.category",
        "p.image_url",
        "p.image_key",
        "o.price_cash",
      ])
      .where(
        "qi.quote_id",
        "in",
        rows.map((r) => r.id),
      )
      .where("qi.is_selected", "=", 1)
      .orderBy("qi.position")
      .orderBy("qi.id"),
  ]);
  return rows.map((row) => {
    const own = items.filter((i) => i.quote_id === row.id);
    return {
      ...toSummary(row, assetsBaseUrl),
      likedByMe: Boolean(row.liked),
      cpu: own.find((i) => i.slot === "cpu")?.name ?? null,
      gpu: own.find((i) => i.slot === "gpu")?.name ?? null,
      totalCash: own.reduce((sum, i) => sum + (i.price_cash ?? 0) * i.quantity, 0),
      images: own
        .toSorted((a, b) => collageRank(a.category) - collageRank(b.category))
        .map((i) => productImageUrl(i, assetsBaseUrl))
        .filter((url): url is string => url !== null)
        .slice(0, 4),
    };
  });
}

const likeState = (db: Db, publicId: string) =>
  db.query
    .selectFrom("quotes")
    .select(["id", "owner_id", "visibility", "like_count"])
    .where("public_id", "=", publicId);

/** Sólo las públicas y ajenas reciben "me gusta" (la propia sería inflarse el ranking); idempotente si ya lo había dado. */
export async function likeQuote(
  db: Db,
  publicId: string,
  userId: string,
  now: string,
): Promise<QuoteLike | "not_found" | "own"> {
  const [quote] = await likeState(db, publicId).execute();
  if (!quote || quote.visibility !== "public") return "not_found";
  if (quote.owner_id === userId) return "own";
  const [, [row]] = await db.read([
    db.query
      .insertInto("quote_likes")
      .values({ quote_id: quote.id, user_id: userId, created_at: now })
      .onConflict((oc) => oc.doNothing()),
    likeState(db, publicId),
  ]);
  return { likeCount: row?.like_count ?? quote.like_count, likedByMe: true };
}

export async function unlikeQuote(db: Db, publicId: string, userId: string): Promise<QuoteLike | null> {
  const [quote] = await likeState(db, publicId).execute();
  if (!quote || quote.visibility !== "public") return null;
  const [, [row]] = await db.read([
    db.query.deleteFrom("quote_likes").where("quote_id", "=", quote.id).where("user_id", "=", userId),
    likeState(db, publicId),
  ]);
  return { likeCount: row?.like_count ?? quote.like_count, likedByMe: false };
}
