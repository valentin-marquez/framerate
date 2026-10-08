import {
  CATEGORIES,
  CATEGORY_LABELS,
  CategorySchema,
  type PricePoint,
  type ProductSummary,
} from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { Env } from "@/env";
import {
  categoryCounts,
  getPriceHistory,
  getProduct,
  listProducts,
  listStores,
  resolveRedirect,
} from "@/features/catalog/catalog.queries";

/**
 * Servidor MCP público y de sólo lectura sobre el catálogo (#125), en `mcp.framerate.cl`. Sin estado: cada petición
 * arma su servidor y su transporte, sin sesión. Los títulos de las tiendas son texto de terceros: no se devuelven,
 * así no pueden colarle instrucciones al agente.
 */

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const SORTS = ["relevance", "price_asc", "price_desc", "discount", "popularity", "newest"] as const;

const ProductItem = z.object({
  slug: z.string(),
  nombre: z.string(),
  marca: z.string().nullable(),
  categoria: CategorySchema,
  mpn: z.string().nullable(),
  atributos: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  precioEfectivo: z.number().nullable().describe("CLP, mejor precio por transferencia o efectivo con stock"),
  precioTarjeta: z.number().nullable().describe("CLP, mejor precio con tarjeta con stock"),
  precioHabitual: z.number().nullable().describe("CLP, promedio de los 30 días previos; null sin historia"),
  url: z.string(),
});

const Offer = z.object({
  tienda: z.string(),
  tiendaSlug: z.string(),
  url: z.string(),
  precioEfectivo: z.number(),
  precioTarjeta: z.number(),
  conStock: z.boolean(),
  vistaEl: z.string().describe("Última vez que se vio la oferta (ISO 8601)"),
});

function json<T extends Record<string, unknown>>(data: T) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data };
}

