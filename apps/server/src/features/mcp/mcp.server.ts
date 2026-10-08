import {
  bestOf,
  CATEGORIES,
  CATEGORY_LABELS,
  CategorySchema,
  historyDays,
  MCP_TOOLS,
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
  url: z.string().describe("Ficha en Framerate, con el enlace a cada tienda: es el enlace que se cita"),
});

const Offer = z.object({
  tienda: z.string(),
  tiendaSlug: z.string(),
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
      ...MCP_TOOLS.buscar_productos,
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
      ...MCP_TOOLS.ver_producto,
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
      ...MCP_TOOLS.historial_de_precios,
      outputSchema: {
        slug: z.string(),
        dias: z.array(z.object({ fecha: z.string(), precioEfectivo: z.number(), tienda: z.string() })),
      },
      annotations: READ_ONLY,
    },
    async ({ slug, dias }) => {
      // Ingest guarda un punto sólo cuando algo cambia: hacen falta las ofertas actuales para arrastrar cada precio.
      const history = await bySlug(slug, async (s) => {
        const [product, points] = await Promise.all([getProduct(db, s, undefined), getPriceHistory(db, s, dias)]);
        return product && points ? { offers: product.offers, points } : null;
      });
      if (!history) return notFound(slug);
      const { offers, points } = history.found;
      return json({
        slug: history.slug,
        dias: historyDays(points, offers, dias, Date.now()).flatMap((d) => {
          const best = bestOf(d, "cash");
          return best ? [{ fecha: d.day, precioEfectivo: best.cash, tienda: best.storeName }] : [];
        }),
      });
    },
  );

  server.registerTool(
    "listar_categorias",
    {
      ...MCP_TOOLS.listar_categorias,
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
      ...MCP_TOOLS.listar_tiendas,
      outputSchema: {
        tiendas: z.array(
          z.object({
            slug: z.string(),
            nombre: z.string(),
            url: z.string().describe("Página de la tienda en Framerate"),
            ofertasActivas: z.number(),
          }),
        ),
      },
      annotations: READ_ONLY,
    },
    async () => {
      const stores = await listStores(db);
      return json({
        tiendas: stores.map((s) => ({
          slug: s.slug,
          nombre: s.name,
          url: `${env.WEB_ORIGIN}/tiendas/${s.slug}`,
          ofertasActivas: s.offerCount,
        })),
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
