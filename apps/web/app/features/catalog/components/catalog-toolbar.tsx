import { IconChevronDown, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { PAGE_SIZES } from "../load-catalog";
import { useFilterParams } from "../use-filter-params";

const SORT_OPTIONS = [
  { value: "popularity", label: "Más populares" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "name", label: "Nombre" },
  { value: "discount", label: "Mayor descuento" },
] as const;

const select =
  "h-9 appearance-none rounded-full bg-secondary/50 pr-8 pl-3.5 text-foreground text-label-sm outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring";

function Pick({ label, children, ...props }: { label: string } & React.ComponentProps<"select">) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select className={select} {...props}>
        {children}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-3 size-3.5 text-muted-foreground" />
    </label>
  );
}

const arrow =
  "grid size-9 place-items-center rounded-full transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-30";

/**
 * Barra de la lista, sobre las entradas: el orden a la izquierda; cuántas por página, el tramo que se ve y las
 * flechas a la derecha. El paginador completo va al final de la grilla.
 */
export function CatalogToolbar({
  total,
  page,
  totalPages,
  pageSize,
  defaultSort,
  onPageChange,
  lead,
  className,
}: {
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  defaultSort: string;
  onPageChange: (page: number) => void;
  /** Lo que va antes del orden: el botón de filtros en teléfono. */
  lead?: ReactNode;
  className?: string;
}) {
  const { params, update } = useFilterParams();
  const sort = params.get("sort") ?? defaultSort;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {lead}
      <Pick
        label="Ordenar por"
        value={sort}
        onChange={(e) => update({ sort: e.target.value === defaultSort ? null : e.target.value })}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Pick>
      <div className="ml-auto flex items-center gap-3 text-muted-foreground text-paragraph-sm">
        <span className="hidden sm:inline">Por página</span>
        <Pick
          label="Productos por página"
          value={pageSize}
          onChange={(e) => update({ limit: Number(e.target.value) === PAGE_SIZES[0] ? null : e.target.value })}
        >
          {[...PAGE_SIZES]
            .sort((a, b) => a - b)
            .map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
        </Pick>
        <span className="hidden tabular-nums sm:inline">
          {from} a {to} de {total.toLocaleString("es-CL")}
        </span>
        <div className="flex">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className={arrow}
          >
            <IconChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className={arrow}
          >
            <IconChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
