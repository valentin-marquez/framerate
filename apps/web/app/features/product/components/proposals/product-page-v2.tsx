import type { Offer } from "@framerate/contracts";
import { IconChevronDown, IconExternalLink } from "@tabler/icons-react";
import { AddToQuote } from "~/features/product/components/add-to-quote";
import { PriceHistoryChart } from "~/features/product/components/price-history-chart";
import { OutboundLink } from "~/shared/components/outbound-link";
import { buttonVariants } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { ProductCase } from "./fixtures";
import {
  Breadcrumb,
  type HistorySummary,
  ProductPhoto,
  priceVerdict,
  StockDot,
  seenAgo,
  shortDate,
  sortOffers,
  specRows,
  stockText,
  summarizeHistory,
} from "./shared";

/**
 * v2, precio con contexto (Knasta, Geizhals): la foto y la ficha a la izquierda; a la derecha el precio dice si
 * conviene comprar hoy (comparado con su historial) y debajo están las tiendas. Las que no tienen stock se pliegan.
 */
export function ProductPageV2({ product, history }: ProductCase) {
  const offers = sortOffers(product.offers);
  const inStock = offers.filter((o) => o.inStock);
  const outOfStock = offers.filter((o) => !o.inStock);
  const best = offers[0];
  const specs = specRows(product.attributes);
  const summary = summarizeHistory(history);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <Breadcrumb category={product.category} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10">
        <ProductPhoto
          src={product.imageUrl}
          alt={product.name}
          className="aspect-[4/3] rounded-3xl lg:col-start-1 lg:row-start-1 lg:aspect-square"
        />

        <div className="min-w-0 space-y-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <header className="space-y-2">
            {product.brand && <p className="text-muted-foreground text-sm">{product.brand}</p>}
            <h1 className="text-balance font-semibold text-3xl text-foreground tracking-tight">{product.name}</h1>
          </header>

          <section aria-label="Precio" className="space-y-5 rounded-3xl border border-border bg-card p-5">
            {best?.inStock ? (
              <div className="space-y-1">
                <p className="font-semibold text-4xl text-foreground tabular-nums tracking-tight">
                  {formatCLP(best.priceCash)}
                </p>
                <p className="text-muted-foreground text-sm">
                  Con transferencia en {best.store.name}
                  {product.bestCardPrice !== null && product.bestCardPrice > best.priceCash && (
                    <span className="block tabular-nums">Con tarjeta desde {formatCLP(product.bestCardPrice)}</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold text-2xl text-foreground tracking-tight">Sin stock por ahora</p>
                {best && (
                  <p className="text-muted-foreground text-sm">
                    Ninguna tienda lo tiene disponible. El último precio fue {formatCLP(best.priceCash)} en{" "}
                    {best.store.name}.
                  </p>
                )}
              </div>
            )}

            {best?.inStock && summary ? (
              <PriceContext today={best.priceCash} summary={summary} />
            ) : (
              best?.inStock && (
                <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-muted-foreground text-sm">
                  {history.length > 0
                    ? `Lo seguimos desde el ${shortDate(
                        history
                          .map((p) => p.observedAt)
                          .toSorted()[0]
                          ?.slice(0, 10) ?? "",
                      )}. Con una semana de datos te vamos a decir si es buen precio.`
                    : "Todavía no tenemos historial para decirte si es buen precio. Lo empezamos a seguir hoy."}
                </p>
              )
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
                    "flex-1 sm:flex-none",
                  )}
                >
                  {best.inStock ? `Ir a ${best.store.name}` : `Ver en ${best.store.name}`}
                  <IconExternalLink className="size-4" />
                </OutboundLink>
                <AddToQuote product={product} label="long" className="h-10" />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-foreground text-lg tracking-tight">
              {offers.length > 1 && inStock.length > 0
                ? `Dónde comprarlo (${inStock.length} con stock)`
                : "Dónde comprarlo"}
            </h2>
            {inStock.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {inStock.map((o) => (
                  <StoreRow key={o.id} offer={o} productId={product.id} />
                ))}
              </ul>
            )}
            {outOfStock.length > 0 && (
              <details open={inStock.length === 0} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-muted-foreground text-sm hover:text-foreground">
                  <IconChevronDown className="size-4 transition-transform group-open:rotate-180" />
                  {outOfStock.length === 1
                    ? `1 tienda sin stock (${outOfStock[0]?.store.name})`
                    : `${outOfStock.length} tiendas sin stock`}
                </summary>
                <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {outOfStock.map((o) => (
                    <StoreRow key={o.id} offer={o} productId={product.id} />
                  ))}
                </ul>
              </details>
            )}
          </section>

          {history.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-foreground text-lg tracking-tight">Cómo se ha movido el precio</h2>
              <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
                {summary && (
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <Stat label="Más bajo" value={summary.min} />
                    <Stat label="Habitual" value={summary.usual} />
                    <Stat label="Más alto" value={summary.max} />
                  </dl>
                )}
                <PriceHistoryChart points={history} days={30} />
              </div>
            </section>
          )}
        </div>

        {specs.length > 0 && (
          <section className="space-y-3 lg:col-start-1 lg:row-start-2">
            <h2 className="font-semibold text-foreground text-lg tracking-tight">Ficha técnica</h2>
            <dl className="grid grid-cols-2 gap-2">
              {specs.map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-secondary/60 px-3 py-2.5">
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="font-medium text-foreground text-sm">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground text-xs">
              Sacada del nombre del producto en las tiendas.
              {product.mpn && (
                <span className="block">
                  Código del fabricante <span className="font-mono">{product.mpn}</span>
                </span>
              )}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

/** Veredicto y barra entre el mínimo y el máximo del período, con la marca de hoy. */
function PriceContext({ today, summary }: { today: number; summary: HistorySummary }) {
  const verdict = priceVerdict(today, summary);
  const span = summary.max - summary.min;
  const at = span > 0 ? Math.min(1, Math.max(0, (today - summary.min) / span)) : 0.5;
  return (
    <div className="space-y-3 rounded-2xl bg-secondary/60 p-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-medium text-xs",
            verdict.tone === "good" && "bg-success/15 text-success",
            verdict.tone === "neutral" && "bg-background text-foreground",
            verdict.tone === "bad" && "bg-warn/20 text-foreground",
          )}
        >
          {verdict.label}
        </span>
        <span className="text-muted-foreground">Comparado con los últimos {summary.days} días.</span>
      </p>
      <div className="space-y-1.5">
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-success/60 via-foreground/15 to-warn/70">
          <span
            className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 size-3.5 rounded-full border-2 border-card bg-foreground shadow-sm"
            style={{ left: `${at * 100}%` }}
            title={`Hoy ${formatCLP(today)}`}
          />
        </div>
        <div className="flex justify-between text-muted-foreground text-xs tabular-nums">
          <span>{formatCLP(summary.min)}</span>
          <span>{formatCLP(summary.max)}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary/60 px-3 py-2">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium text-foreground tabular-nums">{formatCLP(value)}</dd>
    </div>
  );
}

function StoreRow({ offer: o, productId }: { offer: Offer; productId: number }) {
  return (
    <li className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40">
      <StoreLogo store={o.store} className={cn("size-9", !o.inStock && "opacity-50")} />
      <div className="min-w-0 flex-1">
        <OutboundLink
          href={o.url}
          source="product_details_comparison"
          listingId={String(o.id)}
          productId={String(productId)}
          className="block truncate font-medium text-foreground text-sm after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
        >
          {o.store.name}
        </OutboundLink>
        <p className="flex flex-wrap items-center gap-x-3 whitespace-nowrap text-muted-foreground text-xs">
          <span className="inline-flex items-center gap-1.5">
            <StockDot inStock={o.inStock} />
            {stockText(o)}
          </span>
          <span>{seenAgo(o.lastSeenAt)}</span>
        </p>
      </div>
      <div className="text-right tabular-nums">
        <p className={cn("font-semibold", o.inStock ? "text-foreground" : "text-muted-foreground")}>
          {formatCLP(o.priceCash)}
        </p>
        <p className="text-muted-foreground text-xs">Tarjeta {formatCLP(o.priceCard)}</p>
      </div>
      <IconExternalLink aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </li>
  );
}
