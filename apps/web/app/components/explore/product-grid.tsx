"use client";

import { IconLoader2, IconMoodEmpty } from "@tabler/icons-react";
import { ProductCard } from "~/components/product/card-product";
import { cn } from "~/lib/utils";
import type { Product } from "~/services/products";

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  className?: string;
}

export function ProductGrid({ products, isLoading, className }: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <IconMoodEmpty className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron productos</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Intenta ajustar los filtros o buscar con otros términos para encontrar lo que necesitas.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5", className)}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 8} />
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
          "h-9 px-3 text-sm font-medium rounded-lg transition-colors",
          currentPage <= 1 ? "text-muted-foreground cursor-not-allowed" : "text-foreground hover:bg-secondary/50",
        )}
      >
        Anterior
      </button>

      <div className="flex items-center gap-1 mx-2">
        {pages.map((page, idx) =>
          page === "..." ? (
            <span key={`ellipsis-${idx}-${Math.random()}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={cn(
                "h-9 w-9 text-sm font-medium rounded-lg transition-colors",
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
          "h-9 px-3 text-sm font-medium rounded-lg transition-colors",
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

interface ResultsSummaryProps {
  total: number;
  currentPage: number;
  limit: number;
  className?: string;
}

export function ResultsSummary({ total, currentPage, limit, className }: ResultsSummaryProps) {
  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, total);

  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      Mostrando{" "}
      <span className="font-medium text-foreground">
        {start}-{end}
      </span>{" "}
      de <span className="font-medium text-foreground">{total.toLocaleString("es-CL")}</span> productos
    </p>
  );
}
