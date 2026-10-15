import { CATEGORIES, CATEGORY_SLUGS, type ProductPage, type ProductSummary } from "@framerate/contracts";
import { categoriesService } from "@/features/category/services/categories";
import { productsService } from "@/features/product/services/products";
import { HomeContent } from "~/features/home/components/home-content";
import type { HomeData, HomeRow } from "~/features/home/types";
import { storesService } from "~/features/stores/services/stores";
import { isRateLimitError } from "~/shared/lib/api";
import type { Route } from "./+types/home-page";

export function meta() {
  return [
    { title: "Framerate - Comparador de Precios y Cotizaciones de Hardware en Chile" },
    {
      name: "description",
      content:
        "Encuentra los precios más bajos para armar tu PC Gamer en Chile. Compara GPUs, CPUs y componentes en tiempo real de las principales tiendas (SpDigital, PCFactory, etc.).",
    },
    {
      name: "keywords",
      content:
        "hardware chile, pc gamer chile, cotizador pc, tarjeta de video precio, armar pc chile, comparación precios hardware",
    },
    { property: "og:title", content: "Framerate - El mejor comparador de precios de hardware en Chile" },
    {
      property: "og:description",
      content:
        "Ahorra dinero armando tu PC. Compara precios, verifica stock y crea cotizaciones inteligentes con Framerate.",
    },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Framerate.cl" },
    { property: "og:locale", content: "es_CL" },
    { property: "og:image", content: "/og-image.png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Framerate - Comparador de Hardware Chile" },
    { name: "twitter:description", content: "Encuentra los mejores precios para tu próximo PC Gamer." },
    { name: "twitter:image", content: "/og-image.png" },
  ];
}

// JSON-LD del home: WebSite (habilita el sitelinks searchbox) + Organization
// (entidad de marca — nombre, logo, perfiles). Un array top-level es JSON-LD
// válido; las URLs van al dominio de producción a propósito.
function generateJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Framerate",
      url: "https://framerate.cl",
      description: "El mejor comparador de precios de hardware en Chile",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://framerate.cl/buscar?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Framerate",
      url: "https://framerate.cl",
      logo: "https://framerate.cl/favicon.svg",
      description:
        "Comparador de precios de hardware para PC en Chile: GPUs, CPUs, RAM y componentes de las principales tiendas chilenas.",
      sameAs: ["https://github.com/valentin-marquez/framerate"],
    },
  ];
}

// Mínimo de productos para que una fila/carrusel valga la pena mostrarse.
const MIN_ROW_PRODUCTS = 4;
// Cada tarjeta son ~35 nodos y la home tiene una docena de filas: más tarjetas engordan el HTML y la hidratación.
const ROW_LIMIT = 8;

/** Productos de una fila; si falla (o hay rate limit) la fila simplemente no se renderiza. */
function rowItems(page: Promise<ProductPage>, key: string) {
  return page.then(
    (r) => r.items,
    (error) => {
      if (!isRateLimitError(error)) console.error(`Failed to fetch home row "${key}"`, error);
      return [] as ProductSummary[];
    },
  );
}

export async function loader() {
  // Las filas no esperan a las categorías: la lista es fija y cada espera es un viaje a D1 (~140 ms desde Chile).
  // De la API sólo salen el orden, el nombre y el conteo.
  const rowBySlug = new Map(
    CATEGORIES.map((c) => {
      const slug = CATEGORY_SLUGS[c];
      return [slug, rowItems(productsService.getAll({ category: slug, sort: "popularity", limit: ROW_LIMIT }), slug)];
    }),
  );

  const [categories, popular, drops, trending, stores] = await Promise.all([
    categoriesService.getAll().catch((error) => {
      if (!isRateLimitError(error)) console.error("Failed to fetch categories", error);
      return [] as Awaited<ReturnType<typeof categoriesService.getAll>>;
    }),
    rowItems(productsService.getAll({ sort: "popularity", limit: ROW_LIMIT }), "popular"),
    productsService.getDrops(ROW_LIMIT).catch((error) => {
      if (!isRateLimitError(error)) console.error("Failed to fetch home drops", error);
      return [];
    }),
    productsService.getTrending(40).catch(() => ({ ids: [] as number[] })),
    storesService.listClaimable().then(
      (r) => r.stores.filter((s) => (s.offer_count ?? 0) > 0),
      () => [],
    ),
  ]);

  const rows: HomeRow[] = [{ key: "popular", title: "Lo más popular", href: "/buscar", products: popular }];
  for (const c of categories) {
    const products = (await rowBySlug.get(c.slug)) ?? [];
    rows.push({ key: c.slug, title: c.label, href: `/categoria/${c.slug}`, products });
  }

  return {
    categories,
    rows: rows.filter((r) => r.products.length >= MIN_ROW_PRODUCTS),
    drops,
    trendingIds: trending.ids,
    stores,
  } satisfies HomeData;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD injection
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateJsonLd()) }}
      />
      <div className="flex min-h-screen flex-col">
        <HomeContent {...loaderData} />
      </div>
    </>
  );
}
