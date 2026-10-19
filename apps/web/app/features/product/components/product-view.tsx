import { CATEGORY_LABELS, CATEGORY_SLUGS, type Offer, type PricePoint, type ProductDetail } from "@framerate/contracts";
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconExternalLink,
  IconPhotoOff,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useNavigation, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useUser } from "~/features/auth/hooks/useAuth";
import { ReportButton } from "~/features/moderation";
import { AddToQuote } from "~/features/product/components/add-to-quote";
import { PriceHistoryPanel } from "~/features/product/components/price-history-panel";
import { ProductFamily } from "~/features/product/components/product-variants";
import {
  type HistorySummary,
  PERIODS,
  type Period,
  periodFromParam,
  priceVerdict,
  summarizeHistory,
} from "~/features/product/utils/price-history";
import { AdSlot } from "~/shared/components/ad-slot";
import { OutboundLink } from "~/shared/components/outbound-link";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { buttonVariants } from "~/shared/components/primitives/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/shared/components/primitives/select";
import { StoreLogo } from "~/shared/components/store-logo";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cameFrom, lastCategoryUrl } from "~/shared/lib/category-memory";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { priceDrop } from "../utils/price-drop";
import { type SpecRow, specLines } from "../utils/spec-labels";

interface ProductViewProps {
  product: ProductDetail;
  history: PricePoint[];
  period: Period;
  /** Hora de la respuesta del loader: "visto hace" y el período se calculan igual en el servidor y al hidratar. */
  now: number;
}

/**
 * Ficha de producto: la foto y la ficha técnica a la izquierda; a la derecha el precio dice si conviene comprar hoy
 * (comparado con su historial en el período elegido) y debajo están las tiendas. Las que no tienen stock se pliegan.
 */
