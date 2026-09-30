import {
  IconBuildingStore,
  IconChartLine,
  IconClockHour4,
  IconCpu,
  IconListCheck,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { getCategoryConfig } from "~/features/category/utils/categories";
import type { Product } from "~/features/product/services/products";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { getImageUrl } from "~/shared/utils/images";
import type { HomeData } from "../types";

type Category = HomeData["categories"][number];

/** Hasta 3 imágenes de productos de una categoría, para que las fichas de categoría se vean con contenido real. */
export function thumbsFor(slug: string, rows: HomeData["rows"]): Product[] {
  return (rows.find((r) => r.key === slug)?.products ?? []).filter((p) => p.image_url).slice(0, 3);
}

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

/** Miniatura de categoría: la foto de un producto real o, si aún no hay, un icono neutro. */
function CategoryThumb({ product, className }: { product?: Product; className?: string }) {
  return product?.image_url ? (
    <img src={getImageUrl(product.image_url)} alt="" loading="lazy" className={cn("object-contain", className)} />
  ) : (
    <IconCpu className="size-5 text-muted-foreground/60" stroke={1.5} />
  );
}

function Thumbs({ products, className }: { products: Product[]; className?: string }) {
  if (products.length === 0) return null;
  return (
    <div className={cn("flex -space-x-3", className)} aria-hidden>
      {products.map((p) => (
        <img
          key={p.id}
          src={getImageUrl(p.image_url ?? "")}
          alt=""
          loading="lazy"
          className="size-14 rounded-xl border border-border/40 bg-background object-contain p-1"
        />
      ))}
    </div>
  );
}

/** Tres promesas del sitio en una franja (patrón SoloTodo: value props pegadas al hero). */
export function ValueProps({ storeCount, className }: { storeCount: number; className?: string }) {
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
    <ul className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex items-start gap-3 rounded-2xl border border-border/40 bg-card p-4">
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

/** Mosaico asimétrico: la primera categoría ocupa 2x2 (patrón SoloTodo "categorías que la rompen"). */
export function CategoryMosaic({ categories, rows }: Pick<HomeData, "categories" | "rows">) {
  if (categories.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-foreground text-lg tracking-tight md:text-xl">Explora por categoría</h2>
      <div className="grid auto-rows-[6rem] grid-cols-2 gap-3 md:grid-cols-4">
        {withProductsFirst(categories).map((category, i) => {
          const config = getCategoryConfig(category.slug);
          const big = i === 0 && !isEmpty(category);
          return (
            <Link
              key={category.id}
              to={`/categoria/${config.urlSlug}`}
              prefetch="intent"
              className={cn(
                "group flex flex-col justify-between rounded-2xl border border-border/40 bg-card p-4 transition-colors hover:border-primary/40",
                big && "col-span-2 row-span-2 p-6",
                isEmpty(category) && "opacity-60 hover:opacity-100",
              )}
            >
              <div>
                <p className={cn("font-semibold text-foreground", big ? "text-2xl" : "text-sm")}>{config.label}</p>
                <p className="text-muted-foreground text-xs">{countLabel(category)}</p>
              </div>
              {big && <Thumbs products={thumbsFor(category.slug, rows)} />}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Cuadrícula uniforme de categorías arriba de todo (patrón PriceSpy: navegar antes que ver productos). */
export function CategoryGrid({ categories, rows }: Pick<HomeData, "categories" | "rows">) {
  if (categories.length === 0) return null;
  return (
    <section aria-label="Categorías" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {withProductsFirst(categories).map((category) => {
        const config = getCategoryConfig(category.slug);
        return (
          <Link
            key={category.id}
            to={`/categoria/${config.urlSlug}`}
            prefetch="intent"
            className={cn(
              "group flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3 transition-colors hover:border-primary/40",
              isEmpty(category) && "opacity-60 hover:opacity-100",
            )}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary/50">
              <CategoryThumb product={thumbsFor(category.slug, rows)[0]} className="size-10" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground text-sm group-hover:text-primary">
                {config.label}
              </span>
              <span className="block text-muted-foreground text-xs">{countLabel(category)}</span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}

/** Círculos de categoría en una fila horizontal (patrón idealo "Tendencias actuales"). */
export function CategoryCircles({ categories, rows }: Pick<HomeData, "categories" | "rows">) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Categorías" className="scrollbar-hide -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-5 md:w-full md:flex-wrap md:justify-center">
        {withProductsFirst(categories).map((category) => {
          const config = getCategoryConfig(category.slug);
          return (
            <li key={category.id} className={cn(isEmpty(category) && "opacity-60")}>
              <Link
                to={`/categoria/${config.urlSlug}`}
                prefetch="intent"
                className="group flex w-20 flex-col items-center gap-2"
              >
                <span className="flex size-16 items-center justify-center rounded-full border border-border/40 bg-card transition-colors group-hover:border-primary/50">
                  <CategoryThumb product={thumbsFor(category.slug, rows)[0]} className="size-11" />
                </span>
                <span className="text-center text-foreground text-xs leading-tight group-hover:text-primary">
                  {config.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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

export function StatsRow({ productCount, storeCount }: { productCount: number; storeCount: number }) {
  const stats = [
    { icon: IconListCheck, text: `${productCount.toLocaleString("es-CL")} productos` },
    { icon: IconBuildingStore, text: `${storeCount} ${storeCount === 1 ? "tienda" : "tiendas"}` },
    { icon: IconClockHour4, text: "Precios al día" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground text-sm">
      {stats.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-1.5">
          <Icon className="size-4 text-primary" />
          {text}
        </li>
      ))}
    </ul>
  );
}

/** Bloque de confianza al final (patrón idealo: explicar por qué se puede confiar en los precios). */
export function TrustBlock() {
  const points = [
    {
      title: "Precios de tiendas reales",
      text: "Leemos el precio y el stock directamente del sitio de cada tienda; no los editamos.",
    },
    {
      title: "Sin letra chica",
      text: "Mostramos precio transferencia y precio con tarjeta por separado, con enlace directo a la tienda.",
    },
    { title: "Historial", text: "Cada cambio de precio queda registrado para que sepas si es una oferta de verdad." },
  ];
  return (
    <section className="rounded-3xl border border-border/40 bg-card/50 p-6 md:p-8">
      <div className="mb-5 flex items-center gap-2">
        <IconShieldCheck className="size-5 text-primary" />
        <h2 className="font-semibold text-foreground text-xl tracking-tight">Por qué confiar en Framerate</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {points.map((p) => (
          <div key={p.title} className="space-y-1">
            <h3 className="font-medium text-foreground text-sm">{p.title}</h3>
            <p className="text-muted-foreground text-sm">{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
