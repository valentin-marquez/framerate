import {
  IconArrowsRightLeft,
  IconBuildingStore,
  IconCash,
  IconChevronRight,
  IconCircleCheck,
  IconCpu,
  IconExternalLink,
  IconHome,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { AsyncImage } from "@/components/primitives/async-image";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Card } from "@/components/primitives/card";
import { Separator } from "@/components/primitives/separator";
import { AddToQuote } from "@/components/product/add-to-quote";
import { getTranslation } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { productsService } from "@/services/products";
import { useAuthStore } from "@/store/auth";
import { getCategoryConfig } from "@/utils/categories";
import type { Route } from "./+types/product";

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);

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
    productsService.trackView(params.slug).catch(() => {});

    if (!product || product.prices?.cash === 0 || product.prices?.cash == null) {
      throw new Response("Producto no encontrado", { status: 404 });
    }

    return product;
  } catch (_error) {
    throw new Response("Producto no encontrado", { status: 404 });
  }
}

export default function ProductPage({ loaderData }: Route.ComponentProps) {
  const { profile } = useAuthStore();
  const lang = profile?.lang || "es";
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(lang, key, params);

  const product = loaderData;
  const bestPrice = product.prices?.cash || 0;
  const categoryConfig = getCategoryConfig(product.category?.slug);

  const sortedListings = [...product.listings].sort((a, b) => (a.price_cash || Infinity) - (b.price_cash || Infinity));
  const bestOffer = sortedListings[0];
  const sortedVariants = product.variants?.sort((a, b) => (a.prices?.cash || 0) - (b.prices?.cash || 0)) || [];

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic specs rendering
  const renderSpecValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "boolean") return value ? t("yes") : t("no");
    if (typeof value === "object") {
      return (
        <div className="flex flex-col gap-1 items-end w-full">
          {Object.entries(value).map(([k, v]) => {
            if (v === null || v === undefined) return null;
            return (
              <div key={k} className="flex gap-2 text-xs w-full justify-between sm:justify-end">
                <span className="text-muted-foreground mr-1">{t(k)}:</span>
                <span className="font-mono text-foreground">{renderSpecValue(v)}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return String(value);
  };

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
        <div className="container mx-auto px-4 pt-4 pb-2">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center text-xs text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide py-2"
          >
            <Link to="/" className="flex items-center hover:text-primary transition-colors active:text-primary">
              <IconHome className="h-3.5 w-3.5 mr-1" />
              {t("home")}
            </Link>

            <IconChevronRight className="h-3 w-3 mx-2 shrink-0 text-border" />

            <Link
              to={`/categoria/${categoryConfig.urlSlug}`}
              className="hover:text-primary transition-colors active:text-primary"
            >
              {categoryConfig.label}
            </Link>

            <IconChevronRight className="h-3 w-3 mx-2 shrink-0 text-border" />

            <span className="text-foreground font-medium truncate max-w-[150px] sm:max-w-xs">{product.name}</span>
          </nav>
        </div>

        <div className="container mx-auto px-4 py-2 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-24">
              <div className="rounded-3xl border border-border bg-card shadow-sm relative overflow-hidden group">
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
                    src={product.image_url || "/placeholder.png"}
                    alt={product.name || "Imagen de producto"}
                    priority
                    className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-500 group-hover:scale-105 filter"
                  />
                </div>
              </div>

              <div className="lg:hidden">
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground leading-tight">
                  {product.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 text-secondary-foreground text-xs font-medium border border-border/10">
                    <IconCircleCheck className="h-3.5 w-3.5 text-emerald-500" />
                    {t("available_in_stores", { count: product.listings_count || 0 })}
                  </div>
                  {product.mpn && <span className="font-mono text-xs opacity-70">MPN: {product.mpn}</span>}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-8">
              <div className="hidden lg:block">
                <h1 className="font-display text-3xl xl:text-4xl font-bold tracking-tight text-foreground leading-tight">
                  {product.name}
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium border border-emerald-500/20">
                    <IconCircleCheck className="h-4 w-4" />
                    {t("available_in_stores", { count: product.listings_count || 0 })}
                  </div>
                  {product.mpn && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <span className="font-mono bg-secondary/30 px-2 py-0.5 rounded text-xs">MPN: {product.mpn}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-card to-card/50 border border-border rounded-2xl p-6 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                  <IconCash className="w-48 h-48 -mr-12 -mt-12" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-end justify-between">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                      {t("best_price_cash")}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-5xl sm:text-6xl font-bold text-foreground tracking-tighter">
                        {formatCLP(bestPrice)}
                      </span>
                    </div>

                    {bestOffer && (
                      <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground bg-secondary/40 py-2 px-3 rounded-lg w-fit">
                        <span className="opacity-70">Vendido por:</span>
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          {bestOffer.store.logo_url ? (
                            <AsyncImage
                              src={bestOffer.store.logo_url}
                              alt={bestOffer.store.name}
                              className="h-4 w-auto object-contain rounded-xs"
                            />
                          ) : (
                            <IconBuildingStore className="h-4 w-4" />
                          )}
                          {bestOffer.store.name}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="hidden md:flex flex-col gap-3 w-full md:w-auto min-w-[200px]">
                    <Button asChild size="lg" className="h-12 text-base shadow-lg shadow-primary/20 w-full">
                      <a
                        href={bestOffer?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2"
                      >
                        {t("go_to_store")}
                        <IconExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <div className="w-full">
                      <AddToQuote product={product} className="w-full" variant="outline" size="lg" />
                    </div>
                  </div>
                </div>
              </div>

              {sortedVariants.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <IconArrowsRightLeft className="h-5 w-5 text-muted-foreground" />
                      {t("other_versions")}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sortedVariants.map((variant) => (
                      <Link key={variant.slug} to={`/producto/${variant.slug}`} className="group block h-full">
                        <Card className="flex items-center gap-3 p-3 h-full border border-border/60 bg-card hover:bg-secondary/40 hover:border-border transition-all duration-200">
                          <div className="h-12 w-12 shrink-0 rounded-lg bg-white border border-border sm:p-1 flex items-center justify-center overflow-hidden">
                            {variant.image_url ? (
                              <AsyncImage
                                src={variant.image_url}
                                alt=""
                                className="max-h-full max-w-full object-contain p-1"
                              />
                            ) : (
                              <IconCpu className="h-6 w-6 text-muted-foreground/50" />
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

              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xl font-display font-bold flex items-center gap-2">
                    <IconBuildingStore className="h-6 w-6 text-muted-foreground" />
                    {t("store_comparison")}
                  </h3>
                </div>

                <div className="border border-border rounded-xl  overflow-hidden bg-card shadow-sm">
                  <div className="hidden md:grid grid-cols-12 gap-4 border-b border-border bg-muted/30 p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-5 pl-2">{t("store")}</div>
                    <div className="col-span-3 text-right pr-4">{t("cash")}</div>
                    <div className="col-span-2 text-right pr-4">{t("normal")}</div>
                    <div className="col-span-2 text-center">{t("action")}</div>
                  </div>

                  <div className="divide-y divide-border/60">
                    {sortedListings.map((listing, idx) => (
                      <div
                        key={`${listing.store.slug}-${idx}`}
                        className="group relative grid grid-cols-2 md:grid-cols-12 md:gap-4 p-4 items-center hover:bg-muted/20 transition-colors"
                      >
                        <div className="col-span-2 md:col-span-5 md:pl-2 flex items-center gap-3 mb-2 md:mb-0">
                          <div
                            className={cn(
                              "h-10 w-20 shrink-0 flex items-center justify-center rounded-md border border-border/60 p-1.5 overflow-hidden",
                              listing.store.appearance === "dark" ? "bg-white" : "bg-white",
                            )}
                          >
                            {listing.store.logo_url ? (
                              <AsyncImage
                                src={listing.store.logo_url}
                                alt={listing.store.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <IconBuildingStore className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-sm truncate">{listing.store.name}</span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm",
                                  listing.is_active
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-zinc-500/10 text-zinc-500",
                                )}
                              >
                                {listing.is_active ? t("in_stock") : t("out_of_stock")}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="col-span-1 md:col-span-3 flex flex-col md:items-end md:pr-4 justify-center">
                          <span className="md:hidden text-[10px] text-muted-foreground uppercase">{t("cash")}</span>
                          <span className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                            {formatCLP(listing.price_cash || 0)}
                          </span>
                        </div>

                        <div className="col-span-1 md:col-span-2 flex flex-col md:items-end md:pr-4 justify-center items-end text-right md:text-right">
                          <span className="md:hidden text-[10px] text-muted-foreground uppercase">{t("normal")}</span>
                          <span className="font-medium text-sm text-muted-foreground">
                            {listing.price_normal ? formatCLP(listing.price_normal) : "N/A"}
                          </span>
                        </div>

                        <div className="col-span-2 md:col-span-2 flex justify-center items-center mt-3 md:mt-0">
                          <Button
                            asChild
                            size="sm"
                            variant={idx === 0 ? "default" : "secondary"}
                            className={cn(
                              "w-full md:w-auto h-9 text-xs font-semibold shadow-sm w-full",
                              idx === 0 && "shadow-primary/20",
                            )}
                          >
                            <a
                              href={listing.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2"
                            >
                              {t("see_offer")}
                              <IconExternalLink className="w-3 h-3 md:hidden lg:block" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <Separator className="my-2 opacity-50" />

              {product.specs && (
                <section className="space-y-4 pb-8">
                  <h3 className="text-xl font-display font-bold">{t("specs_title")}</h3>
                  <div className="bg-card border border-border rounded-xl p-1">
                    <div className="divide-y divide-border/40">
                      {Object.entries(product.specs).map(([key, value]) => {
                        if (value === null || value === undefined) return null;
                        if (Array.isArray(value) && value.length === 0) return null;

                        return (
                          <div
                            key={key}
                            className="grid grid-cols-2 md:grid-cols-3 gap-4 p-3 md:px-6 hover:bg-muted/10 transition-colors"
                          >
                            <dt className="text-sm text-muted-foreground font-medium capitalize flex items-center">
                              {t(key)}
                            </dt>
                            <dd className="col-span-1 md:col-span-2 text-sm font-medium text-foreground text-right md:text-left break-words">
                              {renderSpecValue(value)}
                            </dd>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-xl border-t border-border lg:hidden z-50 animate-in slide-in-from-bottom-full duration-300">
          <div className="container mx-auto max-w-md flex items-center gap-3">
            <div className="shrink-0">
              <AddToQuote
                product={product}
                variant="secondary"
                size="icon"
                className="h-12 w-12 rounded-xl border border-border"
              />
            </div>

            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                  {t("best_price_cash")}
                </span>
                <span className="font-display font-bold text-xl text-primary leading-none truncate">
                  {formatCLP(bestPrice)}
                </span>
              </div>

              <Button asChild className="h-12 rounded-xl shadow-lg shadow-primary/20 px-6 font-semibold shrink-0">
                <a href={sortedListings[0]?.url} target="_blank" rel="noopener noreferrer">
                  {t("go_to_store")}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
