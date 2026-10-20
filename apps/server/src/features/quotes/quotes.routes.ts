import {
  AddQuoteItemRequestSchema,
  CreateQuoteRequestSchema,
  PublicQuotesQuerySchema,
  QuoteListQuerySchema,
  UpdateQuoteItemRequestSchema,
  UpdateQuoteRequestSchema,
} from "@framerate/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "@/app";
import { currentUser } from "@/features/identity/middleware";
import { assertNotBanned } from "@/features/identity/policies";
import { AppError } from "@/shared/http/errors";
import {
  addItem,
  canRead,
  condenseOptions,
  createQuote,
  deleteQuote,
  likeQuote,
  listPublicQuotes,
  listQuotes,
  listTopQuotes,
  loadQuote,
  removeItem,
  unlikeQuote,
  updateItem,
  updateQuote,
} from "./quotes.repository";

/**
 * `/v1/quotes` (se monta bajo `optionalUser`). Leer una cotización: el dueño siempre, los demás si no es privada;
 * sin acceso responde 404, igual que si no existiera. Escribir: sólo el dueño.
 */

const ItemIdSchema = z.coerce.number().int().positive();
const quoteNotFound = () => new AppError(404, "quote_not_found", "Cotización no encontrada");
const itemNotFound = () => new AppError(404, "quote_item_not_found", "Ítem no encontrado");

export const quotesRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const user = currentUser(c);
    const { page, pageSize } = QuoteListQuerySchema.parse(c.req.query());
    return c.json(await listQuotes(c.var.db, user.id, page, pageSize, c.env.ASSETS_BASE_URL));
  })
  .post("/", async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const input = CreateQuoteRequestSchema.parse(await c.req.json().catch(() => ({})));
    return c.json(await createQuote(c.var.db, user.id, input, c.env.ASSETS_BASE_URL, new Date().toISOString()), 201);
  })
  .get("/user/:username", async (c) => {
    const { page, pageSize } = QuoteListQuerySchema.parse(c.req.query());
    const result = await listPublicQuotes(c.var.db, c.req.param("username"), page, pageSize, c.env.ASSETS_BASE_URL);
    if (!result) throw new AppError(404, "user_not_found", "Usuario no encontrado");
    return c.json(result);
  })
  .get("/public", async (c) => {
    const { limit, page } = PublicQuotesQuerySchema.parse(c.req.query());
    return c.json(await listTopQuotes(c.var.db, limit, page, c.get("user")?.id, c.env.ASSETS_BASE_URL));
  })
  .get("/:id", async (c) => {
    const viewerId = c.get("user")?.id;
    const quote = await loadQuote(c.var.db, c.req.param("id"), c.env.ASSETS_BASE_URL, viewerId);
    if (!quote || !canRead(quote, viewerId)) throw quoteNotFound();
    return c.json(quote.detail);
  })
  .put("/:id/like", async (c) => {
    const user = currentUser(c);
    assertNotBanned(user);
    const result = await likeQuote(c.var.db, c.req.param("id"), user.id, new Date().toISOString());
    if (result === "not_found") throw quoteNotFound();
    if (result === "own") throw new AppError(403, "own_quote", "No puedes dar me gusta a tu propia cotización");
    return c.json(result);
  })
  .delete("/:id/like", async (c) => {
    const result = await unlikeQuote(c.var.db, c.req.param("id"), currentUser(c).id);
    if (!result) throw quoteNotFound();
    return c.json(result);
  })
  .get("/:id/condense", async (c) => {
    const options = await condenseOptions(c.var.db, c.req.param("id"), c.get("user")?.id);
    if (!options) throw quoteNotFound();
    return c.json(options);
  })
  .patch("/:id", async (c) => {
    const user = currentUser(c);
    const changes = UpdateQuoteRequestSchema.parse(await c.req.json().catch(() => ({})));
    // Hacerla pública es publicar: quien está sancionado no puede.
    if (changes.visibility === "public") assertNotBanned(user);
    const detail = await updateQuote(
      c.var.db,
      c.req.param("id"),
      user.id,
      changes,
      c.env.ASSETS_BASE_URL,
      new Date().toISOString(),
    );
    if (!detail) throw quoteNotFound();
    return c.json(detail);
  })
  .delete("/:id", async (c) => {
    const user = currentUser(c);
    if (!(await deleteQuote(c.var.db, c.req.param("id"), user.id))) throw quoteNotFound();
    return c.body(null, 204);
  })
  .post("/:id/items", async (c) => {
    const user = currentUser(c);
    const { productId, quantity } = AddQuoteItemRequestSchema.parse(await c.req.json().catch(() => ({})));
    const result = await addItem(
      c.var.db,
      c.req.param("id"),
      user.id,
      productId,
      quantity,
      c.env.ASSETS_BASE_URL,
      new Date().toISOString(),
    );
    if (result === "quote_not_found") throw quoteNotFound();
    if (result === "product_not_found") throw new AppError(404, "product_not_found", "Producto no encontrado");
    return c.json(result.detail, result.created ? 201 : 200);
  })
  .patch("/:id/items/:itemId", async (c) => {
    const user = currentUser(c);
    const changes = UpdateQuoteItemRequestSchema.parse(await c.req.json().catch(() => ({})));
    const result = await updateItem(
      c.var.db,
      c.req.param("id"),
      user.id,
      ItemIdSchema.parse(c.req.param("itemId")),
      changes,
      c.env.ASSETS_BASE_URL,
      new Date().toISOString(),
    );
    if (!result) throw itemNotFound();
    if (result === "invalid_listing") throw new AppError(400, "invalid_listing", "Esa oferta no es de este producto");
    return c.json(result);
  })
  .delete("/:id/items/:itemId", async (c) => {
    const user = currentUser(c);
    const detail = await removeItem(
      c.var.db,
      c.req.param("id"),
      user.id,
      ItemIdSchema.parse(c.req.param("itemId")),
      c.env.ASSETS_BASE_URL,
    );
    if (!detail) throw itemNotFound();
    return c.json(detail);
  });
