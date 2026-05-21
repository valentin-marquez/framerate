import type { LoaderFunctionArgs } from "react-router";

/**
 * `llms.txt` — resumen del sitio para asistentes de IA (ChatGPT, Perplexity,
 * Claude, AI Overviews). Sigue la convención https://llmstxt.org: H1 con el
 * nombre, blockquote con el resumen, y secciones de enlaces.
 *
 * Las categorías se traen del API para que los enlaces estén siempre al día;
 * si el API falla, se omite esa sección (el resto es estático).
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";

interface Category {
  name: string;
  slug: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { origin } = new URL(request.url);

  let categories: Category[] = [];
  try {
    const response = await fetch(`${API_URL}/v1/categories`);
    if (response.ok) {
      const data = (await response.json()) as Category[];
      categories = Array.isArray(data) ? data : [];
    }
  } catch {
    // El API no respondió: servimos llms.txt sin la sección de categorías.
  }

  const sections = [
    `# Framerate`,
    "",
    "> Comparador de precios de hardware para PC en Chile. Compara en tiempo real los precios y el stock de tarjetas de video, procesadores, memorias RAM y demás componentes entre las principales tiendas chilenas.",
    "",
    "Framerate.cl agrega precios y disponibilidad de componentes de PC desde múltiples tiendas de Chile (PC Express, SP Digital, Central Gamer, entre otras), permitiendo comparar ofertas, revisar el historial de precios y armar cotizaciones. Los precios se actualizan automáticamente. El sitio sirve a una audiencia chilena: precios en CLP y contenido en español.",
    "",
    "## Navegación principal",
    `- [Explorar productos](${origin}/explorar): catálogo completo con filtros por categoría, marca y precio`,
    `- [Reclamar una tienda](${origin}/reclamar): flujo para que los dueños reclamen el perfil de su tienda`,
  ];

  if (categories.length > 0) {
    sections.push("", "## Categorías");
    for (const category of categories) {
      sections.push(`- [${category.name}](${origin}/categoria/${category.slug})`);
    }
  }

  sections.push(
    "",
    "## Legal",
    `- [Términos de servicio](${origin}/terms)`,
    `- [Política de privacidad](${origin}/privacy)`,
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
