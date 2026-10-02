import { CATEGORY_LABELS, CATEGORY_SLUGS, type ProductDetail } from "@framerate/contracts";
import {
  IconBuildingStore,
  IconChartLine,
  IconChevronRight,
  IconCircleCheck,
  IconExternalLink,
  IconHome,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { Link, redirect } from "react-router";
import { CommentsSection } from "~/features/comments/components/comments-section";
import { COMMENTS_API_ENABLED } from "~/features/comments/services/comments";
import { AddToQuote } from "~/features/product/components/add-to-quote";
import { PriceHistoryChart } from "~/features/product/components/price-history-chart";
import { usePriceHistory } from "~/features/product/hooks/useProducts";
import { productsService } from "~/features/product/services/products";
import { OutboundLink } from "~/shared/components/outbound-link";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Badge } from "~/shared/components/primitives/badge";
import { buttonVariants } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { useTranslation } from "~/shared/hooks/use-translation";
import { isRateLimitError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { Route } from "./+types/product-details";

/** Atributos que se muestran como especificaciones, con la clave de traducción de su nombre. El resto (línea, OC,
 * wifi...) sólo le sirve al matching. */
const SPEC_LABELS = {
  chipset: "chipset",
  vram: "memory_gb",
  capacity: "capacity_gb",
  type: "type",
  speed: "speed_mt_s",
  interface: "interface",
  rpm: "rpm",
  formFactor: "form_factor",
  wattage: "wattage",
  efficiency: "efficiency_rating",
};

/** Precio a destacar: el mejor con stock, o el de la oferta más barata si nadie tiene (la API las ordena así). */
const headlinePrice = (product: ProductDetail) => product.bestPrice ?? product.offers[0]?.priceCash ?? 0;

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Producto no encontrado - Framerate" }];

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

export async function loader({ params }: Route.LoaderArgs) {
  try {
    const product = await productsService.getBySlug(params.slug);

    if (product.offers.length === 0) {
      throw new Response("Producto no encontrado", { status: 404 });
    }

    return product;
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

    throw new Response("Producto no encontrado", { status: 404 });
  }
}

// react-doctor-disable-next-line no-giant-component -- breaking into focused components is a separate task, tracked
export default function ProductPage({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();

  const product = loaderData;
  // Fuera del loader: con prefetch="intent" el loader corre al pasar el mouse y cada hover contaría como visita.
  useEffect(() => {
    productsService.trackView(product.slug).catch(() => {});
  }, [product.slug]);
  const { data: priceHistory = [] } = usePriceHistory(product.slug, 30);
  const bestPrice = headlinePrice(product);
  const productId = String(product.id);
  const categorySlug = CATEGORY_SLUGS[product.category];

  // La API ya las ordena: primero con stock y luego por precio.
  const offers = product.offers;
  const bestOffer = offers[0];

  const specs = Object.entries(SPEC_LABELS).flatMap(([key, label]) => {
    const value = product.attributes[key];
    if (value === undefined || typeof value === "boolean") return [];
    return [{ label, value: typeof value === "string" ? value.toUpperCase() : String(value) }];
  });

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
      lowPrice: bestPrice,
      priceCurrency: "CLP",
      offerCount: product.offerCount,
      availability: `https://schema.org/${product.bestPrice === null ? "OutOfStock" : "InStock"}`,
    },
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>

      <div className="min-h-screen bg-background pb-32 md:pb-12">
        <div className="container mx-auto max-w-6xl px-4 pt-4 pb-2">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center text-xs text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide py-2"
          >
            <Link to="/" className="flex items-center hover:text-primary transition-colors active:text-primary">
              <IconHome className="size-3.5 mr-1" />
              {t("home")}
            </Link>

            <IconChevronRight className="size-3 mx-2 shrink-0 text-border" />

            <Link
              to={`/categoria/${categorySlug}`}
              className="hover:text-primary transition-colors active:text-primary"
            >
              {CATEGORY_LABELS[product.category]}
            </Link>

            <IconChevronRight className="size-3 mx-2 shrink-0 text-border" />

            <span className="text-foreground font-medium truncate max-w-[150px] sm:max-w-xs">{product.name}</span>
          </nav>
        </div>

        <div className="container mx-auto max-w-6xl px-4 py-2">
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-24">
              {/* Destino de la foto de la tarjeta de producto (app.css). */}
              <div
                className="rounded-3xl border border-border/60 bg-card shadow-sm relative overflow-hidden group"
                style={{ viewTransitionName: "product-photo" }}
              >
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                  <Badge
                    variant="secondary"
                    className="font-mono text-xs backdrop-blur-md bg-background/80 border-border/50 shadow-sm px-3 py-1.5"
                  >
                    {product.brand}
                  </Badge>
                </div>

                <div className="relative aspect-square bg-white flex items-center justify-center p-8 lg:p-12">
                  <AsyncImage
                    src={product.imageUrl ?? undefined}
                    alt={product.name}
                    priority
                    className="max-h-full max-w-full size-auto object-contain transition-transform duration-500 group-hover:scale-105 filter"
                  />
                </div>
              </div>

              <div className="lg:hidden">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">{product.name}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <IconCircleCheck className="size-3.5" />
                    {t("available_in_stores", { count: product.offerCount })}
                  </span>
                  {product.mpn && <span className="font-mono text-xs opacity-70">MPN: {product.mpn}</span>}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-8">
              <div className="hidden lg:block">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                  {product.name}
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <IconCircleCheck className="size-4" />
                    {t("available_in_stores", { count: product.offerCount })}
                  </span>
                  {product.mpn && <span className="font-mono text-xs">MPN: {product.mpn}</span>}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
                <div className="flex flex-col md:flex-row gap-6 md:items-end justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      {t("best_price_cash")}
                    </p>
                    <span className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight tabular-nums">
                      {formatCLP(bestPrice)}
                    </span>

                    {bestOffer && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Vendido por:</span>
                        <Link
                          to={`/tiendas/${bestOffer.store.slug}`}
                          prefetch="intent"
                          className="group/store inline-flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                        >
                          <StoreLogo store={bestOffer.store} className="size-6 rounded-md" />
                          {bestOffer.store.name}
                          <IconChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover/store:translate-x-0.5 group-hover/store:text-primary" />
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="hidden md:flex flex-col gap-2 w-full md:w-auto min-w-[200px]">
                    {bestOffer && (
                      <OutboundLink
                        href={bestOffer.url}
                        source="product_details_hero"
                        listingId={String(bestOffer.id)}
                        productId={productId}
                        className={cn(buttonVariants({ size: "lg" }), "w-full flex items-center justify-center gap-2")}
                      >
                        {t("go_to_store")}
                        <IconExternalLink className="size-4" />
                      </OutboundLink>
                    )}
                    <AddToQuote product={product} className="w-full" label="long" />
                  </div>
                </div>
              </div>

              {priceHistory.length >= 2 && (
                <section className="space-y-3">
                  <h3 className="inline-flex items-center gap-2 text-lg font-medium">
                    <IconChartLine className="size-4 text-muted-foreground" />
                    {t("price_history")}
                  </h3>
                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                    <PriceHistoryChart points={priceHistory} days={30} />
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <h3 className="inline-flex items-center gap-2 text-lg font-medium">
                  <IconBuildingStore className="size-4 text-muted-foreground" />
                  {t("store_comparison")}
                </h3>

                <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
                  {/* Header columnas (desktop). Grid 12 col: tienda 5 / precio 4 / acción 3.
                      El precio normal se muestra debajo del cash cuando hay descuento, evitando
                      colapsar la columna de acción con números largos. */}
                  <div className="hidden md:grid grid-cols-12 gap-4 border-b border-border/60 bg-muted/30 px-6 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-5">{t("store")}</div>
                    <div className="col-span-4 text-right">{t("price")}</div>
                    <div className="col-span-3 text-right">{t("action")}</div>
                  </div>

                  <div className="divide-y divide-border/40">
                    {offers.map((offer, idx) => {
                      // priceCard NO es un precio anterior: es el precio tarjeta de la misma oferta (medio de pago).
                      // No es un descuento; se muestra como referencia, sin tachar.
                      const hasCardGap = offer.priceCard > offer.priceCash;
                      return (
                        <div
                          key={offer.id}
                          className="group relative grid grid-cols-12 gap-4 px-5 md:px-6 py-4 md:py-5 items-center hover:bg-muted/20 transition-colors"
                        >
                          {/* Tienda → enlaza al perfil de la tienda */}
                          <div className="col-span-12 md:col-span-5 min-w-0">
                            <Link
                              to={`/tiendas/${offer.store.slug}`}
                              prefetch="intent"
                              className="group/store flex items-center gap-4 min-w-0"
                            >
                              <StoreLogo store={offer.store} className="size-12" />
                              <div className="flex flex-col min-w-0 gap-1">
                                <span className="font-medium text-sm truncate group-hover/store:text-primary transition-colors">
                                  {offer.store.name}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 text-[11px] font-medium",
                                    offer.inStock ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "size-1.5 rounded-full",
                                      offer.inStock ? "bg-emerald-500" : "bg-muted-foreground/50",
                                    )}
                                  />
                                  {offer.inStock ? t("in_stock") : t("out_of_stock")}
                                </span>
                              </div>
                            </Link>
                          </div>

                          {/* Precio: efectivo/transferencia destacado + precio
                              tarjeta como referencia de medio de pago. */}
                          <div className="col-span-7 md:col-span-4 flex flex-col md:items-end justify-center gap-0.5 min-w-0">
                            <span className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors tabular-nums whitespace-nowrap">
                              {formatCLP(offer.priceCash)}
                            </span>
                            {hasCardGap && (
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                Con tarjeta {formatCLP(offer.priceCard)}
                              </span>
                            )}
                          </div>

                          {/* Acción */}
                          <div className="col-span-5 md:col-span-3 flex md:justify-end items-center min-w-0">
                            <OutboundLink
                              href={offer.url}
                              source="product_details_comparison"
                              listingId={String(offer.id)}
                              productId={productId}
                              className={cn(
                                buttonVariants({
                                  size: "sm",
                                  variant: idx === 0 ? "default" : "secondary",
                                }),
                                "w-full md:w-auto gap-1.5",
                              )}
                            >
                              {t("see_offer")}
                              <IconExternalLink className="size-3" />
                            </OutboundLink>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {specs.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-lg font-medium">{t("specs_title")}</h3>
                  <dl className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                    {specs.map(({ label, value }) => (
                      <div
                        key={label}
                        className="grid grid-cols-2 md:grid-cols-3 gap-4 px-4 md:px-6 py-3 hover:bg-muted/15 transition-colors"
                      >
                        <dt className="text-sm text-muted-foreground flex items-center">{t(label)}</dt>
                        <dd className="col-span-1 md:col-span-2 text-sm text-foreground text-right md:text-left break-words">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {COMMENTS_API_ENABLED && <CommentsSection targetType="product" targetId={productId} />}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-xl border-t border-border/60 lg:hidden z-50 animate-in slide-in-from-bottom-full duration-300">
          <div className="container mx-auto max-w-md flex items-center gap-3">
            <AddToQuote product={product} className="size-12 shrink-0 rounded-xl border border-border/60" />

            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                  {t("best_price_cash")}
                </span>
                <span className="font-bold text-xl text-foreground leading-none truncate tabular-nums">
                  {formatCLP(bestPrice)}
                </span>
              </div>

              {bestOffer && (
                <OutboundLink
                  href={bestOffer.url}
                  source="product_details_mobile"
                  listingId={String(bestOffer.id)}
                  productId={productId}
                  className={cn(buttonVariants({ size: "lg" }), "rounded-xl px-5 font-medium shrink-0")}
                >
                  {t("go_to_store")}
                </OutboundLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
