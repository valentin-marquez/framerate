import { IconAdjustmentsHorizontal, IconCheck, IconChevronDown, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { CATEGORY_CONFIG } from "~/features/category/utils/categories";
import { Button } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";

import { formatCLP } from "~/shared/utils/format";

interface CategorySelectorProps {
  currentCategory: string | null;
  className?: string;
}

export function CategorySelector({ currentCategory, className }: CategorySelectorProps) {
  const [, setSearchParams] = useSearchParams();

  const handleCategoryChange = useCallback(
    (categorySlug: string | null) => {
      const newParams = new URLSearchParams();

      if (categorySlug) {
        newParams.set("category", categorySlug);
      }

      // Reset page when category changes
      newParams.set("page", "1");
      setSearchParams(newParams);
    },
    [setSearchParams],
  );

  const categories = Object.entries(CATEGORY_CONFIG);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        variant={!currentCategory ? "default" : "secondary"}
        size="sm"
        onClick={() => handleCategoryChange(null)}
        className="rounded-full"
      >
        Todos
      </Button>
      {categories.map(([slug, config]) => (
        <Button
          key={slug}
          variant={currentCategory === slug ? "default" : "secondary"}
          size="sm"
          onClick={() => handleCategoryChange(slug)}
          className="rounded-full"
        >
          {config.label}
        </Button>
      ))}
    </div>
  );
}

interface ActiveFiltersProps {
  className?: string;
}

export function ActiveFilters({ className }: ActiveFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeFilters: { key: string; label: string; value: string }[] = [];

  // Include brand filter
  const brandParam = searchParams.get("brand");
  if (brandParam) {
    activeFilters.push({ key: "brand", label: "Marca", value: brandParam });
  }

  // Include price filters
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");
  if (minPrice) {
    activeFilters.push({ key: "min_price", label: "Precio mín", value: formatCLP(Number(minPrice)) });
  }
  if (maxPrice) {
    activeFilters.push({ key: "max_price", label: "Precio máx", value: formatCLP(Number(maxPrice)) });
  }

  searchParams.forEach((value, key) => {
    if (key.startsWith("specs[")) {
      const match = key.match(/specs\[(.*?)\](?:\[(.*?)\])?/);
      if (match) {
        const specKey = match[1];
        const subKey = match[2];
        const label = subKey ? `${specKey} (${subKey})` : specKey;
        activeFilters.push({ key, label, value });
      }
    }
  });

  const removeFilter = useCallback(
    (key: string) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete(key);
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams],
  );

  const clearAll = useCallback(() => {
    const newParams = new URLSearchParams();
    const category = searchParams.get("category");
    if (category) newParams.set("category", category);
    newParams.set("page", "1");
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  if (activeFilters.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">Filtros activos:</span>
      {activeFilters.map(({ key, label, value }) => (
        <span
          key={`${key}-${value}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full"
        >
          <span className="capitalize">{label}:</span> {value}
          <button type="button" onClick={() => removeFilter(key)} className="hover:text-primary/70">
            <IconX className="size-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Limpiar todo
      </button>
    </div>
  );
}

interface SortSelectorProps {
  className?: string;
}

const SORT_OPTIONS = [
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "discount", label: "Mayor descuento" },
  { value: "popularity", label: "Popularidad" },
  { value: "name", label: "Nombre" },
] as const;

export function SortSelector({ className }: SortSelectorProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSort = searchParams.get("sort") || "price_asc";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al click fuera o Escape (dropdown accionable, no hover).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSortChange = useCallback(
    (value: string) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("sort", value);
      setSearchParams(newParams);
      setOpen(false);
    },
    [searchParams, setSearchParams],
  );

  const currentLabel = SORT_OPTIONS.find((o) => o.value === currentSort)?.label || "Ordenar";

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5"
      >
        <IconAdjustmentsHorizontal className="size-4" />
        <span className="hidden sm:inline">{currentLabel}</span>
        <IconChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-border/60 bg-popover/90 shadow-lg backdrop-blur-md z-50"
        >
          <div className="p-1">
            {SORT_OPTIONS.map((option) => {
              const active = currentSort === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => handleSortChange(option.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors",
                    active ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-secondary/50",
                  )}
                >
                  {option.label}
                  {active && <IconCheck className="size-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface PriceRangeQuickFiltersProps {
  priceRange?: { min: number; max: number } | null;
  className?: string;
}

export function PriceRangeQuickFilters({ priceRange, className }: PriceRangeQuickFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentMin = searchParams.get("min_price") || "";
  const currentMax = searchParams.get("max_price") || "";

  const handlePriceChange = useCallback(
    (type: "min" | "max", value: string) => {
      const newParams = new URLSearchParams(searchParams);
      const key = type === "min" ? "min_price" : "max_price";

      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }

      newParams.set("page", "1");
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams],
  );

  const minPlaceholder = priceRange ? formatCLP(priceRange.min) : "Min";
  const maxPlaceholder = priceRange ? formatCLP(priceRange.max) : "Max";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">Precio:</span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">$</span>
        <input
          type="number"
          placeholder={minPlaceholder}
          value={currentMin}
          onChange={(e) => handlePriceChange("min", e.target.value)}
          className="w-24 h-8 px-2 text-sm bg-secondary/30 border border-border/60 rounded-md focus:border-primary focus:outline-none"
        />
        <span className="text-muted-foreground">-</span>
        <input
          type="number"
          placeholder={maxPlaceholder}
          value={currentMax}
          onChange={(e) => handlePriceChange("max", e.target.value)}
          className="w-24 h-8 px-2 text-sm bg-secondary/30 border border-border/60 rounded-md focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}