export function ProductView({ product, history, period, now }: ProductViewProps) {
  const user = useUser();
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const location = useLocation();
  const changingPeriod = navigation.state === "loading" && navigation.location?.pathname === location.pathname;

  // La API ya las ordena: primero con stock y luego por precio. Una tienda que publica el mismo producto dos veces
  // aparece una vez, con su mejor publicación; las demás quedan plegadas.
  const { offers, repeated } = onePerStore(product.offers);
  const inStock = offers.filter((o) => o.inStock);
  const outOfStock = offers.filter((o) => !o.inStock);
  const best = offers[0];
  const specs = withoutRepeats([...specRows(product.attributes, product.category), ...specLines(product.specs)]);
  const fromKnowledge = specs.some((s) => s.knowledge);
  const summary = summarizeHistory(history, offers, period.days, now);

  const choosePeriod = (key: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === PERIODS[0].key) next.delete("periodo");
        else next.set("periodo", key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <Breadcrumb category={product.category} name={product.name} />

      {/* minmax(0,1fr) también en teléfono: si no, la columna crece hasta el texto más largo sin cortar y se sale. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-10">
        {/* Destino de la foto de la tarjeta de producto (app.css). */}
        <div
          className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl bg-[var(--product-stage)] lg:col-start-1 lg:row-start-1 lg:aspect-square"
          style={{ viewTransitionName: "product-photo" }}
        >
          {product.imageUrl ? (
            <AsyncImage
              src={product.imageUrl}
              alt={product.name}
              priority
              className="size-full object-contain p-4 mix-blend-multiply"
            />
          ) : (
            <IconPhotoOff className="size-10 text-foreground/20" stroke={1.25} role="img" aria-label="Sin imagen" />
          )}
        </div>

        <div className="min-w-0 space-y-8 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <header className="space-y-2">
            {product.brand && <p className="text-muted-foreground text-sm">{product.brand}</p>}
            <h1 className="text-balance text-title-h4 text-foreground">{product.name}</h1>
          </header>

          <section aria-label="Precio" className="space-y-5 rounded-3xl border border-border bg-card p-5">
            {best?.inStock ? (
              <div className="space-y-1">
                <p className="text-title-h3 text-foreground tabular-nums">{formatCLP(best.priceCash)}</p>
                <PriceDropLine price={best.priceCash} reference={product.referencePrice} />
                <p className="text-muted-foreground text-sm">
                  Con transferencia en {best.store.name}
                  {product.bestCardPrice !== null && product.bestCardPrice > best.priceCash && (
                    <span className="block tabular-nums">Con tarjeta desde {formatCLP(product.bestCardPrice)}</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-title-h5 text-foreground">Sin stock por ahora</p>
                {best && (
                  <p className="text-muted-foreground text-sm">
                    Ninguna tienda lo tiene disponible. El último precio fue {formatCLP(best.priceCash)} en{" "}
                    {best.store.name}.
                  </p>
                )}
              </div>
            )}

            {best?.inStock &&
              (summary ? (
                <PriceContext
                  today={best.priceCash}
                  summary={summary}
                  period={period}
                  onPeriod={choosePeriod}
                  busy={changingPeriod}
                />
              ) : (
                <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-muted-foreground text-sm">
                  {history.length > 0
                    ? `Lo seguimos desde el ${shortDate(history[0]?.observedAt ?? "")}. Con una semana de datos te vamos a decir si es buen precio.`
                    : "Todavía no tenemos historial para decirte si es buen precio. Lo empezamos a seguir hoy."}
                </p>
              ))}

            {best && (
              <div className="flex flex-wrap gap-2">
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
                <AddToQuote product={product} label="long" className="h-10 flex-1 sm:flex-none" />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-foreground text-label-lg">
              {offers.length > 1 && inStock.length > 0
                ? `Dónde comprarlo (${inStock.length} con stock)`
                : "Dónde comprarlo"}
            </h2>
            {inStock.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {inStock.map((o) => (
                  <StoreRow key={o.id} offer={o} productId={product.id} now={now} />
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
                    <StoreRow key={o.id} offer={o} productId={product.id} now={now} />
                  ))}
                </ul>
              </details>
            )}
            {repeated.length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-muted-foreground text-sm hover:text-foreground">
                  <IconChevronDown className="size-4 transition-transform group-open:rotate-180" />
                  {repeated.length === 1
                    ? `1 publicación repetida (${repeated[0]?.store.name} lo publica dos veces)`
                    : `${repeated.length} publicaciones repetidas de las mismas tiendas`}
                </summary>
                <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {repeated.map((o) => (
                    <StoreRow key={o.id} offer={o} productId={product.id} now={now} />
                  ))}
                </ul>
              </details>
            )}
            {offers.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Ninguna tienda lo publica ahora. Dejamos la página con su historial por si vuelve.
              </p>
            )}
            {user && (
              <ReportButton
                targetType="product"
                targetId={String(product.id)}
                contextLabel={product.name}
                label="Reportar un error en este producto"
                className="mt-2 text-xs"
              />
            )}
          </section>

          {history.length > 0 && (
            <section
              aria-busy={changingPeriod}
              className={cn("space-y-3 transition-opacity", changingPeriod && "opacity-60")}
            >
              <h2 className="text-foreground text-label-lg">Cómo se ha movido el precio</h2>
              <PriceHistoryPanel
                productName={product.name}
                history={history}
                offers={offers}
                period={period}
                now={now}
                onPeriod={choosePeriod}
              />
            </section>
          )}
        </div>

        {(specs.length > 0 || product.mpn) && (
          <section className="space-y-3 lg:col-start-1 lg:row-start-2">
            {specs.length > 0 && (
              <>
                <h2 className="text-foreground text-label-lg">Ficha técnica</h2>
                <dl className="grid grid-cols-2 gap-2">
                  {specs.map(({ label, value, knowledge }) => (
                    <div key={label} className="rounded-2xl bg-secondary/60 px-3 py-2.5">
                      <dt className="text-muted-foreground text-xs">{label}</dt>
                      <dd className="font-medium text-foreground text-sm">
                        {value}
                        {knowledge && <span className="text-muted-foreground"> *</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <p className="text-muted-foreground text-xs">
              {specs.length > 0 && "Sacada de las fichas de las tiendas."}
              {fromKnowledge && (
                <span className="block">* Ninguna tienda lo indica: es el dato conocido del modelo.</span>
              )}
              {product.mpn && (
                <span className="block">
                  Código del fabricante <span className="font-mono">{product.mpn}</span>
                </span>
              )}
            </p>
          </section>
        )}

        {/* Bajo la ficha técnica: en teléfono queda después de precio y tiendas, que es lo que se viene a ver. En
            escritorio el anuncio ocupa el hueco que deja la columna izquierda junto a las tiendas y el historial. */}
        <div className="space-y-6 lg:col-start-1 lg:row-start-3">
          <ProductFamily product={product} />
          <AdSlot slot="5052860512" className="h-[250px]" />
        </div>
      </div>
    </div>
  );
}

/** Veredicto y barra entre el mínimo y el máximo del período, con la marca de hoy y el selector de período. */
function PriceContext({
  today,
  summary,
  period,
  onPeriod,
  busy,
}: {
  today: number;
  summary: HistorySummary;
  period: Period;
  onPeriod: (key: string) => void;
  busy: boolean;
}) {
  const verdict = priceVerdict(today, summary);
  const span = summary.max - summary.min;
  const at = span > 0 ? Math.min(1, Math.max(0, (today - summary.min) / span)) : 0.5;
  return (
    <div
      aria-busy={busy}
      className={cn("space-y-3 rounded-2xl bg-secondary/60 p-4 transition-opacity", busy && "opacity-60")}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-medium text-xs",
            verdict.tone === "good" && "bg-success/15 text-success",
            verdict.tone === "neutral" && "bg-background text-foreground",
            verdict.tone === "bad" && "bg-destructive/15 text-destructive",
          )}
        >
          {verdict.label}
        </span>
        {/* Si el producto se sigue hace menos que el período, se dice desde cuándo: si no, cambiar a 12 meses
            parecería no hacer nada. */}
        <span className="text-muted-foreground">
          {summary.coversPeriod ? `Comparado con ${period.text}.` : `Con datos desde el ${shortDate(summary.since)}.`}
        </span>
        <Select value={period.key} onValueChange={(value) => onPeriod(value as string)}>
          <SelectTrigger size="sm" aria-label="Período para comparar" className="ml-auto bg-background">
            <SelectValue>{(value: string) => periodFromParam(value).label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-success/60 via-foreground/15 to-destructive/60">
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

function StoreRow({ offer: o, productId, now }: { offer: Offer; productId: number; now: number }) {
  return (
    <li className="relative flex items-center gap-2.5 px-3 py-3 transition-colors hover:bg-secondary/40 sm:gap-3 sm:px-4">
      <StoreLogo
        store={{ ...o.store, icon_url: o.store.iconUrl }}
        className={cn("size-9", !o.inStock && "opacity-50")}
      />
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
        <p className="flex flex-wrap items-center gap-x-3 text-muted-foreground text-xs">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              aria-hidden
              className={cn("size-1.5 shrink-0 rounded-full", o.inStock ? "bg-success" : "bg-foreground/25")}
            />
            {stockText(o)}
          </span>
          <span>{seenAgo(o.lastSeenAt, now)}</span>
        </p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className={cn("font-semibold", o.inStock ? "text-foreground" : "text-muted-foreground")}>
          {formatCLP(o.priceCash)}
        </p>
        <p className="text-muted-foreground text-xs">Tarjeta {formatCLP(o.priceCard)}</p>
      </div>
      <IconExternalLink aria-hidden className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
    </li>
  );
}

/** Página actual de la miga: tocar el nombre o su ícono copia el enlace y avisa como el "Copiar enlace" de las cotizaciones. */
function CopyCrumb({ name }: { name: string }) {
  const { t } = useTranslation();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      return;
    }
    toast.success(t("link_copied"));
  };
  return (
    <button
      type="button"
      aria-current="page"
      aria-label={`${name}, copiar enlace`}
      onClick={copy}
      className="group flex min-w-0 cursor-pointer items-center gap-1.5 rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span title={name} className="min-w-0 truncate">
        {name}
      </span>
      <span className="grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors group-hover:bg-secondary/60 group-hover:text-foreground">
        <IconCopy className="size-3.5" />
      </span>
    </button>
  );
}

function Breadcrumb({ category, name }: { category: ProductDetail["category"]; name: string }) {
  const navigate = useNavigate();
  const slug = CATEGORY_SLUGS[category];
  // Igual en servidor y en el primer render del cliente; ya montado, la última lista vista con sus filtros.
  const [href, setHref] = useState(`/categoria/${slug}`);
  useEffect(() => setHref(lastCategoryUrl(slug) ?? `/categoria/${slug}`), [slug]);
  return (
    <nav aria-label="Migas" className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <button
        type="button"
        aria-label="Volver atrás"
        // Con historial es "atrás"; si la ficha se abrió directa, lleva a la lista de su categoría.
        onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(href))}
        className="mr-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border border-border/60 transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconArrowLeft className="size-3.5" />
      </button>
      <Link to="/" className="shrink-0 hover:text-foreground">
        Inicio
      </Link>
      <IconChevronRight className="size-3 shrink-0" />
      <Link
        to={href}
        onClick={(e) => {
          // Con Ctrl, Cmd o Mays, o con otro botón, el enlace abre aparte como siempre.
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          // Si veníamos de esa lista, es volver atrás: mismos filtros y mismo scroll.
          if (cameFrom(href)) {
            e.preventDefault();
            navigate(-1);
          }
        }}
        className="shrink-0 hover:text-foreground"
      >
        {CATEGORY_LABELS[category]}
      </Link>
      <IconChevronRight className="size-3 shrink-0" />
      <CopyCrumb name={name} />
    </nav>
  );
}

const relative = new Intl.RelativeTimeFormat("es-CL", { numeric: "auto" });

/** La primera publicación de cada tienda en el orden de la API (con stock y más barata primero); el resto, aparte. */
function onePerStore(all: Offer[]): { offers: Offer[]; repeated: Offer[] } {
  const seen = new Set<string>();
  const offers: Offer[] = [];
  const repeated: Offer[] = [];
  for (const o of all) {
    if (seen.has(o.store.slug)) repeated.push(o);
    else {
      seen.add(o.store.slug);
      offers.push(o);
    }
  }
  return { offers, repeated };
}

function seenAgo(iso: string, now: number) {
  const minutes = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  return hours < 24 ? relative.format(-hours, "hour") : relative.format(-Math.round(hours / 24), "day");
}

function stockText(o: Offer) {
  if (!o.inStock) return "Sin stock";
  return o.stockQuantity && o.stockQuantity <= 5 ? `Quedan ${o.stockQuantity}` : "Con stock";
}

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CL", { day: "numeric", month: "long" });

const SPEC_LABELS: Record<string, string> = {
  chipset: "Chipset",
  vram: "Memoria",
  capacity: "Capacidad",
  type: "Tipo",
  speed: "Velocidad",
  interface: "Interfaz",
  rpm: "Velocidad de giro",
  formFactor: "Formato",
  wattage: "Potencia",
  efficiency: "Certificación",
  eta: "Cybenetics ETA",
  lambda: "Cybenetics LAMBDA",
  socket: "Socket",
};
const UNITS: Record<string, string> = { vram: " GB", capacity: " GB", speed: " MHz", rpm: " RPM", wattage: " W" };
const UPPER = new Set(["chipset", "type", "interface", "formFactor", "socket"]);

/** Los atributos que el matching saca del título, como filas legibles. El resto (línea, OC...) sólo le sirve al
 * matching. */
function specRows(attributes: ProductDetail["attributes"], category: ProductDetail["category"]): SpecRow[] {
  return Object.entries(attributes).flatMap(([key, value]): SpecRow[] => {
    // En una tarjeta de video el chipset es el modelo (RX 7600); así también se llama su filtro.
    const label = key === "chipset" && category === "gpu" ? "Modelo" : SPEC_LABELS[key];
    if (!label || typeof value === "boolean") return [];
    const row = (text: string) => [{ label, value: text, knowledge: false }];
    if (typeof value === "number") return row(`${value}${UNITS[key] ?? ""}`);
    if (key === "efficiency") return row(`80 Plus ${value[0]?.toUpperCase()}${value.slice(1)}`);
    return row(UPPER.has(key) ? value.toUpperCase() : `${value[0]?.toUpperCase()}${value.slice(1)}`);
  });
}

/** Lo del nombre va primero; una spec con la misma etiqueta (el socket de una CPU) no se repite. */
const withoutRepeats = (rows: SpecRow[]) => rows.filter((r, i) => rows.findIndex((o) => o.label === r.label) === i);

/** Precio habitual tachado y cuánto bajó; nada si la baja es menor al 3%. */
function PriceDropLine({ price, reference }: { price: number; reference: number | null }) {
  const drop = priceDrop(price, reference);
  if (!drop || !reference) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
      <s className="text-muted-foreground">{formatCLP(reference)}</s>
      <span className="font-medium text-emerald-700 dark:text-emerald-400">
        Bajó {formatCLP(drop.amount)} ({drop.percent}%)
      </span>
      <span className="text-muted-foreground text-xs">bajo su precio habitual</span>
    </p>
  );
}