function usageError(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

/** Mejor precio con stock por día: la historia cruda trae un punto por tienda y corrida, demasiado para un agente. */
export function dailyBest(points: PricePoint[]) {
  const days = new Map<string, { fecha: string; precioEfectivo: number; tienda: string }>();
  for (const p of points) {
    if (!p.inStock) continue;
    const fecha = p.observedAt.slice(0, 10);
    const best = days.get(fecha);
    if (!best || p.priceCash < best.precioEfectivo)
      days.set(fecha, { fecha, precioEfectivo: p.priceCash, tienda: p.storeName });
  }
  return [...days.values()];
}

export function createMcpServer(db: Db, env: Env) {
  const productUrl = (slug: string) => `${env.WEB_ORIGIN}/producto/${slug}`;
  const item = (p: ProductSummary): z.infer<typeof ProductItem> => ({
    slug: p.slug,
    nombre: p.name,
    marca: p.brand,
    categoria: p.category,
    mpn: p.mpn,
    atributos: p.attributes,
    precioEfectivo: p.bestPrice,
    precioTarjeta: p.bestCardPrice,
    precioHabitual: p.referencePrice,
    url: productUrl(p.slug),
  });
  /** Carga por slug y, si no existe, sigue la redirección que dejó una fusión de productos. */
  const bySlug = async <T>(slug: string, load: (slug: string) => Promise<T | null>) => {
    const found = await load(slug);
    if (found) return { slug, found };
    const target = await resolveRedirect(db, slug);
    const redirected = target ? await load(target) : null;
    return target && redirected ? { slug: target, found: redirected } : null;
  };
  const notFound = (slug: string) =>
    usageError(`No hay un producto con el slug "${slug}". Búscalo primero con buscar_productos y usa su slug.`);

  const server = new McpServer({ name: "framerate", version: "1.0.0" });

  server.registerTool(
    "buscar_productos",
    {
      title: "Buscar productos",
      description:
        "Busca componentes de PC con stock en tiendas chilenas y devuelve el mejor precio de cada uno. Úsala para " +
        "encontrar o comparar productos por texto, categoría, marca, tienda o rango de precio. Para ver las ofertas " +
        "de cada tienda de un producto, usa ver_producto con su slug.",
      inputSchema: {
        consulta: z
          .string()
          .trim()
          .min(2)
          .max(100)
          .optional()
          .describe('Texto libre, por ejemplo "RTX 4060" o "B650M"'),
        categoria: CategorySchema.optional().describe(
          `Una de: ${CATEGORIES.map((c) => `${c} (${CATEGORY_LABELS[c]})`).join(", ")}`,
        ),
        marca: z.string().min(1).max(64).optional(),
        tienda: z.string().min(1).max(64).optional().describe("Slug de tienda, de listar_tiendas"),
        precioMin: z.number().int().min(0).optional().describe("CLP, sobre el precio en efectivo"),
        precioMax: z.number().int().min(0).optional().describe("CLP, sobre el precio en efectivo"),
        orden: z
          .enum(SORTS)
          .default("relevance")
          .describe(
            "relevance (más tiendas primero), price_asc, price_desc, discount (mayor baja), popularity, newest",
          ),
        pagina: z.number().int().min(1).max(20).default(1),
        limite: z.number().int().min(1).max(25).default(10),
      },
      outputSchema: { total: z.number(), pagina: z.number(), productos: z.array(ProductItem) },
      annotations: READ_ONLY,
    },
    async (args) => {
      const page = await listProducts(
        db,
        {
          q: args.consulta,
          category: args.categoria,
          brand: args.marca,
          store: args.tienda,
          minPrice: args.precioMin,
          maxPrice: args.precioMax,
          sort: args.orden,
          page: args.pagina,
          pageSize: args.limite,
        },
        undefined,
      );
      return json({ total: page.total, pagina: page.page, productos: page.items.map(item) });
    },
  );

  server.registerTool(
    "ver_producto",
    {
      title: "Ver producto",
      description:
        "Ficha de un producto con sus ofertas por tienda: precio en efectivo, precio con tarjeta, stock y enlace a la " +
        "tienda. Necesita el slug que devuelve buscar_productos. No sirve para buscar.",
      inputSchema: { slug: z.string().min(1).max(120) },
      outputSchema: { producto: ProductItem, ofertas: z.array(Offer) },
      annotations: READ_ONLY,
    },
    async ({ slug }) => {
      const product = (await bySlug(slug, (s) => getProduct(db, s, undefined)))?.found;
      if (!product) return notFound(slug);
      return json({
        producto: item(product),
        ofertas: product.offers.map((o) => ({
          tienda: o.store.name,
          tiendaSlug: o.store.slug,
          url: o.url,
          precioEfectivo: o.priceCash,
          precioTarjeta: o.priceCard,
          conStock: o.inStock,
          vistaEl: o.lastSeenAt,
        })),
      });
    },
  );

  server.registerTool(
    "historial_de_precios",
    {
      title: "Historial de precios",
      description:
        "Mejor precio en efectivo con stock de un producto, por día, y en qué tienda. Úsala para saber si un precio " +
        "bajó o subió. Necesita el slug que devuelve buscar_productos.",
      inputSchema: {
        slug: z.string().min(1).max(120),
        dias: z.number().int().min(1).max(365).default(30),
      },
      outputSchema: {
        slug: z.string(),
        dias: z.array(z.object({ fecha: z.string(), precioEfectivo: z.number(), tienda: z.string() })),
      },
      annotations: READ_ONLY,
    },
    async ({ slug, dias }) => {
      const history = await bySlug(slug, (s) => getPriceHistory(db, s, dias));
      if (!history) return notFound(slug);
      return json({ slug: history.slug, dias: dailyBest(history.found) });
    },
  );

  server.registerTool(
    "listar_categorias",
    {
      title: "Listar categorías",
      description: "Categorías del catálogo con cuántos productos tienen stock. Sus id sirven para buscar_productos.",
      outputSchema: {
        categorias: z.array(z.object({ id: CategorySchema, nombre: z.string(), productosConStock: z.number() })),
      },
      annotations: READ_ONLY,
    },
    async () => {
      const counts = new Map((await categoryCounts(db)).map((r) => [r.category, r.products]));
      return json({
        categorias: CATEGORIES.map((id) => ({
          id,
          nombre: CATEGORY_LABELS[id],
          productosConStock: counts.get(id) ?? 0,
        })),
      });
    },
  );

  server.registerTool(
    "listar_tiendas",
    {
      title: "Listar tiendas",
      description: "Tiendas chilenas que compara Framerate, con cuántas ofertas activas tiene cada una.",
      outputSchema: {
        tiendas: z.array(
          z.object({ slug: z.string(), nombre: z.string(), url: z.string(), ofertasActivas: z.number() }),
        ),
      },
      annotations: READ_ONLY,
    },
    async () => {
      const stores = await listStores(db);
      return json({
        tiendas: stores.map((s) => ({ slug: s.slug, nombre: s.name, url: s.url, ofertasActivas: s.offerCount })),
      });
    },
  );

  return server;
}

/** Una petición HTTP del protocolo (HTTP streamable, sin estado, respuestas JSON en vez de SSE). */
export async function handleMcp(request: Request, db: Db, env: Env) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    // El protocolo exige validar Origin. Los clientes MCP no son navegadores y no lo mandan; uno ajeno se rechaza.
    enableDnsRebindingProtection: true,
    allowedOrigins: [env.WEB_ORIGIN],
  });
  await createMcpServer(db, env).connect(transport);
  return transport.handleRequest(request);
}
