import { IconBuildingStore, IconChartLine, IconListCheck } from "@tabler/icons-react";
import { Link } from "react-router";
import { getCategoryConfig, getCategoryImage } from "~/features/category/utils/categories";
import { StoreLogo } from "~/shared/components/store-logo";
import { enterClass, enterStyle } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";
import type { HomeData } from "../types";

type Category = HomeData["categories"][number];

/** Las categorías con productos primero; el orden original se conserva dentro de cada grupo. */
const withProductsFirst = (categories: Category[]) =>
  [...categories].sort((a, b) => Number((b.product_count ?? 0) > 0) - Number((a.product_count ?? 0) > 0));

const isEmpty = (category: Category) => !category.product_count;

const countLabel = (category: Category) =>
  isEmpty(category)
    ? "Próximamente"
    : category.product_count === 1
      ? "1 producto"
      : `${category.product_count} productos`;

/** Tres promesas del sitio en una franja pegada al hero. Entran en cascada justo después del buscador. */
export function ValueProps({ storeCount }: { storeCount: number }) {
  const items = [
    {
      icon: IconBuildingStore,
      title:
        storeCount === 1
          ? "1 tienda comparada"
          : storeCount > 1
            ? `${storeCount} tiendas comparadas`
            : "Tiendas chilenas",
      text: "Precio y stock de cada tienda en un solo lugar",
    },
    { icon: IconChartLine, title: "Historial de precios", text: "Mira cuánto costó antes de comprar" },
    { icon: IconListCheck, title: "Arma tu cotización", text: "Junta tus componentes y compara el total" },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {items.map(({ icon: Icon, title, text }, i) => (
        <li
          key={title}
          className={cn("flex items-start gap-3 rounded-2xl border border-border/40 bg-card p-4", enterClass())}
          style={enterStyle(260 + i * 90)}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm">{title}</p>
            <p className="text-muted-foreground text-xs">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const MD_SPAN = { 1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4" } as const;

/** Mosaico asimétrico de fotos: la primera categoría con productos ocupa 2x2. Las vacías se ven desaturadas. */
export function CategoryMosaic({ categories }: Pick<HomeData, "categories">) {
  if (categories.length === 0) return null;
  const sorted = withProductsFirst(categories);
  // El último tile rellena lo que falte de la fila para que la grilla (2 columnas en móvil, 4 en escritorio) no deje huecos.
  const cellsBefore = (isEmpty(sorted[0]) ? 1 : 4) + Math.max(sorted.length - 2, 0);
  const lastMdSpan = MD_SPAN[(cellsBefore % 4 === 0 ? 4 : 4 - (cellsBefore % 4)) as 1 | 2 | 3 | 4];
  const lastSmSpan = cellsBefore % 2 === 0 ? "col-span-2" : "";
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-foreground text-lg tracking-tight md:text-xl">Explora por categoría</h2>
      <div className="grid auto-rows-[7.5rem] grid-cols-2 gap-3 md:grid-cols-4 md:auto-rows-[8.5rem]">
        {sorted.map((category, i) => {
          const config = getCategoryConfig(category.slug);
          const big = i === 0 && !isEmpty(category);
          const last = i === sorted.length - 1 && sorted.length > 1;
          return (
            <Link
              key={category.id}
              to={`/categoria/${config.urlSlug}`}
              prefetch="intent"
              className={cn(
                "group relative flex h-full flex-col justify-end overflow-hidden rounded-2xl bg-secondary p-4",
                big && "col-span-2 row-span-2",
                last && [lastSmSpan, lastMdSpan],
              )}
            >
              <img
                src={getCategoryImage(category.slug)}
                alt=""
                loading="lazy"
                className={cn(
                  "absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105",
                  isEmpty(category) && "grayscale",
                )}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
              <div className="relative text-white">
                <p
                  className={cn("font-semibold tracking-tight", big ? "text-2xl md:text-3xl" : "text-sm md:text-base")}
                >
                  {config.label}
                </p>
                <p className="text-white/70 text-xs">{countLabel(category)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Tiendas que se comparan: da confianza y muestra el alcance real del catálogo. */
export function StoresStrip({ stores }: { stores: HomeData["stores"] }) {
  if (stores.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-foreground text-lg tracking-tight md:text-xl">Tiendas que comparamos</h2>
      <ul className="flex flex-wrap gap-3">
        {stores.map((store) => (
          <li key={store.id}>
            <Link
              to={`/tiendas/${store.slug}`}
              prefetch="intent"
              className="flex items-center gap-2.5 rounded-2xl border border-border/40 bg-card py-2 pr-4 pl-2 transition-colors hover:border-primary/40"
            >
              <StoreLogo store={store} className="size-9" />
              <span className="font-medium text-foreground text-sm">{store.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
