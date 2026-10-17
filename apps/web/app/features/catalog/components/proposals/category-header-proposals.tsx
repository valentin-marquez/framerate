import { CATEGORY_NAV_LABELS, categoryFromSlug, type Facet } from "@framerate/contracts";
import { categoryLabel } from "~/features/category/utils/categories";
import { formatCLP } from "~/shared/utils/format";

export interface HeaderProposalProps {
  category: string;
  total: number;
  minPrice: number | null;
  brandCount: number;
  storeCount?: number;
}

const shortLabel = (slug: string) => {
  const c = categoryFromSlug(slug);
  return c ? CATEGORY_NAV_LABELS[c] : categoryLabel(slug);
};
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-CL")} ${n === 1 ? one : many}`;

/** A (Apple Store, "The latest. Take a look at what's new."): sin foto; la segunda mitad del título es un dato vivo. */
export function HeaderTwoTone({ category, total, minPrice, brandCount, storeCount }: HeaderProposalProps) {
  return (
    <header className="space-y-3 pt-6 pb-2 md:pt-10">
      <h1 className="text-pretty text-title-h4 md:text-title-h2">
        <span className="text-foreground">{shortLabel(category)}.</span>{" "}
        <span className="text-muted-foreground">
          {total > 0
            ? `${plural(total, "producto", "productos")}${minPrice ? ` desde ${formatCLP(minPrice)}` : ""}.`
            : "Sin productos con stock por ahora."}
        </span>
      </h1>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-label-sm text-muted-foreground">
        {brandCount > 0 && <li>{plural(brandCount, "marca", "marcas")}</li>}
        {storeCount ? <li>{plural(storeCount, "tienda", "tiendas")} con stock hoy</li> : null}
      </ul>
    </header>
  );
}

// Ejemplos para comparar; si se elige B, cada categoría necesita la suya.
const TAGLINES: Record<string, string> = {
  "tarjetas-de-video": "Lo que mueve tus juegos.",
  ssd: "Donde viven tus juegos y tus archivos.",
};

/** B (Apple Store, "Store" con la frase a la derecha): título corto y grande, frase y datos alineados a la derecha. */
export function HeaderTagline({ category, total, minPrice, brandCount }: HeaderProposalProps) {
  return (
    <header className="grid gap-4 pt-6 pb-2 md:grid-cols-[1fr_auto] md:items-end md:pt-12">
      <h1 className="text-title-h3 text-foreground md:text-title-h1">{shortLabel(category)}</h1>
      <div className="space-y-1 md:max-w-xs md:pb-2 md:text-right">
        <p className="text-foreground text-title-h6">{TAGLINES[category] ?? categoryLabel(category)}</p>
        <p className="text-muted-foreground text-paragraph-sm">
          {[
            total > 0 && plural(total, "producto", "productos"),
            minPrice && `desde ${formatCLP(minPrice)}`,
            brandCount > 0 && plural(brandCount, "marca", "marcas"),
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
      </div>
    </header>
  );
}

export interface QuickFilter {
  label: string;
  count: number;
  imageUrl: string | null;
}

/** C (IKEA, chips de subcategoría con miniatura): la foto de stock se cambia por fotos de productos reales. */
export function HeaderQuickFilters({
  category,
  total,
  minPrice,
  facet,
  filters,
}: HeaderProposalProps & { facet: Facet["label"]; filters: QuickFilter[] }) {
  return (
    <header className="space-y-4 pt-6 pb-2 md:pt-10">
      <div className="space-y-1">
        <h1 className="text-title-h4 text-foreground md:text-title-h3">{shortLabel(category)}</h1>
        <p className="text-muted-foreground text-paragraph-sm">
          {plural(total, "producto", "productos")}
          {minPrice ? ` desde ${formatCLP(minPrice)}` : ""}
        </p>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2" aria-label={facet}>
          {filters.map((f) => (
            <li key={f.label}>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3.5 pl-1 text-label-sm text-foreground transition-colors hover:bg-accent"
              >
                <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {f.imageUrl && <img src={f.imageUrl} alt="" className="size-full object-contain p-0.5" />}
                </span>
                {f.label}
                <span className="text-muted-foreground tabular-nums">{f.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
