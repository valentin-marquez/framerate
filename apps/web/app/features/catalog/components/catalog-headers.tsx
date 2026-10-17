import { CATEGORY_NAV_LABELS, categoryFromSlug } from "@framerate/contracts";
import { enterClass, enterStyle } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { CatalogData } from "../load-catalog";

const count = (n: number, one: string, many: string) => `${n.toLocaleString("es-CL")} ${n === 1 ? one : many}`;

/**
 * Cabecera de una categoría, en dos tonos (Apple Store, "The latest. Take a look at what's new."): el nombre corto del
 * riel y, en gris, cuántos productos hay y desde cuánto. El nombre largo queda en el `<title>`.
 */
export function CategoryHeader({
  category,
  total,
  priceRange,
  brandCount,
}: {
  category: string;
  total: number;
  priceRange: CatalogData["priceRange"];
  brandCount: number;
}) {
  const id = categoryFromSlug(category);
  const stats = [
    brandCount > 0 && count(brandCount, "marca", "marcas"),
    total > 1 && priceRange?.max && `hasta ${formatCLP(priceRange.max)}`,
  ].filter(Boolean);

  return (
    <header className="space-y-3 pt-2 md:pt-6">
      <h1 className={cn("text-pretty text-title-h4 md:text-title-h2", enterClass())}>
        <span className="text-foreground">{id ? CATEGORY_NAV_LABELS[id] : category}</span>{" "}
        <span className="text-muted-foreground">
          {total > 0
            ? `${count(total, "producto", "productos")}${priceRange?.min ? ` desde ${formatCLP(priceRange.min)}` : ""}`
            : "Sin productos con stock por ahora"}
        </span>
      </h1>
      {stats.length > 0 && (
        <ul
          className={cn("flex flex-wrap gap-x-4 gap-y-1 text-label-sm text-muted-foreground", enterClass())}
          style={enterStyle(90)}
        >
          {stats.map((s) => (
            <li key={String(s)}>{s}</li>
          ))}
        </ul>
      )}
    </header>
  );
}

/** Cabecera de `/buscar`: la consulta (el campo vive en el navbar) y cuántos productos la cumplen. */
export function SearchHeader({ total, search }: { total: number; search: string | null }) {
  return (
    <header className={cn("space-y-1 pt-2", enterClass())}>
      {/* Al buscar mientras se escribe, título y conteo cambian en el lugar: la key los vuelve a montar y entran
          con un deslizamiento corto (transitions.dev, "text states swap" y "number pop-in", sin desenfoque). */}
      <h1 className="text-title-h4 text-foreground md:text-title-h3">
        <span key={search ?? ""} className="inline-block slide-in-from-bottom-1 fade-in-0 animate-in duration-fast">
          {search ? `“${search}”` : "Todo el catálogo"}
        </span>
      </h1>
      <p className="text-muted-foreground text-sm">
        <span key={total} className="inline-block slide-in-from-bottom-1 fade-in-0 animate-in duration-fast">
          {total > 0
            ? `${total.toLocaleString("es-CL")} ${total === 1 ? "producto" : "productos"} de las tiendas de Chile`
            : search
              ? "No encontramos productos con esa búsqueda"
              : "Compara precios de hardware en Chile"}
        </span>
      </p>
    </header>
  );
}
