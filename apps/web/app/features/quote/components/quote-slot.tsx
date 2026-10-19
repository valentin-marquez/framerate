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
import { IconPlus } from "@tabler/icons-react";
import { Link } from "react-router";
import { QuoteItem } from "~/features/quote/components/quote-item";
import { useQuoteInteractionStore } from "~/features/quote/store/quote-interaction";
import { buttonVariants } from "~/shared/components/primitives/button";
import { SLOT_SHORT_LABELS } from "~/shared/utils/slots";
import { QuoteAlternatives } from "./quote-alternatives";
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
        <QuoteAlternatives items={alternatives} isOwner={isOwner} onSelect={onSelect} onRemove={onRemove} />
      )}
    </div>
  );
}
