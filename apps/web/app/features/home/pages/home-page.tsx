import { categoriesService } from "@/features/category/services/categories";
import { productsService } from "@/features/product/services/products";
import { getCategoryConfig } from "~/features/category/utils/categories";
import { CategoryLinks } from "~/features/home/components/category-links";
import { CompactSearchHero } from "~/features/home/components/compact-search-hero";
import { ProductRow } from "~/features/home/components/product-row";
import type { Product } from "~/features/product/services/products";
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

function generateJsonLd() {
  return {
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
  };
}

interface HomeRow {
  key: string;
  title: string;
  href: string;
  products: Product[];
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

  // Filas curadas + una por categoría. allSettled aísla fallos/rate-limit:
  // una fila que falla simplemente no se renderiza, sin tirar al error boundary.
  const rowDefs: { key: string; title: string; href: string }[] = [
    { key: "discount", title: "Mejores ofertas", href: "/explorar?sort=discount" },
    { key: "popular", title: "Lo más popular", href: "/explorar" },
    ...categories.map((c) => {
      const config = getCategoryConfig(c.slug);
      return { key: c.slug, title: config.label, href: `/categoria/${config.urlSlug}` };
    }),
  ];

  const fetches = [
    productsService.getAll({ sort: "discount", limit: 15 }),
    productsService.getAll({ sort: "popularity", limit: 15 }),
    ...categories.map((c) => productsService.getAll({ category: c.slug, sort: "popularity", limit: 12 })),
  ];

  const [settled, trending] = await Promise.all([
    Promise.allSettled(fetches),
    productsService.getTrending(40).catch(() => ({ ids: [] as string[] })),
  ]);
  const trendingIds = trending.ids;

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

  return { categories, rows, trendingIds };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { categories, rows, trendingIds } = loaderData;
  const trendingSet = new Set(trendingIds);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD injection
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateJsonLd()) }}
      />

      <div className="flex flex-col min-h-screen">
        <CompactSearchHero categories={categories} />

        <div className="flex flex-col gap-10 md:gap-12 pb-16">
          {rows.map((row, index) => (
            <ProductRow
              key={row.key}
              title={row.title}
              href={row.href}
              products={row.products}
              priority={index === 0}
              // En "Lo más popular" todo sería tendencia → ruido; ahí no.
              trendingIds={row.key === "popular" ? undefined : trendingSet}
            />
          ))}

          <CategoryLinks categories={categories} />
        </div>
      </div>
    </>
  );
}
