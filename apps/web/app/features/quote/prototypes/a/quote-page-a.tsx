import {
  isAdditiveSlot,
  psuSizing,
  QUOTE_SLOT_LABELS,
  QUOTE_SLOTS,
  type QuoteDetail,
  type QuoteItem,
  type QuoteSlot,
} from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import {
  IconClipboardText,
  IconExternalLink,
  IconFileSpreadsheet,
  IconLink,
  IconMinus,
  IconPlus,
  IconTag,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { QuoteAlternatives } from "~/features/quote/components/quote-alternatives";
import {
  CompatibilityIssue,
  CompatibilityList,
  issuesOf,
  STATUS_DOT,
  statusOf,
} from "~/features/quote/components/quote-compatibility";
import { QuoteLikeToggle } from "~/features/quote/components/quote-like-toggle";
import { StoreSelector } from "~/features/quote/components/store-selector";
import { OutboundLink } from "~/shared/components/outbound-link";
import { Button, buttonVariants } from "~/shared/components/primitives/button";
import { ButtonGroup } from "~/shared/components/primitives/button-group";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { QuoteCondensePlan } from "../fixtures";
import { CondenseA } from "./condense-a";

const noop = () => {};
const ROW_COLS = "lg:grid-cols-[8.5rem_minmax(0,1fr)_11rem_8rem_6.5rem]";

const STATUS_WORD: Record<QuoteDetail["compatibility"]["status"], string> = {
  valid: "Compatible",
  warning: "Con advertencias",
  incompatible: "Incompatible",
  unknown: "Sin revisar",
};
const STATUS_TONE: Record<QuoteDetail["compatibility"]["status"], string> = {
  valid: STATUS_DOT.ok,
  warning: STATUS_DOT.warning,
  incompatible: STATUS_DOT.incompatible,
  unknown: STATUS_DOT.unknown,
};

interface QuotePageAProps {
  quote: QuoteDetail;
  isOwner: boolean;
  condensePlan?: QuoteCondensePlan;
}

export function QuotePageA({ quote, isOwner, condensePlan }: QuotePageAProps) {
  return (
    <div className="space-y-6">
      <Header quote={quote} />
      <ItemsTable quote={quote} isOwner={isOwner} condensePlan={condensePlan} />
      <CompatibilityList compatibility={quote.compatibility} />
    </div>
  );
}

function Header({ quote }: { quote: QuoteDetail }) {
  const date = new Date(quote.updatedAt).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
  return (
    <header className="grid gap-4 text-center lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:text-left">
      <div className="space-y-2">
        <h1 className="text-title-h4 text-foreground md:text-title-h3">{quote.name}</h1>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-muted-foreground text-paragraph-sm lg:justify-start">
          <Link to={`/u/${quote.author.username}`} className="inline-flex items-center gap-2 hover:text-foreground">
            {quote.author.avatarUrl && <img src={quote.author.avatarUrl} alt="" className="size-5 rounded-full" />}
            {quote.author.displayName}
          </Link>
          <span>Actualizada el {date}</span>
        </p>
      </div>
      <div className="order-last flex flex-wrap items-center justify-center gap-2 lg:order-none lg:justify-end">
        <span className="text-label-xs text-muted-foreground">Compartir</span>
        <ButtonGroup>
          <Button variant="outline" size="sm" onClick={noop}>
            <IconLink />
            Copiar enlace
          </Button>
          <Button variant="outline" size="sm" onClick={noop}>
            <IconFileSpreadsheet />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={noop}>
            <IconClipboardText />
            Texto
          </Button>
        </ButtonGroup>
        <QuoteLikeToggle quote={quote} />
      </div>
      <Figures quote={quote} />
    </header>
  );
}

function Figure({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5 bg-card p-3 text-left sm:p-4">
      <p className="text-label-xs text-muted-foreground">{label}</p>
      <p className="truncate text-title-h6 text-foreground tabular-nums">{value}</p>
      {sub && <p className="truncate text-muted-foreground text-paragraph-xs">{sub}</p>}
    </div>
  );
}

function Figures({ quote }: { quote: QuoteDetail }) {
  const { compatibility, totals } = quote;
  const watts = compatibility.estimatedWatts;
  const psu = watts ? psuSizing(watts) : null;
  const ok = compatibility.checks.filter((c) => c.result === "ok").length;
  return (
    // Las líneas entre cifras son el fondo de la grilla asomando por el `gap-px`.
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:col-span-2 lg:grid-cols-4">
      <Figure label="Total en efectivo" value={formatCLP(totals.cash)} sub={`Con tarjeta ${formatCLP(totals.card)}`} />
      <Figure
        label="Compatibilidad"
        value={
          <span className="inline-flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-full", STATUS_TONE[compatibility.status])} />
            {STATUS_WORD[compatibility.status]}
          </span>
        }
        sub={
          compatibility.checks.length > 0
            ? `${ok} de ${compatibility.checks.length} chequeos en orden`
            : "Faltan componentes"
        }
      />
      <Figure label="Consumo estimado" value={watts ? `${watts} W` : "Sin datos"} sub="Aproximado, en carga" />
      <Figure
        label="Fuente recomendada"
        value={psu ? `${psu.recommended} W` : "Sin datos"}
        sub={psu ? `Mínima ${psu.minimum} W` : undefined}
      />
    </div>
  );
}

