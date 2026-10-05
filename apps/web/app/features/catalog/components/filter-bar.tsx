import {
  type BrandCount,
  type CategoryItem,
  type Facet,
  type FacetDefinition,
  facetValueLabel,
} from "@framerate/contracts";
import { IconCheck, IconChevronDown, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { type CatalogData, categoryFacets } from "../load-catalog";

const SORT_OPTIONS = [
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "popularity", label: "Más populares" },
  { value: "name", label: "Nombre" },
  { value: "discount", label: "Mayor baja" },
] as const;

/** Actualiza la URL (fuente de verdad de los filtros) y vuelve a la primera página. */
function useFilterParams() {
  const [params, setParams] = useSearchParams();
  const update = useCallback(
    (changes: Record<string, string | string[] | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        next.delete(key);
        // Un arreglo es un parámetro repetible (`spec=vram:12&spec=vram:16`).
        for (const v of [value ?? []].flat()) if (v !== "") next.append(key, v);
      }
      next.delete("page");
      setParams(next, { preventScrollReset: true });
    },
    [params, setParams],
  );
  return { params, update };
}

const chip = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 font-medium text-sm transition-[color,background-color,scale] active:scale-[0.97]",
    active ? "bg-primary/10 text-primary" : "bg-secondary/50 text-secondary-foreground hover:bg-secondary",
  );

