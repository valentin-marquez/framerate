import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "~/shared/components/primitives/button";
import { Dialog, DialogContent, DialogTitle } from "~/shared/components/primitives/dialog";
import type { CatalogData } from "../load-catalog";
import { useFilterParams } from "../use-filter-params";
import { activeFilterCount, FilterPanel } from "./filter-panel";

/** En teléfono el riel no existe: el botón abre una hoja desde abajo con el mismo panel, desplegable en el sitio. */
export function FiltersButton({ data }: { data: CatalogData }) {
  const [open, setOpen] = useState(false);
  const { params, update } = useFilterParams();
  const count = activeFilterCount(params);
  return (
    <>
      <Button variant="secondary" className="lg:hidden" onClick={() => setOpen(true)}>
        <IconAdjustmentsHorizontal />
        Filtros{count > 0 && ` (${count})`}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-auto bottom-0 max-h-[85dvh] w-full max-w-none translate-y-0 overflow-hidden rounded-t-3xl rounded-b-none border-x-0 border-b-0 p-0 zoom-in-100 zoom-out-100 slide-in-from-bottom-24 slide-out-to-bottom-24 lg:hidden">
          <DialogTitle className="px-5 pt-5 pb-2">Filtros</DialogTitle>
          {/* El dialog envuelve el contenido en un div sin alto: el scroll lleva su tope y el pie queda siempre a la vista. */}
          <div className="scrollbar-slim max-h-[calc(85dvh-9.5rem)] overflow-y-auto overflow-x-hidden px-3 pt-1">
            <FilterPanel data={data} inline />
          </div>
          <div className="flex gap-2 border-border/60 border-t p-4">
            <Button
              variant="outline"
              className="h-10 flex-1"
              disabled={count === 0}
              onClick={() => update({ brand: null, min_price: null, max_price: null, spec: null })}
            >
              Limpiar
            </Button>
            <Button className="h-10 flex-[2]" onClick={() => setOpen(false)}>
              Ver {data.meta.total.toLocaleString("es-CL")} {data.meta.total === 1 ? "producto" : "productos"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
