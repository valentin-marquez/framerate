import { z } from "zod";
import { CATEGORIES, CATEGORY_LABELS, CategorySchema } from "./categories";

/**
 * Herramientas del servidor MCP (`mcp.framerate.cl`): nombre, descripción y parámetros. El servidor las registra y la
 * página /desarrolladores las documenta desde aquí, así no se desfasan.
 */

export const MCP_URL = "https://mcp.framerate.cl";

const SORTS = ["relevance", "price_asc", "price_desc", "discount", "popularity", "newest"] as const;
const slug = z.string().min(1).max(120).describe("Slug del producto, de buscar_productos");

export const MCP_TOOLS = {
  buscar_productos: {
    title: "Buscar productos",
    description:
      "Busca componentes de PC con stock en tiendas chilenas y devuelve el mejor precio de cada uno. Úsala para " +
      "encontrar o comparar productos por texto, categoría, marca, tienda o rango de precio. Para ver las ofertas " +
      "de cada tienda de un producto, usa ver_producto con su slug.",
    inputSchema: {
      consulta: z.string().trim().min(2).max(100).optional().describe('Texto libre, por ejemplo "RTX 4060" o "B650M"'),
      categoria: CategorySchema.optional().describe(
        `Una de: ${CATEGORIES.map((c) => `${c} (${CATEGORY_LABELS[c]})`).join(", ")}`,
      ),
      marca: z.string().min(1).max(64).optional().describe("Marca, por ejemplo ASUS"),
      tienda: z.string().min(1).max(64).optional().describe("Slug de tienda, de listar_tiendas"),
      precioMin: z.number().int().min(0).optional().describe("CLP, sobre el precio en efectivo"),
      precioMax: z.number().int().min(0).optional().describe("CLP, sobre el precio en efectivo"),
      orden: z
        .enum(SORTS)
        .default("relevance")
        .describe("relevance (más tiendas primero), price_asc, price_desc, discount (mayor baja), popularity, newest"),
      pagina: z.number().int().min(1).max(20).default(1).describe("Página de resultados"),
      limite: z.number().int().min(1).max(25).default(10).describe("Resultados por página"),
    },
  },
  ver_producto: {
    title: "Ver producto",
    description:
      "Ficha de un producto con sus ofertas por tienda: precio en efectivo, precio con tarjeta, stock y enlace a la " +
      "tienda. Necesita el slug que devuelve buscar_productos. No sirve para buscar.",
    inputSchema: { slug },
  },
  historial_de_precios: {
    title: "Historial de precios",
    description:
      "Mejor precio en efectivo con stock de un producto, por día, y en qué tienda. Úsala para saber si un precio " +
      "bajó o subió. Los días en que ninguna tienda tuvo stock no aparecen. Necesita el slug que devuelve buscar_productos.",
    inputSchema: { slug, dias: z.number().int().min(1).max(365).default(30).describe("Días hacia atrás desde hoy") },
  },
  listar_categorias: {
    title: "Listar categorías",
    description: "Categorías del catálogo con cuántos productos tienen stock. Sus id sirven para buscar_productos.",
    inputSchema: {},
  },
  listar_tiendas: {
    title: "Listar tiendas",
    description: "Tiendas chilenas que compara Framerate, con cuántas ofertas activas tiene cada una.",
    inputSchema: {},
  },
} satisfies Record<string, { title: string; description: string; inputSchema: z.ZodRawShape }>;
