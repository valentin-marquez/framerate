import { type Offer, QUOTE_SLOTS, type QuoteDetail, type QuoteItem as QuoteItemData } from "@framerate/contracts";
import { useTranslation } from "~/shared/hooks/use-translation";
import { QuoteSlot } from "./quote-slot";

interface QuoteItemsListProps {
  quote: Pick<QuoteDetail, "id" | "name" | "items" | "itemCount"> & Partial<Pick<QuoteDetail, "compatibility">>;
  isOwner: boolean;
  onChangeQuantity: (item: QuoteItemData, quantity: number) => void;
  onRemove: (item: QuoteItemData) => void;
  onSelect: (item: QuoteItemData) => void;
  onChooseOffer: (item: QuoteItemData, offer: Offer | null) => void;
}

/** Los slots con algo primero, en el orden del armado; los vacíos al final, como pendientes. */
export function QuoteItemsList({
  quote,
  isOwner,
  onChangeQuantity,
  onRemove,
  onSelect,
  onChooseOffer,
}: QuoteItemsListProps) {
  const { t } = useTranslation();
  const filled = (slot: (typeof QUOTE_SLOTS)[number]) => quote.items.some((item) => item.slot === slot);
  const slots = [...QUOTE_SLOTS.filter(filled), ...QUOTE_SLOTS.filter((slot) => !filled(slot))];

  return (
    <div className="bg-card rounded-3xl border border-border/40 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border/40 bg-secondary/5 flex justify-between items-center">
        <h2 className="text-xl font-semibold tracking-tight">{t("components")}</h2>
        <span className="text-sm text-muted-foreground">{t("active_items_count", { count: quote.itemCount })}</span>
      </div>

      <div className="divide-y divide-border/40">
        {slots.map((slot) => (
          <QuoteSlot
            key={slot}
            slot={slot}
            quote={quote}
            items={quote.items.filter((item) => item.slot === slot)}
            compatibility={quote.compatibility}
            isOwner={isOwner}
            onChangeQuantity={onChangeQuantity}
            onRemove={onRemove}
            onSelect={onSelect}
            onChooseOffer={onChooseOffer}
          />
        ))}
      </div>
    </div>
  );
}
