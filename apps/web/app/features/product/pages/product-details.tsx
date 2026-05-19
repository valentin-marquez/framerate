import {
  IconArrowsRightLeft,
  IconBuildingStore,
  IconChartLine,
  IconChevronRight,
  IconCircleCheck,
  IconCpu,
  IconExternalLink,
  IconHome,
} from "@tabler/icons-react";
import { Link, redirect } from "react-router";
import { useAuthStore } from "~/features/auth/store/auth";
import { getCategoryConfig } from "~/features/category/utils/categories";
// Fase 3: comments
import { CommentsSection } from "~/features/comments/components/comments-section";
import { AddToQuote } from "~/features/product/components/add-to-quote";
import { PriceHistoryChart } from "~/features/product/components/price-history-chart";
import { usePriceHistory } from "~/features/product/hooks/useProducts";
import { productsService } from "~/features/product/services/products";
import { OutboundLink } from "~/shared/components/outbound-link";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Badge } from "~/shared/components/primitives/badge";
import { buttonVariants } from "~/shared/components/primitives/button";
import { Card } from "~/shared/components/primitives/card";
import { StoreLogo } from "~/shared/components/store-logo";
import { isRateLimitError } from "~/shared/lib/api";
import { getTranslation } from "~/shared/lib/translations";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { getImageUrl } from "~/shared/utils/images";
import type { Route } from "./+types/product-details";

type Translator = (key: string, params?: Record<string, string | number>) => string;

