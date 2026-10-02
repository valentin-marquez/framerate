import { CATEGORY_LABELS, type PricePoint, type ProductDetail } from "@framerate/contracts";
import { useEffect } from "react";
import { redirect } from "react-router";
import { CommentsSection } from "~/features/comments/components/comments-section";
import { COMMENTS_API_ENABLED } from "~/features/comments/services/comments";
import { ProductView } from "~/features/product/components/product-view";
import { productsService } from "~/features/product/services/products";
import { legacySlug } from "~/features/product/utils/legacy-slug";
import { periodFromParam } from "~/features/product/utils/price-history";
import { isRateLimitError } from "~/shared/lib/api";
import { formatCLP } from "~/shared/utils/format";
import type { Route } from "./+types/product-details";

/** Precio a destacar: el mejor con stock, o el de la oferta más barata si nadie tiene (la API las ordena así). */
const headlinePrice = (product: ProductDetail) => product.bestPrice ?? product.offers[0]?.priceCash ?? 0;

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Producto no encontrado - Framerate" }];
  const data = loaderData.product;

  const bestPrice = headlinePrice(data);
  const description = `Compra ${data.name} desde ${formatCLP(bestPrice)} en Chile. Compara precios en ${data.offerCount} tiendas.`;
  // ponytail: la foto de la tienda tal cual; una tarjeta propia (logo + foto + nombre) cuando haga falta.
  const ogImage = data.imageUrl || "/og-image.png";

  return [
    { title: `${data.name}: precios en Chile - Framerate` },
    { name: "description", content: description },
    { property: "og:site_name", content: "Framerate.cl" },
    { property: "og:locale", content: "es_CL" },
    { property: "og:type", content: "product" },
    { property: "og:title", content: data.name },
    { property: "og:description", content: description },
    { property: "og:image", content: ogImage },
    { property: "og:image:alt", content: `${data.name} — Framerate` },
    { property: "product:price:amount", content: String(bestPrice) },
    { property: "product:price:currency", content: "CLP" },
    { property: "product:category", content: CATEGORY_LABELS[data.category] },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: ogImage },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const period = periodFromParam(new URL(request.url).searchParams.get("periodo"));
  try {
    const [product, history] = await Promise.all([
      productsService.getBySlug(params.slug),
      // Sin historial la ficha sirve igual.
      productsService
        .getPriceHistory(params.slug, period.days)
        .catch((): PricePoint[] => []),
    ]);

    if (product.offers.length === 0) {
      throw new Response("Producto no encontrado", { status: 404 });
    }

    return { product, history, period, now: Date.now() };
  } catch (error) {
    // Respeta redirects/respuestas explícitas (incluye `throw redirect(...)`).
    if (error instanceof Response) throw error;

    // 429: el API rate-limitó. No queremos pintar un 404 (que sería confuso y
    // se cachearía en SEO). Lanzamos un 503 transitorio para que el navegador
    // reintente la próxima.
    if (isRateLimitError(error)) {
      throw new Response("Servicio saturado, intenta en unos segundos.", { status: 503 });
    }

    // Antes de rendir un 404 final, chequear si el slug fue renombrado.
    try {
      const canonical = await productsService.resolveRedirect(params.slug);
      if (canonical?.slug && canonical.slug !== params.slug) {
        throw redirect(`/producto/${canonical.slug}`, 301);
      }
    } catch (redirectErr) {
      if (redirectErr instanceof Response) throw redirectErr;
      if (isRateLimitError(redirectErr)) {
        throw new Response("Servicio saturado, intenta en unos segundos.", { status: 503 });
      }
      // Fallthrough al 404.
    }

    // Las URLs del sistema anterior (`...--<número>`) siguen llegando desde buscadores: a la ficha de hoy, o a una búsqueda.
    const legacy = legacySlug(params.slug);
    if (legacy) {
      const exists = await productsService.getBySlug(legacy.base).then(
        () => true,
        () => false,
      );
      throw redirect(
        exists ? `/producto/${legacy.base}` : `/explorar?search=${encodeURIComponent(legacy.search)}`,
        301,
      );
    }

    throw new Response("Producto no encontrado", { status: 404 });
  }
}

export default function ProductPage({ loaderData }: Route.ComponentProps) {
  const { product, history, period, now } = loaderData;
  // Fuera del loader: con prefetch="intent" el loader corre al pasar el mouse y cada hover contaría como visita.
  useEffect(() => {
    productsService.trackView(product.slug).catch(() => {});
  }, [product.slug]);

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    image: product.imageUrl,
    description: `Compra ${product.name} al mejor precio.`,
    brand: {
      "@type": "Brand",
      name: product.brand || "Genérico",
    },
    sku: product.mpn,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: headlinePrice(product),
      priceCurrency: "CLP",
      offerCount: product.offerCount,
      availability: `https://schema.org/${product.bestPrice === null ? "OutOfStock" : "InStock"}`,
    },
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      <ProductView product={product} history={history} period={period} now={now} />
      {COMMENTS_API_ENABLED && (
        <div className="mx-auto max-w-6xl px-4 pb-12">
          <CommentsSection targetType="product" targetId={String(product.id)} />
        </div>
      )}
    </>
  );
}
