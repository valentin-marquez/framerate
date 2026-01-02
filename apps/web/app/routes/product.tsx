import {
  IconArrowsRightLeft,
  IconBell,
  IconBuildingStore,
  IconCash,
  IconChevronRight,
  IconCircleCheck,
  IconCpu,
  IconExternalLink,
  IconHistory,
  IconHome,
  IconShare,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Separator } from "@/components/primitives/separator";
import { AddToQuote } from "@/components/product/add-to-quote";
import { productsService } from "@/services/products";
import { getCategoryConfig } from "@/utils/categories";
import type { Route } from "./+types/product";

// Helpers de formato
const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);

const formatSpecKey = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// === SEO & METADATA ===
export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Producto no encontrado | Framerate" }];

  const bestPrice = data.prices?.cash || 0;
  const description = `Cotiza ${data.name} al mejor precio en Chile. Desde ${formatCLP(bestPrice)} en ${data.listings_count} tiendas. Comparación de precios, historial y especificaciones.`;
  const categoryConfig = getCategoryConfig(data.category?.slug);

  return [
    { title: `${data.name} | Mejor Precio en Chile - Framerate` },
    { name: "description", content: description },

    // Open Graph / Facebook
    { property: "og:type", content: "product" },
    { property: "og:title", content: data.name },
    { property: "og:description", content: description },
    { property: "og:image", content: data.image_url || "/og-image.png" },
    { property: "og:site_name", content: "Framerate.cl" },
    { property: "product:price:amount", content: String(bestPrice) },
    { property: "product:price:currency", content: "CLP" },
    { property: "product:category", content: categoryConfig.label },

    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: data.name },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: data.image_url || "/og-image.png" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  try {
    const product = await productsService.getBySlug(params.slug);
    // Trackeo de vista en background (fire and forget)
    productsService.trackView(params.slug).catch(() => {});
    return product;
  } catch (_error) {
    throw new Response("Producto no encontrado", { status: 404 });
  }
}

