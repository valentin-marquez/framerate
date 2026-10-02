import {
  type Category,
  isAdditiveSlot,
  QUOTE_SLOTS,
  type QuoteDetail,
  type QuoteItem,
  type QuoteItemOffer,
  type QuotePage,
  type QuoteSummary,
  type QuoteVisibility,
  quoteTotals,
  SLOT_BY_CATEGORY,
  type UpdateQuoteItemRequest,
  type UpdateQuoteRequest,
} from "@framerate/contracts";
import { type Db, toBool } from "@framerate/database";
import { sql } from "kysely";
import { productImageUrl } from "@/features/catalog/catalog.queries";
import { avatarUrl } from "@/features/identity/domain/avatar";
import { newPublicId } from "@/shared/public-id";

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
    store: { slug: r.store_slug, name: r.store_name, url: r.store_url },
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
  };
}

function toDetail(row: SummaryRow, itemRows: ItemRow[], assetsBaseUrl: string | undefined): QuoteDetail {
  const items = itemRows
    .map((r) => toItem(r, assetsBaseUrl))
    .sort(
      (a, b) =>
        QUOTE_SLOTS.indexOf(a.slot) - QUOTE_SLOTS.indexOf(b.slot) ||
        Number(b.isSelected) - Number(a.isSelected) ||
        a.id - b.id,
    );
  return { ...toSummary(row, assetsBaseUrl), items, totals: quoteTotals(items) };
}

export interface LoadedQuote {
  ownerId: string;
  detail: QuoteDetail;
}

/** Cotización con sus ítems y autor, en un solo viaje. `null` si no existe. */
export async function loadQuote(
  db: Db,
  publicId: string,
  assetsBaseUrl: string | undefined,
): Promise<LoadedQuote | null> {
  const [[row], itemRows] = await db.read([
    summariesQuery(db).where("q.public_id", "=", publicId),
    itemsQuery(db, publicId),
  ]);
  return row ? { ownerId: row.owner_id, detail: toDetail(row, itemRows, assetsBaseUrl) } : null;
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
    const [, [row], itemRows] = await db.read([
      db.query.insertInto("quotes").values({
        public_id: publicId,
        owner_id: ownerId,
        name: input.name,
        description: input.description || null,
        visibility: input.visibility,
        created_at: now,
        updated_at: now,
      }),
      summariesQuery(db).where("q.public_id", "=", publicId),
      itemsQuery(db, publicId),
    ]);
    if (!row) throw new Error("La cotización recién creada no se encontró");
    return toDetail(row, itemRows, assetsBaseUrl);
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
  const [, [row], itemRows] = await db.read([
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
    summariesQuery(db).where("q.public_id", "=", publicId),
    itemsQuery(db, publicId),
  ]);
  if (!row || row.owner_id !== ownerId) return null;
  return toDetail(row, itemRows, assetsBaseUrl);
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

  const [, [row], itemRows] = await db.read([
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
    summariesQuery(db).where("q.public_id", "=", publicId),
    itemsQuery(db, publicId),
  ]);
  if (!row) return "quote_not_found";
  return { detail: toDetail(row, itemRows, assetsBaseUrl), created };
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
  const [, , [row], itemRows] = await db.read([
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
    summariesQuery(db).where("q.public_id", "=", publicId),
    itemsQuery(db, publicId),
  ]);
  return row ? toDetail(row, itemRows, assetsBaseUrl) : null;
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
  const [, , [row], itemRows] = await db.read([
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
    summariesQuery(db).where("q.public_id", "=", publicId),
    itemsQuery(db, publicId),
  ]);
  return row ? toDetail(row, itemRows, assetsBaseUrl) : null;
}
