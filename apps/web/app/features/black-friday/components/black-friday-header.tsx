import type { CategoryItem } from "@framerate/contracts";
import { IconInfoCircle, IconRosetteDiscount } from "@tabler/icons-react";
import { useFilterParams } from "~/features/catalog/use-filter-params";
import { BLACK_FRIDAY_UNTIL } from "~/shared/lib/black-friday";
import { enterClass } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";

/** La nota dice contra qué se compara: sin ella "bajó" no dice nada. */
export function BlackFridayHeader({ total }: { total: number }) {
  return (
    <header className={cn("space-y-3 pt-2", enterClass())}>
      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium text-sm">
          <span className="text-foreground/70">{BLACK_FRIDAY_UNTIL}</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <IconRosetteDiscount className="size-4" stroke={1.75} />
            {total > 0
              ? `${total.toLocaleString("es-CL")} ${total === 1 ? "baja" : "bajas"} de precio`
              : "Bajas de precio"}
          </span>
        </p>
        <h1 className="font-bold text-3xl text-foreground tracking-tight md:text-5xl">Black Friday</h1>
        <span aria-hidden className="block h-1 w-12 rounded-full bg-foreground" />
        <p className="pt-1 text-pretty text-muted-foreground md:text-lg">
          Productos al menos 3 % más baratos que su precio habitual.
        </p>
      </div>
      <p className="flex max-w-2xl gap-1.5 text-muted-foreground text-xs">
        <IconInfoCircle className="mt-px size-3.5 shrink-0" stroke={1.75} />
        <span className="text-pretty">
          El precio habitual es el promedio del mejor precio de cada día del último mes, sin contar los últimos tres: si
          una tienda sube el precio justo antes del evento, la rebaja no aparece como baja.
        </span>
      </p>
    </header>
  );
}

const chip = (active: boolean) =>
  cn(
    "shrink-0 rounded-full border px-3 py-1.5 font-medium text-sm transition-colors",
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border/70 bg-card/60 text-foreground/80 hover:bg-secondary",
  );

/** Filtro de categoría en una vista que las mezcla. Cambiarla borra los filtros propios de la otra. */
export function CategoryChips({ categories }: { categories: CategoryItem[] }) {
  const { params, update } = useFilterParams();
  const current = params.get("category");
  const choose = (slug: string | null) =>
    update({ category: slug, brand: null, min_price: null, max_price: null, spec: null });
  return (
    <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      <button type="button" onClick={() => choose(null)} className={chip(!current)}>
        Todas
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={c.slug === current}
          onClick={() => choose(c.slug === current ? null : c.slug)}
          className={chip(c.slug === current)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
