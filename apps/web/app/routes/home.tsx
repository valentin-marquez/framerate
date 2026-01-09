import { useProductDrops, useProducts } from "@/hooks/useProducts";
import { categoriesService } from "@/services/categories";
import { productsService } from "@/services/products";
import { CategoriesGrid } from "~/components/home/categories-grid";
import { HeroSection } from "~/components/home/hero-section";
import { PopularProducts } from "~/components/home/popular-products";
import { PriceDropsCarousel } from "~/components/home/price-drops-carousel";
import type { Route } from "./+types/home";

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

export async function loader() {
  try {
    const [popularProducts, categories, priceDrops] = await Promise.all([
      productsService.getAll({ limit: 50, sort: "popularity" }),
      categoriesService.getAll(),
      productsService.getDrops(12, 5),
    ]);
    return { popularProducts, categories, priceDrops };
  } catch (error) {
    console.error("Failed to fetch data", error);
    return {
      popularProducts: {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
      categories: [],
      priceDrops: [],
    };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { popularProducts: initialPopular, categories: initialCategories, priceDrops: initialDrops } = loaderData;

  const { data: popularProducts } = useProducts({ limit: 50, sort: "popularity" }, { initialData: initialPopular });

  const { data: priceDrops } = useProductDrops(12, 5, { initialData: initialDrops });

  const products = popularProducts ?? initialPopular;
  const drops = priceDrops ?? initialDrops;
  const categories = initialCategories ?? [];

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD injection
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateJsonLd()) }}
      />

      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <HeroSection totalProducts={products.meta.total} totalCategories={categories.length} />

        {/* Main Content */}
        <div className="flex flex-col gap-16 md:gap-24 pb-20">
          {/* Price Drops Carousel */}
          <PriceDropsCarousel drops={drops} />

          {/* Categories Grid */}
          <CategoriesGrid categories={categories} />

          {/* Popular Products */}
          <PopularProducts products={products.data} totalProducts={products.meta.total} />
        </div>
      </div>
    </>
  );
}