// Si t() no encuentra traducción devuelve la clave raw (e.g. "usb_3_2_gen_1");
// formateamos snake_case a "Title Case" para que al menos sea legible.
function formatSpecKey(key: string, t: Translator): string {
  const translated = t(key);
  if (translated !== key) return translated;
  // react-doctor-disable-next-line js-combine-iterations -- string-builder chain; rewriting to for-loop hurts readability
  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface SpecValueProps {
  value: unknown;
  t: Translator;
}

function SpecValue({ value, t }: SpecValueProps): React.ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? t("yes") : t("no");
  if (Array.isArray(value)) {
    // Array de primitivos: join simple. Array de objects: cada item se renderiza como un grupo.
    const allPrimitive = value.every((v) => v === null || typeof v !== "object");
    if (allPrimitive) return value.join(", ");
    return (
      <div className="flex flex-col gap-2 items-end w-full">
        {value.map((item) => {
          // Derivamos una key estable a partir del contenido del item (no índice).
          const itemKey = typeof item === "object" ? JSON.stringify(item) : String(item);
          return (
            <div key={itemKey} className="flex flex-col gap-0.5 items-end w-full border-l-2 border-border/40 pl-2">
              <SpecValue value={item} t={t} />
            </div>
          );
        })}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <div className="flex flex-col gap-1 items-end w-full">
        {Object.entries(value).map(([k, v]) => {
          if (v === null || v === undefined) return null;
          if (Array.isArray(v) && v.length === 0) return null;
          return (
            <div key={k} className="flex gap-2 text-xs w-full justify-between sm:justify-end">
              <span className="text-muted-foreground mr-1">{formatSpecKey(k, t)}:</span>
              <span className="font-mono text-foreground">
                <SpecValue value={v} t={t} />
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return String(value);
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Producto no encontrado - Framerate" }];

  const bestPrice = data.prices?.cash || 0;
  const description = `Compra ${data.name} desde ${formatCLP(bestPrice)} en Chile. Compara precios en ${data.listings_count} tiendas.`;
  const categoryConfig = getCategoryConfig(data.category?.slug);

  return [
    { title: `${data.name} | Precios en Chile - Framerate` },
    { name: "description", content: description },
    { property: "og:site_name", content: "Framerate.cl" },
    { property: "og:locale", content: "es_CL" },
    { property: "og:type", content: "product" },
    { property: "og:title", content: data.name },
    { property: "og:description", content: description },
    { property: "og:image", content: data.image_url || "/og-image.png" },
    { property: "product:price:amount", content: String(bestPrice) },
    { property: "product:price:currency", content: "CLP" },
    { property: "product:category", content: categoryConfig.label },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  try {
    const product = await productsService.getBySlug(params.slug);

    if (!product || product.prices?.cash === 0 || product.prices?.cash == null) {
      throw new Response("Producto no encontrado", { status: 404 });
    }

    productsService.trackView(params.slug).catch(() => {});
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
  const { profile } = useAuthStore();
  const lang = profile?.lang || "es";
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(lang, key, params);

  const product = loaderData;
  const { data: priceHistory } = usePriceHistory(product.slug || "", 30);
  const totalHistoryPoints = priceHistory?.series.reduce((acc, s) => acc + s.points.length, 0) ?? 0;
  const bestPrice = product.prices?.cash || 0;
  const categoryConfig = getCategoryConfig(product.category?.slug);

  const sortedListings = product.listings.toSorted((a, b) => (a.price_cash || Infinity) - (b.price_cash || Infinity));
  const bestOffer = sortedListings[0];
  const sortedVariants = product.variants?.toSorted((a, b) => (a.prices?.cash || 0) - (b.prices?.cash || 0)) ?? [];

  // Specs puede venir como {} o con todas las keys vacías; sólo renderizamos si hay
  // al menos una entrada con valor renderizable.
  const hasRenderableSpecs =
    product.specs &&
    typeof product.specs === "object" &&
    Object.entries(product.specs).some(([, value]) => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === "object" && Object.keys(value).length === 0) return false;
      return true;
    });

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    image: product.image_url,
    description: `Compra ${product.name} al mejor precio.`,
    brand: {
      "@type": "Brand",
      name: product.brand?.name || "Genérico",
    },
    sku: product.mpn,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: bestPrice,
      priceCurrency: "CLP",
      offerCount: product.listings_count,
      availability: "https://schema.org/InStock",
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
              to={`/categoria/${categoryConfig.urlSlug}`}
              className="hover:text-primary transition-colors active:text-primary"
            >
              {categoryConfig.label}
            </Link>

            <IconChevronRight className="size-3 mx-2 shrink-0 text-border" />

            <span className="text-foreground font-medium truncate max-w-[150px] sm:max-w-xs">{product.name}</span>
          </nav>
        </div>

        <div className="container mx-auto max-w-6xl px-4 py-2 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-24">
              <div className="rounded-3xl border border-border/60 bg-card shadow-sm relative overflow-hidden group">
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                  <Badge
                    variant="secondary"
                    className="font-mono text-xs backdrop-blur-md bg-background/80 border-border/50 shadow-sm px-3 py-1.5"
                  >
                    {product.brand?.name}
                  </Badge>
                </div>

                <div className="relative aspect-square bg-white flex items-center justify-center p-8 lg:p-12">
                  <AsyncImage
                    src={getImageUrl(product.image_url) || "/placeholder.png"}
                    alt={product.name || "Imagen de producto"}
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
                    {t("available_in_stores", { count: product.listings_count || 0 })}
                  </span>
                  {product.mpn && (
                    <>
                      <span className="text-border">•</span>
                      <span className="font-mono text-xs opacity-70">MPN: {product.mpn}</span>
                    </>
                  )}
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
                    {t("available_in_stores", { count: product.listings_count || 0 })}
                  </span>
                  {product.mpn && (
                    <>
                      <span className="text-border">•</span>
                      <span className="font-mono text-xs">MPN: {product.mpn}</span>
                    </>
                  )}
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
                    {bestOffer?.url && (
                      <OutboundLink
                        href={bestOffer.url}
                        source="product_details_hero"
                        listingId={bestOffer.id}
                        productId={product.id}
                        className={cn(buttonVariants({ size: "lg" }), "w-full flex items-center justify-center gap-2")}
                      >
                        {t("go_to_store")}
                        <IconExternalLink className="size-4" />
                      </OutboundLink>
                    )}
                    <AddToQuote product={product} className="w-full" />
                  </div>
                </div>
              </div>

              {sortedVariants.length > 0 && (
                <section>
                  <h3 className="mb-3 inline-flex items-center gap-2 text-lg font-medium">
                    <IconArrowsRightLeft className="size-4 text-muted-foreground" />
                    {t("other_versions")}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sortedVariants.map((variant) => (
                      <Link key={variant.slug} to={`/producto/${variant.slug}`} className="group block h-full">
                        <Card className="flex items-center gap-3 p-3 h-full border border-border/60 bg-card hover:bg-secondary/40 hover:border-border transition-all duration-200">
                          <div className="size-12 shrink-0 rounded-lg bg-white border border-border/60 sm:p-1 flex items-center justify-center overflow-hidden">
                            {variant.image_url ? (
                              <AsyncImage
                                src={getImageUrl(variant.image_url)}
                                alt=""
                                className="max-h-full max-w-full object-contain p-1"
                              />
                            ) : (
                              <IconCpu className="size-6 text-muted-foreground/50" />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-0.5">
                              {variant.name}
                            </span>
                            <span className="text-sm font-display font-bold text-muted-foreground">
                              {formatCLP(variant.prices?.cash || 0)}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {priceHistory && totalHistoryPoints >= 2 && (
                <section className="space-y-3">
                  <h3 className="inline-flex items-center gap-2 text-lg font-medium">
                    <IconChartLine className="size-4 text-muted-foreground" />
                    {t("price_history")}
                  </h3>
                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                    <PriceHistoryChart data={priceHistory} />
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
                    {sortedListings.map((listing, idx) => {
                      // price_normal NO es un precio anterior: es el precio
                      // tarjeta del mismo listing (medio de pago). No es un
                      // descuento; se muestra como referencia, sin tachar.
                      const hasCardGap =
                        !!listing.price_normal && !!listing.price_cash && listing.price_normal > listing.price_cash;
                      return (
                        <div
                          key={`${listing.store.slug}-${listing.url}`}
                          className="group relative grid grid-cols-12 gap-4 px-5 md:px-6 py-4 md:py-5 items-center hover:bg-muted/20 transition-colors"
                        >
                          {/* Tienda → enlaza al perfil de la tienda */}
                          <div className="col-span-12 md:col-span-5 min-w-0">
                            <Link
                              to={`/tiendas/${listing.store.slug}`}
                              prefetch="intent"
                              className="group/store flex items-center gap-4 min-w-0"
                            >
                              <StoreLogo store={listing.store} className="size-12" />
                              <div className="flex flex-col min-w-0 gap-1">
                                <span className="font-medium text-sm truncate group-hover/store:text-primary transition-colors">
                                  {listing.store.name}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 text-[11px] font-medium",
                                    listing.is_active
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "size-1.5 rounded-full",
                                      listing.is_active ? "bg-emerald-500" : "bg-muted-foreground/50",
                                    )}
                                  />
                                  {listing.is_active ? t("in_stock") : t("out_of_stock")}
                                </span>
                              </div>
                            </Link>
                          </div>

                          {/* Precio: efectivo/transferencia destacado + precio
                              tarjeta como referencia de medio de pago. */}
                          <div className="col-span-7 md:col-span-4 flex flex-col md:items-end justify-center gap-0.5 min-w-0">
                            <span className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors tabular-nums whitespace-nowrap">
                              {formatCLP(listing.price_cash || 0)}
                            </span>
                            {hasCardGap && (
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                Transferencia · tarjeta {formatCLP(listing.price_normal ?? 0)}
                              </span>
                            )}
                          </div>

                          {/* Acción */}
                          <div className="col-span-5 md:col-span-3 flex md:justify-end items-center min-w-0">
                            <OutboundLink
                              href={listing.url}
                              source="product_details_comparison"
                              listingId={listing.id}
                              productId={product.id}
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

              {hasRenderableSpecs && product.specs && (
                <section className="space-y-3">
                  <h3 className="text-lg font-medium">{t("specs_title")}</h3>
                  <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                    <div className="divide-y divide-border/40">
                      {Object.entries(product.specs).map(([key, value]) => {
                        if (value === null || value === undefined) return null;
                        if (Array.isArray(value) && value.length === 0) return null;

                        return (
                          <div
                            key={key}
                            className="grid grid-cols-2 md:grid-cols-3 gap-4 px-4 md:px-6 py-3 hover:bg-muted/15 transition-colors"
                          >
                            <dt className="text-sm text-muted-foreground flex items-center">{formatSpecKey(key, t)}</dt>
                            <dd className="col-span-1 md:col-span-2 text-sm text-foreground text-right md:text-left break-words">
                              <SpecValue value={value} t={t} />
                            </dd>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              {/* Fase 3: comments threaded estilo Reddit */}
              {product.id && <CommentsSection targetType="product" targetId={product.id} />}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-xl border-t border-border/60 lg:hidden z-50 animate-in slide-in-from-bottom-full duration-300">
          <div className="container mx-auto max-w-md flex items-center gap-3">
            <div className="shrink-0">
              <AddToQuote product={product} className="size-12 rounded-xl border border-border/60" />
            </div>

            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                  {t("best_price_cash")}
                </span>
                <span className="font-bold text-xl text-foreground leading-none truncate tabular-nums">
                  {formatCLP(bestPrice)}
                </span>
              </div>

              {sortedListings[0]?.url && (
                <OutboundLink
                  href={sortedListings[0].url}
                  source="product_details_mobile"
                  listingId={sortedListings[0].id}
                  productId={product.id}
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
