import {
  CATEGORIES,
  CATEGORY_SLUGS,
  type CompatCheck,
  isAdditiveSlot,
  psuSizing,
  QUOTE_SLOT_LABELS,
  QUOTE_SLOTS,
  type QuoteCompatibility,
  type QuoteCondensePlan,
  type QuoteDetail,
  type QuoteItem,
  type QuoteSlot,
  SLOT_BY_CATEGORY,
} from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCircleCheck,
  IconCircleX,
  IconExternalLink,
  IconHelpCircle,
  IconMinus,
  IconPlus,
  IconShare,
  IconTag,
  IconTrash,
} from "@tabler/icons-react";
import { type ComponentType, useState } from "react";
import { Link } from "react-router";
import { QuoteActions } from "~/features/quote/components/quote-actions";
import { CompatibilityIssue, CompatibilityList, issuesOf } from "~/features/quote/components/quote-compatibility";
import { QuoteLikeButton } from "~/features/quote/components/quote-like-button";
import { StoreSelector } from "~/features/quote/components/store-selector";
import { OutboundLink } from "~/shared/components/outbound-link";
import { Button, buttonVariants } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { CondenseDialog } from "./condensar";
import { componentes } from "./ranking";

const noop = () => {};

const COMPAT: Record<
  QuoteCompatibility["status"],
  { label: string; tone: string; icon: ComponentType<{ className?: string }> }
> = {
  valid: { label: "Compatible", tone: "text-success", icon: IconCircleCheck },
  warning: { label: "Con advertencias", tone: "text-warn", icon: IconAlertTriangle },
  incompatible: { label: "Incompatible", tone: "text-destructive", icon: IconCircleX },
  unknown: { label: "Sin revisar", tone: "text-muted-foreground", icon: IconHelpCircle },
};

const isIssue = (c: CompatCheck) => c.result === "incompatible" || c.result === "warning";

const categoryHref = (slot: QuoteSlot) => {
  const category = CATEGORIES.find((c) => SLOT_BY_CATEGORY[c] === slot);
  return category ? `/categoria/${CATEGORY_SLUGS[category]}` : "/buscar";
};

/** Diferencia contra lo elegido, con el signo menos tipográfico. */
const delta = (n: number) => (n === 0 ? "Mismo precio" : `${n > 0 ? "+" : "−"}${formatCLP(Math.abs(n))}`);

const ROW_GRID = "md:grid-cols-[8.5rem_minmax(0,1fr)_9.5rem_7rem_2.5rem_1rem]";

function Stat({ label, value, children }: { label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5 p-4">
      <span className="block text-muted-foreground text-label-xs">{label}</span>
      <span className="block truncate text-foreground text-title-h5 tabular-nums md:text-title-h4">{value}</span>
      <div className="text-muted-foreground text-paragraph-xs">{children}</div>
    </div>
  );
}

function Thumb({ item }: { item: QuoteItem }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--product-stage)]">
      {item.product.imageUrl && (
        <img
          src={imageVariant(item.product.imageUrl, 400)}
          alt=""
          loading="lazy"
          className="size-full object-contain p-0.5 mix-blend-multiply"
        />
      )}
    </span>
  );
}

interface SlotRowProps {
  item: QuoteItem;
  alternatives: QuoteItem[];
  issues: CompatCheck[];
  isOwner: boolean;
}

