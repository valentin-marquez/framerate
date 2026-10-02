import {
  AddQuoteItemRequestSchema,
  CreateQuoteRequestSchema,
  QuoteListQuerySchema,
  UpdateQuoteItemRequestSchema,
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
  createQuote,
  listPublicQuotes,
  listQuotes,
  loadQuote,
  removeItem,
  setItemQuantity,
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
  .get("/:id", async (c) => {
    const quote = await loadQuote(c.var.db, c.req.param("id"), c.env.ASSETS_BASE_URL);
    if (!quote || !canRead(quote, c.get("user")?.id)) throw quoteNotFound();
    return c.json(quote.detail);
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
    const { quantity } = UpdateQuoteItemRequestSchema.parse(await c.req.json().catch(() => ({})));
    const detail = await setItemQuantity(
      c.var.db,
      c.req.param("id"),
      user.id,
      ItemIdSchema.parse(c.req.param("itemId")),
      quantity,
      c.env.ASSETS_BASE_URL,
      new Date().toISOString(),
    );
    if (!detail) throw itemNotFound();
    return c.json(detail);
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
