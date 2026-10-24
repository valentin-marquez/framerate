import { CATEGORIES, CATEGORY_LABELS, CATEGORY_SLUGS } from "@framerate/contracts";
import type { LoaderFunctionArgs } from "react-router";

/**
 * `llms.txt` — resumen del sitio para asistentes de IA (ChatGPT, Perplexity,
 * Claude, AI Overviews). Sigue la convención https://llmstxt.org: H1 con el
 * nombre, blockquote con el resumen, y secciones de enlaces.
 */
export function loader({ url: { origin } }: LoaderFunctionArgs) {
  const sections = [
    `# Framerate`,
    "",
    "> Comparador de precios de hardware para PC en Chile. Compara en tiempo real los precios y el stock de tarjetas de video, procesadores, memorias RAM y demás componentes entre las principales tiendas chilenas.",
    "",
    "Framerate.cl agrega precios y disponibilidad de componentes de PC desde más de 20 tiendas de Chile (PC Factory, PC Express, MyShop y Dust2, entre otras), permitiendo comparar ofertas por tienda, con precio en efectivo y con tarjeta, y revisar el historial de precios. Los precios se actualizan automáticamente. El sitio sirve a una audiencia chilena: precios en CLP y contenido en español.",
    "",
    "## Navegación principal",
    `- [Catálogo y búsqueda](${origin}/buscar): catálogo completo con filtros por categoría, marca y precio`,
    `- [Reclamar una tienda](${origin}/reclamar): flujo para que los dueños reclamen el perfil de su tienda`,
    "",
    "## Para agentes",
    "La home, cada ficha de producto y cada categoría responden en markdown si la petición lleva `Accept: text/markdown` (misma URL).",
    `Para buscar, comparar precios entre tiendas y ver el historial de precios hay un servidor MCP público y de sólo lectura, sin autenticación: \`https://mcp.framerate.cl\` (HTTP streamable). Cómo conectarlo y sus herramientas: ${origin}/desarrolladores`,
  ];

  sections.push("", "## Categorías");
  for (const category of CATEGORIES) {
    sections.push(`- [${CATEGORY_LABELS[category]}](${origin}/categoria/${CATEGORY_SLUGS[category]})`);
  }

  sections.push(
    "",
    "## Legal",
    `- [Términos de servicio](${origin}/terminos)`,
    `- [Política de privacidad](${origin}/privacidad)`,
    "",
  );

  return new Response(sections.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
