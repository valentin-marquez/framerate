import { QUOTE_SLOT_LABELS, type QuoteSlot } from "@framerate/contracts";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { CondenseOption, CondenseOptions, CondenseStoreSplit } from "./fixtures";

/** Diálogo en escritorio, hoja inferior en teléfono (mismas clases que la hoja de filtros). */
export const SHEET =
  "max-h-[85dvh] overflow-y-auto bg-card p-0 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:zoom-in-100 max-sm:zoom-out-100 max-sm:slide-in-from-bottom-24 max-sm:slide-out-to-bottom-24 sm:w-[calc(100%-2rem)] sm:rounded-3xl";

export const SHIPPING_NOTE = "Los envíos no están incluidos: cada tienda cobra el suyo.";

const list = new Intl.ListFormat("es", { type: "conjunction" });

export const storesLabel = (n: number) => (n === 1 ? "1 tienda" : `${n} tiendas`);
export const inStores = (n: number) => `En ${storesLabel(n)}`;
export const storeNames = (o: CondenseOption) => list.format(o.split.map((s) => s.store.name));
export const extraLabel = (o: CondenseOption) => (o.extraCash === 0 ? "Lo más barato" : `+${formatCLP(o.extraCash)}`);
export const slotLabel = (slot: string) => QUOTE_SLOT_LABELS[slot as QuoteSlot] ?? slot;
export const applyLabel = (o: CondenseOption) =>
  `Aplicar: comprar en ${storesLabel(o.stores)}, ${formatCLP(o.totalCash)}`;

export const recommendedOf = (data: CondenseOptions) =>
  data.options.find((o) => o.recommended) ?? (data.options.at(-1) as CondenseOption);

export const contextText = (data: CondenseOptions) =>
  `${data.itemCount} componentes, hoy en ${storesLabel(data.storesNow)}`;

function ItemLine({ item }: { item: CondenseStoreSplit["items"][number] }) {
  return (
    <li className="flex items-baseline gap-3 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block text-label-xs text-muted-foreground">{slotLabel(item.slot)}</span>
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

/** Cabecera de una tienda del reparto: logo, nombre, cuántos componentes y subtotal. */
export function StoreHead({ split }: { split: CondenseStoreSplit }) {
  const n = split.items.length;
  return (
    <div className="flex items-center gap-3">
      <StoreLogo store={split.store} className="size-8" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-foreground text-label-md">{split.store.name}</span>
        <span className="block text-muted-foreground text-paragraph-xs">
          {n === 1 ? "1 componente" : `${n} componentes`}
        </span>
      </span>
      <span className="text-foreground text-label-md tabular-nums">{formatCLP(split.subtotalCash)}</span>
    </div>
  );
}

export function StoreItems({ split }: { split: CondenseStoreSplit }) {
  return (
    <ul className="divide-y divide-border">
      {split.items.map((item) => (
        <ItemLine key={item.itemId} item={item} />
      ))}
    </ul>
  );
}

/** El reparto como bloques por tienda; `columns` los pone lado a lado desde escritorio. */
export function StoreSplit({ option, columns }: { option: CondenseOption; columns?: boolean }) {
  return (
    <div className={cn("grid gap-2", columns && "md:grid-cols-2 lg:grid-cols-3")}>
      {option.split.map((split) => (
        <div key={split.store.slug} className="space-y-2 rounded-2xl border border-border bg-background p-3">
          <StoreHead split={split} />
          <StoreItems split={split} />
        </div>
      ))}
    </div>
  );
}

/** Radio en tarjeta: el input nativo da el teclado y el foco; la tarjeta entera es la etiqueta. */
export function OptionCard({
  option,
  name,
  checked,
  onSelect,
}: {
  option: CondenseOption;
  name: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background p-3 transition-colors",
        "has-checked:border-foreground/40 has-checked:bg-secondary/40 has-focus-visible:ring-2 has-focus-visible:ring-ring/50",
        "has-disabled:cursor-not-allowed has-disabled:bg-transparent has-disabled:opacity-60",
      )}
    >
      <input
        type="radio"
        name={name}
        className="peer sr-only"
        checked={checked}
        disabled={!option.available}
        onChange={onSelect}
      />
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-foreground/30 peer-checked:border-foreground peer-checked:[&>span]:scale-100">
        <span className="size-2 scale-0 rounded-full bg-foreground transition-transform" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-foreground text-label-md">{inStores(option.stores)}</span>
          {option.recommended && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-label-xs text-foreground">Recomendada</span>
          )}
        </span>
        <span className="line-clamp-2 text-muted-foreground text-paragraph-xs">
          {option.available ? storeNames(option) : option.unavailableReason}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {option.available ? (
          <>
            <span className="block text-foreground text-label-md tabular-nums">{formatCLP(option.totalCash)}</span>
            <span
              className={cn(
                "block text-label-xs tabular-nums",
                option.extraCash === 0 ? "text-success" : "text-muted-foreground",
              )}
            >
              {extraLabel(option)}
            </span>
          </>
        ) : (
          <span className="text-label-xs text-muted-foreground">No disponible</span>
        )}
      </span>
    </label>
  );
}
