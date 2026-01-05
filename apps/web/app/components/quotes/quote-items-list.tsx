import { IconDots } from "@tabler/icons-react";
import type { VirtualQuoteItem } from "~/services/quotes";
import { QUOTE_SLOTS } from "~/utils/slots";
import { QuoteItem } from "./quote-item";
import { QuoteSlot } from "./quote-slot";
import { QuoteTotals } from "./quote-totals";

interface QuoteItemsListProps {
  flattenedItems: VirtualQuoteItem[];
  activeItems: VirtualQuoteItem[];
  totalNormal: number;
  totalCash: number;
  onRemove: (item: VirtualQuoteItem) => void;
  onChangeStore: (item: VirtualQuoteItem, listingId: string | null) => void;
  isOwner: boolean;
  selectedVariants: Record<string, string>;
  onSelectVariant: (slotId: string, itemId: string) => void;
}

export function QuoteItemsList({
  flattenedItems,
  activeItems,
  totalNormal,
  totalCash,
  onRemove,
  onChangeStore,
  isOwner,
  selectedVariants,
  onSelectVariant,
}: QuoteItemsListProps) {
  // Identify items that don't fit into standard slots
  const handledCategories = new Set(QUOTE_SLOTS.flatMap((s) => s.accepts));
  const otherItems = flattenedItems.filter(
    (item) => !handledCategories.has((item.category?.slug || item.product?.category?.slug) as any),
  );

  return (
    <div className="bg-card rounded-3xl border border-border/40 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border/40 bg-secondary/5 flex justify-between items-center">
        <h2 className="text-xl font-semibold tracking-tight">Componentes</h2>
        <span className="text-sm text-muted-foreground">{activeItems.length} activos</span>
      </div>

      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-secondary/10 text-xs font-medium text-muted-foreground border-b border-border/40">
        <div className="col-span-5">Producto</div>
        <div className="col-span-3">Tienda</div>
        <div className="col-span-2 text-right">Precio Normal</div>
        <div className="col-span-2 text-right">Precio Efectivo</div>
      </div>

      <div className="divide-y divide-border/40">
        {QUOTE_SLOTS.map((slot) => {
          const slotItems = flattenedItems.filter((item) =>
            slot.accepts.includes((item.category?.slug || item.product?.category?.slug) as any),
          );
          return (
            <QuoteSlot
              key={slot.id}
              slot={slot}
              items={slotItems}
              selectedItemId={selectedVariants[slot.id]}
              onSelect={(itemId) => onSelectVariant(slot.id, itemId)}
              onRemove={onRemove}
              onChangeStore={onChangeStore}
              isOwner={isOwner}
            />
          );
        })}

        {otherItems.length > 0 && (
          <>
            <div className="px-6 py-2 bg-secondary/5 border-b border-border/40 flex items-center gap-2">
              <IconDots size={16} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Otros</span>
            </div>
            {otherItems.map((item) => (
              <QuoteItem
                key={item.virtualId}
                item={item}
                onRemove={onRemove}
                onChangeStore={onChangeStore}
                isOwner={isOwner}
              />
            ))}
          </>
        )}
      </div>

      <QuoteTotals
        totalNormal={totalNormal}
        totalCash={totalCash}
        hasOutOfStockItems={activeItems.some(
          (item) => item.product && (!item.selected_listing || item.selected_listing.stock_quantity === 0),
        )}
      />
    </div>
  );
}
