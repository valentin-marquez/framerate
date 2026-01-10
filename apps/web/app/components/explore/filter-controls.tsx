"use client";

import { IconAdjustmentsHorizontal, IconChevronDown, IconX } from "@tabler/icons-react";
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { Button } from "~/components/primitives/button";
import { cn } from "~/lib/utils";
import { CATEGORY_CONFIG } from "~/utils/categories";

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

  searchParams.forEach((value, key) => {
    if (key.startsWith("specs[")) {
      // Parse specs[socket] or specs[speed][min]
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
            <IconX className="h-3 w-3" />
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

export function SortSelector({ className }: SortSelectorProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSort = searchParams.get("sort") || "price_asc";

  const sortOptions = [
    { value: "price_asc", label: "Precio: menor a mayor" },
    { value: "price_desc", label: "Precio: mayor a menor" },
    { value: "popularity", label: "Popularidad" },
    { value: "discount", label: "Mayor descuento" },
    { value: "name", label: "Nombre" },
  ];

  const handleSortChange = useCallback(
    (value: string) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("sort", value);
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams],
  );

  const currentLabel = sortOptions.find((o) => o.value === currentSort)?.label || "Ordenar";

  return (
    <div className={cn("relative group", className)}>
      <Button variant="secondary" size="sm" className="gap-1.5">
        <IconAdjustmentsHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLabel}</span>
        <IconChevronDown className="h-4 w-4" />
      </Button>
      <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="py-1">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSortChange(option.value)}
              className={cn(
                "w-full px-3 py-2 text-sm text-left transition-colors",
                currentSort === option.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-secondary/50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface PriceRangeQuickFiltersProps {
  className?: string;
}

export function PriceRangeQuickFilters({ className }: PriceRangeQuickFiltersProps) {
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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">Precio:</span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">$</span>
        <input
          type="number"
          placeholder="Min"
          value={currentMin}
          onChange={(e) => handlePriceChange("min", e.target.value)}
          className="w-24 h-8 px-2 text-sm bg-secondary/30 border border-border rounded-lg focus:border-primary focus:outline-none"
        />
        <span className="text-muted-foreground">-</span>
        <input
          type="number"
          placeholder="Max"
          value={currentMax}
          onChange={(e) => handlePriceChange("max", e.target.value)}
          className="w-24 h-8 px-2 text-sm bg-secondary/30 border border-border rounded-lg focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}
