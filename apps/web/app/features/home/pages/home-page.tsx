import { categoriesService } from "@/features/category/services/categories";
import { productsService } from "@/features/product/services/products";
import { getCategoryConfig } from "~/features/category/utils/categories";
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

export async function loader() {
  let categories: Awaited<ReturnType<typeof categoriesService.getAll>> = [];
  try {
    categories = await categoriesService.getAll();
  } catch (error) {
    if (!isRateLimitError(error)) {
      console.error("Failed to fetch categories", error);
    }
  }

  // No se piden filas de categorías que no llenarían el carrusel: cada una es una llamada a la API.
  const rowCategories = categories.filter((c) => (c.product_count ?? 0) >= MIN_ROW_PRODUCTS);

  // "Mejores ofertas" vuelve cuando exista precio de referencia (hoy repetiría "Lo más popular").
  const rowDefs: { key: string; title: string; href: string }[] = [
    { key: "popular", title: "Lo más popular", href: "/explorar" },
    ...rowCategories.map((c) => {
      const config = getCategoryConfig(c.slug);
      return { key: c.slug, title: config.label, href: `/categoria/${config.urlSlug}` };
    }),
  ];

  const fetches = [
    productsService.getAll({ sort: "popularity", limit: 15 }),
    ...rowCategories.map((c) => productsService.getAll({ category: c.slug, sort: "popularity", limit: 12 })),
  ];

  // allSettled aísla fallos/rate-limit: una fila que falla simplemente no se renderiza.
  const [settled, trending, stores] = await Promise.all([
    Promise.allSettled(fetches),
    productsService.getTrending(40).catch(() => ({ ids: [] as string[] })),
    storesService.listClaimable().then(
      (r) => r.stores,
      () => [],
    ),
  ]);

  const rows: HomeRow[] = [];
  settled.forEach((result, i) => {
    if (result.status !== "fulfilled") {
      if (result.reason && !isRateLimitError(result.reason)) {
        console.error(`Failed to fetch home row "${rowDefs[i].key}"`, result.reason);
      }
      return;
    }
    const products = result.value.data ?? [];
    if (products.length >= MIN_ROW_PRODUCTS) {
      rows.push({ ...rowDefs[i], products });
    }
  });

  return { categories, rows, trendingIds: trending.ids, stores } satisfies HomeData;
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