/** Un componente en una línea; al tocarlo se despliegan specs, tarjeta, avisos, tienda y alternativas. */
function SlotRow({ item, alternatives, issues, isOwner }: SlotRowProps) {
  const [open, setOpen] = useState(false);
  const { product, offer, quantity } = item;
  const panelId = `slot-${item.id}`;
  const cheapest = offer && item.chosenListingId === null;

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "grid w-full cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto_1rem] items-center gap-x-3 px-3 py-2 text-left transition-colors hover:bg-secondary/40",
          ROW_GRID,
          open && "bg-secondary/40",
        )}
      >
        <span className="hidden truncate text-muted-foreground text-label-xs md:block">
          {QUOTE_SLOT_LABELS[item.slot]}
        </span>
        <span className="flex min-w-0 items-center gap-3 max-md:contents">
          <Thumb item={item} />
          <span className="min-w-0">
            <span className="block truncate text-muted-foreground text-label-xs md:hidden">
              {QUOTE_SLOT_LABELS[item.slot]}
              {quantity > 1 && <span className="tabular-nums"> ×{quantity}</span>}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              {issues.length > 0 && (
                <IconAlertTriangle
                  className={cn(
                    "size-3.5 shrink-0",
                    issues.some((c) => c.result === "incompatible") ? "text-destructive" : "text-warn",
                  )}
                  aria-label="Tiene avisos de compatibilidad"
                />
              )}
              <span className={cn("truncate text-label-sm", offer ? "text-foreground" : "text-muted-foreground")}>
                {product.name}
              </span>
              {alternatives.length > 0 && (
                <span className="hidden shrink-0 rounded-md bg-secondary px-1.5 text-label-xs text-muted-foreground tabular-nums md:inline">
                  +{alternatives.length}
                  <span className="sr-only"> alternativas</span>
                </span>
              )}
            </span>
          </span>
        </span>
        <span className="hidden min-w-0 items-center gap-2 md:flex">
          {offer && (
            <>
              <StoreLogo
                store={{ name: offer.store.name, slug: offer.store.slug, icon_url: offer.store.iconUrl }}
                className="size-5 rounded-sm text-[9px]"
              />
              <span className="truncate text-label-xs text-muted-foreground">{offer.store.name}</span>
            </>
          )}
        </span>
        <span className="flex items-center justify-end gap-1.5 text-label-sm tabular-nums">
          {cheapest && (
            <span title="Más barato" className="text-success">
              <IconTag className="size-3.5" aria-hidden />
              <span className="sr-only">Más barato</span>
            </span>
          )}
          {offer ? formatCLP(offer.priceCash * quantity) : <span className="text-muted-foreground">Sin stock</span>}
        </span>
        <span className="hidden text-right text-label-xs text-muted-foreground tabular-nums md:block">×{quantity}</span>
        <IconChevronDown
          aria-hidden
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div id={panelId} className="space-y-3 bg-secondary/40 px-3 pt-1 pb-3 md:pl-40">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0 space-y-1.5">
              {item.specs.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.specs.map((spec) => (
                    <span
                      key={spec}
                      className="rounded-md bg-card px-1.5 py-0.5 text-label-xs text-secondary-foreground tabular-nums"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              )}
              {offer && (
                <p className="text-muted-foreground text-paragraph-xs">
                  Con tarjeta <span className="tabular-nums">{formatCLP(offer.priceCard * quantity)}</span>
                  {quantity > 1 && (
                    <span className="tabular-nums">
                      {" "}
                      ({quantity} de {formatCLP(offer.priceCash)} en efectivo)
                    </span>
                  )}
                </p>
              )}
              {issues.map((check) => (
                <CompatibilityIssue key={check.rule} check={check} />
              ))}
              <Link
                to={`/producto/${product.slug}`}
                className="inline-block text-label-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
              >
                Ver ficha del producto
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
              {offer && (
                <span className="flex min-w-0 items-center gap-2">
                  <StoreLogo
                    store={{ name: offer.store.name, slug: offer.store.slug, icon_url: offer.store.iconUrl }}
                    className="size-5 rounded-sm text-[9px]"
                  />
                  {isOwner ? (
                    <StoreSelector item={item} onChoose={noop} />
                  ) : (
                    <OutboundLink
                      href={offer.url}
                      source="quote_item"
                      listingId={String(offer.id)}
                      productId={String(product.id)}
                      className="flex items-center gap-1 text-label-sm hover:text-primary"
                    >
                      Ir a {offer.store.name}
                      <IconExternalLink className="size-3 text-muted-foreground" />
                    </OutboundLink>
                  )}
                </span>
              )}
              {isOwner && (
                <span className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-xs" aria-label="Quitar de la cotización" onClick={noop}>
                    <IconTrash />
                  </Button>
                  <Button variant="outline" size="icon-xs" aria-label="Menos unidades" disabled={quantity <= 1}>
                    <IconMinus />
                  </Button>
                  <span className="w-6 text-center text-label-sm tabular-nums">{quantity}</span>
                  <Button variant="outline" size="icon-xs" aria-label="Más unidades">
                    <IconPlus />
                  </Button>
                </span>
              )}
            </div>
          </div>

          {alternatives.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <p className="border-border border-b px-3 py-1.5 text-label-xs text-muted-foreground">
                Alternativas guardadas
              </p>
              <ul className="divide-y divide-border">
                {alternatives.map((alt) => {
                  const diff = alt.offer && offer ? alt.offer.priceCash - offer.priceCash : null;
                  return (
                    <li key={alt.id} className="flex items-center gap-3 px-3 py-1.5">
                      <Link
                        to={`/producto/${alt.product.slug}`}
                        className="min-w-0 flex-1 truncate text-label-sm hover:text-primary"
                      >
                        {alt.product.name}
                      </Link>
                      <span
                        className={cn(
                          "shrink-0 text-label-xs tabular-nums",
                          diff !== null && diff < 0 ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {diff === null ? "Sin stock" : delta(diff)}
                      </span>
                      {isOwner && (
                        <Button variant="outline" size="xs" onClick={noop}>
                          Elegir
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function EmptySlotRow({ slot }: { slot: QuoteSlot }) {
  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 text-muted-foreground",
        "md:grid-cols-[8.5rem_minmax(0,1fr)_auto]",
      )}
    >
      <span className="truncate text-label-xs">{QUOTE_SLOT_LABELS[slot]}</span>
      <span className="hidden text-paragraph-xs md:block">No seleccionado</span>
      <Link to={categoryHref(slot)} className={buttonVariants({ variant: "ghost", size: "xs" })}>
        <IconPlus /> Agregar
      </Link>
    </li>
  );
}

interface QuoteDenseProps {
  quote: QuoteDetail;
  isOwner: boolean;
  /** Plan de "Condensar tiendas"; sin él no se ofrece. */
  condensePlan?: QuoteCondensePlan;
}

/** La cotización como lista densa: cabecera en una línea, tres cifras hermanas y una fila de una línea por componente. */
export function QuoteDense({ quote, isOwner, condensePlan }: QuoteDenseProps) {
  const [showChecks, setShowChecks] = useState(false);
  const { compatibility, totals } = quote;
  const watts = compatibility.estimatedWatts;
  const psu = watts ? psuSizing(watts) : null;
  const look = COMPAT[compatibility.status];
  const issueCount = compatibility.checks.filter(isIssue).length;
  const filled = QUOTE_SLOTS.filter((slot) => quote.items.some((i) => i.slot === slot));
  const empty = QUOTE_SLOTS.filter((slot) => !filled.includes(slot));
  const selectedCount = quote.items.filter((i) => i.isSelected).length;

  return (
    <div className="w-full space-y-4 pb-16">
      <header className="flex flex-col items-center gap-2 pt-4 text-center lg:flex-row lg:flex-wrap lg:gap-x-4 lg:text-left">
        <h1 className="order-1 min-w-0 text-foreground text-title-h5 md:text-title-h4">{quote.name}</h1>
        {quote.description && (
          <p className="order-2 max-w-2xl text-muted-foreground text-paragraph-sm lg:order-4 lg:basis-full">
            {quote.description}
          </p>
        )}
        <div className="order-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-label-xs text-muted-foreground lg:order-2">
          <Link to={`/u/${quote.author.username}`} className="flex items-center gap-1.5 hover:text-foreground">
            {quote.author.avatarUrl && (
              <img src={quote.author.avatarUrl} alt="" className="size-5 rounded-full" referrerPolicy="no-referrer" />
            )}
            @{quote.author.username}
          </Link>
          <span>
            Actualizada el{" "}
            {new Date(quote.updatedAt).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "America/Santiago",
            })}
          </span>
          <QuoteLikeButton
            liked={quote.likedByMe}
            count={quote.likeCount}
            disabled={isOwner}
            hint={isOwner ? "No puedes darle me gusta a tu propia cotización" : undefined}
            onToggle={noop}
          />
        </div>
        <div className="order-4 flex items-center gap-2 lg:order-3 lg:ml-auto">
          <Button variant="outline" onClick={noop}>
            <IconShare />
            Compartir
          </Button>
          <QuoteActions onExportPDF={noop} onExportExcel={noop} onCopyClipboard={noop} />
        </div>
      </header>

      <div className="grid grid-cols-2 divide-border overflow-hidden rounded-2xl border border-border bg-card max-sm:divide-y sm:grid-cols-3 sm:divide-x">
        <div className="col-span-2 sm:col-span-1">
          <Stat label="Total efectivo" value={formatCLP(totals.cash)}>
            Con tarjeta <span className="tabular-nums">{formatCLP(totals.card)}</span>
          </Stat>
        </div>
        <div className="max-sm:border-border max-sm:border-r">
          <Stat label="Consumo estimado" value={watts ? `~${watts} W` : "Sin datos"}>
            {psu ? (
              <span className="tabular-nums">
                Fuente mínima {psu.minimum} W y recomendada {psu.recommended} W
              </span>
            ) : (
              "Agrega procesador y tarjeta para estimarlo"
            )}
          </Stat>
        </div>
        <Stat
          label="Compatibilidad"
          value={
            <span className={cn("flex items-center gap-1.5", look.tone)}>
              <look.icon className="size-6 shrink-0" />
              <span className="truncate">{look.label}</span>
            </span>
          }
        >
          <button
            type="button"
            aria-expanded={showChecks}
            onClick={() => setShowChecks((v) => !v)}
            className="cursor-pointer text-left underline-offset-2 hover:text-foreground hover:underline"
          >
            <span className="tabular-nums">
              {issueCount === 0
                ? `Sin avisos en ${compatibility.checks.length} chequeos`
                : `${issueCount} ${issueCount === 1 ? "aviso" : "avisos"} en ${compatibility.checks.length} chequeos`}
            </span>
          </button>
        </Stat>
      </div>

      {showChecks && <CompatibilityList compatibility={compatibility} className="rounded-2xl shadow-none" />}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-border border-b px-3 py-2">
          <h2 className="text-foreground text-label-md">
            Componentes <span className="text-muted-foreground text-paragraph-sm tabular-nums">{selectedCount}</span>
          </h2>
          {isOwner && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={noop}>
                <IconTag className="size-4" />
                Más barato en todo
              </Button>
              {condensePlan && <CondenseDialog quote={quote} plan={condensePlan} />}
            </div>
          )}
        </div>
        <div
          className={cn(
            "hidden gap-x-3 border-border border-b px-3 py-1.5 text-label-xs text-muted-foreground md:grid",
            ROW_GRID,
          )}
        >
          <span>Componente</span>
          <span>Producto</span>
          <span>Tienda</span>
          <span className="text-right">Efectivo</span>
          <span className="text-right">Cant.</span>
          <span />
        </div>
        <ul className="divide-y divide-border">
          {filled.flatMap((slot) => {
            const items = quote.items.filter((i) => i.slot === slot);
            const shown = isAdditiveSlot(slot) ? items : items.filter((i) => i.isSelected);
            const alternatives = items.filter((i) => !shown.includes(i));
            return shown.map((item) => (
              <SlotRow
                key={item.id}
                item={item}
                alternatives={alternatives}
                issues={issuesOf(compatibility, item.id)}
                isOwner={isOwner}
              />
            ));
          })}
          {isOwner && empty.map((slot) => <EmptySlotRow key={slot} slot={slot} />)}
        </ul>
        <div className="flex items-center justify-end gap-3 border-border border-t px-3 py-2.5">
          <span className="text-muted-foreground text-label-xs">Total ({componentes(selectedCount)})</span>
          <span className="text-foreground text-label-md tabular-nums">{formatCLP(totals.cash)}</span>
        </div>
      </section>
    </div>
  );
}
