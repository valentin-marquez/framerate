import { type Offer, QUOTE_SLOTS, type QuoteDetail, type QuoteItem as QuoteItemData } from "@framerate/contracts";
import { useTranslation } from "~/shared/hooks/use-translation";
import { QuoteSlot } from "./quote-slot";
import { QuoteTotals } from "./quote-totals";

interface QuoteItemsListProps {
  quote: Pick<QuoteDetail, "id" | "name" | "items" | "itemCount" | "totals">;
  isOwner: boolean;
  onChangeQuantity: (item: QuoteItemData, quantity: number) => void;
  onRemove: (item: QuoteItemData) => void;
  onSelect: (item: QuoteItemData) => void;
  onChooseOffer: (item: QuoteItemData, offer: Offer | null) => void;
}

export function QuoteItemsList({
  quote,
  isOwner,
  onChangeQuantity,
  onRemove,
  onSelect,
  onChooseOffer,
}: QuoteItemsListProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-card rounded-3xl border border-border/40 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border/40 bg-secondary/5 flex justify-between items-center">
        <h2 className="text-xl font-semibold tracking-tight">{t("components")}</h2>
        <span className="text-sm text-muted-foreground">{t("active_items_count", { count: quote.itemCount })}</span>
      </div>

      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-secondary/10 text-xs font-medium text-muted-foreground border-b border-border/40">
        <div className="col-span-5">{t("product")}</div>
        <div className="col-span-2">{t("store")}</div>
        <div className="col-span-2 text-right">{t("price_normal")}</div>
        <div className="col-span-2 text-right">{t("price_cash")}</div>
        <div className="col-span-1"></div>
      </div>

      <div className="divide-y divide-border/40">
        {QUOTE_SLOTS.map((slot) => (
          <QuoteSlot
            key={slot}
            slot={slot}
            quote={quote}
            items={quote.items.filter((item) => item.slot === slot)}
            isOwner={isOwner}
            onChangeQuantity={onChangeQuantity}
            onRemove={onRemove}
            onSelect={onSelect}
            onChooseOffer={onChooseOffer}
          />
        ))}
      </div>

      <QuoteTotals
        totalNormal={quote.totals.card}
        totalCash={quote.totals.cash}
        hasOutOfStockItems={quote.items.some((item) => item.isSelected && !item.offer)}
      />
    </div>
  );
}
