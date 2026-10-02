import type { Offer } from "@framerate/contracts";
import { IconExternalLink } from "@tabler/icons-react";
import { AddToQuote } from "~/features/product/components/add-to-quote";
import { PriceHistoryChart } from "~/features/product/components/price-history-chart";
import { OutboundLink } from "~/shared/components/outbound-link";
import { buttonVariants } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { ProductCase } from "./fixtures";
import { Breadcrumb, ProductPhoto, StockDot, seenAgo, sortOffers, specRows, stockText } from "./shared";

/**
 * v1, tabla de tiendas primero (Geizhals, Idealo, Solotodo): cabecera compacta con el mejor precio y, justo debajo,
 * todas las tiendas en una tabla. Historial y ficha técnica van al final, lado a lado.
 */
export function ProductPageV1({ product, history }: ProductCase) {
  const offers = sortOffers(product.offers);
  const inStock = offers.filter((o) => o.inStock);
  const best = offers[0];
  const specs = specRows(product.attributes);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6">
      <Breadcrumb category={product.category} />

      <section className="grid gap-5 rounded-3xl border border-border bg-card p-4 sm:p-5 md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)_20rem]">
        <ProductPhoto src={product.imageUrl} alt={product.name} className="aspect-[4/3] md:aspect-square" />

        <div className="flex min-w-0 flex-col gap-3 md:py-1">
          {product.brand && <span className="text-muted-foreground text-sm">{product.brand}</span>}
          <h1 className="text-balance font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">
            {product.name}
          </h1>
          {specs.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {specs.slice(0, 3).map(([label, value]) => (
                <li key={label} className="rounded-md bg-secondary px-2 py-0.5 text-muted-foreground text-xs">
                  {value}
                </li>
              ))}
            </ul>
          )}
          {product.mpn && (
            <p className="mt-auto text-muted-foreground text-xs">
              Código del fabricante <span className="font-mono text-foreground/80">{product.mpn}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-secondary/60 p-4 md:col-span-2 lg:col-span-1">
          {best?.inStock ? (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Mejor precio con transferencia</p>
              <p className="font-semibold text-3xl text-foreground tabular-nums tracking-tight">
                {formatCLP(best.priceCash)}
              </p>
              {product.bestCardPrice !== null && product.bestCardPrice > best.priceCash && (
                <p className="text-muted-foreground text-sm tabular-nums">
                  Con tarjeta {formatCLP(product.bestCardPrice)}
                </p>
              )}
              <p className="text-muted-foreground text-sm">
                {inStock.length > 1
                  ? `En ${best.store.name} y ${inStock.length - 1} tiendas más`
                  : `Sólo en ${best.store.name}`}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-foreground">Sin stock en ninguna tienda</p>
              {best && (
                <p className="text-muted-foreground text-sm">
                  El último precio que vimos fue {formatCLP(best.priceCash)} en {best.store.name},{" "}
                  {seenAgo(best.lastSeenAt)}.
                </p>
              )}
            </div>
          )}
          {best && (
            <div className="flex gap-2">
              <OutboundLink
                href={best.url}
                source="product_details_hero"
                listingId={String(best.id)}
                productId={String(product.id)}
                className={cn(
                  buttonVariants({ variant: best.inStock ? "default" : "secondary", size: "lg" }),
                  "flex-1",
                )}
              >
                {best.inStock ? `Ir a ${best.store.name}` : `Ver en ${best.store.name}`}
                <IconExternalLink className="size-4" />
              </OutboundLink>
              <AddToQuote product={product} className="size-10 rounded-xl" />
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-foreground text-xl tracking-tight">
            {offers.length === 1
              ? `Sólo lo vende ${offers[0]?.store.name}`
              : inStock.length > 0
                ? `Precios en ${inStock.length} ${inStock.length === 1 ? "tienda" : "tiendas"}`
                : `Ninguna de las ${offers.length} tiendas lo tiene en stock`}
          </h2>
          {offers.length > 1 && (
            <p className="text-muted-foreground text-sm">
              Ordenados por precio con transferencia. Revisamos cada tienda varias veces al día.
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_8rem_8.5rem] items-center gap-4 border-border border-b px-4 py-2.5 text-muted-foreground text-xs md:grid">
            <span>Tienda</span>
            <span>Disponibilidad</span>
            <span className="text-right">Transferencia</span>
            <span className="text-right">Tarjeta</span>
            <span>Actualizado</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {offers.map((o, i) => (
              <OfferRow
                key={o.id}
                offer={o}
                productId={product.id}
                cheapest={i === 0 && o.inStock && inStock.length > 1}
                firstOutOfStock={!o.inStock && offers[i - 1]?.inStock === true}
              />
            ))}
          </ul>
        </div>
      </section>

      <div className={cn("grid gap-6", specs.length > 0 && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        <section className="min-w-0 space-y-3">
          <h2 className="font-semibold text-foreground text-xl tracking-tight">Historial de precios</h2>
          {history.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <PriceHistoryChart points={history} days={30} />
            </div>
          ) : (
            <p className="rounded-2xl border border-border border-dashed p-6 text-muted-foreground text-sm">
              Todavía no hay historial. Empezamos a seguir este precio hace poco; en unos días vas a ver cómo se mueve
              en cada tienda.
            </p>
          )}
        </section>

        {specs.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-foreground text-xl tracking-tight">Ficha técnica</h2>
            <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
              {specs.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground text-xs">Datos sacados del nombre del producto en las tiendas.</p>
          </section>
        )}
      </div>
    </div>
  );
}

function OfferRow({
  offer: o,
  productId,
  cheapest,
  firstOutOfStock,
}: {
  offer: Offer;
  productId: number;
  cheapest: boolean;
  firstOutOfStock: boolean;
}) {
  return (
    <li
      className={cn(
        "relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-secondary/40 md:grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_8rem_8.5rem]",
        !o.inStock && "text-muted-foreground",
        firstOutOfStock && "border-t-4 border-t-secondary",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <StoreLogo store={o.store} className={cn("size-9", !o.inStock && "opacity-50")} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* La fila entera es el enlace (::after); el botón de la derecha es sólo la señal visual. */}
            <OutboundLink
              href={o.url}
              source="product_details_comparison"
              listingId={String(o.id)}
              productId={String(productId)}
              className={cn(
                "truncate font-medium text-sm after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset",
                o.inStock && "text-foreground",
              )}
            >
              {o.store.name}
            </OutboundLink>
            {cheapest && (
              <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 font-medium text-[11px] text-success">
                Más barato
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs md:hidden">
            <StockDot inStock={o.inStock} />
            {stockText(o)}
          </span>
        </div>
      </div>

      <span className="hidden items-center gap-1.5 text-xs md:inline-flex">
        <StockDot inStock={o.inStock} />
        {stockText(o)}
      </span>

      <span className={cn("text-right font-semibold tabular-nums", o.inStock && "text-foreground")}>
        {formatCLP(o.priceCash)}
      </span>

      <span className="col-span-2 flex justify-between text-muted-foreground text-xs tabular-nums md:col-span-1 md:block md:text-right md:text-sm">
        <span className="md:hidden">Tarjeta {formatCLP(o.priceCard)}</span>
        <span className="hidden md:inline">{formatCLP(o.priceCard)}</span>
        <span className="md:hidden">Visto {seenAgo(o.lastSeenAt)}</span>
      </span>

      <span className="hidden text-muted-foreground text-xs md:inline">{seenAgo(o.lastSeenAt)}</span>

      <span
        aria-hidden
        className={cn(buttonVariants({ variant: cheapest ? "default" : "secondary", size: "sm" }), "hidden md:flex")}
      >
        Ir a la tienda
        <IconExternalLink className="size-3.5" />
      </span>
    </li>
  );
}
