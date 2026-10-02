import { CATEGORY_LABELS, categoryFromSlug } from "@framerate/contracts";
import { categoriesService } from "~/features/category/services/categories";
import { productsService } from "~/features/product/services/products";
import { categoryMarkdown, homeMarkdown, prefersMarkdown, productMarkdown } from "./markdown";

/** Rutas con una versión en markdown para agentes: la home, la ficha y la categoría. */
const MARKDOWN_PATH = /^\/(?:(?:producto|categoria)\/[^/]+)?$/;
export const hasMarkdownVersion = (url: URL) => MARKDOWN_PATH.test(url.pathname);

async function body(url: URL): Promise<string | null> {
  const [, section, slug] = url.pathname.split("/");
  if (!section) return homeMarkdown(await categoriesService.getAll(), url.origin);
  if (section === "producto" && slug) return productMarkdown(await productsService.getBySlug(slug), url.origin);
  const category = slug ? categoryFromSlug(slug) : undefined;
  if (category && slug) {
    const page = await productsService.getAll({ category: slug, sort: "popularity", limit: 24 });
    return categoryMarkdown(CATEGORY_LABELS[category], slug, page, url.origin);
  }
  return null;
}

/** La misma URL en markdown si el agente lo pide (`Accept: text/markdown`); `null` si no aplica y sigue el HTML. */
export async function markdownResponse(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "GET" || !hasMarkdownVersion(url) || !prefersMarkdown(request.headers.get("accept"))) {
    return null;
  }
  try {
    const text = await body(url);
    if (text === null) return null;
    return new Response(text, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        Vary: "Accept",
      },
    });
  } catch {
    // Un producto que no existe o una API caída: que responda la página normal (con su 404 o su error).
    return null;
  }
}

/** Marca la respuesta HTML de esas rutas como variable por `Accept`, para que una caché no la mezcle con el markdown. */
export function varyByAccept(request: Request, response: Response): Response {
  if (!hasMarkdownVersion(new URL(request.url))) return response;
  const headers = new Headers(response.headers);
  headers.append("Vary", "Accept");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
