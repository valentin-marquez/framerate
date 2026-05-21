import { IconPackageOff } from "@tabler/icons-react";
import { ProductRow } from "~/features/home/components/product-row";
import type { StoreProductCategory } from "../services/stores";

interface StoreProductsSectionProps {
  categories: StoreProductCategory[];
  /** Total de productos distintos que la tienda tiene listados. */
  total: number;
}

/**
 * Productos de la tienda: un carrusel por categoría (reutiliza `ProductRow`,
 * igual que el home). El precio de las cards es el mejor del mercado; "Ver
 * todos" lleva a la categoría del catálogo.
 */
export function StoreProductsSection({ categories, total }: StoreProductsSectionProps) {
  if (categories.length === 0) {
    return (
      <section
        aria-label="Productos de la tienda"
        className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 bg-card p-10 text-center"
      >
        <IconPackageOff className="size-8 text-muted-foreground/50" />
        <p className="font-medium text-foreground text-sm">Sin productos listados</p>
        <p className="max-w-sm text-muted-foreground text-xs">
          Todavía no registramos productos de esta tienda en el catálogo.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Productos de la tienda" className="space-y-6">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold text-foreground text-xl tracking-tight">Productos</h2>
        <span className="text-muted-foreground text-sm">
          {total} {total === 1 ? "producto" : "productos"} · {categories.length}{" "}
          {categories.length === 1 ? "categoría" : "categorías"}
        </span>
      </div>

      <div className="space-y-8">
        {categories.map((category, index) => (
          <ProductRow
            key={category.slug}
            title={category.name}
            href={`/categoria/${category.slug}`}
            products={category.products}
            priority={index === 0}
          />
        ))}
      </div>
    </section>
  );
}
