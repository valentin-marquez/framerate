import { categoryFromSlug } from "@framerate/contracts";
import { IconArrowLeft } from "@tabler/icons-react";
import { CategoryIcon } from "~/features/category/components/category-icon";
import { categoryLabel } from "~/features/category/utils/categories";
import { Button } from "~/shared/components/primitives/button";
import type { CatalogData } from "../load-catalog";
import { useFilterParams } from "../use-filter-params";
import { activeFilterCount, FilterPanel } from "./filter-panel";

/** Lo que muestra el riel en una categoría, en lugar de la lista de categorías: sus filtros, con la vuelta a la lista. */
export function RailFilters({ data, onBack }: { data: CatalogData; onBack: () => void }) {
  const { params, update } = useFilterParams();
  const count = activeFilterCount(params);
  const id = data.category ? categoryFromSlug(data.category) : undefined;
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 shrink-0 items-center gap-2 rounded-xl px-2.5 text-muted-foreground text-paragraph-sm transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        Categorías
        <kbd className="ml-auto rounded-md border border-border px-1.5 text-[11px]">F</kbd>
      </button>
      <div className="flex shrink-0 items-center gap-2 px-2.5 pt-2 pb-1">
        {id && <CategoryIcon category={id} className="size-5" />}
        <h2 className="truncate text-label-sm">{data.category ? categoryLabel(data.category) : ""}</h2>
        <span className="ml-auto shrink-0 text-muted-foreground text-paragraph-xs tabular-nums">
          {data.meta.total.toLocaleString("es-CL")}
        </span>
      </div>
      {/* El desvanecido de abajo avisa que hay más campos sin poner una barra de scroll gruesa. */}
      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-1 [mask-image:linear-gradient(to_bottom,black_calc(100%-24px),transparent)]">
        <FilterPanel data={data} />
      </div>
      {count > 0 && (
        <div className="shrink-0 border-border/60 border-t pt-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => update({ brand: null, min_price: null, max_price: null, spec: null })}
          >
            Limpiar {count} {count === 1 ? "filtro" : "filtros"}
          </Button>
        </div>
      )}
    </>
  );
}
