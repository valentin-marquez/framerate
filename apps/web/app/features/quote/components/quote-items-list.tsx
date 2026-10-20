import {
  CATEGORIES,
  CATEGORY_SLUGS,
  type CompatCheck,
  isAdditiveSlot,
  type Offer,
  QUOTE_SLOT_LABELS,
  QUOTE_SLOTS,
  type QuoteCondenseOption,
  type QuoteDetail,
  type QuoteItem,
  type QuoteSlot,
  SLOT_BY_CATEGORY,
} from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconExternalLink,
  IconMinus,
  IconPlus,
  IconTag,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { useQuoteInteractionStore } from "~/features/quote/store/quote-interaction";
import { OutboundLink } from "~/shared/components/outbound-link";
import { Button, buttonVariants } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { CondenseStoresDialog } from "./condense-stores-dialog";
import { CompatibilityIssue, issuesOf } from "./quote-compatibility";
import { StoreSelector } from "./store-selector";

interface Handlers {
  onChangeQuantity: (item: QuoteItem, quantity: number) => void;
  onRemove: (item: QuoteItem) => void;
  onSelect: (item: QuoteItem) => void;
  onChooseOffer: (item: QuoteItem, offer: Offer | null) => void;
}

interface QuoteItemsListProps extends Handlers {
  quote: Pick<QuoteDetail, "id" | "name" | "items" | "totals" | "compatibility">;
  isOwner: boolean;
  /** Vuelve al mejor precio todos los ítems con la tienda fijada a mano. */
  onChooseCheapest: () => void;
  /** Aplica el plan de comprar en menos tiendas que muestra el panel "Condensar tiendas". */
  onCondense: (option: QuoteCondenseOption) => Promise<void>;
}

/** Agregar lleva a la página de la categoría del slot (en storage, la primera: SSD): ahí se elige y se agrega. */
const categoryHref = (slot: QuoteSlot) => {
  const category = CATEGORIES.find((c) => SLOT_BY_CATEGORY[c] === slot);
  return category ? `/categoria/${CATEGORY_SLUGS[category]}` : "/buscar";
};

/** Diferencia contra lo elegido, con el signo menos tipográfico. */
const delta = (n: number) => (n === 0 ? "Mismo precio" : `${n > 0 ? "+" : "−"}${formatCLP(Math.abs(n))}`);

const lineCash = (item: QuoteItem) => (item.offer ? item.offer.priceCash * item.quantity : null);

const ROW_GRID = "md:grid-cols-[8.5rem_minmax(0,1fr)_9.5rem_7rem_2.5rem_1rem]";

function Thumb({ item }: { item: QuoteItem }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--product-stage)]">
      {item.product.imageUrl && (
        <img
          src={imageVariant(item.product.imageUrl, 400)}
          alt=""
          loading="lazy"
          className={cn("size-full object-contain p-0.5 mix-blend-multiply", !item.offer && "opacity-50 grayscale")}
        />
      )}
    </span>
  );
}

interface SlotRowProps extends Handlers {
  item: QuoteItem;
  alternatives: QuoteItem[];
  issues: CompatCheck[];
  isOwner: boolean;
}

