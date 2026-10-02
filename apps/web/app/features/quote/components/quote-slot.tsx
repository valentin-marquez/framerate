import {
  isAdditiveSlot,
  QUOTE_SLOT_LABELS,
  type QuoteItem as QuoteItemData,
  type QuoteSlot as QuoteSlotId,
} from "@framerate/contracts";
import { IconPlus } from "@tabler/icons-react";
import { QuoteItem } from "~/features/quote/components/quote-item";
import { Button } from "~/shared/components/primitives/button";
import { SLOT_SHORT_LABELS } from "~/shared/utils/slots";

interface QuoteSlotProps {
  slot: QuoteSlotId;
  /** Todos los ítems del slot, también las alternativas no seleccionadas. */
  items: QuoteItemData[];
  isOwner: boolean;
  onChangeQuantity: (item: QuoteItemData, quantity: number) => void;
  onRemove: (item: QuoteItemData) => void;
  onAdd?: () => void;
}

export function QuoteSlot({ slot, items, isOwner, onChangeQuantity, onRemove, onAdd }: QuoteSlotProps) {
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
          {isOwner && onAdd && (
            <Button variant="outline" size="sm" className="gap-2" onClick={onAdd}>
              <IconPlus size={16} /> Agregar
            </Button>
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