export default function ProductPage({ loaderData }: Route.ComponentProps) {
  const product = loaderData;
  const bestPrice = product.prices?.cash || 0;
  const categoryConfig = getCategoryConfig(product.category?.slug);

  // Ordenar listings: primero el más barato en efectivo
  const sortedListings = [...product.listings].sort((a, b) => (a.price_cash || Infinity) - (b.price_cash || Infinity));

  // Ordenar variantes por precio
  const sortedVariants = product.variants?.sort((a, b) => (a.prices?.cash || 0) - (b.prices?.cash || 0)) || [];

  // === JSON-LD STRUCTURED DATA FOR GOOGLE ===
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
      {/* Script JSON-LD para SEO */}
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>

      <div className="min-h-screen bg-background pb-24 md:pb-12">
        {/* === BREADCRUMBS MEJORADO === */}
        {/* Añadido 'container mx-auto pt-4' para separar del navbar */}
        <div className="container mx-auto px-4 pt-6 pb-2">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center text-xs md:text-sm text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide"
          >
            <Link
              to="/"
              className="flex items-center hover:text-primary transition-colors hover:underline underline-offset-4"
            >
              <IconHome className="h-3.5 w-3.5 mr-1" />
              Inicio
            </Link>

            <IconChevronRight className="h-3 w-3 mx-2 shrink-0 text-border" />

            <Link
              to={`/categorias/${categoryConfig.urlSlug}`}
              className="hover:text-primary transition-colors hover:underline underline-offset-4"
            >
              {categoryConfig.label}
            </Link>

            <IconChevronRight className="h-3 w-3 mx-2 shrink-0 text-border" />

            <span className="text-foreground font-medium truncate max-w-50 md:max-w-md">{product.name}</span>
          </nav>
        </div>

        <div className="container mx-auto px-4 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* === COLUMNA IZQUIERDA: IMAGEN === */}
            <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-24">
              {/* Contenedor de Imagen Mejorado */}
              <div className="rounded-container border border-border bg-card p-1 shadow-sm relative overflow-hidden group">
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                  <Badge
                    variant="secondary"
                    className="font-mono text-xs backdrop-blur-md bg-background/80 border-border/50 shadow-sm"
                  >
                    {product.brand?.name}
                  </Badge>
                </div>

                {/* Área de imagen con fondo blanco suave para mejorar contraste en modo oscuro */}
                <div className="relative aspect-square md:aspect-4/3 bg-white rounded-inherit flex items-center justify-center p-6 lg:p-10 overflow-hidden">
                  <img
                    src={product.image_url || "/placeholder.png"}
                    alt={product.name || "Imagen de producto"}
                    className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-500 group-hover:scale-105 filter"
                    loading="eager"
                  />
                </div>
              </div>

              {/* Quick Actions (Desktop) */}
              <div className="hidden lg:grid grid-cols-4 gap-2">
                <Button variant="outline" className="col-span-1" size="icon" title="Historial de precios">
                  <IconHistory className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="col-span-1" size="icon" title="Crear alerta">
                  <IconBell className="h-4 w-4" />
                </Button>
                <div className="col-span-2">
                  {/* Aquí integramos AddToQuote pasándole una clase para que ocupe ancho */}
                  <div className="w-full">
                    <AddToQuote product={product} className="w-full h-10" />
                  </div>
                </div>
              </div>
            </div>

            {/* === COLUMNA DERECHA: DATOS === */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* Header */}
              <div>
                <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
                  {product.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {product.mpn && (
                    <span className="font-mono bg-muted/50 px-2 py-1 rounded text-xs border border-border">
                      MPN: {product.mpn}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
                    <IconCircleCheck className="h-3.5 w-3.5" />
                    Disponible en {product.listings_count} tiendas
                  </span>
                </div>
              </div>

              {/* MEJOR PRECIO HERO */}
              <div className="rounded-container bg-muted/30 border border-border p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                {/* Decoration background */}
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />

                <div className="text-center md:text-left z-10">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    Mejor oferta actual
                  </p>
                  <div className="flex items-baseline gap-2 justify-center md:justify-start">
                    <span className="font-display text-5xl font-bold text-primary tracking-tighter">
                      {formatCLP(bestPrice)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center md:justify-start gap-1.5">
                    <IconCash className="h-4 w-4 text-emerald-500" />
                    Precio efectivo / transferencia
                  </p>
                </div>

                <div className="flex flex-col gap-3 w-full md:w-auto z-10">
                  <Button size="lg" className="w-full md:w-48 shadow-lg shadow-primary/20 text-base h-12">
                    <a href={sortedListings[0]?.url} target="_blank" rel="noopener noreferrer">
                      Ir a la tienda <IconExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  <div className="flex items-center justify-center gap-2 md:hidden">
                    <AddToQuote product={product} />
                    <Button variant="outline" size="icon" className="h-10 w-10">
                      <IconShare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* === SECCIÓN DE VARIANTES === */}
              {sortedVariants.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <IconArrowsRightLeft className="h-4 w-4" />
                    <span>Otras versiones disponibles</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sortedVariants.map((variant) => (
                      <Link
                        key={variant.slug}
                        to={`/producto/${variant.slug}`}
                        className="group flex items-center gap-3 p-2.5 rounded-container border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-all duration-200"
                      >
                        <div className="h-10 w-10 shrink-0 rounded bg-white border border-border p-1 flex items-center justify-center">
                          {variant.image_url ? (
                            <img src={variant.image_url} alt="" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <IconCpu className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium truncate text-foreground group-hover:text-primary transition-colors">
                            {variant.name}
                          </span>
                          <span className="text-sm font-display font-bold text-muted-foreground">
                            {formatCLP(variant.prices?.cash || 0)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* TABLA DE TIENDAS */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-lg font-display font-semibold flex items-center gap-2">
                    <IconBuildingStore className="h-5 w-5 text-muted-foreground" />
                    Comparativa de Tiendas
                  </h2>
                </div>

                <div className="rounded-container border border-border bg-card overflow-hidden shadow-sm">
                  {/* Header Tabla Desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-4 border-b border-border bg-muted/40 p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-5 pl-2">Tienda</div>
                    <div className="col-span-3 text-right pr-4">Efectivo</div>
                    <div className="col-span-2 text-right pr-4">Normal</div>
                    <div className="col-span-2 text-center">Acción</div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-border">
                    {sortedListings.map((listing, idx) => (
                      <div
                        key={`${listing.store.slug}-${idx}`}
                        className="group relative md:grid md:grid-cols-12 md:gap-4 flex flex-col p-4 md:p-0 md:h-18 items-center hover:bg-muted/30 transition-colors"
                      >
                        {/* Store Info */}
                        <div className="w-full md:col-span-5 md:pl-4 flex items-center gap-3 mb-3 md:mb-0">
                          <div
                            className={cn(
                              "h-10 w-24 shrink-0 flex items-center justify-center rounded border border-border  p-2",
                              listing.store.appearance === "dark" ? "bg-white" : "bg-black",
                            )}
                          >
                            {listing.store.logo_url ? (
                              <img
                                src={listing.store.logo_url}
                                alt={listing.store.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <IconBuildingStore className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm leading-none mb-1 md:mb-0.5">
                              {listing.store.name}
                            </span>
                            <div className="flex items-center gap-2">
                              {listing.is_active ? (
                                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                  <IconCircleCheck className="h-3 w-3" /> En Stock
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground font-medium">Consultar stock</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Precios */}
                        <div className="w-full md:col-span-3 flex md:block justify-between items-center md:text-right md:pr-4 md:self-center">
                          <span className="md:hidden text-xs text-muted-foreground font-medium">Precio Efectivo</span>
                          <span className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                            {formatCLP(listing.price_cash)}
                          </span>
                        </div>

                        <div className="w-full md:col-span-2 flex md:block justify-between items-center md:text-right md:pr-4 md:self-center">
                          <span className="md:hidden text-xs text-muted-foreground">Precio Normal</span>
                          <span className="font-medium text-sm text-muted-foreground">
                            {formatCLP(listing.price_normal)}
                          </span>
                        </div>

                        {/* Botón */}
                        <div className="w-full md:col-span-2 md:flex md:justify-center md:items-center mt-3 md:mt-0">
                          <Button
                            size="sm"
                            variant={idx === 0 ? "default" : "secondary"}
                            className="w-full md:w-auto text-xs font-medium"
                          >
                            <a href={listing.url} target="_blank" rel="noopener noreferrer">
                              Ver Oferta
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Separator className="my-2" />

              {/* SPECS */}
              {product.specs && (
                <section className="space-y-4">
                  <h2 className="text-xl font-display font-semibold">Especificaciones</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    {Object.entries(product.specs).map(([key, value]) => {
                      if (!value || (Array.isArray(value) && value.length === 0)) return null;
                      return (
                        <div
                          key={key}
                          className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-border/50"
                        >
                          <dt className="text-muted-foreground capitalize font-medium">{formatSpecKey(key)}</dt>
                          <dd className="font-mono text-foreground mt-1 sm:mt-0 sm:text-right">
                            {Array.isArray(value)
                              ? value.join(", ")
                              : typeof value === "boolean"
                                ? value
                                  ? "Sí"
                                  : "No"
                                : String(value)}
                          </dd>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>

        {/* STICKY MOBILE BAR */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-lg border-t border-border lg:hidden z-50 flex items-center gap-3 safe-area-bottom">
          <div className="shrink-0">
            <AddToQuote product={product} />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Mejor Precio Efectivo</span>
            <span className="font-display font-bold text-lg text-primary leading-none">{formatCLP(bestPrice)}</span>
          </div>
          <Button className="shadow-lg px-6">
            <a href={sortedListings[0]?.url} target="_blank" rel="noopener noreferrer">
              Ir a Tienda
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}

// Helper simple para clases condicionales si no lo tienes importado
function cn(...classes: (string | undefined | null | boolean)[]) {
  return classes.filter(Boolean).join(" ");
}
