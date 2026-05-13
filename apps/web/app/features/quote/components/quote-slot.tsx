import { IconPlus } from "@tabler/icons-react";
import { useMemo } from "react";
import { QuoteItem } from "~/features/quote/components/quote-item";
import type { VirtualQuoteItem } from "~/features/quote/services/quotes";
import { Button } from "~/shared/components/primitives/button";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import type { SlotDefinition } from "~/shared/utils/slots";

interface QuoteSlotProps {
  slot: SlotDefinition;
  items: VirtualQuoteItem[];
  selectedItemId?: string;
  onSelect?: (itemId: string) => void;
  onRemove: (item: VirtualQuoteItem) => void;
  onChangeStore: (item: VirtualQuoteItem, listingId: string | null) => void;
  onAdd?: () => void;
  isOwner: boolean;
}

export function QuoteSlot({
  slot,
  items,
  selectedItemId,
  onSelect,
  onRemove,
  onChangeStore,
  onAdd,
  isOwner,
}: QuoteSlotProps) {
  const { t } = useTranslation();

  // Agrupar elementos por su id original de quote_item (para distinguir entre diferentes productos/entradas)
  const options = useMemo(() => {
    const groups: Record<string, VirtualQuoteItem[]> = {};
    for (const item of items) {
      const key = item.originalItem?.id || item.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [items]);

  const optionKeys = Object.keys(options);
  const hasMultipleOptions = optionKeys.length > 1;

  const activeItems = useMemo(() => {
    if (slot.type === "additive") {
      return items;
    }
    // Exclusivo: mostrar solo la opción seleccionada
    if (selectedItemId && options[selectedItemId]) {
      return options[selectedItemId];
    }
    // Fallback: mostrar la primera opción si no se selecciona nada (debería ser manejado por el estado del componente padre, pero mejor prevenir)
    const firstKey = optionKeys[0];
    return firstKey ? options[firstKey] : [];
  }, [slot.type, items, selectedItemId, options, optionKeys]);

  const handleAdd = () => {
    if (onAdd) {
      onAdd();
    } else {
      const _category = slot.accepts[0];
      // navigate(`/categoria/${category}`); // Removed useNavigate, so this line is commented out or replaced
      // If navigation is still needed, a different approach would be required, e.g., passing a navigate function via props or using a global router context.
      // For now, assuming the onAdd prop handles external navigation or this feature is temporarily disabled.
    }
  };

  if (items.length === 0) {
    return (
      <div className="p-4 border-b border-border/40 last:border-0 bg-card/50 hover:bg-secondary/10 transition-colors group">
        <div className="flex items-center gap-4 opacity-60 group-hover:opacity-100 transition-opacity">
          <div className="size-14 shrink-0 rounded-lg bg-secondary/20 border border-dashed border-border flex items-center justify-center">
            <span className="text-xs font-bold text-muted-foreground">{slot.shortLabel}</span>
          </div>
          <div className="flex-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{slot.label}</span>
            <p className="text-sm text-muted-foreground">No seleccionado</p>
          </div>
          {isOwner && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleAdd}>
              <IconPlus size={16} /> Agregar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border/40 last:border-0">
      {hasMultipleOptions && slot.type === "exclusive" && (
        <div className="px-6 py-2 bg-secondary/5 border-b border-border/40 flex items-center gap-3 overflow-x-auto">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
            {slot.label} (Opciones):
          </span>
          <div className="flex gap-2">
            {optionKeys.map((key) => {
              const optionItems = options[key];
              const firstItem = optionItems[0];
              const productName = firstItem.product?.name || t("common:unknown_product");
              const isSelected = key === selectedItemId;

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => onSelect?.(key)}
                  className={cn(
                    "text-xs px-3 py-1 rounded-full border transition-all whitespace-nowrap max-w-[200px] truncate cursor-pointer",
                    isSelected
                      ? "bg-primary/10 border-primary/50 text-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/30",
                  )}
                  title={productName}
                >
                  {productName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="divide-y divide-border/40">
        {activeItems.map((item) => (
          <QuoteItem
            key={item.virtualId}
            item={item}
            onRemove={onRemove}
            onChangeStore={onChangeStore}
            isOwner={isOwner}
          />
        ))}
      </div>
    </div>
  );
}
