import { IconCheck, IconChevronDown, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { BrandWithCount } from "~/features/category/services/categories";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { CatalogData } from "../load-catalog";

const SORT_OPTIONS = [
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "popularity", label: "Más populares" },
  { value: "name", label: "Nombre" },
] as const;

/** Actualiza la URL (fuente de verdad de los filtros) y vuelve a la primera página. */
function useFilterParams() {
  const [params, setParams] = useSearchParams();
  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
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
    "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 font-medium text-sm transition-colors",
    active ? "bg-primary/10 text-primary" : "bg-secondary/50 text-secondary-foreground hover:bg-secondary",
  );

/** Botón con panel flotante: se cierra al hacer clic fuera o con Escape. */
function Popover({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={chip(active)}>
        {label}
        <IconChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="enter-up absolute top-full left-0 z-50 mt-2 min-w-56 rounded-2xl border border-border/60 bg-popover p-2 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

function BrandFilter({ brands }: { brands: BrandWithCount[] }) {
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
                {b.slug === current && <IconCheck className="size-4" />}
                {b.name}
              </span>
              <span className="text-muted-foreground text-xs">{b.count}</span>
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
          {field("min", priceRange ? String(priceRange.min) : "Mínimo")}
          <span className="text-muted-foreground">a</span>
          {field("max", priceRange ? String(priceRange.max) : "Máximo")}
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

function SortMenu() {
  const { params, update } = useFilterParams();
  const current = params.get("sort") ?? "price_asc";
  const label = SORT_OPTIONS.find((o) => o.value === current)?.label ?? "Ordenar";
  return (
    <Popover label={label} active={false}>
      <ul className="w-52">
        {SORT_OPTIONS.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              onClick={() => update({ sort: o.value === "price_asc" ? null : o.value })}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                o.value === current ? "bg-primary/10 font-medium text-primary" : "hover:bg-secondary/50",
              )}
            >
              {o.label}
              {o.value === current && <IconCheck className="size-4" />}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

/** Filtros aplicados, cada uno con su quitar. Sólo aparece cuando hay alguno. */
function ActiveChips({ brands }: { brands: BrandWithCount[] }) {
  const { params, update } = useFilterParams();
  const chips: { label: string; clear: Record<string, null> }[] = [];
  const brand = params.get("brand");
  if (brand) chips.push({ label: brands.find((b) => b.slug === brand)?.name ?? brand, clear: { brand: null } });
  if (params.get("min_price") || params.get("max_price")) {
    chips.push({ label: "Rango de precio", clear: { min_price: null, max_price: null } });
  }
  if (params.get("in_stock") === "1") chips.push({ label: "En stock", clear: { in_stock: null } });
  if (params.get("search")) chips.push({ label: `“${params.get("search")}”`, clear: { search: null } });
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => update(c.clear)}
          className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1 text-foreground text-xs transition-colors hover:bg-secondary"
        >
          {c.label}
          <IconX className="size-3 text-muted-foreground" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => update({ brand: null, min_price: null, max_price: null, in_stock: null, search: null })}
        className="text-muted-foreground text-xs transition-colors hover:text-foreground"
      >
        Limpiar todo
      </button>
    </div>
  );
}

interface FilterBarProps {
  brands: BrandWithCount[];
  priceRange: CatalogData["priceRange"];
  total: number;
}

export function FilterBar({ brands, priceRange, total }: FilterBarProps) {
  const { params, update } = useFilterParams();
  const inStock = params.get("in_stock") === "1";
  return (
    <div className="space-y-3">
      <div className="sticky top-13 z-30 -mx-4 flex flex-wrap items-center gap-2 border-border/40 border-b bg-background/80 px-4 py-2.5 backdrop-blur-md md:mx-0 md:rounded-2xl md:border md:px-3">
        {brands.length > 0 && <BrandFilter brands={brands} />}
        <PriceFilter priceRange={priceRange} />
        <button
          type="button"
          aria-pressed={inStock}
          onClick={() => update({ in_stock: inStock ? null : "1" })}
          className={chip(inStock)}
        >
          En stock
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-muted-foreground text-sm sm:block">
            {total.toLocaleString("es-CL")} {total === 1 ? "producto" : "productos"}
          </span>
          <SortMenu />
        </div>
      </div>
      <ActiveChips brands={brands} />
    </div>
  );
}
