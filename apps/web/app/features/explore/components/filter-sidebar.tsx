import { IconChevronDown, IconChevronUp, IconFilter, IconX } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import type { BrandWithCount, CategoryFilter } from "~/features/category/services/categories";
import { Button } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";

interface FilterSidebarProps {
  filters: CategoryFilter[];
  brands?: BrandWithCount[];
  currentBrand?: string | null;
  className?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const EMPTY_BRANDS: BrandWithCount[] = [];

export function FilterSidebar({
  filters,
  brands = EMPTY_BRANDS,
  currentBrand,
  className,
  isMobileOpen,
  onMobileClose,
}: FilterSidebarProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const handleFilterChange = useCallback(
    (filterSlug: string, value: string | null, isRange?: { type: "min" | "max" }) => {
      const newParams = new URLSearchParams(searchParams);

      if (isRange) {
        const key = `specs[${filterSlug}][${isRange.type}]`;
        if (value) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      } else {
        const key = `specs[${filterSlug}]`;
        const currentValues = newParams.getAll(key);

        if (value === null) {
          newParams.delete(key);
        } else if (currentValues.includes(value)) {
          newParams.delete(key);
          for (const v of currentValues.filter((v) => v !== value)) {
            newParams.append(key, v);
          }
        } else {
          newParams.append(key, value);
        }
      }

      newParams.set("page", "1");
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams],
  );

  const handleBrandChange = useCallback(
    (brandSlug: string) => {
      const newParams = new URLSearchParams(searchParams);
      const currentBrandParam = newParams.get("brand");

      if (currentBrandParam === brandSlug) {
        newParams.delete("brand");
      } else {
        newParams.set("brand", brandSlug);
      }

      newParams.set("page", "1");
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams],
  );

  const clearAllFilters = useCallback(() => {
    const newParams = new URLSearchParams();
    const category = searchParams.get("category");
    if (category) newParams.set("category", category);
    newParams.set("page", "1");
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const hasActiveFilters =
    Array.from(searchParams.keys()).some((key) => key.startsWith("specs[")) || searchParams.has("brand");

  // Shared filter content for both mobile and desktop
  const filterContent = (
    <>
      {/* Brand filter */}
      {brands.length > 0 && (
        <BrandFilter
          brands={brands}
          activeBrand={currentBrand || searchParams.get("brand")}
          onChange={handleBrandChange}
        />
      )}

      {/* Spec filters */}
      {filters.map((filter) => (
        <FilterSection
          key={filter.slug}
          filter={filter}
          searchParams={searchParams}
          onFilterChange={handleFilterChange}
        />
      ))}

      {filters.length === 0 && brands.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Selecciona una categoría para ver los filtros disponibles</p>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-background/70 backdrop-blur-md z-40 lg:hidden cursor-default"
          onClick={onMobileClose}
          onKeyDown={(e) => e.key === "Escape" && onMobileClose?.()}
          aria-label="Cerrar filtros"
        />
      )}

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-80 bg-card border-r border-border/60 rounded-r-2xl flex flex-col lg:hidden",
            "transform transition-transform duration-300",
            isMobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <IconFilter className="size-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Filtros</h2>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="xs" onClick={clearAllFilters} className="text-muted-foreground">
                  Limpiar
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={onMobileClose}>
                <IconX className="size-4" />
              </Button>
            </div>
          </div>

          {/* Filters list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">{filterContent}</div>
        </aside>
      )}

      {/* Desktop Sidebar Content */}
      <div className={cn("hidden lg:flex flex-col h-full", className)}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <IconFilter className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Filtros</h2>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="xs" onClick={clearAllFilters} className="text-muted-foreground text-xs">
              Limpiar
            </Button>
          )}
        </div>

        {/* Filters list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">{filterContent}</div>
      </div>
    </>
  );
}

// ── Brand Filter ──────────────────────────────────────────────────────

interface BrandFilterProps {
  brands: BrandWithCount[];
  activeBrand: string | null;
  onChange: (brandSlug: string) => void;
}

function BrandFilter({ brands, activeBrand, onChange }: BrandFilterProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const visibleBrands = showAll ? brands : brands.slice(0, 6);
  const hasMore = brands.length > 6;

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors",
          "hover:bg-secondary/30",
          activeBrand && "bg-primary/5",
        )}
      >
        <span className={cn("text-sm font-medium", activeBrand ? "text-primary" : "text-foreground")}>Marca</span>
        {isExpanded ? (
          <IconChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <IconChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-1.5">
          {visibleBrands.map((brand) => {
            const isActive = activeBrand === brand.slug;
            return (
              <label
                key={brand.slug}
                className={cn(
                  "flex items-center gap-2 cursor-pointer group px-2 py-1.5 rounded-lg transition-colors",
                  isActive ? "bg-primary/10" : "hover:bg-secondary/30",
                )}
              >
                <input
                  type="radio"
                  name="brand"
                  checked={isActive}
                  onChange={() => onChange(brand.slug)}
                  className="size-4 border-border text-primary focus:ring-primary focus:ring-offset-0"
                />
                <span
                  className={cn(
                    "text-sm flex-1 truncate",
                    isActive ? "text-primary font-medium" : "text-secondary-foreground group-hover:text-foreground",
                  )}
                  title={brand.name}
                >
                  {brand.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{brand.count}</span>
              </label>
            );
          })}

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-primary hover:text-primary/80 font-medium mt-1"
            >
              {showAll ? "Ver menos" : `Ver ${brands.length - 6} más`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Spec Filter Section ───────────────────────────────────────────────

interface FilterSectionProps {
  filter: CategoryFilter;
  searchParams: URLSearchParams;
  onFilterChange: (filterSlug: string, value: string | null, isRange?: { type: "min" | "max" }) => void;
}

function FilterSection({ filter, searchParams, onFilterChange }: FilterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getActiveValues = () => {
    if (filter.type === "range") {
      return {
        min: searchParams.get(`specs[${filter.slug}][min]`) || "",
        max: searchParams.get(`specs[${filter.slug}][max]`) || "",
      };
    }
    return searchParams.getAll(`specs[${filter.slug}]`);
  };

  const activeValues = getActiveValues();
  const hasActiveValue =
    filter.type === "range"
      ? Boolean(
          (activeValues as { min: string; max: string }).min || (activeValues as { min: string; max: string }).max,
        )
      : (activeValues as string[]).length > 0;

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors",
          "hover:bg-secondary/30",
          hasActiveValue && "bg-primary/5",
        )}
      >
        <span className={cn("text-sm font-medium", hasActiveValue ? "text-primary" : "text-foreground")}>
          {filter.name}
          {filter.unit && <span className="text-muted-foreground ml-1">({filter.unit})</span>}
        </span>
        {isExpanded ? (
          <IconChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <IconChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1">
          {filter.type === "range" ? (
            <RangeFilter
              filter={filter}
              values={activeValues as { min: string; max: string }}
              onChange={onFilterChange}
            />
          ) : filter.type === "boolean" ? (
            <BooleanFilter
              filter={filter}
              active={(activeValues as string[]).includes("true")}
              onChange={onFilterChange}
            />
          ) : (
            <SelectFilter filter={filter} activeValues={activeValues as string[]} onChange={onFilterChange} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Individual Filter Components ──────────────────────────────────────

interface RangeFilterProps {
  filter: CategoryFilter;
  values: { min: string; max: string };
  onChange: (filterSlug: string, value: string | null, isRange?: { type: "min" | "max" }) => void;
}

function RangeFilter({ filter, values, onChange }: RangeFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        placeholder={filter.min?.toString() || "Min"}
        value={values.min}
        onChange={(e) => onChange(filter.slug, e.target.value || null, { type: "min" })}
        className="w-full h-8 px-2 text-sm bg-secondary/30 border border-border/60 rounded-md focus:border-primary focus:outline-none"
      />
      <span className="text-muted-foreground text-sm">-</span>
      <input
        type="number"
        placeholder={filter.max?.toString() || "Max"}
        value={values.max}
        onChange={(e) => onChange(filter.slug, e.target.value || null, { type: "max" })}
        className="w-full h-8 px-2 text-sm bg-secondary/30 border border-border/60 rounded-md focus:border-primary focus:outline-none"
      />
    </div>
  );
}

interface BooleanFilterProps {
  filter: CategoryFilter;
  active: boolean;
  onChange: (filterSlug: string, value: string | null) => void;
}

function BooleanFilter({ filter, active, onChange }: BooleanFilterProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={active}
        onChange={(e) => onChange(filter.slug, e.target.checked ? "true" : null)}
        className="size-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
      />
      <span className="text-sm text-secondary-foreground group-hover:text-foreground transition-colors">Sí</span>
    </label>
  );
}

interface SelectFilterProps {
  filter: CategoryFilter;
  activeValues: string[];
  onChange: (filterSlug: string, value: string | null) => void;
}

function SelectFilter({ filter, activeValues, onChange }: SelectFilterProps) {
  const [showAll, setShowAll] = useState(false);
  const options = filter.options || [];
  const visibleOptions = showAll ? options : options.slice(0, 5);
  const hasMore = options.length > 5;

  return (
    <div className="space-y-1.5">
      {visibleOptions.map((option) => {
        const isActive = activeValues.includes(option);
        return (
          <label
            key={option}
            className={cn(
              "flex items-center gap-2 cursor-pointer group px-2 py-1.5 rounded-lg transition-colors",
              isActive ? "bg-primary/10" : "hover:bg-secondary/30",
            )}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={() => onChange(filter.slug, option)}
              className="size-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
            />
            <span
              className={cn(
                "text-sm flex-1 truncate",
                isActive ? "text-primary font-medium" : "text-secondary-foreground group-hover:text-foreground",
              )}
              title={option}
            >
              {option}
            </span>
          </label>
        );
      })}

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-primary hover:text-primary/80 font-medium mt-1"
        >
          {showAll ? "Ver menos" : `Ver ${options.length - 5} más`}
        </button>
      )}
    </div>
  );
}