/** Botón con panel flotante: se cierra al hacer clic fuera o con Escape. */
function Popover({
  label,
  active,
  end,
  children,
}: {
  label: string;
  active: boolean;
  /** Alineado a la derecha del botón: el del orden, pegado al borde, si no se saldría de la pantalla. */
  end?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpenState] = useState(false);
  const [closing, setClosing] = useState(false);
  // Los valores entran escalonados sólo la primera vez que se abre: después ya se conocen y estorbaría.
  const [opens, setOpens] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  // Al cerrar queda .is-closing lo que dura la salida, para que encoja en vez de saltar a su escala de reposo.
  const setOpen = useCallback(
    (next: boolean | ((v: boolean) => boolean)) =>
      setOpenState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        if (!prev && value) setOpens((n) => n + 1);
        if (prev && !value) {
          setClosing(true);
          setTimeout(() => setClosing(false), 150);
        }
        return value;
      }),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={chip(active)}>
        {/* Text swap: al activarse ("Memoria" a "Memoria: 12 GB") la etiqueta nueva sube con un fundido corto. */}
        <span key={label} className="inline-block fade-in-0 slide-in-from-bottom-1 animate-in duration-fast">
          {label}
        </span>
        <IconChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <div
        inert={!open}
        style={end ? { transformOrigin: "top right" } : undefined}
        className={cn(
          "t-dropdown absolute top-full z-50 mt-2 min-w-56 rounded-2xl border border-border/60 bg-popover p-2 shadow-lg",
          end ? "right-0" : "left-0",
          open && "is-open",
          open && opens === 1 && "t-pop-items",
          closing && "is-closing",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Check con su lugar reservado: aparece y se va con escala y fundido (icon swap) sin mover el texto. */
function Check({ on }: { on: boolean }) {
  return (
    <span className="t-icon-swap">
      <IconCheck data-on={on} className="size-4" />
    </span>
  );
}

/** Conteo que cambia al filtrar: el valor nuevo entra con un pop-in corto. */
function Count({ value }: { value: number }) {
  return (
    <span
      key={value}
      className="inline-block text-muted-foreground text-xs tabular-nums fade-in-0 zoom-in-90 slide-in-from-bottom-0.5 animate-in duration-fast"
    >
      {value.toLocaleString("es-CL")}
    </span>
  );
}

function BrandFilter({ brands }: { brands: BrandCount[] }) {
  const { params, update } = useFilterParams();
  const current = params.get("brand");
  const selected = brands.find((b) => b.slug === current);
  return (
    <Popover label={selected ? selected.name : "Marca"} active={!!current}>
      <ul className="max-h-64 overflow-y-auto">
        {brands.map((b) => (
          <li key={b.slug}>
            <button
              type="button"
              onClick={() => update({ brand: b.slug === current ? null : b.slug })}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                b.slug === current ? "bg-primary/10 font-medium text-primary" : "hover:bg-secondary/50",
              )}
            >
              <span className="flex items-center gap-2">
                <Check on={b.slug === current} />
                {b.name}
              </span>
              <Count value={b.count} />
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

/** Los precios se aplican al confirmar (Enter o botón): no se navega en cada tecla. */
function PriceFilter({ priceRange }: { priceRange: CatalogData["priceRange"] }) {
  const { params, update } = useFilterParams();
  const min = params.get("min_price") ?? "";
  const max = params.get("max_price") ?? "";
  const [draft, setDraft] = useState({ min, max });
  const active = !!(min || max);
  const label = active
    ? [min ? `desde ${formatCLP(Number(min))}` : "", max ? `hasta ${formatCLP(Number(max))}` : ""]
        .filter(Boolean)
        .join(" ")
    : "Precio";

  const field = (key: "min" | "max", placeholder: string) => (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      placeholder={placeholder}
      value={draft[key]}
      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      className="h-9 w-28 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary"
    />
  );

  return (
    <Popover label={label} active={active}>
      <form
        className="flex flex-col gap-3 p-1"
        onSubmit={(e) => {
          e.preventDefault();
          update({ min_price: draft.min, max_price: draft.max });
        }}
      >
        <div className="flex items-center gap-2">
          {field("min", priceRange?.min != null ? String(priceRange.min) : "Mínimo")}
          <span className="text-muted-foreground">a</span>
          {field("max", priceRange?.max != null ? String(priceRange.max) : "Máximo")}
        </div>
        <button
          type="submit"
          className="h-9 rounded-xl bg-secondary font-medium text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Aplicar
        </button>
      </form>
    </Popover>
  );
}

function SortMenu({ defaultSort }: { defaultSort: string }) {
  const { params, update } = useFilterParams();
  const current = params.get("sort") ?? defaultSort;
  const label = SORT_OPTIONS.find((o) => o.value === current)?.label ?? "Ordenar";
  return (
    <Popover label={label} active={false} end>
      <ul className="w-52">
        {SORT_OPTIONS.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              onClick={() => update({ sort: o.value === defaultSort ? null : o.value })}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                o.value === current ? "bg-primary/10 font-medium text-primary" : "hover:bg-secondary/50",
              )}
            >
              {o.label}
              <Check on={o.value === current} />
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

const specValue = (token: string, key: string) => (token.startsWith(`${key}:`) ? token.slice(key.length + 1) : null);

/** Una faceta (Memoria, Chipset...): selección múltiple; varios valores de la misma son "o". */
export function FacetFilter({ facet }: { facet: Facet }) {
  const { params, update } = useFilterParams();
  const all = params.getAll("spec");
  const selected = all.map((t) => specValue(t, facet.key)).filter((v) => v !== null);
  const labelOf = (value: string) => facet.values.find((v) => v.value === value)?.label ?? value;
  const label = selected.length
    ? `${facet.label}: ${labelOf(selected[0])}${selected.length > 1 ? ` +${selected.length - 1}` : ""}`
    : facet.label;
  const toggle = (value: string) => {
    const token = `${facet.key}:${value}`;
    update({ spec: all.includes(token) ? all.filter((t) => t !== token) : [...all, token] });
  };

  return (
    <Popover label={label} active={selected.length > 0}>
      <ul className="max-h-64 overflow-y-auto">
        {facet.values.map((v) => {
          const on = selected.includes(v.value);
          return (
            <li key={v.value}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(v.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  on ? "bg-primary/10 font-medium text-primary" : "hover:bg-secondary/50",
                )}
              >
                <span className="flex items-center gap-2">
                  <Check on={on} />
                  {v.label}
                </span>
                <Count value={v.count} />
              </button>
            </li>
          );
        })}
      </ul>
      {facet.unknownCount > 0 && (
        <p className="mt-1 border-border/60 border-t px-3 pt-2 pb-1 text-muted-foreground text-xs">
          {facet.unknownCount.toLocaleString("es-CL")} sin este dato {facet.unknownCount === 1 ? "aparece" : "aparecen"}{" "}
          al final
        </p>
      )}
    </Popover>
  );
}

/** Filtro de categoría para vistas que mezclan categorías (`/cyber`). Cambiarla borra los filtros propios de la otra. */
export function CategoryChips({ categories }: { categories: CategoryItem[] }) {
  const { params, update } = useFilterParams();
  const current = params.get("category");
  const choose = (slug: string | null) =>
    update({ category: slug, brand: null, min_price: null, max_price: null, spec: null });
  return (
    <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      <button type="button" onClick={() => choose(null)} className={cn(chip(!current), "shrink-0")}>
        Todas
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={c.slug === current}
          onClick={() => choose(c.slug === current ? null : c.slug)}
          className={cn(chip(c.slug === current), "shrink-0")}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** Filtros aplicados, cada uno con su quitar. Sólo aparece cuando hay alguno. */
function ActiveChips({ brands, definitions }: { brands: BrandCount[]; definitions: FacetDefinition[] }) {
  const { params, update } = useFilterParams();
  // Chips recién quitados: el filtro ya se aplicó (al instante); sólo quedan para animar su salida.
  const [ghosts, setGhosts] = useState<{ label: string; index: number; delay: number }[]>([]);
  const chips: { label: string; clear: Record<string, string[] | null> }[] = [];
  const brand = params.get("brand");
  if (brand) chips.push({ label: brands.find((b) => b.slug === brand)?.name ?? brand, clear: { brand: null } });
  if (params.get("min_price") || params.get("max_price")) {
    chips.push({ label: "Rango de precio", clear: { min_price: null, max_price: null } });
  }
  const specs = params.getAll("spec");
  for (const token of specs) {
    const facet = definitions.find((f) => specValue(token, f.key) !== null);
    if (!facet) continue;
    const label = `${facet.label}: ${facetValueLabel(facet, specValue(token, facet.key) ?? "")}`;
    chips.push({ label, clear: { spec: specs.filter((t) => t !== token) } });
  }
  if (params.get("q")) chips.push({ label: `“${params.get("q")}”`, clear: { q: null } });

  const remove = (labels: string[], change: Parameters<typeof update>[0]) => {
    setGhosts(
      labels.map((label, i) => ({
        label,
        index: chips.findIndex((c) => c.label === label),
        delay: Math.min(i, 5) * 30,
      })),
    );
    update(change);
  };
  const clearAll = { brand: null, min_price: null, max_price: null, q: null, spec: null };

  // Los fantasmas vuelven a su posición anterior entre los chips que siguen activos.
  type Item =
    | { kind: "chip"; label: string; clear: Record<string, string[] | null> }
    | { kind: "ghost"; label: string; delay: number };
  const items: Item[] = chips.map((c) => ({ kind: "chip", ...c }));
  for (const g of [...ghosts].sort((a, b) => a.index - b.index)) {
    if (!chips.some((c) => c.label === g.label)) {
      items.splice(Math.min(g.index, items.length), 0, { kind: "ghost", label: g.label, delay: g.delay });
    }
  }
  if (items.length === 0) return null;

  return (
    <div className="-mt-3 flex flex-wrap items-center gap-2">
      {items.map((item) =>
        item.kind === "ghost" ? (
          <span
            key={`ghost-${item.label}`}
            aria-hidden="true"
            onAnimationEnd={() => setGhosts((gs) => gs.filter((g) => g.label !== item.label))}
            style={{ animationDelay: `${item.delay}ms` }}
            className="pointer-events-none inline-flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1 text-foreground text-xs fade-out-0 zoom-out-90 animate-out fill-mode-forwards duration-100"
          >
            {item.label}
            <IconX className="size-3 text-muted-foreground" />
          </span>
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={() => remove([item.label], item.clear)}
            className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1 text-foreground text-xs transition-colors hover:bg-secondary fade-in-0 zoom-in-90 animate-in duration-fast"
          >
            {item.label}
            <IconX className="size-3 text-muted-foreground" />
          </button>
        ),
      )}
      {chips.length > 0 && (
        <button
          type="button"
          onClick={() =>
            remove(
              chips.map((c) => c.label),
              clearAll,
            )
          }
          className="text-muted-foreground text-xs transition-colors hover:text-foreground"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}

interface FilterBarProps {
  brands: BrandCount[];
  priceRange: CatalogData["priceRange"];
  total: number;
  /** Slug de la categoría: define qué facetas tienen etiqueta en los chips activos. */
  category?: string | null;
  facets?: Facet[];
  defaultSort?: string;
}

export function FilterBar({
  brands,
  priceRange,
  total,
  category,
  facets = [],
  defaultSort = "price_asc",
}: FilterBarProps) {
  const specs = useSearchParams()[0].getAll("spec");
  return (
    // `contents`: la barra se pega dentro de la columna del catálogo; en un envoltorio de su mismo alto no se pegaba.
    <div className="contents">
      <div className="sticky top-14 z-30 lg:top-3 -mx-4 flex flex-wrap items-center gap-2 border-border/40 border-b bg-background/80 px-4 py-2.5 backdrop-blur-md md:mx-0 md:rounded-2xl md:border md:px-3">
        {brands.length > 0 && <BrandFilter brands={brands} />}
        <PriceFilter priceRange={priceRange} />
        {facets
          .filter((f) => f.values.length > 0 || specs.some((t) => specValue(t, f.key) !== null))
          .map((f) => (
            <FacetFilter key={f.key} facet={f} />
          ))}
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-muted-foreground text-sm sm:block">
            {total.toLocaleString("es-CL")} {total === 1 ? "producto" : "productos"}
          </span>
          <SortMenu defaultSort={defaultSort} />
        </div>
      </div>
      <ActiveChips brands={brands} definitions={categoryFacets(category)} />
    </div>
  );
}
