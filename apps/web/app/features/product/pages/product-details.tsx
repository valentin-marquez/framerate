import { CATEGORY_LABELS, type PricePoint } from "@framerate/contracts";
import { useEffect } from "react";
import { redirect } from "react-router";
import { CommentsSection } from "~/features/comments/components/comments-section";
import { ProductView } from "~/features/product/components/product-view";
import { headlinePrice, ogImagePath, shareDescription } from "~/features/product/lib/share";
import { productsService } from "~/features/product/services/products";
import { periodFromParam } from "~/features/product/utils/price-history";
import { isRateLimitError } from "~/shared/lib/api";
import type { Route } from "./+types/product-details";

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Producto no encontrado - Framerate" }];
  const { product: data, origin } = loaderData;

  const bestPrice = headlinePrice(data);
  const description = shareDescription(data);
  const url = `${origin}/producto/${data.slug}`;
  // Tarjeta propia de 1200×630 (foto sobre la base de la marca); `v` cambia con la foto, así se cachea sin vencer.
  const image = data.imageUrl ? `${origin}${ogImagePath(data.slug, data.imageUrl)}` : `${origin}/og-image.png`;

  return [
    { title: `${data.name}: precios en Chile - Framerate` },
    { name: "description", content: description },
    { property: "og:site_name", content: "Framerate.cl" },
    { property: "og:locale", content: "es_CL" },
    { property: "og:type", content: "product" },
    { property: "og:url", content: url },
    { property: "og:title", content: data.name },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:image:type", content: data.imageUrl ? "image/jpeg" : "image/png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: `${data.name} en Framerate` },
    ...(bestPrice === null
      ? []
      : [
          { property: "product:price:amount", content: String(bestPrice) },
          { property: "product:price:currency", content: "CLP" },
        ]),
    { property: "product:category", content: CATEGORY_LABELS[data.category] },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: data.name },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    // Discord arma con este JSON una tarjeta propia (foto, precio, tiendas y botones); sin él, usa lo de arriba.
    {
      tagName: "link",
      rel: "discord:component-embed",
      type: "application/json",
      href: `${origin}/embed/discord/producto/${data.slug}`,
    },
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

    return { product, history, period, now: Date.now(), origin: new URL(request.url).origin };
  } catch (error) {
    // Respeta redirects/respuestas explícitas (incluye `throw redirect(...)`).
    if (error instanceof Response) throw error;

    // 429: el API rate-limitó. No queremos pintar un 404 (que sería confuso y
    // se cachearía en SEO). Lanzamos un 503 transitorio para que el navegador
    // reintente la próxima.
    if (isRateLimitError(error)) {
      throw new Response("Servicio saturado, intenta en unos segundos.", { status: 503 });
    }

    // Antes de rendir un 404 final, chequear si el slug fue renombrado o es del sistema anterior (#145).
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

    // Sin ficha a la cual mandarla, 404: una búsqueda vacía Google la cuenta como soft 404.
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
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <CommentsSection productId={product.id} />
      </div>
    </>
  );
}