function ItemsTable({ quote, isOwner, condensePlan }: QuotePageAProps) {
  const filled = (slot: QuoteSlot) => quote.items.some((i) => i.slot === slot);
  const slots = isOwner
    ? [...QUOTE_SLOTS.filter(filled), ...QUOTE_SLOTS.filter((s) => !filled(s))]
    : QUOTE_SLOTS.filter(filled);
  const hasPinned = quote.items.some((i) => i.isSelected && i.chosenListingId !== null);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-border border-b px-4 py-3 lg:px-6">
        <h2 className="text-label-lg">
          Componentes <span className="text-muted-foreground tabular-nums">{quote.itemCount}</span>
        </h2>
        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            {hasPinned && (
              <Button variant="outline" size="sm" onClick={noop}>
                <IconTag className="size-4" />
                Más barato en todo
              </Button>
            )}
            {condensePlan && <CondenseA quote={quote} plan={condensePlan} />}
          </div>
        )}
      </div>
      <div
        className={cn(
          "hidden gap-4 border-border border-b px-6 py-2 text-subheading-2xs text-muted-foreground uppercase lg:grid",
          ROW_COLS,
        )}
      >
        <span>Slot</span>
        <span>Componente</span>
        <span>Tienda</span>
        <span className="text-right">Precio</span>
        <span className="text-right">Cantidad</span>
      </div>
      <ul className="divide-y divide-border">
        {slots.map((slot) => {
          const items = quote.items.filter((i) => i.slot === slot);
          const shown = isAdditiveSlot(slot) ? items : items.filter((i) => i.isSelected);
          const alternatives = items.filter((i) => !shown.includes(i));
          return (
            <li key={slot}>
              {shown.length === 0 ? (
                <EmptyRow slot={slot} />
              ) : (
                shown.map((item) => <Row key={item.id} item={item} quote={quote} isOwner={isOwner} />)
              )}
              {alternatives.length > 0 && (
                <QuoteAlternatives items={alternatives} isOwner={isOwner} onSelect={noop} onRemove={noop} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EmptyRow({ slot }: { slot: QuoteSlot }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
      <span className="text-subheading-2xs text-muted-foreground uppercase">{QUOTE_SLOT_LABELS[slot]}</span>
      <Link to="/buscar" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <IconPlus /> Agregar
      </Link>
    </div>
  );
}

function StoreCell({ item, isOwner }: { item: QuoteItem; isOwner: boolean }) {
  const { offer } = item;
  if (!offer) return <span className="text-paragraph-sm text-warn">Sin stock</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <StoreLogo
        store={{ name: offer.store.name, slug: offer.store.slug, icon_url: offer.store.iconUrl }}
        className="size-6 rounded-md text-[10px]"
      />
      <span className="min-w-0">
        {isOwner ? (
          <StoreSelector item={item} onChoose={noop} />
        ) : (
          <OutboundLink
            href={offer.url}
            source="quote_item"
            listingId={String(offer.id)}
            productId={String(item.product.id)}
            className="flex items-center gap-1 text-label-sm hover:text-primary"
          >
            <span className="truncate">{offer.store.name}</span>
            <IconExternalLink className="size-3 shrink-0 text-muted-foreground" />
          </OutboundLink>
        )}
        {item.isSelected && item.chosenListingId === null && (
          <span className="block text-paragraph-xs text-success">Más barato</span>
        )}
      </span>
    </span>
  );
}

function Quantity({ item, isOwner }: { item: QuoteItem; isOwner: boolean }) {
  if (!isOwner) return <span className="text-paragraph-sm tabular-nums">{item.quantity}</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Button variant="ghost" size="icon-xs" aria-label="Menos unidades" disabled={item.quantity <= 1} onClick={noop}>
        <IconMinus />
      </Button>
      <span className="w-5 text-center text-paragraph-sm tabular-nums">{item.quantity}</span>
      <Button variant="ghost" size="icon-xs" aria-label="Más unidades" onClick={noop}>
        <IconPlus />
      </Button>
    </span>
  );
}

function Datum({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5 bg-card p-2.5">
      <p className="text-subheading-2xs text-muted-foreground uppercase">{label}</p>
      <div className="min-w-0 text-paragraph-sm">{children}</div>
    </div>
  );
}

/** En escritorio, una fila de tabla; en teléfono, una tarjeta por slot con una mini grilla de datos. */
function Row({ item, quote, isOwner }: { item: QuoteItem; quote: QuoteDetail; isOwner: boolean }) {
  const { product, offer, quantity } = item;
  const status = statusOf(quote.compatibility, item.id);
  const cash = offer ? formatCLP(offer.priceCash * quantity) : "Sin precio";
  const card = offer ? formatCLP(offer.priceCard * quantity) : null;

  return (
    <div className={cn("grid gap-3 px-4 py-4 lg:items-center lg:gap-4 lg:px-6 lg:py-3", ROW_COLS)}>
      <span className="flex items-center gap-2 text-subheading-2xs text-muted-foreground uppercase">
        {status && <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} />}
        {QUOTE_SLOT_LABELS[item.slot]}
      </span>

      <div className="flex min-w-0 gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--product-stage)] p-1">
          {product.imageUrl && (
            <img
              src={imageVariant(product.imageUrl, 400)}
              alt=""
              loading="lazy"
              className={cn("size-full object-contain mix-blend-multiply", !offer && "opacity-50 grayscale")}
            />
          )}
        </span>
        <div className="min-w-0 space-y-1">
          <Link to={`/producto/${product.slug}`} className="block text-label-sm text-foreground hover:text-primary">
            {product.name}
          </Link>
          {item.specs.length > 0 && <p className="text-muted-foreground text-paragraph-xs">{item.specs.join(", ")}</p>}
          {issuesOf(quote.compatibility, item.id).map((check) => (
            <CompatibilityIssue key={check.rule} check={check} />
          ))}
        </div>
      </div>

      <div className="hidden lg:block">
        <StoreCell item={item} isOwner={isOwner} />
      </div>
      <div className="hidden text-right lg:block">
        <p className="text-label-sm tabular-nums">{cash}</p>
        {card && <p className="text-muted-foreground text-paragraph-xs tabular-nums">Tarjeta {card}</p>}
      </div>
      <div className="hidden justify-end lg:flex">
        <Quantity item={item} isOwner={isOwner} />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:hidden">
        <Datum label="Efectivo">
          <span className="text-label-sm tabular-nums">{cash}</span>
        </Datum>
        <Datum label="Tarjeta">
          <span className="tabular-nums">{card ?? "Sin precio"}</span>
        </Datum>
        <Datum label="Tienda">
          <StoreCell item={item} isOwner={isOwner} />
        </Datum>
        <Datum label="Cantidad">
          <Quantity item={item} isOwner={isOwner} />
        </Datum>
      </div>
    </div>
  );
}
