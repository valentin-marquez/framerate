import {
  CATEGORIES,
  CATEGORY_SLUGS,
  isAdditiveSlot,
  QUOTE_SLOT_LABELS,
  type QuoteItem as QuoteItemData,
  type QuoteSlot as QuoteSlotId,
  SLOT_BY_CATEGORY,
} from "@framerate/contracts";
import { IconPlus } from "@tabler/icons-react";
import { Link } from "react-router";
import { QuoteItem } from "~/features/quote/components/quote-item";
import { buttonVariants } from "~/shared/components/primitives/button";
import { SLOT_SHORT_LABELS } from "~/shared/utils/slots";

interface QuoteSlotProps {
  slot: QuoteSlotId;
  /** Todos los ítems del slot, también las alternativas no seleccionadas. */
  items: QuoteItemData[];
  isOwner: boolean;
  onChangeQuantity: (item: QuoteItemData, quantity: number) => void;
  onRemove: (item: QuoteItemData) => void;
}

/** Agregar lleva a la página de la categoría del slot (en storage, la primera: SSD): ahí se elige y se agrega. */
const categoryHref = (slot: QuoteSlotId) => {
  const category = CATEGORIES.find((c) => SLOT_BY_CATEGORY[c] === slot);
  return category ? `/categoria/${CATEGORY_SLUGS[category]}` : "/explorar";
};

export function QuoteSlot({ slot, items, isOwner, onChangeQuantity, onRemove }: QuoteSlotProps) {
  const shown = isAdditiveSlot(slot) ? items : items.filter((item) => item.isSelected);
  const alternatives = items.length - shown.length;

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
            onChangeQuantity={onChangeQuantity}
            onRemove={onRemove}
          />
        ))}
      </div>
      {alternatives > 0 && (
        <p className="px-6 py-2 bg-secondary/5 border-t border-border/40 text-xs text-muted-foreground">
          {alternatives} {alternatives === 1 ? "alternativa guardada" : "alternativas guardadas"} en{" "}
          {QUOTE_SLOT_LABELS[slot].toLowerCase()}
        </p>
      )}
    </div>
  );
}
