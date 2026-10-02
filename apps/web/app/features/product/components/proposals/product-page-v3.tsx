import type { Offer } from "@framerate/contracts";
import { IconExternalLink } from "@tabler/icons-react";
import { useState } from "react";
import { AddToQuote } from "~/features/product/components/add-to-quote";
import { PriceHistoryChart } from "~/features/product/components/price-history-chart";
import { OutboundLink } from "~/shared/components/outbound-link";
import { buttonVariants } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { ProductCase } from "./fixtures";
import { Breadcrumb, type PriceKey, ProductPhoto, StockDot, seenAgo, sortOffers, specRows, stockText } from "./shared";

const METHODS: { key: PriceKey; label: string }[] = [
  { key: "priceCash", label: "Transferencia" },
  { key: "priceCard", label: "Tarjeta" },
];

/**
 * v3, elige cómo pagas (Solotodo, Idealo, el concepto de Dribbble): el medio de pago reordena todo, una franja muestra
 * cuánto se separan las tiendas y cada tienda es una tarjeta. Historial y ficha técnica van en pestañas.
 */
export function ProductPageV3({ product, history }: ProductCase) {
  const [method, setMethod] = useState<PriceKey>("priceCash");
  const offers = sortOffers(product.offers, method);
  const inStock = offers.filter((o) => o.inStock);
  const specs = specRows(product.attributes);
  const tabs = [
    history.length > 0 && { id: "historial", label: "Historial de precios" },
    specs.length > 0 && { id: "ficha", label: "Ficha técnica" },
  ].filter((t) => t !== false);
  const [tab, setTab] = useState(tabs[0]?.id);
  const cheapest = inStock[0];
  const cardGap = cheapest ? cheapest.priceCard - cheapest.priceCash : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      <Breadcrumb category={product.category} />

      <header className="flex items-center gap-4 sm:gap-6">
        <ProductPhoto src={product.imageUrl} alt={product.name} className="size-24 shrink-0 sm:size-36" />
        <div className="min-w-0 space-y-2">
          {product.brand && <p className="text-muted-foreground text-sm">{product.brand}</p>}
          <h1 className="text-balance font-semibold text-2xl text-foreground tracking-tight sm:text-4xl">
            {product.name}
          </h1>
          {specs.length > 0 && (
            <ul className="hidden flex-wrap gap-1.5 sm:flex">
              {specs.slice(0, 3).map(([label, value]) => (
                <li key={label} className="rounded-md bg-secondary px-2 py-0.5 text-muted-foreground text-xs">
                  {value}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <section aria-label="Precios" className="space-y-5 rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <fieldset className="inline-flex rounded-xl bg-secondary p-1">
            <legend className="sr-only">Cómo pagas</legend>
            {METHODS.map((m) => (
              <label
                key={m.key}
                className="cursor-pointer rounded-lg px-3 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input
                  type="radio"
                  name="metodo-de-pago"
                  checked={method === m.key}
                  onChange={() => setMethod(m.key)}
                  className="sr-only"
                />
                {m.label}
              </label>
            ))}
          </fieldset>
          {cheapest && cardGap > 0 && (
            <p className="text-muted-foreground text-sm">
              Con tarjeta pagas {formatCLP(cardGap)} más en {cheapest.store.name}.
            </p>
          )}
        </div>

        <Spread offers={offers} method={method} />

        <div className="flex flex-wrap gap-2">
          {cheapest && (
            <OutboundLink
              href={cheapest.url}
              source="product_details_hero"
              listingId={String(cheapest.id)}
              productId={String(product.id)}
              className={buttonVariants({ size: "lg" })}
            >
              Ir a {cheapest.store.name}
              <IconExternalLink className="size-4" />
            </OutboundLink>
          )}
          <AddToQuote product={product} label="long" className="h-10" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-foreground text-xl tracking-tight">
          {offers.length === 1 ? "La única tienda que lo vende" : "Todas las tiendas"}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((o) => (
            <StoreCard
              key={o.id}
              offer={o}
              method={method}
              productId={product.id}
              best={o === cheapest && inStock.length > 1}
            />
          ))}
        </ul>
      </section>

      {tabs.length > 0 && (
        <section className="space-y-3">
          {tabs.length === 1 ? (
            <h2 className="font-semibold text-foreground text-xl tracking-tight">{tabs[0]?.label}</h2>
          ) : (
            <div role="tablist" className="flex gap-1 border-border border-b">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 font-medium text-sm transition-colors",
                    tab === t.id
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {tab === "historial" && (
            <div role="tabpanel" className="rounded-2xl border border-border bg-card p-4">
              <PriceHistoryChart points={history} days={30} />
            </div>
          )}
          {tab === "ficha" && (
            <div role="tabpanel">
              <dl className="grid gap-x-8 sm:grid-cols-2">
                {specs.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-border border-b py-2.5 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      )}
      {history.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Aún no hay historial de precios: empezamos a seguir este producto hace poco.
        </p>
      )}
    </div>
  );
}

/** Franja de precios: cada tienda con stock es un punto entre la más barata y la más cara. */
function Spread({ offers, method }: { offers: Offer[]; method: PriceKey }) {
  const inStock = offers.filter((o) => o.inStock);
  const shown = inStock.length > 0 ? inStock : offers;
  const min = shown[0]?.[method] ?? 0;
  const max = shown.at(-1)?.[method] ?? 0;
  const span = max - min;

  return (
    <div className="space-y-4">
      <div>
        {inStock.length === 0 ? (
          <>
            <p className="font-semibold text-2xl text-foreground tracking-tight">Sin stock en ninguna tienda</p>
            <p className="text-muted-foreground text-sm">Estos son los últimos precios que vimos.</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-4xl text-foreground tabular-nums tracking-tight">{formatCLP(min)}</p>
            <p className="text-muted-foreground text-sm">
              {inStock.length === 1
                ? `Sólo en ${inStock[0]?.store.name}`
                : `Hasta ${formatCLP(max)} en ${inStock.length} tiendas: entre la más barata y la más cara hay ${formatCLP(span)}.`}
            </p>
          </>
        )}
      </div>
      {shown.length > 1 && (
        <div aria-hidden className="space-y-1.5">
          <div className="relative h-5">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-secondary" />
            {/* Al revés, para que la más barata quede encima cuando varias tiendas tienen el mismo precio. */}
            {shown.toReversed().map((o) => {
              const at = span > 0 ? (o[method] - min) / span : 0;
              const first = o === shown[0] && inStock.length > 0;
              return (
                <span
                  key={o.id}
                  title={`${o.store.name} ${formatCLP(o[method])}`}
                  className={cn(
                    "-translate-x-1/2 -translate-y-1/2 absolute top-1/2 rounded-full border-2 border-card",
                    first ? "size-5 bg-success" : "size-3.5 bg-foreground/35",
                  )}
                  style={{ left: `calc(0.625rem + ${at} * (100% - 1.25rem))` }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>{shown[0]?.store.name}</span>
            <span>{shown.at(-1)?.store.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreCard({
  offer: o,
  method,
  productId,
  best,
}: {
  offer: Offer;
  method: PriceKey;
  productId: number;
  best: boolean;
}) {
  const other = method === "priceCash" ? "priceCard" : "priceCash";
  return (
    <li
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/15",
        best ? "border-success/50" : "border-border",
        !o.inStock && "bg-transparent",
      )}
    >
      <div className="flex items-center gap-3">
        <StoreLogo store={o.store} className={cn("size-8", !o.inStock && "opacity-50")} />
        <OutboundLink
          href={o.url}
          source="product_details_comparison"
          listingId={String(o.id)}
          productId={String(productId)}
          className="min-w-0 flex-1 truncate font-medium text-foreground text-sm after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {o.store.name}
        </OutboundLink>
        {best && (
          <span className="rounded-full bg-success/15 px-1.5 py-0.5 font-medium text-[11px] text-success">
            Más barato
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="tabular-nums">
          <p className={cn("font-semibold text-xl", o.inStock ? "text-foreground" : "text-muted-foreground")}>
            {formatCLP(o[method])}
          </p>
          <p className="text-muted-foreground text-xs">
            {other === "priceCard" ? "Tarjeta" : "Transferencia"} {formatCLP(o[other])}
          </p>
        </div>
        <div className="space-y-0.5 text-right text-muted-foreground text-xs">
          <p className="inline-flex items-center gap-1.5">
            <StockDot inStock={o.inStock} />
            {stockText(o)}
          </p>
          <p>{seenAgo(o.lastSeenAt)}</p>
        </div>
      </div>
    </li>
  );
}
