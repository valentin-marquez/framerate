import {
  CATEGORY_FACETS,
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  FAMILY_FIELDS,
  facetValueLabel,
  type ProductDetail,
  type ProductVariant,
} from "@framerate/contracts";
import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "react-router";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";

/**
 * La familia del producto (#101): los demás de la misma RTX 5070, la misma DDR5 32 GB a 6000, la misma fuente de
 * 850 W Gold, de cualquier marca. Como el selector "Modelo" de SoloTodo, bajo el título y con la ficha abierta
 * marcada, pero con el precio de cada uno. Con más de los que trae la API, enlaza a la categoría filtrada.
 */
export function ProductFamily({ product, className }: { product: ProductDetail; className?: string }) {
  if (product.variants.length === 0) return null;
  const family = familyOf(product);
  const rows: (ProductVariant & { current?: boolean })[] = [
    { slug: product.slug, name: product.name, imageUrl: product.imageUrl, bestPrice: product.bestPrice, current: true },
    ...product.variants,
  ];
  const more = product.variantsTotal - product.variants.length;
  return (
    <section
      aria-label={`Otras ${family.label}`}
      className={cn("rounded-2xl border border-border bg-card p-2", className)}
    >
      <p className="px-3 pt-1.5 pb-1 text-muted-foreground text-xs">
        {family.label ? `Todas las ${family.label}` : "Versiones"}
      </p>
      <ul>
        {rows.map((v) => {
          const row = (
            <>
              <span
                aria-hidden
                className={cn(
                  "size-4 shrink-0 rounded-full border-2",
                  v.current
                    ? "border-foreground bg-foreground [box-shadow:inset_0_0_0_2px_var(--card)]"
                    : "border-border",
                )}
              />
              <span className={cn("min-w-0 flex-1 truncate text-sm", v.current ? "font-semibold" : "font-medium")}>
                {v.name}
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm tabular-nums",
                  v.bestPrice === null ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {v.bestPrice === null ? "Sin stock" : formatCLP(v.bestPrice)}
              </span>
            </>
          );
          return (
            <li key={v.slug}>
              {v.current ? (
                <div aria-current="page" className="flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2">
                  {row}
                </div>
              ) : (
                <Link
                  to={`/producto/${v.slug}`}
                  viewTransition
                  className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-secondary/60"
                >
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {more > 0 && family.href && (
        <Link
          to={family.href}
          className="flex items-center gap-1 px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          {more === 1 ? "Ver la que falta" : `Ver las ${more} que faltan`} en {CATEGORY_LABELS[product.category]}
          <IconChevronRight className="size-4" />
        </Link>
      )}
    </section>
  );
}

/** Título de la familia desde las facetas ("RTX 5070 12 GB") y el filtro de la categoría que la lista entera. */
function familyOf(product: ProductDetail): { label: string; href: string | null } {
  const fields = FAMILY_FIELDS[product.category] ?? [];
  const facets = CATEGORY_FACETS[product.category];
  const parts: string[] = [];
  const specs: string[] = [];
  for (const field of fields) {
    const value = product.attributes[field];
    if (value === undefined) continue;
    const facet = facets.find((f) => f.key === field);
    parts.push(facet ? facetValueLabel(facet, String(value)) : String(value));
    if (facet) specs.push(`spec=${encodeURIComponent(`${field}:${value}`)}`);
  }
  return {
    label: parts.join(" "),
    // Si algún campo de la familia no es faceta, no hay filtro que la muestre completa.
    href:
      specs.length === fields.length && specs.length > 0
        ? `/categoria/${CATEGORY_SLUGS[product.category]}?${specs.join("&")}`
        : null,
  };
}
