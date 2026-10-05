import { IconInfoCircle, IconRosetteDiscount } from "@tabler/icons-react";
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
    priceRange?.max && `${formatCLP(priceRange.min ?? 0)} a ${formatCLP(priceRange.max)}`,
    brandCount > 0 && `${brandCount} ${brandCount === 1 ? "marca" : "marcas"}`,
  ].filter(Boolean);

  return (
    <header className="relative isolate overflow-hidden rounded-3xl" style={{ viewTransitionName: "category-photo" }}>
      <img
        src={getCategoryImage(category)}
        alt=""
        fetchPriority="high"
        className="parallax-y absolute inset-0 -z-10 size-full object-cover opacity-90 grayscale [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_92%)]"
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
      {/* Al buscar mientras se escribe, título y conteo cambian en el lugar: la key los vuelve a montar y entran
          con un deslizamiento corto (transitions.dev, "text states swap" y "number pop-in", sin desenfoque). */}
      <h1 className="font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
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

/**
 * Cabecera de `/cyber`. La nota explica contra qué se compara: sin ella "bajó" no dice nada, y la historia es corta.
 * El evento se nombra con nuestra tipografía; del de cyber.cl sólo se toma el rojo, en un subrayado corto.
 */
export function CyberHeader({ total }: { total: number }) {
  return (
    <header className={cn("space-y-3 pt-2", enterClass())}>
      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium text-sm">
          <span className="text-foreground/70">5 al 7 de octubre</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <IconRosetteDiscount className="size-4" stroke={1.75} />
            {total > 0
              ? `${total.toLocaleString("es-CL")} ${total === 1 ? "baja" : "bajas"} de precio`
              : "Bajas de precio"}
          </span>
        </p>
        <h1 className="font-bold text-3xl text-foreground tracking-tight md:text-5xl">Cyber Monday</h1>
        <span aria-hidden className="block h-1 w-12 rounded-full bg-[#f61c36]" />
        <p className="pt-1 text-pretty text-muted-foreground md:text-lg">
          Productos más baratos que su precio habitual de los últimos días.
        </p>
      </div>
      <p className="flex max-w-2xl gap-1.5 text-muted-foreground text-xs">
        <IconInfoCircle className="mt-px size-3.5 shrink-0" stroke={1.75} />
        <span className="text-pretty">
          El precio habitual es el promedio del mejor precio de cada día anterior. Guardamos esa historia desde el 30 de
          septiembre, así que por ahora abarca pocos días.
        </span>
      </p>
    </header>
  );
}
