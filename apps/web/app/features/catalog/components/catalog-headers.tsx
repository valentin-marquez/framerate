import { categoryLabel, getCategoryImage } from "~/features/category/utils/categories";
import { enterClass, enterStyle } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { CatalogData } from "../load-catalog";

/** Cabecera de una categoría: foto con los bordes difuminados y tres datos rápidos. */
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
  const stats = [
    total > 0 && `${total.toLocaleString("es-CL")} ${total === 1 ? "producto" : "productos"}`,
    priceRange?.max && `${formatCLP(priceRange.min ?? 0)} – ${formatCLP(priceRange.max)}`,
    brandCount > 0 && `${brandCount} ${brandCount === 1 ? "marca" : "marcas"}`,
  ].filter(Boolean);

  return (
    <header className="relative isolate overflow-hidden rounded-3xl" style={{ viewTransitionName: "category-photo" }}>
      <img
        src={getCategoryImage(category)}
        alt=""
        fetchPriority="high"
        className="parallax-y absolute inset-0 -z-10 size-full object-cover opacity-90 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_92%)]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/60 to-transparent md:via-background/40" />
      <div className="flex min-h-56 flex-col justify-end gap-3 p-6 pt-24 md:min-h-72 md:p-10 md:pt-32">
        <h1 className={cn("font-semibold text-3xl text-foreground tracking-tight md:text-5xl", enterClass())}>
          {categoryLabel(category)}
        </h1>
        <ul
          className={cn("flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm", enterClass())}
          style={enterStyle(90)}
        >
          {stats.map((s) => (
            <li key={String(s)}>{s}</li>
          ))}
        </ul>
      </div>
    </header>
  );
}

/** Cabecera de `/buscar`: la consulta (el campo vive en el navbar) y cuántos productos la cumplen. */
export function SearchHeader({ total, search }: { total: number; search: string | null }) {
  return (
    <header className={cn("space-y-1 pt-2", enterClass())}>
      <h1 className="font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
        {search ? `“${search}”` : "Todo el catálogo"}
      </h1>
      <p className="text-muted-foreground text-sm">
        {total > 0
          ? `${total.toLocaleString("es-CL")} ${total === 1 ? "producto" : "productos"} de las tiendas de Chile`
          : search
            ? "No encontramos productos con esa búsqueda"
            : "Compara precios de hardware en Chile"}
      </p>
    </header>
  );
}
