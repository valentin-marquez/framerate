import type { CategoryItem } from "@framerate/contracts";
import { IconInfoCircle, IconRosetteDiscount } from "@tabler/icons-react";
import { useFilterParams } from "~/features/catalog/use-filter-params";
import { BLACK_FRIDAY_UNTIL } from "~/shared/lib/black-friday";
import { enterClass, enterStyle } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";

/**
 * Franja del evento, oscura y a todo el ancho como el aviso de la portada. Las cifras son las que se pueden
 * sostener: cuántas bajas hay, cuántos días quedan y el umbral. La nota dice contra qué se compara.
 */
export function BlackFridayHeader({ total, daysLeft }: { total: number; daysLeft: number }) {
  const stats = [
    { value: total.toLocaleString("es-CL"), label: total === 1 ? "baja de precio" : "bajas de precio" },
    { value: String(daysLeft), label: daysLeft === 1 ? "día que queda" : "días que quedan" },
    { value: "3 %", label: "de baja mínima" },
  ];
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-3xl bg-foreground px-5 py-7 text-background md:px-10 md:py-10",
        enterClass(),
      )}
    >
      <span aria-hidden="true" data-variant="event" className="beam pointer-events-none absolute inset-0 rounded-3xl">
        <span className="beam-glow" />
        <span className="beam-line" />
        <span className="beam-line beam-top" />
      </span>
      <div className="relative grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-background/20 px-3 py-1 text-background/80 text-sm">
            <IconRosetteDiscount className="size-4 text-amber-400 dark:text-amber-600" stroke={1.75} />
            {BLACK_FRIDAY_UNTIL}
          </p>
          <h1 className="text-title-h3 md:text-title-h1">Black Friday</h1>
          <p className="max-w-xl text-pretty text-background/70 md:text-lg">
            Lo que de verdad está más barato: el precio de hoy contra el de todo el último mes, en todas las tiendas.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-4 md:gap-8">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn("flex flex-col-reverse gap-0.5", enterClass())}
              style={enterStyle(120 + i * 50)}
            >
              <dt className="text-background/60 text-xs md:text-sm">{s.label}</dt>
              <dd className="text-title-h5 tabular-nums md:text-title-h4">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="relative mt-6 flex max-w-2xl gap-1.5 text-background/50 text-xs">
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
