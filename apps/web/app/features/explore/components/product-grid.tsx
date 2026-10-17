import type { ProductSummary } from "@framerate/contracts";
import { IconHelpCircle, IconMoodEmpty } from "@tabler/icons-react";
import { Fragment } from "react";
import { PRODUCT_GRID_CLASS, ProductGridSkeleton } from "~/features/explore/components/product-grid-skeleton";
import { ProductCard } from "~/features/product/components/product-card";
import { enterClass, enterStyle } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";

interface ProductGridProps {
  products: ProductSummary[];
  isLoading?: boolean;
  className?: string;
  /** Ids en tendencia (ranking server-side) para pintar el badge. */
  trendingIds?: Set<number>;
  /** Con filtros por especificación: qué dato les falta a los "unknown" ("memoria o modelo"). */
  missingSpec?: string;
  /** Texto propio para cuando no hay resultados. */
  empty?: { title: string; text: string };
}

/** Separa los que cumplen el filtro de los que no tienen el dato y podrían cumplirlo (van al final). */
export function UnknownDivider({ missing }: { missing: string }) {
  return (
    <div className="col-span-full flex items-center gap-3 pt-4 pb-1 text-sm">
      <IconHelpCircle className="size-4 shrink-0 text-muted-foreground" stroke={1.75} />
      <p className="text-pretty">
        <span className="font-medium text-foreground">No sabemos si estos cumplen el filtro</span>
        <span className="text-muted-foreground">: les falta el dato de {missing}.</span>
      </p>
      <span aria-hidden className="hidden h-px min-w-8 flex-1 bg-border sm:block" />
    </div>
  );
}

export function ProductGrid({ products, isLoading, className, trendingIds, missingSpec, empty }: ProductGridProps) {
  if (isLoading) {
    return <ProductGridSkeleton count={12} />;
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <IconMoodEmpty className="t-empty-icon size-16 text-muted-foreground mb-4" />
        <h3 className="t-empty-text text-lg font-medium text-foreground mb-2">
          {empty?.title ?? "No se encontraron productos"}
        </h3>
        <p className="t-empty-text text-sm text-muted-foreground max-w-md">
          {empty?.text ?? "Intenta ajustar los filtros o buscar con otros términos para encontrar lo que necesitas."}
        </p>
      </div>
    );
  }

  const firstUnknown = missingSpec ? products.findIndex((p) => p.specMatch === "unknown") : -1;

  return (
    <div className={cn(PRODUCT_GRID_CLASS, className)}>
      {products.map((product, index) => (
        <Fragment key={product.id}>
          {index === firstUnknown && missingSpec && <UnknownDivider missing={missingSpec} />}
          <div
            // Fuera de pantalla no se dibuja ni se recalcula (también mientras el riel cambia el ancho del contenido).
            className={cn(
              "h-full [contain-intrinsic-size:auto_209px] [content-visibility:auto]",
              index < 8 && enterClass(),
            )}
            style={index < 8 ? enterStyle(240 + Math.min(index, 6) * 50) : undefined}
          >
            <ProductCard
              product={product}
              priority={index < 8}
              trending={trendingIds?.has(product.id)}
              className="h-full"
            />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const pages: (number | "...")[] = [];
    const delta = 2;

    // Always show first page
    pages.push(1);

    // Calculate range around current page
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

    // Add ellipsis after first page if needed
    if (rangeStart > 2) {
      pages.push("...");
    }

    // Add pages in range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (rangeEnd < totalPages - 1) {
      pages.push("...");
    }

    // Always show last page if there's more than one page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getVisiblePages();

  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={cn(
          "h-9 px-3 text-sm font-medium rounded-xl transition-[color,background-color,scale] active:scale-[0.95]",
          currentPage <= 1 ? "text-muted-foreground cursor-not-allowed" : "text-foreground hover:bg-secondary/50",
        )}
      >
        Anterior
      </button>

      <span className="mx-2 text-muted-foreground text-sm tabular-nums sm:hidden">
        {currentPage} de {totalPages}
      </span>
      {/* En teléfono los números no caben junto a Anterior y Siguiente. */}
      <div className="mx-2 hidden items-center gap-1 sm:flex">
        {pages.map((page, idx) =>
          page === "..." ? (
            <span
              key={idx < pages.indexOf(currentPage) ? "start-ellipsis" : "end-ellipsis"}
              className="px-2 text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={cn(
                "size-9 text-sm font-medium rounded-xl transition-[color,background-color,scale] active:scale-[0.95]",
                currentPage === page ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary/50",
              )}
            >
              {page}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={cn(
          "h-9 px-3 text-sm font-medium rounded-xl transition-[color,background-color,scale] active:scale-[0.95]",
          currentPage >= totalPages
            ? "text-muted-foreground cursor-not-allowed"
            : "text-foreground hover:bg-secondary/50",
        )}
      >
        Siguiente
      </button>
    </div>
  );
}
