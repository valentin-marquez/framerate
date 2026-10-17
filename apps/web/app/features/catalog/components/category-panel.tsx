import { CATEGORY_NAV_LABELS, categoryFromSlug } from "@framerate/contracts";
import { CategoryIcon } from "~/features/category/components/category-icon";
import { SearchField } from "~/features/search/components/search-field";
import { Button } from "~/shared/components/primitives/button";
import type { CatalogData } from "../load-catalog";
import { useFilterParams } from "../use-filter-params";
import { activeFilterCount, FilterPanel } from "./filter-panel";

/** Lo que va en el panel a la derecha del riel compacto, en una categoría: su título, el buscador y los filtros. */
export function CategoryPanel({ data }: { data: CatalogData }) {
  const { params, update } = useFilterParams();
  const count = activeFilterCount(params);
  const id = data.category ? categoryFromSlug(data.category) : undefined;
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-1">
        {id && <CategoryIcon category={id} className="size-5" />}
        <h2 className="truncate font-medium text-foreground text-label-md">{id ? CATEGORY_NAV_LABELS[id] : ""}</h2>
        <span className="ml-auto shrink-0 text-muted-foreground text-paragraph-xs tabular-nums">
          {data.meta.total.toLocaleString("es-CL")}
        </span>
      </div>
      <SearchField withinCategory className="shrink-0" />
      {/* El desvanecido de abajo avisa que hay más campos sin poner una barra de scroll gruesa. */}
      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overflow-x-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%-24px),transparent)]">
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
