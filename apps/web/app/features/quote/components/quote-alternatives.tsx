import type { QuoteItem as QuoteItemData } from "@framerate/contracts";
import { IconChevronDown, IconTrash } from "@tabler/icons-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "~/shared/components/primitives/button";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";

interface QuoteAlternativesProps {
  /** Las alternativas no seleccionadas del slot. */
  items: QuoteItemData[];
  isOwner: boolean;
  onSelect: (item: QuoteItemData) => void;
  onRemove: (item: QuoteItemData) => void;
}

/**
 * Las alternativas guardadas de un slot, plegadas: cerrado ocupa una línea, sean una o veinte, con el precio más bajo
 * a la vista; abierto, una fila de una línea por alternativa, con scroll si son muchas.
 */
export function QuoteAlternatives({ items, isOwner, onSelect, onRemove }: QuoteAlternativesProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const prices = items.flatMap((item) => (item.offer ? [item.offer.priceCash] : []));
  const lowest = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <div className="border-border/40 border-t bg-secondary/5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-full cursor-pointer items-center gap-2 px-6 text-left text-sm"
      >
        <span className="font-medium">
          {items.length === 1 ? t("quote_alternatives_one") : t("quote_alternatives_many", { count: items.length })}
        </span>
        {lowest !== null && (
          <span className="text-muted-foreground text-xs">
            {t("quote_alternatives_from", { price: formatCLP(lowest) })}
          </span>
        )}
        <IconChevronDown
          className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul id={listId} className="max-h-48 divide-y divide-border/40 overflow-y-auto px-4 pb-2">
          {items.map((item) => (
            <li key={item.id} className="group flex h-9 items-center gap-3 px-2">
              <Link
                to={`/producto/${item.product.slug}`}
                className="min-w-0 flex-1 truncate text-sm hover:text-primary"
              >
                {item.product.name}
              </Link>
              <span className="font-mono text-muted-foreground text-xs tabular-nums">
                {item.offer ? formatCLP(item.offer.priceCash) : t("out_of_stock")}
              </span>
              {isOwner && (
                <>
                  <Button variant="ghost" size="xs" onClick={() => onSelect(item)}>
                    {t("quote_use_this")}
                  </Button>
                  <button
                    type="button"
                    aria-label={t("remove_product_error")}
                    onClick={() => onRemove(item)}
                    className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <IconTrash className="size-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
