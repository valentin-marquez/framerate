import type { LoaderFunctionArgs } from "react-router";

/**
 * `sitemap.xml` dinámico.
 *
 * Los slugs del catálogo los provee el API (`GET /v1/sitemap`); este loader
 * sólo arma el XML con el host público de la request. Si el API falla, devuelve
 * igual un sitemap con las rutas estáticas (nunca 500 — robots.txt lo anuncia).
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";

// Rutas estáticas públicas e indexables. Las URLs visibles van en español
// (ver CLAUDE.md). Se excluyen auth/settings/admin/perfiles y cotizaciones.
const STATIC_PATHS = ["/", "/explorar", "/reclamar", "/privacy", "/terms"];

interface SitemapData {
  products: string[];
  categories: string[];
  stores: string[];
}

/** Escapa los caracteres reservados de XML en una URL. */
function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );
}

function buildXml(origin: string, paths: string[]): string {
  const urls = paths.map((path) => `  <url><loc>${escapeXml(origin + path)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { origin } = new URL(request.url);
  const paths = [...STATIC_PATHS];

  try {
    const response = await fetch(`${API_URL}/v1/sitemap`);
    if (response.ok) {
      const { products, categories, stores } = (await response.json()) as SitemapData;
      for (const slug of categories ?? []) paths.push(`/categoria/${slug}`);
      for (const slug of products ?? []) paths.push(`/producto/${slug}`);
      for (const slug of stores ?? []) paths.push(`/tiendas/${slug}`);
    }
  } catch {
    // El API no respondió: servimos al menos las rutas estáticas.
  }

  return new Response(buildXml(origin, paths), {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
