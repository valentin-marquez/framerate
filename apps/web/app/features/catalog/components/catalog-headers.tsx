import { IconSearch, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { CategoryWithCount } from "~/features/category/services/categories";
import { getCategoryConfig, getCategoryImage } from "~/features/category/utils/categories";
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
    priceRange && priceRange.max > 0 && `${formatCLP(priceRange.min)} – ${formatCLP(priceRange.max)}`,
    brandCount > 0 && `${brandCount} ${brandCount === 1 ? "marca" : "marcas"}`,
  ].filter(Boolean);

  return (
    <header className="relative isolate overflow-hidden rounded-3xl">
      <img
        src={getCategoryImage(category)}
        alt=""
        fetchPriority="high"
        className="parallax-y absolute inset-0 -z-10 size-full object-cover opacity-90 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_92%)]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/60 to-transparent md:via-background/40" />
      <div className="flex min-h-56 flex-col justify-end gap-3 p-6 pt-24 md:min-h-72 md:p-10 md:pt-32">
        <h1 className={cn("font-semibold text-3xl text-foreground tracking-tight md:text-5xl", enterClass())}>
          {getCategoryConfig(category).label}
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

/** Buscador y fichas de categoría con foto: la puerta de entrada al catálogo completo. */
export function ExploreHeader({
  total,
  search,
  categories,
}: {
  total: number;
  search: string | null;
  categories: CategoryWithCount[];
}) {
  const [params, setParams] = useSearchParams();
  const [value, setValue] = useState(search ?? "");

  const submit = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next.trim()) nextParams.set("search", next.trim());
    else nextParams.delete("search");
    nextParams.delete("page");
    setParams(nextParams);
  };

  return (
    <header className="flex flex-col gap-6 pt-2">
      <div className={cn("space-y-1", enterClass())}>
        <h1 className="font-semibold text-3xl text-foreground tracking-tight md:text-4xl">Explorar</h1>
        <p className="text-muted-foreground text-sm">
          {total > 0
            ? `${total.toLocaleString("es-CL")} productos de las tiendas de Chile`
            : "Compara precios de hardware en Chile"}
        </p>
      </div>

      <form
        className={cn("relative w-full max-w-2xl", enterClass())}
        style={enterStyle(80)}
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <IconSearch className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="¿Qué componente buscas? Ej: RTX 4070, Ryzen 7"
          aria-label="Buscar productos"
          className="h-12 w-full rounded-2xl border border-border/60 bg-card pr-11 pl-12 text-[15px] text-secondary-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
        {value && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              setValue("");
              submit("");
            }}
            className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconX className="size-4" />
          </button>
        )}
      </form>

      {categories.length > 0 && (
        <nav aria-label="Categorías" className="scrollbar-hide -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex w-max gap-3 md:w-full md:flex-wrap">
            {categories.map((category, i) => {
              const config = getCategoryConfig(category.slug);
              const empty = !category.product_count;
              return (
                <li key={category.id} className={enterClass()} style={enterStyle(160 + Math.min(i, 6) * 50)}>
                  <Link
                    to={`/categoria/${config.urlSlug}`}
                    prefetch="intent"
                    className="group relative flex h-24 w-40 flex-col justify-end overflow-hidden rounded-2xl bg-secondary p-3"
                  >
                    <img
                      src={getCategoryImage(category.slug)}
                      alt=""
                      loading="lazy"
                      className={cn(
                        "absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105",
                        empty && "grayscale",
                      )}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="relative font-medium text-sm text-white leading-tight">{config.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
