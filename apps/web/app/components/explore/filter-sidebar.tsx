"use client";

import { IconChevronDown, IconChevronUp, IconFilter, IconX } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "~/components/primitives/button";
import { cn } from "~/lib/utils";
import type { CategoryFilter } from "~/services/categories";

interface FilterSidebarProps {
  filters: CategoryFilter[];
  className?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function FilterSidebar({ filters, className, isMobileOpen, onMobileClose }: FilterSidebarProps) {
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

      // Reset to page 1 when filters change
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

  const hasActiveFilters = Array.from(searchParams.keys()).some((key) => key.startsWith("specs["));

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden cursor-default"
          onClick={onMobileClose}
          onKeyDown={(e) => e.key === "Escape" && onMobileClose?.()}
          aria-label="Cerrar filtros"
        />
      )}

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-80 bg-card border-r border-border flex flex-col lg:hidden",
            "transform transition-transform duration-300",
            isMobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <IconFilter className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Filtros</h2>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="xs" onClick={clearAllFilters} className="text-muted-foreground">
                  Limpiar
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={onMobileClose}>
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {filters.map((filter) => (
              <FilterSection
                key={filter.slug}
                filter={filter}
                searchParams={searchParams}
                onFilterChange={handleFilterChange}
              />
            ))}

            {filters.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Selecciona una categoría para ver los filtros disponibles</p>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Desktop Sidebar Content - no aside wrapper (parent provides it) */}
      <div className={cn("hidden lg:flex flex-col h-full", className)}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <IconFilter className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Filtros</h2>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="xs" onClick={clearAllFilters} className="text-muted-foreground text-xs">
              Limpiar
            </Button>
          )}
        </div>

        {/* Filters list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {filters.map((filter) => (
            <FilterSection
              key={filter.slug}
              filter={filter}
              searchParams={searchParams}
              onFilterChange={handleFilterChange}
            />
          ))}

          {filters.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Selecciona una categoría para ver los filtros disponibles</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

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
    <div className="border border-border/50 rounded-xl overflow-hidden">
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
          <IconChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <IconChevronDown className="h-4 w-4 text-muted-foreground" />
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
        className="w-full h-8 px-2 text-sm bg-secondary/30 border border-border rounded-lg focus:border-primary focus:outline-none"
      />
      <span className="text-muted-foreground text-sm">-</span>
      <input
        type="number"
        placeholder={filter.max?.toString() || "Max"}
        value={values.max}
        onChange={(e) => onChange(filter.slug, e.target.value || null, { type: "max" })}
        className="w-full h-8 px-2 text-sm bg-secondary/30 border border-border rounded-lg focus:border-primary focus:outline-none"
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
        className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
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
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
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
