import {
  CATEGORIES,
  CATEGORY_SLUGS,
  isAdditiveSlot,
  type Offer,
  QUOTE_SLOT_LABELS,
  type QuoteCompatibility,
  type QuoteItem as QuoteItemData,
  type QuoteSlot as QuoteSlotId,
  SLOT_BY_CATEGORY,
} from "@framerate/contracts";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Link } from "react-router";
import { QuoteItem } from "~/features/quote/components/quote-item";
import { useQuoteInteractionStore } from "~/features/quote/store/quote-interaction";
import { Button, buttonVariants } from "~/shared/components/primitives/button";
import { useTranslation } from "~/shared/hooks/use-translation";
import { formatCLP } from "~/shared/utils/format";
import { SLOT_SHORT_LABELS } from "~/shared/utils/slots";
import { issuesOf, statusOf } from "./quote-compatibility";

interface QuoteSlotProps {
  slot: QuoteSlotId;
  quote: { id: string; name: string };
  /** Todos los ítems del slot, también las alternativas no seleccionadas. */
  items: QuoteItemData[];
  isOwner: boolean;
  compatibility?: QuoteCompatibility;
  onChangeQuantity: (item: QuoteItemData, quantity: number) => void;
  onRemove: (item: QuoteItemData) => void;
  onSelect: (item: QuoteItemData) => void;
  onChooseOffer: (item: QuoteItemData, offer: Offer | null) => void;
}

/** Agregar lleva a la página de la categoría del slot (en storage, la primera: SSD): ahí se elige y se agrega. */
const categoryHref = (slot: QuoteSlotId) => {
  const category = CATEGORIES.find((c) => SLOT_BY_CATEGORY[c] === slot);
  return category ? `/categoria/${CATEGORY_SLUGS[category]}` : "/buscar";
};

export function QuoteSlot({
  slot,
  quote,
  items,
  isOwner,
  compatibility,
  onChangeQuantity,
  onRemove,
  onSelect,
  onChooseOffer,
}: QuoteSlotProps) {
  const { t } = useTranslation();
  const setOriginQuote = useQuoteInteractionStore((s) => s.setOriginQuote);
  const shown = isAdditiveSlot(slot) ? items : items.filter((item) => item.isSelected);
  const alternatives = items.filter((item) => !shown.includes(item));

  if (shown.length === 0) {
    return (
      <div className="p-4 border-b border-border/40 last:border-0 bg-card/50 hover:bg-secondary/10 transition-colors group">
        <div className="flex items-center gap-4 opacity-60 group-hover:opacity-100 transition-opacity">
          <div className="size-14 shrink-0 rounded-lg bg-secondary/20 border border-dashed border-border flex items-center justify-center">
            <span className="text-xs font-bold text-muted-foreground">{SLOT_SHORT_LABELS[slot]}</span>
          </div>
          <div className="flex-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {QUOTE_SLOT_LABELS[slot]}
            </span>
            <p className="text-sm text-muted-foreground">No seleccionado</p>
          </div>
          {isOwner && (
            <Link
              to={categoryHref(slot)}
              onClick={() => setOriginQuote(quote)}
              className={buttonVariants({ variant: "outline", size: "sm", className: "gap-2" })}
            >
              <IconPlus size={16} /> Agregar
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border/40 last:border-0">
      <div className="divide-y divide-border/40">
        {shown.map((item) => (
          <QuoteItem
            key={item.id}
            item={item}
            isOwner={isOwner}
            status={statusOf(compatibility, item.id)}
            issues={issuesOf(compatibility, item.id)}
            onChangeQuantity={onChangeQuantity}
            onRemove={onRemove}
            onChooseOffer={onChooseOffer}
          />
        ))}
      </div>
      {alternatives.length > 0 && (
        <div className="bg-secondary/5 border-t border-border/40 px-6 py-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("quote_alternatives", { slot: QUOTE_SLOT_LABELS[slot].toLowerCase() })}
          </p>
          <ul className="divide-y divide-border/40">
            {alternatives.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <Link to={`/producto/${item.product.slug}`} className="block truncate text-sm hover:text-primary">
                    {item.product.name}
                  </Link>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {item.offer ? formatCLP(item.offer.priceCash) : t("out_of_stock")}
                  </span>
                </div>
                {isOwner && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => onSelect(item)}>
                      {t("quote_use_this")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label={t("remove_product_error")}
                      onClick={() => onRemove(item)}
                    >
                      <IconTrash size={16} />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