/** Un componente en una línea; al tocarlo se despliegan specs, tarjeta, avisos, tienda y alternativas. */
function SlotRow({
  item,
  alternatives,
  issues,
  isOwner,
  onChangeQuantity,
  onRemove,
  onSelect,
  onChooseOffer,
}: SlotRowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { product, offer, quantity } = item;
  const panelId = `item-${item.id}`;
  const chosenCash = lineCash(item);

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
              <StoreLogo store={offer.store} className="size-5 rounded-sm text-[9px]" />
              <span className="truncate text-label-xs text-muted-foreground">{offer.store.name}</span>
            </>
          )}
        </span>
        <span className="flex items-center justify-end gap-1.5 text-label-sm tabular-nums">
          {offer && item.chosenListingId === null && (
            <span title={t("quote_cheapest_badge")} className="text-success">
              <IconTag className="size-3.5" aria-hidden />
              <span className="sr-only">{t("quote_cheapest_badge")}</span>
            </span>
          )}
          {chosenCash !== null ? (
            formatCLP(chosenCash)
          ) : (
            <span className="text-muted-foreground">{t("out_of_stock")}</span>
          )}
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
              <p className="text-foreground text-label-sm md:hidden">{product.name}</p>
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
              {offer ? (
                <p className="text-muted-foreground text-paragraph-xs">
                  Con tarjeta <span className="tabular-nums">{formatCLP(offer.priceCard * quantity)}</span>
                  {quantity > 1 && (
                    <span className="tabular-nums">
                      {" "}
                      ({quantity} de {formatCLP(offer.priceCash)} en efectivo)
                    </span>
                  )}
                </p>
              ) : (
                <p className="flex items-center gap-1 text-label-xs text-warn">
                  <IconAlertTriangle className="size-3" aria-hidden />
                  No disponible en tiendas
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
              {isOwner ? (
                <span className="flex min-w-0 items-center gap-2">
                  {offer && <StoreLogo store={offer.store} className="size-5 rounded-sm text-[9px]" />}
                  <StoreSelector item={item} onChoose={(chosen) => onChooseOffer(item, chosen)} />
                </span>
              ) : (
                offer && (
                  <OutboundLink
                    href={offer.url}
                    source="quote_item"
                    listingId={String(offer.id)}
                    productId={String(product.id)}
                    className="flex min-w-0 items-center gap-2 text-label-sm hover:text-primary"
                  >
                    <StoreLogo store={offer.store} className="size-5 rounded-sm text-[9px]" />
                    <span className="truncate">Ir a {offer.store.name}</span>
                    <IconExternalLink className="size-3 shrink-0 text-muted-foreground" />
                  </OutboundLink>
                )
              )}
              {isOwner && (
                <span className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Quitar de la cotización"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(item)}
                  >
                    <IconTrash />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    aria-label="Menos unidades"
                    disabled={quantity <= 1}
                    onClick={() => onChangeQuantity(item, quantity - 1)}
                  >
                    <IconMinus />
                  </Button>
                  <span className="w-6 text-center text-label-sm tabular-nums">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    aria-label="Más unidades"
                    disabled={quantity >= 99}
                    onClick={() => onChangeQuantity(item, quantity + 1)}
                  >
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
              <ul className="max-h-60 divide-y divide-border overflow-y-auto">
                {alternatives.map((alt) => {
                  const altCash = lineCash(alt);
                  const diff = altCash !== null && chosenCash !== null ? altCash - chosenCash : null;
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
                        {diff !== null ? delta(diff) : altCash !== null ? formatCLP(altCash) : t("out_of_stock")}
                      </span>
                      {isOwner && (
                        <>
                          <Button variant="outline" size="xs" onClick={() => onSelect(alt)}>
                            {t("quote_use_this")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Quitar alternativa"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => onRemove(alt)}
                          >
                            <IconTrash />
                          </Button>
                        </>
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

function EmptySlotRow({ slot, quote }: { slot: QuoteSlot; quote: { id: string; name: string } }) {
  const setOriginQuote = useQuoteInteractionStore((s) => s.setOriginQuote);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 text-muted-foreground md:grid-cols-[8.5rem_minmax(0,1fr)_auto]">
      <span className="truncate text-label-xs">{QUOTE_SLOT_LABELS[slot]}</span>
      <span className="hidden text-paragraph-xs md:block">No seleccionado</span>
      <Link
        to={categoryHref(slot)}
        onClick={() => setOriginQuote(quote)}
        className={buttonVariants({ variant: "ghost", size: "xs" })}
      >
        <IconPlus /> Agregar
      </Link>
    </li>
  );
}

/** La lista densa: una fila por componente en el orden del armado, los slots vacíos (sólo el dueño) y el total. */
export function QuoteItemsList({ quote, isOwner, onChooseCheapest, onCondense, ...handlers }: QuoteItemsListProps) {
  const { t } = useTranslation();
  const { items, compatibility, totals } = quote;
  const filled = QUOTE_SLOTS.filter((slot) => items.some((i) => i.slot === slot));
  const empty = QUOTE_SLOTS.filter((slot) => !filled.includes(slot));
  const selected = items.filter((i) => i.isSelected);
  const hasPinned = selected.some((i) => i.chosenListingId !== null);
  // Con menos de dos ítems con precio no hay nada que juntar.
  const priced = selected.filter((i) => i.offer).length;
  const count = selected.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-border border-b px-3 py-1.5">
        <h2 className="text-foreground text-label-md">
          {t("components")} <span className="text-muted-foreground text-paragraph-sm tabular-nums">{count}</span>
        </h2>
        {isOwner && (hasPinned || priced >= 2) && (
          <div className="flex flex-wrap items-center gap-1">
            {hasPinned && (
              <Button variant="ghost" size="sm" onClick={onChooseCheapest}>
                <IconTag className="size-4" />
                {t("quote_cheapest_all")}
              </Button>
            )}
            {priced >= 2 && <CondenseStoresDialog quote={quote} onApply={onCondense} />}
          </div>
        )}
      </div>
      {count > 0 && (
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
      )}
      <ul className="divide-y divide-border">
        {filled.flatMap((slot) => {
          const inSlot = items.filter((i) => i.slot === slot);
          const shown = isAdditiveSlot(slot) ? inSlot : inSlot.filter((i) => i.isSelected);
          const alternatives = inSlot.filter((i) => !shown.includes(i));
          return shown.map((item) => (
            <SlotRow
              key={item.id}
              item={item}
              alternatives={alternatives}
              issues={issuesOf(compatibility, item.id)}
              isOwner={isOwner}
              {...handlers}
            />
          ));
        })}
        {isOwner && empty.map((slot) => <EmptySlotRow key={slot} slot={slot} quote={quote} />)}
        {!isOwner && count === 0 && (
          <li className="px-3 py-6 text-center text-muted-foreground text-paragraph-sm">
            Esta cotización todavía no tiene componentes.
          </li>
        )}
      </ul>
      {count > 0 && (
        <div className="flex items-center justify-end gap-3 border-border border-t px-3 py-2.5">
          <span className="text-muted-foreground text-label-xs">
            Total ({t(count === 1 ? "quote_components_one" : "profile_components_count", { count })})
          </span>
          <span className="text-foreground text-label-md tabular-nums">{formatCLP(totals.cash)}</span>
        </div>
      )}
    </section>
  );
}
