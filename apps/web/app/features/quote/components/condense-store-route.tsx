import { QUOTE_SLOT_LABELS, type QuoteCondenseOption } from "@framerate/contracts";
import { IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";
import { StoreLogo } from "~/shared/components/store-logo";
import { formatCLP } from "~/shared/utils/format";

type Split = QuoteCondenseOption["split"][number];

function ItemLine({ item }: { item: Split["items"][number] }) {
  return (
    <li className="flex items-baseline gap-3 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block text-label-xs text-muted-foreground">{QUOTE_SLOT_LABELS[item.slot]}</span>
        <span className="block truncate text-foreground text-paragraph-sm">{item.name}</span>
      </span>
      {item.quantity > 1 && <span className="text-label-xs text-muted-foreground">X{item.quantity}</span>}
      <span className="shrink-0 text-right">
        <span className="block text-foreground text-label-sm tabular-nums">
          {formatCLP(item.priceCash * item.quantity)}
        </span>
        {item.extraCash > 0 && (
          <span className="block text-label-xs text-warn tabular-nums">+{formatCLP(item.extraCash)}</span>
        )}
      </span>
    </li>
  );
}

const wide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;

/**
 * El reparto como un recorrido (Google Maps): un nodo por tienda sobre un riel vertical, sólido dentro de cada pedido
 * y punteado entre uno y otro. Los componentes se pliegan; abiertos en escritorio, cerrados en teléfono. El panel se
 * monta al abrir el diálogo, así que leer el ancho al montar no salta al hidratar.
 */
export function StoreRoute({ option }: { option: QuoteCondenseOption }) {
  const [openByDefault] = useState(wide);
  const n = option.split.length;
  return (
    <section className="space-y-3">
      <header>
        <h3 className="text-foreground text-label-md">
          {n === 1 ? "Llega en 1 pedido" : `Llega en ${n} pedidos, uno por tienda`}
        </h3>
        <p className="text-muted-foreground text-paragraph-xs">
          Los envíos no están incluidos: cada tienda cobra el suyo.
        </p>
      </header>
      <ol>
        {option.split.map((split, i) => {
          const count = split.items.length;
          return (
            <li key={split.store.slug}>
              {i > 0 && (
                <span aria-hidden className="ml-[15px] block h-4 border-foreground/20 border-l-2 border-dashed" />
              )}
              <details open={openByDefault} className="group relative pl-11">
                <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-0.5 bg-foreground/20" />
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  <StoreLogo store={split.store} className="absolute top-0 left-0 size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground text-label-md">{split.store.name}</span>
                    <span className="flex items-center gap-1 text-muted-foreground text-paragraph-xs">
                      {count === 1 ? "1 componente" : `${count} componentes`}
                      <IconChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                    </span>
                  </span>
                  <span className="text-foreground text-label-md tabular-nums">{formatCLP(split.subtotalCash)}</span>
                </summary>
                <div className="pt-1 pb-2">
                  <ul className="divide-y divide-border">
                    {split.items.map((item) => (
                      <ItemLine key={item.itemId} item={item} />
                    ))}
                  </ul>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
